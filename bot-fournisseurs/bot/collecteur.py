"""Parcours de Facebook et récolte des vendeurs de matériaux.

Deux fils de travail, séparés à dessein :

  1. **Le navigateur** ne fait que ce qui exige Facebook : défiler le fil,
     déplier les « Voir plus » sur place, lire le texte et l'adresse des photos,
     capturer la publication. Il avance à allure humaine.
  2. **L'atelier** (quelques fils parallèles) fait tout le reste : télécharger
     les photos depuis le CDN, faire relire par le modèle, apparier au
     référentiel, ranger dans le bon prospect. Rien de tout ça ne touche
     facebook.com.

Pourquoi cette séparation : une relecture par le modèle prend ~40 secondes.
L'enchaîner dans le fil du navigateur multipliait la durée d'une collecte par
dix — sans pour autant ménager Facebook, puisque ces attentes ne le concernent
pas.

Trois genres de source, là où le bot Fonenako n'en avait que deux :
`groupe`, `page`, et **`recherche`** — la recherche de publications par
mot-clé, qui va chercher les dépôts hors des groupes déjà connus. C'est elle
qui fait grossir la liste toute seule.
"""
from __future__ import annotations

import hashlib
import json
import queue
import random
import re
import shutil
import sqlite3
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

import requests
from playwright.sync_api import sync_playwright

from . import analyse_llm, base, extraction, fusion, referentiel
from .config import DOSSIER_PROSPECTS, PROFIL_NAVIGATEUR, charger

# Mots qui font d'une publication un candidat. Large exprès : le tri fin se
# fait à l'appariement, sur le texte entier.
MOTS_MATERIAUX = (
    "parpaing", "parpin", "biriky", "brique", "hourdis", "entrevous", "agglo",
    "bloc", "sable", "fasika", "gravillon", "gravier", "vato", "moellon",
    "concasse", "remblai", "laterite", "tany", "ciment", "simenitra", "chaux",
    "sokay", "platre", "tole", "fanitso", "tuile", "tafo", "fibrociment",
    "fer a beton", "fer 8", "fer 10", "fer 12", "treillis", "fil recuit", "vy",
    "planche", "chevron", "madrier", "latte", "contreplaque", "hazo", "rondin",
    "bambou", "eucalyptus", "poutrelle", "bordure", "buse", "pave", "claustra",
    "btc", "adobe", "beton", "materiaux", "depot", "briqueterie", "carriere",
    "scierie", "livraison", "amidy", "mivarotra", "vidiny",
)

# Mots qui trahissent une DEMANDE et non une offre. Un acheteur publié comme
# fournisseur est la faute la plus visible du lot : on l'écarte dès le fil.
MOTS_DEMANDE = ("mila ", "mila fasika", "je cherche", "recherche ", "qui vend",
                "iza no", "besoin de", "mba mila", "cherche fournisseur",
                "avez-vous", "urgent besoin")

# Repérage d'une publication dans le fil.
#
# ⚠ Vérifié sur le vrai Facebook le 22/08/2026 : `div[role="article"]` ne
# désigne PLUS une publication, seulement les COMMENTAIRES. Le marqueur qui
# tient aujourd'hui est `aria-posinset` (rang dans le fil), doublé de
# `div[role="feed"] > div`. On garde les anciens sélecteurs en repli : le jour
# où Facebook rechange, l'un des trois répondra.
JS_EXTRAIRE_FIL = """
(largeurMin) => {
  const estRacine = (el, sel) => !el.parentElement?.closest(sel);

  let blocs = [...document.querySelectorAll('div[aria-posinset]')]
    .filter(el => estRacine(el, 'div[aria-posinset]'));
  if (!blocs.length) {
    blocs = [...document.querySelectorAll('div[role="feed"] > div')];
  }
  if (!blocs.length) {
    blocs = [...document.querySelectorAll('div[role="article"]')]
      .filter(el => estRacine(el, 'div[role="article"]'));
  }

  const BRUIT = /^(facebook|j'aime|jaime|commenter|partager|répondre|repondre|voir plus|… en voir plus|en voir plus|tout voir|auteur|top fan|membre|admin|modérateur|moderateur)$/i;
  const nettoyer = (t) => (t || '')
    .split('\\n')
    .map(l => l.trim())
    .filter(l => l && !BRUIT.test(l))
    .join('\\n');

  return blocs.map(el => {
    const liens = [...el.querySelectorAll('a[href]')].map(a => a.href);
    const permalien = liens.find(h =>
      /\\/posts\\/|\\/permalink\\/|story_fbid=|multi_permalinks=|\\/videos\\//.test(h)) || '';

    const images = [...el.querySelectorAll('img')]
      .map(i => ({
        url: i.currentSrc || i.src,
        largeur: i.naturalWidth || i.width || 0,
        hauteur: i.naturalHeight || i.height || 0,
      }))
      .filter(o => o.url && o.url.includes('scontent') && o.largeur >= largeurMin);

    const message = el.querySelector(
      '[data-ad-preview="message"], [data-ad-comet-preview="message"]');
    const texte = nettoyer(message ? message.innerText : el.innerText);

    const heure = el.querySelector(
      'a[href*="/posts/"] span, a[href*="permalink"] span, abbr')?.innerText || '';

    // L'auteur ET son adresse : c'est elle qui regroupe les publications d'un
    // même dépôt quand le numéro de téléphone manque encore.
    const enTete = el.querySelector('h2 a, h3 a, h4 a, strong a');
    const auteur = ((enTete?.innerText) ||
      el.querySelector('h2 span, h3 span')?.innerText || '').split('\\n')[0].trim();
    let auteurUrl = enTete?.href || '';
    if (!auteurUrl) {
      auteurUrl = liens.find(h =>
        /facebook\\.com\\/(profile\\.php\\?id=|[A-Za-z0-9.]+\\/?$)/.test(h)) || '';
    }

    return {
      texte,
      permalien: permalien.split('?')[0],
      images,
      nb_images: images.length,
      heure,
      auteur,
      auteur_url: auteurUrl.split('?ref=')[0],
      posinset: el.getAttribute('aria-posinset') || '',
    };
  }).filter(p => p.texte.length > 10 || p.nb_images > 0);
}
"""

# Déplie les textes coupés à « Voir plus », SANS changer de page. C'est ce qui
# permet de ne plus ouvrir chaque publication dans un onglet — une page chargée
# en moins par publication, pour Facebook comme pour nous. Ici c'est vital : le
# tarif complet d'un dépôt est presque toujours dans la partie coupée.
JS_DEPLIER = """
() => {
  const libelles = ['Voir plus', 'See more', 'En voir plus', 'Afficher plus',
                    'Hijery bebe kokoa'];
  const boutons = [...document.querySelectorAll('div[role="button"], span[role="button"]')]
    .filter(b => libelles.some(l => (b.innerText || '').trim() === l));
  boutons.forEach(b => { try { b.click(); } catch (e) {} });
  return boutons.length;
}
"""


def _pause(bornes) -> None:
    time.sleep(random.uniform(float(bornes[0]), float(bornes[1])))


def empreinte(texte: str, permalien: str) -> str:
    """Identifie une publication. Le permalien prime ; sinon le texte normalisé."""
    if permalien:
        return hashlib.sha1(permalien.encode()).hexdigest()
    reduit = re.sub(r"[^a-z0-9]", "", texte.lower())[:300]
    return hashlib.sha1(reduit.encode()).hexdigest()


def _age_en_jours(heure: str) -> int | None:
    """« 3 h », « Hier », « 2 j », « 5 sem. » -> âge approximatif, sinon None."""
    n = (heure or "").lower().strip()
    if not n:
        return None
    if "hier" in n or "yesterday" in n:
        return 1
    trouve = re.search(r"(\d+)\s*(min|mn|h|j|d|sem|w|mois|mo|an|y)", n)
    if not trouve:
        return None
    valeur, unite = int(trouve.group(1)), trouve.group(2)
    if unite in ("min", "mn", "h"):
        return 0
    if unite in ("j", "d"):
        return valeur
    if unite in ("sem", "w"):
        return valeur * 7
    if unite in ("mois", "mo"):
        return valeur * 30
    return valeur * 365


def semble_vendeur(texte: str, nb_photos: int = 0) -> bool:
    """Pré-filtre du fil, volontairement large.

    Le fil coupe les textes à « En voir plus » : sur 60 caractères, exiger deux
    mots-clés écarterait de bons dépôts. Un seul suffit dès qu'il y a une photo.
    En revanche une demande explicite est écartée tout de suite : la relire
    coûterait un appel au modèle pour rien.
    """
    reduit = referentiel.sans_accents(texte)
    if any(mot in reduit for mot in MOTS_DEMANDE):
        return False
    trouves = sum(1 for mot in MOTS_MATERIAUX if mot in reduit)
    return trouves >= 2 or (trouves >= 1 and nb_photos >= 1)


def _url_fil_de_page(url: str) -> str:
    """Nettoie l'adresse d'une page pour tomber sur son fil de publications.

    Les adresses copiées depuis Facebook traînent du pistage (`?ref=`,
    `?mibextid=`…) qui peut renvoyer sur un onglet « À propos » ou « Avis ».
    Seul `profile.php` garde son paramètre : son `id` EST l'adresse.
    """
    decoupe = urlsplit(url)
    parametres = ""
    if decoupe.path.rstrip("/").endswith("profile.php"):
        parametres = urlencode([(c, v) for c, v in parse_qsl(decoupe.query) if c == "id"])
    return urlunsplit(
        (decoupe.scheme or "https", decoupe.netloc, decoupe.path, parametres, "")
    )


CLE_SESSION = "session_facebook"

CHEMINS_REFUSES = {
    "posts", "photo", "photos", "watch", "reel", "reels", "video", "videos",
    "marketplace", "events", "story.php", "permalink.php", "media", "login",
    "help", "settings", "messages", "notifications", "bookmarks",
    "sharer.php", "hashtag", "stories",
}


def analyser_source(url: str) -> tuple[str, str, str]:
    """Valide une entrée et dit ce que c'est. Renvoie (url, genre, requête).

    Accepte aussi un simple **mot-clé** (« parpaing Antananarivo ») : c'est une
    source de genre `recherche`, qui interroge la recherche de publications de
    Facebook. C'est elle qui trouve les dépôts hors des groupes connus.
    """
    saisie = (url or "").strip()
    if not saisie:
        raise ValueError("Adresse ou mot-clé vide.")

    ressemble_a_une_url = saisie.startswith(("http://", "https://")) or (
        "facebook.com" in saisie.lower() or "fb.com" in saisie.lower()
    )
    if not ressemble_a_une_url:
        if len(saisie) < 3:
            raise ValueError("Mot-clé trop court pour une recherche.")
        return (
            f"https://www.facebook.com/search/posts/?q={quote(saisie)}",
            "recherche",
            saisie,
        )

    if not saisie.startswith(("http://", "https://")):
        saisie = "https://" + saisie

    decoupe = urlsplit(saisie)
    if "facebook.com" not in decoupe.netloc.lower() and "fb.com" not in decoupe.netloc.lower():
        raise ValueError("Ce n'est pas une adresse Facebook.")

    segments = [s for s in decoupe.path.split("/") if s]
    if not segments:
        raise ValueError(
            "Cette adresse pointe sur l'accueil de Facebook, pas sur un groupe "
            "ni une page."
        )
    premier = segments[0].lower()

    if premier == "search":
        requete = dict(parse_qsl(decoupe.query)).get("q", "")
        if not requete:
            raise ValueError("Adresse de recherche sans mot-clé.")
        return (
            f"https://www.facebook.com/search/posts/?q={quote(requete)}",
            "recherche",
            requete,
        )

    if premier == "groups":
        if len(segments) < 2:
            raise ValueError("Adresse de groupe incomplète (il manque son identifiant).")
        return f"https://www.facebook.com/groups/{segments[1]}", "groupe", ""

    if premier == "share":
        raise ValueError(
            "Lien de partage abrégé : ouvrez-le dans Facebook, puis copiez "
            "l'adresse affichée dans la barre du navigateur."
        )

    if premier == "profile.php":
        identifiant = dict(parse_qsl(decoupe.query)).get("id")
        if not identifiant:
            raise ValueError("Adresse de profil sans identifiant.")
        return f"https://www.facebook.com/profile.php?id={identifiant}", "page", ""

    if premier in CHEMINS_REFUSES:
        raise ValueError(
            "Cette adresse désigne une publication, pas une source. Collez "
            "l'adresse du groupe ou de la page elle-même."
        )

    if premier in ("pages", "p") and len(segments) >= 2:
        return f"https://www.facebook.com/{'/'.join(segments[:3])}", "page", ""
    return f"https://www.facebook.com/{segments[0]}", "page", ""


def session_enregistree() -> bool:
    """Y a-t-il une session Facebook en place ?

    On lit directement le fichier de cookies du profil Chromium : ouvrir un
    navigateur pour le savoir coûterait trop cher, l'interface pose la question
    toutes les 2 secondes. Le cookie `c_user` n'existe que si quelqu'un s'est
    réellement connecté — la présence du dossier, elle, ne prouve rien.
    """
    fichier = PROFIL_NAVIGATEUR / "Default" / "Network" / "Cookies"
    if not fichier.exists():
        base.ecrire_etat(CLE_SESSION, "0")
        return False

    # On travaille sur une COPIE : le fichier est verrouillé tant que le
    # navigateur tourne, et l'ouverture en mode URI casse dès que le chemin
    # contient une espace.
    with tempfile.TemporaryDirectory() as dossier:
        copie = Path(dossier) / "cookies.db"
        try:
            shutil.copy2(fichier, copie)
            cx = sqlite3.connect(copie, timeout=2)
            try:
                nombre = cx.execute(
                    "SELECT COUNT(*) FROM cookies "
                    "WHERE host_key LIKE '%facebook.com' AND name = 'c_user'"
                ).fetchone()[0]
            finally:
                cx.close()
            base.ecrire_etat(CLE_SESSION, "1" if nombre else "0")
            return nombre > 0
        except (OSError, sqlite3.Error):
            # Fichier illisible parce qu'un navigateur l'occupe (une collecte
            # est en cours) : on se rabat sur le dernier état vérifié plutôt
            # que d'inventer une réponse dans un sens ou dans l'autre.
            return base.lire_etat(CLE_SESSION) == "1"


def oublier_session() -> None:
    """Efface le profil Chromium — sert à changer de compte Facebook."""
    if PROFIL_NAVIGATEUR.exists():
        shutil.rmtree(PROFIL_NAVIGATEUR, ignore_errors=True)
    base.ecrire_etat(CLE_SESSION, "0")
    base.logguer("Session Facebook effacée.", "avert")


NAVIGATEUR_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _telecharger_photos(images: list[dict], dossier: Path, prospect_id: str,
                        publication_id: str, cfg: dict) -> int:
    """Récupère les photos depuis le CDN, en parallèle et hors navigateur.

    Les adresses `scontent` sont signées et publiques : un simple GET suffit.
    Elles ne passent pas par facebook.com — les charger de front, c'est ce que
    fait déjà un navigateur qui affiche le fil.
    """
    maxi = int(cfg.get("photos_max_par_publication", 12))
    lot = list(enumerate(images[:maxi], start=1))
    if not lot:
        return 0

    session = requests.Session()
    session.headers["User-Agent"] = NAVIGATEUR_UA

    def une(rang_img):
        rang, img = rang_img
        nom = f"photo{rang:02d}.jpg"
        try:
            reponse = session.get(img["url"], timeout=30)
            if not reponse.ok or "image" not in reponse.headers.get("Content-Type", ""):
                return None
            if len(reponse.content) < 8_000:     # une vignette, pas une photo de stock
                return None
            (dossier / nom).write_bytes(reponse.content)
        except requests.RequestException:
            return None
        return rang, nom, img

    de_front = max(2, 12 // max(1, int(cfg.get("travailleurs", 3))))
    gardees = 0
    with ThreadPoolExecutor(max_workers=de_front) as pool:
        for resultat in pool.map(une, lot):
            if not resultat:
                continue
            rang, nom, img = resultat
            base.ajouter_photo(
                prospect_id, publication_id, nom, img["url"],
                img.get("largeur", 0), img.get("hauteur", 0), ordre=rang,
            )
            gardees += 1

    if gardees and not any(p["couverture"] for p in base.photos_a_publier(prospect_id)):
        premieres = base.photos_a_publier(prospect_id)
        if premieres:
            base.definir_couverture(prospect_id, premieres[0]["id"])
    return gardees


class Atelier:
    """File de travail hors navigateur : photos, relecture, appariement, score."""

    def __init__(self, travail, nb_fils: int = 3) -> None:
        self.travail = travail
        self.file: queue.Queue = queue.Queue()
        self.fils: list[threading.Thread] = []
        self.arret = threading.Event()
        self.en_attente = 0
        self._verrou = threading.Lock()
        for _ in range(max(1, nb_fils)):
            fil = threading.Thread(target=self._boucle, daemon=True)
            fil.start()
            self.fils.append(fil)

    def soumettre(self, tache: dict) -> None:
        with self._verrou:
            self.en_attente += 1
        self.file.put(tache)

    def _boucle(self) -> None:
        while not self.arret.is_set():
            try:
                tache = self.file.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                self.travail(tache)
            except Exception as e:
                base.logguer(f"Traitement d'une publication abandonné : {e}", "erreur")
            finally:
                with self._verrou:
                    self.en_attente -= 1
                self.file.task_done()

    def attendre(self) -> None:
        self.file.join()

    def fermer(self) -> None:
        self.arret.set()


class Collecteur:
    """Pilote le navigateur. Une seule instance à la fois (verrou de classe)."""

    _en_cours = threading.Lock()

    def __init__(self) -> None:
        self.config = charger()
        self.stop = threading.Event()
        self.etat = {"actif": False, "source": None, "nouveaux": 0, "revus": 0,
                     "examines": 0, "parcourues": 0, "en_file": 0}
        # Un verrou pour l'écriture des prospects : plusieurs fils d'atelier
        # peuvent tomber sur le MÊME dépôt (il poste dans plusieurs groupes),
        # et deux créations simultanées feraient deux fiches au lieu d'une.
        self._verrou_fusion = threading.Lock()

    # -- Session Facebook ---------------------------------------------------
    def _contexte(self, pw, visible: bool):
        PROFIL_NAVIGATEUR.mkdir(parents=True, exist_ok=True)
        return pw.chromium.launch_persistent_context(
            user_data_dir=str(PROFIL_NAVIGATEUR),
            headless=not visible,
            viewport={"width": 1280, "height": 900},
            locale="fr-FR",
            timezone_id="Indian/Antananarivo",
            args=["--disable-blink-features=AutomationControlled"],
        )

    def ouvrir_connexion(self) -> bool:
        """Ouvre Facebook en grand pour se connecter une bonne fois.

        La fenêtre se referme d'elle-même dès que la connexion est détectée.
        Au bout de 5 minutes sans connexion, on abandonne pour ne pas laisser
        un navigateur ouvert.
        """
        connecte = False
        with sync_playwright() as pw:
            ctx = self._contexte(pw, visible=True)
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            try:
                page.goto("https://www.facebook.com/", wait_until="domcontentloaded")
            except Exception:
                pass
            base.logguer(
                "Fenêtre Facebook ouverte — connectez-vous. "
                "Elle se fermera toute seule une fois la session enregistrée.",
                "info",
            )
            limite = time.time() + 300
            while time.time() < limite:
                if self.stop.is_set():
                    break
                try:
                    if self._verifier_session(ctx):
                        connecte = True
                        break
                    if not ctx.pages:
                        break
                    page.wait_for_timeout(1000)
                except Exception:
                    break
            try:
                ctx.close()
            except Exception:
                pass

        base.ecrire_etat(CLE_SESSION, "1" if connecte else "0")
        base.logguer(
            "Compte Facebook connecté — le bot peut collecter." if connecte
            else "Connexion non aboutie : la session n'a pas été enregistrée.",
            "succes" if connecte else "erreur",
        )
        return connecte

    def _verifier_session(self, ctx) -> bool:
        return "c_user" in {c["name"] for c in ctx.cookies("https://www.facebook.com")}

    def session_active(self) -> bool:
        return session_enregistree()

    # -- Collecte -----------------------------------------------------------
    def collecter(self, sources: list[dict] | None = None,
                  reglages: dict | None = None) -> dict:
        if not Collecteur._en_cours.acquire(blocking=False):
            return {"erreur": "Une collecte est déjà en cours."}
        try:
            return self._collecter(sources, reglages)
        finally:
            self.etat["actif"] = False
            Collecteur._en_cours.release()

    def _collecter(self, sources: list[dict] | None,
                   reglages: dict | None = None) -> dict:
        self.config = charger()
        if reglages:
            self.config.update(reglages)
        cfg = self.config

        # Sans référentiel, aucune offre ne peut être appariée : autant le dire
        # avant d'ouvrir un navigateur pendant vingt minutes pour rien.
        try:
            referentiel.charger()
        except Exception as e:
            base.logguer(
                f"Référentiel Akora indisponible ({e}). "
                "Onglet Réglages → « Synchroniser le référentiel ».",
                "erreur",
            )
            return {"erreur": "referentiel_absent"}

        sources = sources or base.sources(actives_seulement=True, pour_collecte=True)
        if not sources:
            base.logguer(
                "Aucune source active — ajoutez un groupe, une page ou un "
                "mot-clé dans l'onglet Sources.",
                "avert",
            )
            return {"nouveaux": 0, "examines": 0}

        self.stop.clear()
        self.etat.update({"actif": True, "nouveaux": 0, "revus": 0,
                          "examines": 0, "parcourues": 0, "en_file": 0})
        depart = base.maintenant()
        self.atelier = Atelier(self._finir_publication, int(cfg.get("travailleurs", 3)))
        par_genre = {}
        for source in sources:
            par_genre[source.get("genre") or "groupe"] = \
                par_genre.get(source.get("genre") or "groupe", 0) + 1
        base.logguer(
            "Collecte lancée sur " + ", ".join(
                f"{n} {g}(s)" for g, n in sorted(par_genre.items())
            ) + ".",
            "info",
        )

        with sync_playwright() as pw:
            ctx = self._contexte(pw, visible=cfg["navigateur_visible"])
            if not self._verifier_session(ctx):
                ctx.close()
                base.logguer(
                    "Pas de session Facebook. Cliquez « Connecter mon compte Facebook ».",
                    "erreur",
                )
                return {"erreur": "session_absente"}

            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            for rang, source in enumerate(sources):
                if self.stop.is_set():
                    base.logguer("Collecte arrêtée à la demande.", "avert")
                    break
                self.etat["source"] = f"{source['nom']} ({rang + 1}/{len(sources)})"
                try:
                    trouves = self._parcourir_source(ctx, page, source)
                except Exception as e:      # une source qui casse ne tue pas la tournée
                    base.logguer(f"« {source['nom']} » : {e}", "erreur")
                    trouves = 0
                    # « Page crashed » : l'onglet est mort (souvent faute de
                    # mémoire). Sans nouvel onglet, TOUTES les sources suivantes
                    # échoueraient en cascade.
                    if "crash" in str(e).lower() or page.is_closed():
                        try:
                            if not page.is_closed():
                                page.close()
                            page = ctx.new_page()
                            base.logguer(
                                "Onglet relancé après un plantage — la tournée continue.",
                                "avert",
                            )
                        except Exception:
                            base.logguer("Navigateur perdu, collecte interrompue.", "erreur")
                            break
                base.modifier_source(
                    source["id"],
                    derniere_collecte=base.maintenant(),
                    nb_trouves=(source.get("nb_trouves") or 0) + trouves,
                )
                if rang < len(sources) - 1 and not self.stop.is_set():
                    _pause(cfg["pause_entre_sources"])
            ctx.close()

        restant = self.atelier.en_attente
        if restant:
            base.logguer(
                f"Navigation terminée. Reste {restant} publication(s) à lire — "
                "photos et relecture continuent en arrière-plan.",
                "info",
            )
            self.etat["source"] = "traitement en cours"
            self.atelier.attendre()
        self.atelier.fermer()

        self.etat["source"] = None
        base.logguer(
            f"Collecte terminée : {self.etat['nouveaux']} nouveau(x) fournisseur(s), "
            f"{self.etat['revus']} déjà connu(s) enrichi(s), sur "
            f"{self.etat['parcourues']} publication(s) parcourue(s). "
            + _repartition(depart),
            "succes",
        )
        return dict(self.etat)

    def _parcourir_source(self, ctx, page, source: dict) -> int:
        cfg = self.config
        genre = source.get("genre") or "groupe"
        url = source["url"].rstrip("/")

        if genre == "groupe":
            # Tri chronologique : sans ça Facebook sert « les plus pertinents »,
            # c'est-à-dire souvent des publications vues il y a trois semaines.
            if "sorting_setting" not in url:
                url += "?sorting_setting=CHRONOLOGICAL"
        elif genre == "page":
            url = _url_fil_de_page(url)
        # genre == 'recherche' : l'adresse porte déjà la requête, on n'y touche pas.

        libelle = {"groupe": "Groupe", "page": "Page", "recherche": "Recherche"}[genre]
        base.logguer(f"{libelle} « {source['nom']} » — ouverture.", "info")
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(4000)

        vus_dans_ce_tour: set[str] = set()
        retenues = 0
        plafond = int(cfg["posts_max_par_source"])
        steriles = 0        # défilements consécutifs sans rien de neuf

        for _ in range(int(cfg["scrolls_max_par_source"])):
            if self.stop.is_set():
                break

            # Déplier AVANT d'extraire : le fil coupe à « Voir plus », et le
            # tarif complet d'un dépôt est presque toujours dans la partie coupée.
            try:
                page.evaluate(JS_DEPLIER)
                page.wait_for_timeout(900)
            except Exception:
                pass

            try:
                lot = page.evaluate(JS_EXTRAIRE_FIL, int(cfg["largeur_photo_min"]))
            except Exception:
                lot = []

            neufs = 0
            for post in lot:
                cle = empreinte(post["texte"], post["permalien"])
                if cle in vus_dans_ce_tour:
                    continue
                vus_dans_ce_tour.add(cle)
                self.etat["parcourues"] += 1

                if not semble_vendeur(post["texte"], post["nb_images"]):
                    continue
                age = _age_en_jours(post.get("heure", ""))
                if age is not None and age > int(cfg["jours_max"]):
                    continue
                if base.publication_existe(cle):
                    continue

                neufs += 1
                self.etat["examines"] += 1
                if self._inscrire_post(page, post, source, cle):
                    retenues += 1

            steriles = steriles + 1 if neufs == 0 else 0
            if steriles >= 2 or retenues >= plafond:
                break

            page.mouse.wheel(0, random.randint(700, 1400))
            _pause(cfg["pause_entre_scrolls"])

        base.logguer(
            f"« {source['nom']} » : {retenues} publication(s) mise(s) en file.", "info"
        )
        return retenues

    # -- Passe 1 : inscription, dans le fil du navigateur -------------------
    def _inscrire_post(self, page, post: dict, source: dict, cle: str) -> bool:
        """Enregistre une publication repérée et confie la suite à l'atelier.

        Tout ce qui touche Facebook se fait ICI : capture d'écran et rien
        d'autre. Le téléchargement des photos (CDN), la relecture et
        l'appariement partent en parallèle.
        """
        dossier = DOSSIER_PROSPECTS / date.today().isoformat() / hashlib.sha1(
            cle.encode()
        ).hexdigest()[:8]
        dossier.mkdir(parents=True, exist_ok=True)

        if post.get("posinset"):
            try:
                page.locator(
                    f'div[aria-posinset="{post["posinset"]}"]'
                ).first.screenshot(path=str(dossier / "capture.png"), timeout=5000)
            except Exception:
                pass

        (dossier / "publication.txt").write_text(post["texte"], encoding="utf-8")

        publication_id = base.ajouter_publication({
            "empreinte": cle,
            "permalien": post["permalien"],
            "source_id": source["id"],
            "source_nom": source["nom"],
            "auteur": (post.get("auteur") or "").strip(),
            "publie_le": post.get("heure", ""),
            "texte": post["texte"],
            "dossier": str(dossier.relative_to(DOSSIER_PROSPECTS.parent)),
        })
        if not publication_id:
            return False

        self.atelier.soumettre({
            "publication_id": publication_id,
            "dossier": dossier,
            "post": post,
            "source": source,
            "config": dict(self.config),
        })
        return True

    # -- Passe 2 : atelier, hors du navigateur ------------------------------
    def _finir_publication(self, travail: dict) -> None:
        """Lecture, appariement, rangement dans le bon prospect."""
        cfg = travail["config"]
        post, source = travail["post"], travail["source"]
        publication_id, dossier = travail["publication_id"], travail["dossier"]
        texte = post["texte"]

        lecture = extraction.analyser(texte, cfg)

        if cfg.get("llm_actif"):
            try:
                lecture = analyse_llm.fusionner(
                    lecture, analyse_llm.relire(texte, cfg), cfg
                )
            except analyse_llm.LLMIndisponible as e:
                base.logguer(f"Relecture IA indisponible ({e}) — lecture simple.", "avert")

        # Le modèle a tranché : ce n'est pas un vendeur de gros œuvre. On jette
        # la publication plutôt que de polluer la liste d'appels d'Andry.
        if lecture.get("est_fournisseur") is False:
            base.supprimer_publication(publication_id)
            shutil.rmtree(dossier, ignore_errors=True)
            return

        if not lecture["offres"]:
            base.supprimer_publication(publication_id)
            shutil.rmtree(dossier, ignore_errors=True)
            return

        # Liste rouge : ce numéro a demandé à ne plus être contacté.
        if lecture.get("telephone_cle") and base.est_refuse(lecture["telephone_cle"]):
            base.supprimer_publication(publication_id)
            shutil.rmtree(dossier, ignore_errors=True)
            return

        # Un seul fil à la fois ici : deux publications du même dépôt traitées
        # en parallèle créeraient deux fiches au lieu d'une.
        with self._verrou_fusion:
            prospect_id, nouveau = fusion.enregistrer(lecture, post, source, cfg)
            gardees = 0
            for offre in lecture["offres"]:
                if base.ajouter_offre(prospect_id, publication_id, offre):
                    gardees += 1
            base.rattacher_publication(publication_id, prospect_id, gardees)

        _telecharger_photos(
            post.get("images") or [], dossier, prospect_id, publication_id, cfg
        )

        if nouveau:
            fusion.controler_annuaire(prospect_id)
        fiche = fusion.evaluer(prospect_id, cfg)

        (dossier / "lecture.json").write_text(
            json.dumps(lecture, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        if nouveau:
            self.etat["nouveaux"] += 1
        else:
            self.etat["revus"] += 1

        appariees = sum(1 for o in lecture["offres"] if o.get("materiau_slug"))
        base.logguer(
            f"{'Nouveau' if nouveau else 'Revu'} — {fiche.get('nom') or 'sans nom'} "
            f"({fiche.get('quartier') or fiche.get('ville') or 'lieu inconnu'}) : "
            f"{appariees}/{len(lecture['offres'])} offre(s) appariée(s), "
            f"score {fiche.get('score', 0)}/100.",
            "succes",
        )


def _repartition(depuis: str) -> str:
    """« Dont 12 à trier, 4 incomplets, 2 déjà clients » — l'utile et le reste."""
    with base._verrou, base.connexion() as cx:
        lignes = cx.execute(
            "SELECT statut, COUNT(*) n FROM prospects WHERE derniere_vue >= ? "
            "GROUP BY statut", (depuis,),
        ).fetchall()
    par_statut = {l["statut"]: l["n"] for l in lignes}
    libelles = [
        (par_statut.get("a_trier", 0), "à trier"),
        (par_statut.get("incomplet", 0), "incomplet(s)"),
        (par_statut.get("deja_client", 0), "déjà client(s)"),
    ]
    morceaux = [f"{n} {mot}" for n, mot in libelles if n]
    return ("Dont " + ", ".join(morceaux) + ".") if morceaux else ""


collecteur = Collecteur()
