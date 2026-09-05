"""Configuration du bot de prospection Akora.

Tout ce qui se règle vit dans data/config.json (créé au premier lancement à
partir des valeurs ci-dessous). Les secrets, eux, ne sont JAMAIS ici : ils sont
lus à l'exécution dans ~/.akora-secrets/, exactement comme scripts/secrets.mjs
côté site.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

# Le dossier de travail se déplace par variable d'environnement.
#
# Ce n'est pas un confort : sans lui, un essai lancé contre le serveur écrit
# dans la VRAIE base. C'est exactement comme ça que les 32 sources d'Andry ont
# été effacées le 23/08 — une boucle de nettoyage de test qui supprimait
# « toutes les sources » les a toutes supprimées, les siennes comprises.
# Un test doit poser AKORA_BOT_DATA sur un dossier jetable.
DOSSIER_DONNEES = Path(
    os.environ.get("AKORA_BOT_DATA") or (RACINE / "data")
)
DOSSIER_PROSPECTS = DOSSIER_DONNEES / "prospects"
PROFIL_NAVIGATEUR = DOSSIER_DONNEES / "profil-fb"
BASE = DOSSIER_DONNEES / "bot.db"
FICHIER_CONFIG = DOSSIER_DONNEES / "config.json"
CACHE_REFERENTIEL = DOSSIER_DONNEES / "referentiel.json"

SECRETS = Path.home() / ".akora-secrets"
FICHIER_SUPABASE = SECRETS / "supabase.txt"
FICHIER_O2SWITCH = SECRETS / "o2switch.txt"
CLE_ANTHROPIC = SECRETS / "anthropic_key.txt"

SITE = "https://akora.fonenako.mg"
API_UPLOAD = f"{SITE}/api/o2upload.php"

DEFAUTS = {
    # Prospection de sources : le bot cherche lui-même de nouveaux groupes et
    # pages. Les requêtes décrivent le métier — c'est ce qui change d'un bot à
    # l'autre. Vide = la liste par défaut de sources_prospection.py.
    "auto_sources": False,            # chercher de nouvelles sources tout seul
    "prospection_auto_jours": 0,      # 0 = jamais ; 7 = une fois par semaine
    "prospection_requetes": [],
    "prospection_mots_metier": [],
    "prospection_repoussoirs": [],
    "prospection_note_min": 60,       # en dessous, le candidat n'est pas proposé
    "prospection_auto_adopter": False,  # adopter tout seul au-dessus du seuil
    "prospection_auto_seuil": 90,
    # ── Cadence. Volontairement lente : on imite une lecture humaine, et un
    # compte Facebook qui déroule trop vite finit limité.
    "posts_max_par_source": 40,
    "scrolls_max_par_source": 25,
    "pause_entre_scrolls": [2.0, 4.0],
    "pause_entre_sources": [15, 35],
    "navigateur_visible": True,
    # 🔴 EN DESSOUS DE CE SEUIL (Mo de mémoire ENGAGEABLE), ON NE LANCE PAS
    #   CHROMIUM. Le 23/08/2026 la machine est descendue à 189 Mo et Windows a
    #   tué les trois bots ; le même jour, le pilote Playwright mourait au
    #   décollage (« no attribute '_playwright' ») et Facebook rendait des
    #   net::ERR_INSUFFICIENT_RESOURCES. Sauter la tournée en le disant vaut
    #   mieux que mourir au milieu. Même motif que bot-diako.
    "memoire_mini_mo": 900,
    "travailleurs": 6,
    "photos_max_par_publication": 12,
    "largeur_photo_min": 400,
    "jours_max": 60,          # un dépôt qui a publié il y a 2 mois vend encore
    # ⚠ RÈGLE MÉTIER — on ne collecte QUE l'année en cours.
    # Toute publication dont l'année DÉTERMINÉE est antérieure est
    # écartée, journalisée comme telle et comptée (voir collecteur.py).
    # Quand l'année est INDÉTERMINABLE, la publication passe : 89 % des
    # publications collectées n'ont aucune date lisible, et refuser
    # l'inconnu supprimerait la collecte au lieu de la nettoyer.
    # Ici l'enjeu est double : un tarif relevé sur une publication de
    # 2019 devient un prix de marché sur akora.fonenako.mg.
    "annee_minimum": 2026,

    # ── Le prix est souvent AILLEURS que dans le texte ────────────────────
    # Mesuré sur la première vraie collecte : 7 offres sur 46 portaient un
    # prix. « Vidiny ao amin'ny commentaire » est la norme — le dépôt publie sa
    # photo et met son tarif en premier commentaire. Le bot ouvre donc la
    # publication, mais SEULEMENT si elle ressemble déjà à une offre sans prix,
    # et pas plus de N fois par source : chaque ouverture est une page chargée
    # de plus chez Facebook.
    "lire_commentaires": True,
    "commentaires_max_par_source": 8,

    # ── Ce qui fait un prospect exploitable. Le téléphone n'est pas
    # négociable : sans lui, personne à contacter, donc rien à prospecter.
    "criteres_obligatoires": ["telephone", "materiau"],
    # ── Ce qui part tout seul vers akora.fonenako.mg.
    #
    # Un DEPOT entre des qu'il a un nom, un contact et un emplacement : c'est
    # ce qu'il faut pour l'appeler et pour chiffrer une livraison, rien de
    # plus. Ses PRODUITS, eux, ne partent jamais avant d'etre complets
    # (reference du catalogue + prix + photo designee) — et cette regle-la
    # n'est pas reglable, elle est dans `tri.py`.
    #
    # Separer les deux etait devenu necessaire : 440 publications sur 526
    # (84 %, mesure du 01/09/2026) ne portent aucun prix. Attendre un tarif
    # pour creer la fiche d'un depot dont on a le numero, c'est attendre pour
    # toujours.
    "auto_inscription": True,
    "auto_inscription_max": 25,   # par tournee, pour ne pas noyer le journal
    "garder_les_incomplets": True,
    # VRAI depuis le 02/09/2026 (Andry : « on ne prend pas des fournisseurs
    # sans prix »). Une publication sans aucun prix n'entre pas — sauf si elle
    # vient d'un dépôt déjà connu, ou si elle est SÉRIEUSE : au moins
    # `produits_min_sans_prix` types du catalogue, et alors le dépôt file
    # dans « À appeler » (statut incomplet), jamais sur le site.
    "prix_obligatoire": True,
    "produits_min_sans_prix": 3,
    # Le bot SUIT les pages des dépôts qu'il garde : dès qu'un dépôt a donné un
    # prix, sa page ou son profil devient une source, relue à chaque passage
    # avec un petit budget de défilement (ses dernières actualités suffisent).
    "suivre_pages_fournisseurs": True,
    "scrolls_pages_fournisseurs": 4,
    # Le catalogue s'enrichit de ce que le terrain vend : une cote complète,
    # chiffrée, d'un type qui a sa grammaire (`grammaires.py`) et que le site
    # ignore devient une référence — avec son volume et son poids calculés.
    "creer_references": True,

    # ── Devises croisées dans les publications malgaches.
    "taux_fmg_ar": 5,            # 1 Ar = 5 Fmg
    "prix_plancher_ar": 200,     # sous ce montant, ce n'est pas un prix matériau
    # …sauf à la PIÈCE : une brique se vend 80 Ar l'unité (offres #23, #45,
    # #124), et le plancher unique à 200 Ar jetait les trois tarifs de brique
    # du corpus. Le seuil haut reste celui du fret (`transport.py`) et de tout
    # ce qui se vend au mètre cube.
    "prix_plancher_unitaire_ar": 50,
    "prix_plafond_ar": 50_000_000,

    # ── Relecture par un modèle. Sans elle le bot marche, mais il se trompe
    # sur ce qui demande du jugement : quel montant va avec quel matériau
    # dans une liste de dix lignes, un dépôt ou un simple revendeur.
    "llm_actif": False,
    "llm_transport": "passerelle",   # 'passerelle' (LiteLLM local) | 'anthropic'
    "llm_passerelle": "http://127.0.0.1:4000",
    "llm_modele": "",
    "llm_repli_anthropic": False,
    "llm_delai": 120,
    "llm_confiance_min": 50,

    # ── Collectes automatiques. FAUX par défaut, et c'est délibéré : ce bot
    # n'a encore jamais tourné contre le vrai Facebook. Un bot qui part tout
    # seul avant sa première collecte vérifiée est un bot qu'on ne peut plus
    # déboguer — on ne sait plus qui a déclenché quoi, surtout avec trois bots
    # sur la même machine. À activer depuis le tableau de bord, une fois la
    # première collecte lancée à la main et son résultat regardé.
    "collecte_auto": False,
    "heures_collecte": ["10:00", "17:00"],
    "objectif_par_jour": 15,         # 15 NOUVEAUX fournisseurs par jour

    # ── Prospection.
    "delai_relance_jours": 3,
    "relances_max": 2,
    "langue_message": "fr",          # 'fr' | 'mg'
    "expediteur": "Akora",

    # ── Automatisations, toutes à FAUX par défaut ─────────────────────────
    # Le principe : le bot ne fait rien d'irréversible ni de visible sans que
    # quelqu'un l'ait allumé en connaissance de cause. Chacune est décrite
    # dans l'onglet « Automatisations » de l'interface, avec ce qu'elle fait
    # ET ce qu'elle ne fera jamais.
    #
    # Écrit en local seulement :
    "auto_relances": False,          # signale les relances dues, n'envoie rien
    "auto_recherches": False,        # ajoute des recherches sur les trous de couverture
    "auto_recherches_max": 3,        # par passage, pour ne pas noyer la liste
    # Écrit dans la base Akora, en privé (fiches non publiques) :
    "auto_reservation": False,       # réserve les fiches validées
    "auto_synchro": True,            # relit le site : qui a revendiqué, qui a refusé
    # Écrit dans le fil PUBLIC d'Akora :
    "auto_bulletin": False,          # prépare le brouillon du bulletin de prix
    "auto_bulletin_publier": False,  # ⚠ le publie vraiment, sans relecture
    "auto_bulletin_ville": "",

    # ── Inscription sur le site ───────────────────────────────────────────
    # `fournisseurs.owner_id` référence `auth.users` : un dépôt trouvé sur
    # Facebook n'a pas de compte, sa fiche est donc créée au nom du compte
    # Akora, jusqu'à ce qu'il la revendique. Vide = l'administrateur du site.
    "compte_akora": "",
    # FAUX : une fiche inscrite reste en brouillon, invisible, tant que
    # personne n'a cliqué « Publier ». Mettre en ligne le nom d'un dépôt et
    # des prix relevés sur Facebook n'est pas une décision qu'un bot prend.
    "inscrire_en_actif": False,
    # Quand `inscrire_en_actif` est allumé : un dépôt n'est ACTIF dans
    # l'annuaire que s'il a au moins un produit actif (référence + prix +
    # photo). Sinon sa fiche existe, en brouillon, et passe active toute
    # seule le jour où son premier produit se complète. Mesuré le 02/09/2026 :
    # 24 fournisseurs actifs créés par le bot, 22 sans aucun produit — un
    # visiteur voyait un nom, un numéro, et rien à acheter. FAUX = l'ancien
    # comportement (le dépôt entre dès qu'il a nom, contact et lieu).
    "actif_exige_un_produit": True,

    # ── Réservation de la fiche sur le site.
    "pousser_les_fiches": False,     # tant que la migration n'est pas appliquée
    "pause_entre_envois_photos": 3.0,

    # ── Observatoire des prix (public.releves_prix, une fois par jour).
    # Trois gardes en amont : prix orphelin, unité, vraisemblance (un prix à
    # plus de ×2,5 de la médiane part « à confirmer », jamais en ligne).
    "pousser_observatoire": True,

    # ── Pré-tri des photos par FAMILLE via l'API Claude (facultatif : sans
    # clé dans ~/.akora-secrets/anthropic_key.txt, il se tait). Jamais plus
    # fin que la famille — le rattachement photo→produit reste un clic.
    "classer_photos": True,
}


def charger() -> dict:
    """Lit data/config.json, en le créant au besoin, et comble les clés manquantes.

    Une clé NEUVE est aussi réécrite dans le fichier. Sans ça, un réglage
    ajouté au code existe en mémoire mais reste absent de `data/config.json` :
    invisible dans l'éditeur de texte, donc impossible à changer à la main.
    Un réglage qu'on ne peut pas lire n'est pas un réglage, c'est une
    constante cachée — et `annee_minimum`, ajouté le 24/08/2026, est
    exactement le genre de valeur qu'on veut pouvoir relire et corriger sans
    toucher au code.
    """
    DOSSIER_DONNEES.mkdir(parents=True, exist_ok=True)
    config = dict(DEFAUTS)
    if FICHIER_CONFIG.exists():
        sur_disque = json.loads(FICHIER_CONFIG.read_text(encoding="utf-8"))
        config.update(sur_disque)
        if set(DEFAUTS) - set(sur_disque):
            try:
                enregistrer(config)
            except OSError:
                pass        # fichier verrouillé ou disque plein : on continue
    else:
        FICHIER_CONFIG.write_text(
            json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    return config


def enregistrer(config: dict) -> None:
    DOSSIER_DONNEES.mkdir(parents=True, exist_ok=True)
    FICHIER_CONFIG.write_text(
        json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def lire_secrets(chemin: Path = FICHIER_SUPABASE) -> dict:
    """Lit un fichier `clé=valeur` de ~/.akora-secrets. Ne jamais logguer le retour.

    `utf-8-sig` et non `utf-8` : ces fichiers sont souvent créés au Bloc-notes
    ou par PowerShell, qui y collent un BOM. `.strip()` ne retire PAS U+FEFF,
    et le jeton part alors dans un en-tête HTTP qui refuse tout ce qui n'est
    pas latin-1 — la requête échoue avant même de partir.
    """
    if not chemin.exists():
        raise FileNotFoundError(
            f"Secret absent : {chemin}. Voir LISEZ-MOI.md, section « Secrets »."
        )
    valeurs: dict[str, str] = {}
    for ligne in chemin.read_text(encoding="utf-8-sig").splitlines():
        ligne = ligne.strip().strip("﻿")
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        cle, _, valeur = ligne.partition("=")
        valeurs[cle.strip()] = valeur.strip()
    return valeurs


def ref_projet(url: str) -> str:
    """https://<ref>.supabase.co -> <ref>."""
    trouve = re.match(r"^https://([a-z0-9]+)\.supabase\.(co|in)", url.strip(), re.I)
    if not trouve:
        raise ValueError(f"URL de projet Supabase inattendue : {url}")
    return trouve.group(1)


def api_supabase() -> tuple[str, str]:
    """(url de l'API Management, jeton). Le même chemin que scripts/db-push.mjs.

    Le bot écrit dans une base dont les tables sont fermées à la clé anon :
    il lui faut donc l'API Management et son jeton `sbp_...`, pas la clé du
    navigateur. Aucune clé service_role n'entre ici — c'est la règle du dépôt.
    """
    secrets = lire_secrets()
    jeton = secrets.get("SUPABASE_ACCESS_TOKEN", "")
    if not jeton:
        raise FileNotFoundError(
            "SUPABASE_ACCESS_TOKEN absent de ~/.akora-secrets/supabase.txt "
            "(dashboard Supabase -> Account -> Access Tokens)."
        )
    if jeton.startswith("sb_secret_") or "service_role" in jeton:
        raise ValueError("STOP : ce jeton ressemble à une clé service_role.")
    ref = ref_projet(secrets["SUPABASE_URL"])
    return f"https://api.supabase.com/v1/projects/{ref}/database/query", jeton


def cle_upload() -> str:
    return lire_secrets(FICHIER_O2SWITCH)["O2SWITCH_UPLOAD_API_KEY"]
