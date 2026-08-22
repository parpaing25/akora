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

from urllib.parse import urlsplit

from . import akora, base
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
