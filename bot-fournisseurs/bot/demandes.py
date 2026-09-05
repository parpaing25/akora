"""Les demandes d'acheteurs : le besoin, capturé au lieu d'être jeté.

Le bot écartait ces publications. « Mila fasika 3 camion aho eto Ivato » a la
forme d'une offre, et le filtre du fil le renvoyait comme « pas un vendeur ».
C'était juste — mais s'arrêter là revenait à jeter le plus utile.

Pour une marketplace qui démarre, **la demande vaut plus cher que l'offre** :

  - c'est un acheteur joignable, avec un besoin daté, chiffré et localisé ;
  - c'est l'argument qui fait signer un dépôt qui hésite. « Inscrivez-vous »
    ne convainc personne ; « il y a eu 12 demandes de sable dans votre zone
    cette semaine, en voici trois » convainc tout de suite ;
  - c'est la mesure du marché : si personne ne demande de claustra, inutile
    d'aller prospecter des fabricants de claustra.

🔒 Ces demandes restent **internes**. Rien n'est republié dans le fil Akora :
personne n'a donné son accord pour que sa recherche de sable soit reproduite
ailleurs sous son nom. Le fil du site a bien un type `demande`, mais il exige
un `auteur_id` — c'est-à-dire un compte, c'est-à-dire un consentement.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from . import base

STATUTS = ("nouvelle", "traitee", "ignoree")

UNITES_LISIBLES = {
    "piece": "pièce(s)", "sac": "sac(s)", "m3": "m³", "tonne": "tonne(s)",
    "m2": "m²", "ml": "m", "botte": "botte(s)", "chargement": "chargement(s)",
    "palette": "palette(s)",
}


def enregistrer(lecture: dict, post: dict, source: dict, empreinte: str,
                dossier: str) -> str | None:
    """Range une demande. Renvoie son identifiant, ou None si déjà connue."""
    return base.ajouter_demande({
        "empreinte": empreinte,
        "permalien": post.get("permalien") or "",
        "source_id": source.get("id"),
        "source_nom": source.get("nom"),
        "auteur": (post.get("auteur") or "").strip(),
        "auteur_url": post.get("auteur_url") or "",
        "texte": post.get("texte") or "",
        "publie_le": post.get("heure") or "",
        # La date résolue, vide quand elle est illisible. « 1 sem. »
        # ci-dessus était vrai le jour de la collecte et faux le
        # lendemain : une demande se lit à sa date, pas à son âge figé.
        "publie_date": post.get("publie_date") or "",
        "dossier": dossier,
        **{c: lecture.get(c) for c in (
            "telephone", "telephone_cle", "ville", "quartier", "langue",
            "materiau_slug", "materiau_nom", "type_slug", "type_nom",
            "famille_slug", "quantite", "unite", "budget", "urgence")},
    })


def resume_quantite(demande: dict) -> str:
    """« 3 chargement(s) » — vide si l'acheteur n'a rien chiffré."""
    if not demande.get("quantite"):
        return ""
    quantite = demande["quantite"]
    nombre = f"{quantite:g}"
    return f"{nombre} {UNITES_LISIBLES.get(demande.get('unite') or '', '')}".strip()


def _depuis(jours: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=jours)).isoformat(
        timespec="seconds"
    )


def pression_du_marche(jours: int = 7) -> list[dict]:
    """Ce que les acheteurs réclament, du plus demandé au moins, sur N jours.

    C'est la liste qui dit où prospecter en priorité : un matériau très demandé
    et servi par personne est un trou à combler cette semaine, pas un jour.
    """
    limite = _depuis(jours)
    groupes: dict[str, dict] = {}
    for demande in base.lister_demandes(limite=1000):
        if (demande.get("collecte_le") or "") < limite:
            continue
        cle = demande.get("type_slug") or demande.get("famille_slug") or "inconnu"
        groupe = groupes.setdefault(cle, {
            "type_slug": demande.get("type_slug"),
            "libelle": demande.get("type_nom") or demande.get("materiau_nom")
            or "Matériau non reconnu",
            "famille_slug": demande.get("famille_slug"),
            "demandes": 0,
            "urgentes": 0,
            "villes": {},
            "avec_contact": 0,
        })
        groupe["demandes"] += 1
        groupe["urgentes"] += 1 if demande.get("urgence") else 0
        groupe["avec_contact"] += 1 if demande.get("telephone_cle") else 0
        ville = demande.get("ville") or "Lieu inconnu"
        groupe["villes"][ville] = groupe["villes"].get(ville, 0) + 1

    resultat = []
    for groupe in groupes.values():
        villes = sorted(groupe["villes"].items(), key=lambda v: -v[1])
        resultat.append({
            **{c: groupe[c] for c in (
                "type_slug", "libelle", "famille_slug", "demandes",
                "urgentes", "avec_contact")},
            "villes": [{"ville": v, "n": n} for v, n in villes[:4]],
        })
    resultat.sort(key=lambda r: (-r["demandes"], -r["urgentes"]))
    return resultat


def fournisseurs_capables(demande_id: str, limite: int = 6) -> list[dict]:
    """Qui, parmi les prospects, peut servir cette demande — et qui est le mieux placé.

    L'ordre : même matériau exact d'abord, même type ensuite, puis la même
    ville, puis le score. Un dépôt à Toamasina ne sert pas un chantier à Tana,
    et le proposer ferait perdre un appel des deux côtés.
    """
    demande = base.demande(demande_id)
    if not demande:
        return []

    candidats = []
    for prospect in base.lister_prospects(statut="tous", tri="score", limite=1000):
        if prospect["statut"] in ("refuse", "rejete", "doublon"):
            continue
        offres = base.offres_du_prospect(prospect["id"])
        exact = any(
            o.get("materiau_slug") and o["materiau_slug"] == demande.get("materiau_slug")
            for o in offres
        )
        meme_type = any(
            o.get("type_slug") and o["type_slug"] == demande.get("type_slug")
            for o in offres
        )
        if not (exact or meme_type):
            continue
        meme_ville = bool(
            demande.get("ville") and prospect.get("ville") == demande["ville"]
        )
        prix = next(
            (o["prix"] for o in offres
             if o.get("materiau_slug") == demande.get("materiau_slug") and o.get("prix")),
            None,
        )
        candidats.append({
            "id": prospect["id"],
            "nom": prospect.get("nom"),
            "ville": prospect.get("ville"),
            "quartier": prospect.get("quartier"),
            "telephone": prospect.get("telephone"),
            "statut": prospect["statut"],
            "score": prospect["score"],
            "exact": exact,
            "meme_ville": meme_ville,
            "prix": prix,
            "nature": prospect.get("nature") or "depot",
        })

    candidats.sort(
        key=lambda c: (not c["exact"], not c["meme_ville"], -(c["score"] or 0))
    )
    return candidats[:limite]


def argumentaire(prospect_id: str, jours: int = 7) -> dict:
    """« Voici ce que les acheteurs ont demandé chez vous cette semaine. »

    Le seul argument qui déplace un dépôt : pas la promesse de visibilité, la
    preuve d'une demande qu'il ne voit pas. Ne renvoie que les demandes que CE
    prospect peut servir, dans SA ville.
    """
    prospect = base.prospect(prospect_id)
    if not prospect:
        return {"demandes": [], "total": 0}

    types_vendus = {
        o["type_slug"] for o in prospect["offres"] if o["garder"] and o.get("type_slug")
    }
    limite = _depuis(jours)
    retenues = []
    for demande in base.lister_demandes(limite=1000):
        if (demande.get("collecte_le") or "") < limite:
            continue
        if demande.get("type_slug") not in types_vendus:
            continue
        if prospect.get("ville") and demande.get("ville") \
                and demande["ville"] != prospect["ville"]:
            continue
        retenues.append({
            "materiau": demande.get("materiau_nom") or demande.get("type_nom"),
            "quantite": resume_quantite(demande),
            "lieu": demande.get("quartier") or demande.get("ville") or "",
            "urgence": bool(demande.get("urgence")),
            # La date réelle si on la connaît ; le texte relatif de
            # Facebook seulement en repli, et jamais la date du jour.
            "quand": (demande.get("publie_date")
                      or demande.get("publie_le") or ""),
        })
    return {"demandes": retenues[:6], "total": len(retenues), "jours": jours}


def changer_statut(demande_id: str, statut: str, note: str = "") -> dict:
    if statut not in STATUTS:
        raise ValueError(f"Statut de demande inconnu : {statut}")
    champs = {"statut": statut}
    if note:
        champs["note"] = note
    base.modifier_demande(demande_id, champs)
    return base.demande(demande_id)
