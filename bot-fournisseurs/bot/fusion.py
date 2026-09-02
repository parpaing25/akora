"""Ranger une publication dans le bon fournisseur.

Le nerf du bot. Un dépôt poste son tarif dans six groupes le même matin : ça
fait six publications, **un** prospect, et une dizaine d'offres. Fonenako
n'avait pas ce problème (une annonce = un bien) ; ici, tout en dépend — un
regroupement raté et Andry rappelle trois fois le même dépôt.

La clé de regroupement, par ordre de fiabilité :

  1. le **téléphone** normalisé — deux publications qui donnent le même numéro
     sont le même vendeur, quels que soient le groupe et le nom du compte ;
  2. l'**adresse du profil ou de la page** de l'auteur ;
  3. faute de mieux, `nom du compte + source`, qui reste local à un groupe :
     deux « Rakoto Jean » dans deux groupes différents restent séparés, et
     c'est voulu — mieux vaut deux fiches à fusionner qu'une fiche fausse.

Quand une publication ultérieure apporte enfin le numéro d'un prospect créé
sur un profil, les deux fiches sont **absorbées** l'une dans l'autre.
"""
from __future__ import annotations

import re
from urllib.parse import urlsplit

from . import akora, base, referentiel
from . import score as notation


def cle_de_regroupement(lecture: dict, post: dict, source: dict) -> str:
    """La clé qui identifie le vendeur. Jamais vide."""
    if lecture.get("telephone_cle"):
        return "tel:" + lecture["telephone_cle"]
    auteur_url = _url_propre(post.get("auteur_url") or "")
    if auteur_url:
        return "fb:" + auteur_url
    if (source.get("genre") or "groupe") == "page":
        return "fb:" + _url_propre(source.get("url") or "")
    nom = (post.get("auteur") or "").strip().lower()
    return f"nom:{nom}|src:{source.get('id')}"


def _url_propre(url: str) -> str:
    """Retire le pistage collé par le bouton « Partager » de Facebook."""
    if not url:
        return ""
    decoupe = urlsplit(url)
    chemin = decoupe.path.rstrip("/")
    if chemin.endswith("profile.php"):
        identifiant = dict(
            morceau.split("=", 1) for morceau in decoupe.query.split("&")
            if "=" in morceau
        ).get("id", "")
        return f"facebook.com/profile.php?id={identifiant}" if identifiant else ""
    return f"facebook.com{chemin}" if chemin else ""


def _fusionner_valeur(ancienne, nouvelle):
    """La première valeur non vide gagne — on ne remplace pas un acquis par un vide."""
    if nouvelle in (None, "", [], 0, False):
        return ancienne
    if ancienne in (None, "", []):
        return nouvelle
    return ancienne


def absorber(source_id: str, cible_id: str) -> None:
    """Verse tout le contenu d'un prospect dans un autre, puis le supprime.

    Sert quand une publication tardive révèle le numéro d'un prospect créé sur
    un simple profil : les deux fiches n'en font qu'une.
    """
    if source_id == cible_id:
        return
    with base._verrou, base.connexion() as cx:
        cx.execute("UPDATE publications SET prospect_id = ? WHERE prospect_id = ?",
                   (cible_id, source_id))
        cx.execute("UPDATE offres SET prospect_id = ? WHERE prospect_id = ?",
                   (cible_id, source_id))
        cx.execute("UPDATE photos SET prospect_id = ? WHERE prospect_id = ?",
                   (cible_id, source_id))
        cx.execute("UPDATE vehicules SET prospect_id = ? WHERE prospect_id = ?",
                   (cible_id, source_id))
        cx.execute("UPDATE evenements SET prospect_id = ? WHERE prospect_id = ?",
                   (cible_id, source_id))
        cx.execute("DELETE FROM prospects WHERE id = ?", (source_id,))
    base.evenement(cible_id, "statut", "Fiche fusionnée avec un doublon (même numéro).")


# ── Doublons PROBABLES : on les signale, on ne les fusionne pas ────────────
def _identifiant_facebook(fiche: dict) -> str:
    """L'identifiant du compte Facebook derrière une fiche, ou `''`.

    `page_url` prend trois formes, selon d'où venait la publication :

        facebook.com/profile.php?id=61577268412763
        facebook.com/groups/842470991701989/user/61577268412763
        facebook.com/NomDeLaPage

    Les DEUX PREMIÈRES désignent le MÊME compte. C'est exactement ce que
    `cle_de_regroupement` ne voit pas : il compare des URL entières, donc
    « vu dans le groupe A » et « vu sur son profil » font deux fiches — et le
    même vendeur vu depuis deux groupes différents en fait deux aussi.

    Un groupe (`/groups/842470991701989` sans `/user/`) n'est PAS un compte :
    il rend `''`, sinon tous les membres d'un même groupe seraient déclarés
    identiques.
    """
    url = (fiche.get("page_url") or "").strip().lower()
    if not url:
        return ""
    trouve = (re.search(r"/user/(\d+)", url)
              or re.search(r"profile\.php\?id=(\d+)", url))
    if trouve:
        return trouve.group(1)
    chemin = url.split("facebook.com/", 1)[-1].strip("/")
    return chemin if chemin and "/" not in chemin else ""


def _resumer(fiche: dict) -> dict:
    """Ce qu'il faut voir pour trancher, et rien de plus."""
    return {
        "id": fiche["id"],
        "nom": fiche.get("nom") or "",
        "telephone": fiche.get("telephone") or "",
        "page_url": fiche.get("page_url") or "",
        "ville": fiche.get("ville") or fiche.get("quartier") or "",
        "statut": fiche.get("statut") or "",
        "score": fiche.get("score") or 0,
        "nb_publications": fiche.get("nb_publications") or 0,
        "nb_offres": fiche.get("nb_offres") or 0,
        "derniere_vue": fiche.get("derniere_vue") or "",
    }


def _richesse(fiche: dict) -> tuple:
    """De quoi choisir la fiche à GARDER par défaut : la mieux remplie."""
    return (
        1 if fiche.get("telephone_cle") else 0,
        int(fiche.get("nb_offres") or 0),
        int(fiche.get("nb_publications") or 0),
        int(fiche.get("score") or 0),
    )


def _grouper(lot: list[dict], certitude: str, raison: str) -> dict:
    tries = sorted(lot, key=_richesse, reverse=True)
    return {
        "cle": "|".join(sorted(f["id"] for f in tries)),
        "certitude": certitude,
        "raison": raison,
        "nom": tries[0].get("nom") or "",
        # Proposition, pas décision : l'interface laisse changer la fiche
        # gardée avant de fusionner.
        "garder": tries[0]["id"],
        "fiches": [_resumer(f) for f in tries],
    }


# Sous cette longueur, un nom normalisé ne prouve plus rien : « ets », « depot »
# se retrouvent chez tout le monde.
NOM_MINIMAL = 6

# Fiches déjà tranchées : les rapprocher n'apprendrait rien et ferait du bruit.
STATUTS_HORS_JEU = ("rejete", "doublon", "refuse")


def doublons_probables(fiches: list[dict] | None = None) -> list[dict]:
    """Les fiches qui SONT PEUT-ÊTRE la même. **Ne fusionne rien.**

    Mesuré le 24/08/2026 sur les 134 prospects de `data/bot.db` : 180
    publications pour 180 empreintes, aucun doublon de téléphone, aucun
    doublon d'offre — le dédoublonnage de `cle_de_regroupement` tient. Restent
    cinq groupes de fiches HOMONYMES :

        3× « Fournisseur en Matériaux de construction »
        2× « Varotra vato sy fasika ary biriky »
        2× « Abdel Hamid Moussa Morou »
        2× « Biriky Volombary »
        2× « El Yan »

    En regardant les URL de compte, les cinq groupes viennent en fait du MÊME
    identifiant Facebook : le même vendeur vu depuis deux groupes, ou vu une
    fois avec son numéro et une fois sans. Le nom seul, lui, ne prouve rien —
    « Fournisseur en Matériaux de construction » est une enseigne générique
    que plusieurs pages RÉELLEMENT différentes portent.

    D'où deux niveaux, et **aucune fusion automatique** :

      - `certitude = "compte"` : même identifiant Facebook. Solide.
      - `certitude = "nom"`    : même nom normalisé, comptes différents ou
        inconnus. À regarder, jamais à fusionner les yeux fermés.

    Fusionner à l'aveugle détruirait ce qu'on ne peut pas reconstruire : deux
    dépôts distincts n'en feraient plus qu'un, avec les offres de l'un collées
    sur le téléphone de l'autre. La fusion reste un geste humain
    (`POST /api/doublons/fusionner`, qui appelle `absorber`).
    """
    if fiches is None:
        fiches = base.lister_prospects(limite=5000)
    retenues = [
        f for f in fiches
        if (f.get("statut") or "") not in STATUTS_HORS_JEU
    ]

    par_compte: dict[str, list[dict]] = {}
    par_nom: dict[str, list[dict]] = {}
    for fiche in retenues:
        compte = _identifiant_facebook(fiche)
        if compte:
            par_compte.setdefault(compte, []).append(fiche)
        # Même normalisation que le référentiel : NFKD, accents tombés,
        # ponctuation ramenée à des espaces. « Ets RAKOTO Matériaux » et
        # « ets rakoto materiaux » sont le même nom.
        nom = referentiel.normaliser(fiche.get("nom") or "")
        if len(nom) >= NOM_MINIMAL:
            par_nom.setdefault(nom, []).append(fiche)

    signales: list[dict] = []
    deja: set[str] = set()
    for compte, lot in par_compte.items():
        if len(lot) < 2:
            continue
        groupe = _grouper(lot, "compte", f"même compte Facebook ({compte})")
        deja.add(groupe["cle"])
        signales.append(groupe)
    for nom, lot in par_nom.items():
        if len(lot) < 2:
            continue
        groupe = _grouper(lot, "nom", "même nom, comptes différents ou inconnus")
        if groupe["cle"] in deja:
            continue      # déjà dit, et mieux dit, par l'identifiant de compte
        signales.append(groupe)

    signales.sort(key=lambda g: (g["certitude"] != "compte", -len(g["fiches"]),
                                 g["nom"].lower()))
    return signales


def fusionner_a_la_main(garder: str, absorbes: list[str], cfg: dict) -> dict:
    """Verse plusieurs fiches dans une autre. Déclenché par un humain, jamais seul.

    Renvoie le nombre de fiches absorbées et la fiche gardée, recalculée.
    """
    if not garder:
        raise ValueError("Aucune fiche à garder n'a été désignée.")
    cible = base.prospect(garder)
    if not cible:
        raise ValueError("La fiche à garder n'existe plus.")
    faites = 0
    for pid in absorbes:
        if pid == garder or not base.prospect(pid):
            continue
        absorber(pid, garder)
        faites += 1
    if faites:
        base.evenement(
            garder, "statut",
            f"{faites} fiche(s) fusionnée(s) à la main — doublon(s) probable(s).",
        )
    return {"absorbees": faites, "fiche": evaluer(garder, cfg)}


def enregistrer(lecture: dict, post: dict, source: dict, cfg: dict) -> tuple[str, bool]:
    """Crée ou met à jour le prospect. Renvoie (identifiant, est_nouveau)."""
    cle = cle_de_regroupement(lecture, post, source)
    existant = base.trouver_prospect(cle)

    # Le numéro vient d'apparaître : si un prospect le porte déjà sous une
    # autre clé, c'est lui le vrai, et l'autre fiche va s'y verser.
    if not existant and lecture.get("telephone_cle"):
        par_numero = base.prospect_par_telephone(lecture["telephone_cle"])
        if par_numero:
            existant = par_numero
            cle = par_numero["cle"]

    auteur = (post.get("auteur") or "").strip()
    nom = lecture.get("nom") or auteur or (source.get("nom") if
                                           source.get("genre") == "page" else "")
    champs = {
        "cle": cle,
        "nom": nom,
        # « Ets RAKOTO Matériaux » est une enseigne ; « Jean R. » est un compte.
        "nom_valide": 1 if lecture.get("nom") else 0,
        "metier": lecture.get("metier"),
        "telephone": lecture.get("telephone"),
        "telephone_cle": lecture.get("telephone_cle"),
        "whatsapp": 1 if lecture.get("whatsapp") else 0,
        "page_url": _url_propre(post.get("auteur_url") or "")
        or (_url_propre(source.get("url") or "") if source.get("genre") == "page" else None),
        "auteur_fb": auteur,
        # D'où venait la publication : sert à créditer la source une fois la
        # fiche réservée.
        "origine_cle": ((post.get("origine_url") or "").split("?")[0]
                        .rstrip("/").rsplit("/", 1)[-1]
                        if "/groups/" in (post.get("origine_url") or "") else None),
        "ville": lecture.get("ville"),
        "quartier": lecture.get("quartier"),
        "adresse": lecture.get("adresse"),
        "langue": lecture.get("langue") or "fr",
        "livre": 1 if lecture.get("livre") else 0,
        "retrait_sur_place": 1 if lecture.get("retrait_sur_place") else 0,
        "nature": lecture.get("nature") or "depot",
        "rayon_km": lecture.get("rayon_km"),
        "seuil_franco": lecture.get("seuil_franco"),
        "llm_confiance": lecture.get("llm_confiance"),
        "llm_doute": lecture.get("llm_doute"),
        "llm_resume": lecture.get("llm_resume"),
        "lu_par_llm": 1 if lecture.get("lu_par_llm") else 0,
    }

    if existant:
        pid, nouveau = existant["id"], False
        # Une valeur déjà connue ne se fait pas écraser par un vide, et une
        # correction faite à la main dans l'interface tient contre la collecte.
        a_ecrire = {
            champ: _fusionner_valeur(existant.get(champ), valeur)
            for champ, valeur in champs.items()
        }
        if existant.get("nom_valide") and not lecture.get("nom"):
            a_ecrire["nom"] = existant["nom"]
            a_ecrire["nom_valide"] = 1
        # Un dépôt vu une fois avec un camion, une fois avec un tarif matériau,
        # est les DEUX. `_fusionner_valeur` garderait la première nature vue et
        # perdrait l'autre moitié de ce qu'il sait faire.
        natures = {existant.get("nature") or "depot", lecture.get("nature") or "depot"}
        a_ecrire["nature"] = "mixte" if len(natures - {"mixte"}) > 1 or "mixte" in natures \
            else natures.pop()
        a_ecrire["derniere_vue"] = base.maintenant()
        a_ecrire["nb_publications"] = int(existant.get("nb_publications") or 0) + 1
        # Un second numéro n'écrase pas le premier : il s'ajoute à côté.
        autres = list(existant.get("telephones_autres") or [])
        for numero in lecture.get("telephones") or []:
            if numero["cle"] != existant.get("telephone_cle") and numero["cle"] not in autres:
                autres.append(numero["cle"])
        a_ecrire["telephones_autres"] = autres
        base.modifier_prospect(pid, a_ecrire)
        if existant["cle"] != cle:
            base.modifier_prospect(pid, {"cle": cle})
    else:
        champs["nb_publications"] = 1
        champs["telephones_autres"] = [
            n["cle"] for n in (lecture.get("telephones") or [])[1:]
        ]
        pid = base.creer_prospect(champs)
        nouveau = True
        base.evenement(pid, "collecte", f"Repéré dans « {source.get('nom')} ».")

    return pid, nouveau


def evaluer(pid: str, cfg: dict) -> dict:
    """Recalcule manques, statut et score d'un prospect. Renvoie sa fiche."""
    fiche = base.prospect(pid)
    if not fiche:
        return {}
    offres = [o for o in fiche["offres"] if o["garder"]]
    vehicules = [v for v in fiche.get("vehicules", []) if v["garder"]]
    nb_photos = sum(1 for p in fiche["photos"] if p["garder"])
    transporteur = (fiche.get("nature") or "depot") == "transporteur"

    manques = []
    if not fiche.get("telephone_cle"):
        manques.append("téléphone")
    # Un transporteur ne vend aucun matériau : lui reprocher de ne pas en
    # avoir le classerait « incomplet » à vie. Ce qu'on attend de lui, c'est
    # un camion avec une capacité et un tarif.
    if transporteur:
        if not vehicules:
            manques.append("véhicule")
        elif not any(v.get("capacite_m3") or v.get("capacite_kg") for v in vehicules):
            manques.append("capacité du camion")
        elif not any(v.get("forfait_base") or v.get("prix_par_km") for v in vehicules):
            manques.append("tarif de transport")
    elif not any(o.get("materiau_slug") for o in offres):
        manques.append("matériau")
    if not (fiche.get("ville") or fiche.get("quartier")):
        manques.append("lieu")
    if not transporteur and not any(o.get("prix") for o in offres):
        manques.append("prix")
    if not (fiche.get("nom") or "").strip():
        manques.append("nom")
    ambigues = [o for o in offres if o.get("ambigu")]
    if ambigues:
        manques.append(f"{len(ambigues)} format(s) à préciser")

    note = notation.calculer(fiche, offres, nb_photos, vehicules)
    a_ecrire = {
        "manques": manques,
        "score": note["score"],
        "niveau": note["niveau"],
        "detail_score": note["details"],
    }

    # Le statut n'est recalculé que tant que personne n'a tranché : une fiche
    # validée, réservée ou contactée garde le sien, sinon une collecte du
    # lendemain défaire le travail de tri de la veille.
    if fiche["statut"] in ("a_trier", "incomplet"):
        obligatoires = set(cfg.get("criteres_obligatoires", []))
        if transporteur:
            obligatoires = (obligatoires - {"materiau"}) | {"vehicule"}
        bloquants = [m for m in manques if m in obligatoires]
        if cfg.get("prix_obligatoire") and "prix" in manques:
            bloquants.append("prix")
        a_ecrire["statut"] = "incomplet" if bloquants else "a_trier"

    base.modifier_prospect(pid, a_ecrire)
    return {**fiche, **a_ecrire}


def controler_annuaire(pid: str) -> bool:
    """Ce prospect est-il déjà un fournisseur Akora ? Si oui, on le sort du lot.

    Démarcher un dépôt qui a déjà son compte est la manière la plus rapide de
    perdre sa crédibilité — le contrôle vaut le détour par le réseau.
    """
    fiche = base.prospect(pid)
    if not fiche or fiche["statut"] in ("revendique", "deja_client"):
        return False
    try:
        identifiant, raison = akora.deja_fournisseur(
            fiche.get("telephone") or "", fiche.get("nom") or ""
        )
    except akora.ErreurAkora as e:
        base.logguer(f"Contrôle « déjà fournisseur » impossible : {e}", "avert")
        return False
    if not identifiant:
        return False
    base.modifier_prospect(pid, {
        "statut": "deja_client",
        "fournisseur_id": identifiant,
        "note": f"Déjà inscrit sur Akora ({raison}).",
    })
    base.evenement(pid, "statut", f"Déjà fournisseur Akora — {raison}.")
    return True
