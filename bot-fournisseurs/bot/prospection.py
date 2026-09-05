"""Le suivi des contacts : qui appeler aujourd'hui, qui relancer, qui laisser.

Un fichier de 300 dépôts sans suivi ne sert à rien : au troisième jour, plus
personne ne sait qui a déjà été appelé. D'où ce petit CRM — statuts, dates,
relances dues, journal par fiche.

Ce que le bot ne fait PAS, et ne fera pas : envoyer les messages. Facebook coupe
les comptes qui écrivent en série, et un dépôt démarché par un robot ne
rappelle jamais. Le bot prépare, l'humain envoie.
"""
from __future__ import annotations

import csv
import io

from . import akora, base, messages, referentiel, reservation


def file_du_jour(cfg: dict, limite: int = 40) -> dict:
    """Trois piles : à réserver, à contacter, à relancer.

    L'ordre à l'intérieur de chaque pile est le score : on appelle d'abord
    celui qui a le plus de produits appariés, ses prix affichés et un quartier
    connu — c'est celui qui dira oui le plus vite.
    """
    a_reserver = [
        p for p in base.lister_prospects(statut="valide", tri="score", limite=limite)
    ]
    a_contacter = [
        p for p in base.lister_prospects(statut="reserve", tri="score", limite=limite)
        if not p.get("contacte_le")
    ]
    a_relancer = base.a_relancer(
        int(cfg.get("delai_relance_jours", 3)), int(cfg.get("relances_max", 2))
    )[:limite]
    return {
        "a_reserver": a_reserver,
        "a_contacter": a_contacter,
        "a_relancer": a_relancer,
        "total": len(a_reserver) + len(a_contacter) + len(a_relancer),
    }


def preparer_message(prospect_id: str, modele: str = "") -> dict:
    """Le texte à envoyer et les canaux pour l'envoyer.

    Le modèle est choisi tout seul d'après l'historique : premier contact,
    première relance, dernière relance. On peut le forcer depuis l'interface.
    """
    fiche = base.prospect(prospect_id)
    if not fiche:
        raise ValueError("Prospect introuvable.")
    if not modele:
        relances = int(fiche.get("nb_relances") or 0)
        modele = "premier" if not fiche.get("contacte_le") else (
            "relance1" if relances == 0 else "relance2"
        )
    offres = [o for o in fiche["offres"] if o["garder"]]
    texte = messages.composer(fiche, offres, modele)
    return {
        "modele": modele,
        "langue": fiche.get("langue") or "fr",
        "texte": texte,
        "canaux": messages.canaux(fiche, texte),
        "lien_fiche": messages.lien_fiche(fiche),
        "fiche_reservee": bool(fiche.get("fiche_url")),
    }


def marquer_contacte(prospect_id: str, canal: str = "whatsapp") -> dict:
    fiche = base.prospect(prospect_id)
    if not fiche:
        raise ValueError("Prospect introuvable.")
    premier = not fiche.get("contacte_le")
    if premier:
        base.modifier_prospect(prospect_id, {
            "statut": "contacte",
            "contacte_le": base.maintenant(),
            "canal_contact": canal,
        })
        base.evenement(prospect_id, "contact", f"Premier contact par {canal}.")
    else:
        relances = int(fiche.get("nb_relances") or 0) + 1
        base.modifier_prospect(prospect_id, {
            "statut": "relance",
            "nb_relances": relances,
            "derniere_relance": base.maintenant(),
            "canal_contact": canal,
        })
        base.evenement(prospect_id, "relance", f"Relance n°{relances} par {canal}.")
    return base.prospect(prospect_id)


def marquer_refus(prospect_id: str, motif: str = "") -> dict:
    """Le dépôt a dit non. Définitif, et la fiche quitte le site.

    On inscrit la clé en liste rouge AVANT de toucher au reste : c'est elle qui
    empêche une collecte de demain de le faire réapparaître.
    """
    fiche = base.prospect(prospect_id)
    if not fiche:
        raise ValueError("Prospect introuvable.")
    base.refuser_definitivement(
        fiche.get("telephone_cle") or fiche.get("cle") or "",
        fiche.get("nom") or "", motif or "refus au contact",
    )
    if fiche.get("fiche_url"):
        try:
            reservation.retirer(prospect_id, motif)
        except Exception as e:
            base.logguer(
                f"Fiche non retirée du site ({e}) — à refaire depuis le panneau.",
                "avert",
            )
    base.modifier_prospect(prospect_id, {"statut": "refuse", "note": motif or None})
    base.evenement(prospect_id, "reponse", f"Refus. {motif}".strip())
    base.logguer(f"« {fiche.get('nom')} » ne veut pas être recontacté.", "avert")
    return base.prospect(prospect_id)


def marquer_revendique(prospect_id: str, fournisseur_id: str = "") -> dict:
    """Saisie manuelle : le dépôt a créé son compte (vu autrement que par le site)."""
    base.modifier_prospect(prospect_id, {
        "statut": "revendique",
        "revendique_le": base.maintenant(),
        "fournisseur_id": fournisseur_id or None,
    })
    base.evenement(prospect_id, "reponse", "Fiche revendiquée (saisie manuelle).")
    return base.prospect(prospect_id)


def changer_statut(prospect_id: str, statut: str, note: str = "") -> dict:
    if statut not in base.STATUTS:
        raise ValueError(f"Statut inconnu : {statut}")
    if statut == "refuse":
        return marquer_refus(prospect_id, note)
    champs = {"statut": statut}
    if note:
        champs["note"] = note
    base.modifier_prospect(prospect_id, champs)
    base.evenement(prospect_id, "statut", f"Passé en « {statut} ». {note}".strip())
    return base.prospect(prospect_id)


COLONNES_EXPORT = [
    "nom", "metier", "telephone", "whatsapp", "ville", "quartier",
    "score", "niveau", "statut", "nb_offres", "types_vendus",
    "contacte_le", "nb_relances", "fiche_url", "page_url",
]


def exporter_csv(statut: str = "") -> str:
    """Le fichier d'appels, ouvrable dans Excel. Point-virgule et BOM.

    Excel francophone découpe sur le point-virgule, pas la virgule, et sans BOM
    il lit « Ambohibao » en « AmbohibaoÂ ». Les deux détails ensemble font la
    différence entre un fichier utilisable et un fichier à retaper.
    """
    lignes = base.lister_prospects(statut=statut or "tous", tri="score", limite=5000)
    tampon = io.StringIO()
    graveur = csv.DictWriter(
        tampon, fieldnames=COLONNES_EXPORT, extrasaction="ignore", delimiter=";"
    )
    graveur.writeheader()
    for ligne in lignes:
        graveur.writerow({
            **{c: ligne.get(c) for c in COLONNES_EXPORT},
            "whatsapp": "oui" if ligne.get("whatsapp") else "",
        })
    return "﻿" + tampon.getvalue()


# ── Annuaire : le recensement, site et Facebook réunis ─────────────────────
# La mission du bot n'est pas « collecter des prospects », c'est RECENSER les
# fournisseurs de matériaux. Un dépôt déjà inscrit sur Akora en fait partie au
# même titre qu'un dépôt vu hier sur Facebook — et savoir lequel est lequel est
# précisément ce qui évite de démarcher un client.
#
# Deux moitiés, deux fiabilités :
#   • les INSCRITS viennent d'Akora, par le réseau. Autorité absolue, mais
#     l'appel peut échouer ;
#   • les PROSPECTS viennent de la base locale. Toujours là, jamais certains.
#
# D'où la règle de cette fonction : si le réseau tombe, elle rend quand même
# les prospects, avec un avertissement. Une page vide ne dit pas qu'Internet
# est coupé — elle dit qu'il n'y a personne, et c'est faux.

COLONNES_ANNUAIRE = [
    "nom", "telephones", "ville", "quartier", "familles", "nb_offres",
    "statut", "client", "origine", "fiche_url", "page_url",
]


def _noms_de_familles() -> dict[str, str]:
    """slug -> nom lisible. Vide si le catalogue n'est pas chargé."""
    try:
        return {slug: f.get("nom") or slug
                for slug, f in referentiel.charger()["familles"].items()}
    except Exception:
        return {}


def _telephones(prospect: dict) -> list[str]:
    """Le numéro principal puis les autres, sans doublon, ordre conservé."""
    numeros = [prospect.get("telephone") or ""]
    autres = prospect.get("telephones_autres") or []
    if isinstance(autres, list):
        numeros += [str(n) for n in autres]
    vus, sortie = set(), []
    for numero in numeros:
        numero = (numero or "").strip()
        if numero and numero not in vus:
            vus.add(numero)
            sortie.append(numero)
    return sortie


def annuaire_croise() -> dict:
    """Tous les fournisseurs connus d'Akora : inscrits ET repérés.

    Renvoie {lignes, avertissement, compte}. `avertissement` est vide quand le
    site a répondu ; sinon il porte la phrase à afficher au-dessus du tableau.
    """
    avertissement = ""
    inscrits: list[dict] = []
    try:
        inscrits = akora.annuaire()
    except Exception as e:
        # Volontairement large : requests lève une dizaine de types différents,
        # et aucun ne doit vider la page. Le message part tel quel à l'écran.
        avertissement = (
            "Le site n'a pas répondu — seuls les prospects collectés sur ce PC "
            f"sont affichés, et la colonne « déjà client » est donc incomplète. ({e})"
        )

    familles_par_id = base.familles_par_prospect()
    noms_familles = _noms_de_familles()
    prospects = base.lister_prospects(statut="tous", tri="nom", limite=5000)

    lignes: list[dict] = []
    apparies: set[str] = set()      # identifiants distants déjà représentés

    for prospect in prospects:
        distant, raison = "", ""
        if inscrits:
            try:
                distant, raison = akora.deja_fournisseur(
                    prospect.get("telephone") or "", prospect.get("nom") or ""
                )
            except Exception:
                distant, raison = "", ""
        if distant:
            apparies.add(distant)
        familles = [noms_familles.get(s, s) for s in familles_par_id.get(prospect["id"], [])]
        lignes.append({
            "cle": prospect["id"],
            "nom": prospect.get("nom") or "Sans nom",
            "telephones": _telephones(prospect),
            "ville": prospect.get("ville") or "",
            "quartier": prospect.get("quartier") or "",
            "familles": familles,
            "nb_offres": int(prospect.get("nb_offres") or 0),
            "statut": prospect.get("statut") or "",
            # « Déjà client » ne se déduit PAS du statut local : un prospect
            # marqué `deja_client` à la collecte peut avoir été effacé côté
            # site, et un prospect neuf peut être un client de longue date.
            # Seul l'annuaire distant fait foi.
            "client": bool(distant) or prospect.get("statut") == "revendique",
            "raison_client": raison,
            "origine": "les deux" if distant else "prospect",
            "prospect_id": prospect["id"],
            "fournisseur_id": distant or (prospect.get("fournisseur_id") or ""),
            "slug": "",
            "fiche_url": prospect.get("fiche_url") or "",
            "page_url": prospect.get("page_url") or "",
            "score": int(prospect.get("score") or 0),
        })

    # Les inscrits que la prospection n'a jamais croisés : ce sont eux qui font
    # de cette page un RECENSEMENT et pas une liste d'appels. Leur ville et
    # leurs familles restent vides — `annuaire()` ne rapporte que le nom et les
    # numéros, et aller chercher le reste serait une seconde requête au site.
    for fournisseur in inscrits:
        if fournisseur["id"] in apparies:
            continue
        # `tel` et `tel2` sont souvent le MÊME numéro (le WhatsApp recopié du
        # téléphone) : l'afficher deux fois donne l'air d'une fiche mal saisie.
        numeros = list(dict.fromkeys(
            n for n in (fournisseur.get("tel"), fournisseur.get("tel2")) if n
        ))
        lignes.append({
            "cle": "akora:" + fournisseur["id"],
            "nom": fournisseur.get("raison_sociale") or "Sans raison sociale",
            "telephones": numeros,
            "ville": "",
            "quartier": "",
            "familles": [],
            "nb_offres": 0,
            "statut": "inscrit",
            "client": True,
            "raison_client": "inscrit sur akora.fonenako.mg",
            "origine": "site",
            "prospect_id": "",
            "fournisseur_id": fournisseur["id"],
            "slug": fournisseur.get("slug") or "",
            "fiche_url": "",
            "page_url": "",
            "score": 0,
        })

    lignes.sort(key=lambda l: (l["nom"] or "").casefold())
    return {
        "lignes": lignes,
        "avertissement": avertissement,
        "compte": {
            "total": len(lignes),
            "inscrits": sum(1 for l in lignes if l["client"]),
            "prospects": sum(1 for l in lignes if l["origine"] != "site"),
            "croises": len(apparies),
        },
    }


def exporter_annuaire_csv() -> str:
    """Le recensement, ouvrable dans Excel. Même recette que l'export d'appels.

    Point-virgule et BOM : Excel francophone découpe sur le point-virgule, et
    sans BOM il lit « Ambohibao » en « AmbohibaoÂ ».
    """
    donnees = annuaire_croise()
    tampon = io.StringIO()
    graveur = csv.DictWriter(
        tampon, fieldnames=COLONNES_ANNUAIRE, extrasaction="ignore", delimiter=";"
    )
    graveur.writeheader()
    for ligne in donnees["lignes"]:
        graveur.writerow({
            **{c: ligne.get(c) for c in COLONNES_ANNUAIRE},
            "telephones": " / ".join(ligne["telephones"]),
            "familles": ", ".join(ligne["familles"]),
            "client": "oui" if ligne["client"] else "",
        })
    return "﻿" + tampon.getvalue()


def bilan() -> dict:
    """Le taux de transformation, de la collecte à la revendication."""
    compte = base.compteurs()
    contactes = compte["contacte"] + compte["relance"] + compte["revendique"] + compte["refuse"]
    return {
        "collectes": compte["total"],
        "reserves": compte["reserve"] + contactes,
        "contactes": contactes,
        "revendiques": compte["revendique"],
        "refuses": compte["refuse"],
        "taux_revendication": (
            round(compte["revendique"] / contactes * 100) if contactes else 0
        ),
    }
