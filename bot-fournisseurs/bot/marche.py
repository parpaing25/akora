"""Observatoire des prix et trous de couverture.

C'est l'avantage propre à Akora, celui que le bot de Fonenako ne pouvait pas
avoir : **le prix est le produit**. Chaque tarif relevé sur Facebook a de la
valeur même si le dépôt ne s'inscrit jamais.

Ce que ça donne, concrètement :

  - **un prix de marché par matériau** (minimum, médiane, maximum, nombre de
    dépôts) — de quoi dire à un fournisseur au téléphone « la médiane du
    parpaing 15 à Tana est à 1 400 Ar, vous êtes à 1 750 » ;
  - **les trous de couverture** : quelle famille de matériaux n'a aucun
    fournisseur dans quelle ville. C'est la liste de prospection, dans l'ordre.

La médiane, jamais la moyenne : un seul dépôt qui poste un prix de gros fausse
une moyenne, pas une médiane.
"""
from __future__ import annotations

from datetime import datetime, timezone
from statistics import median

from . import akora, base, referentiel


def _mois(horodatage: str) -> str:
    try:
        return datetime.fromisoformat(horodatage).strftime("%Y-%m")
    except (ValueError, TypeError):
        return ""


def observatoire(famille: str = "", ville: str = "") -> list[dict]:
    """Un prix de marché par matériau, du mieux renseigné au moins bien.

    Un matériau vu chez un seul dépôt n'a pas de « prix de marché » : la ligne
    existe quand même, mais `fiable` est faux et l'interface le dit — un chiffre
    présenté comme une référence alors qu'il vient d'une seule publication est
    pire que pas de chiffre du tout.
    """
    lignes = base.toutes_les_offres_appariees()
    groupes: dict[str, dict] = {}

    for ligne in lignes:
        if famille and ligne.get("famille_slug") != famille:
            continue
        if ville and (ligne.get("ville") or "") != ville:
            continue
        slug = ligne["materiau_slug"]
        groupe = groupes.setdefault(slug, {
            "materiau_slug": slug,
            "materiau_nom": ligne["materiau_nom"],
            "type_nom": ligne["type_nom"],
            "famille_slug": ligne["famille_slug"],
            "unite": ligne["unite"],
            "prix": [],
            "fournisseurs": set(),
            "villes": set(),
            "derniere": "",
        })
        groupe["prix"].append(int(ligne["prix"]))
        groupe["fournisseurs"].add(ligne["prospect_id"])
        if ligne.get("ville"):
            groupe["villes"].add(ligne["ville"])
        if (ligne.get("vu_le") or "") > groupe["derniere"]:
            groupe["derniere"] = ligne["vu_le"]

    resultat = []
    for groupe in groupes.values():
        prix = sorted(groupe["prix"])
        nb_fournisseurs = len(groupe["fournisseurs"])
        milieu = int(median(prix))
        resultat.append({
            "materiau_slug": groupe["materiau_slug"],
            "materiau_nom": groupe["materiau_nom"],
            "type_nom": groupe["type_nom"],
            "famille_slug": groupe["famille_slug"],
            "unite": groupe["unite"],
            "nb_releves": len(prix),
            "nb_fournisseurs": nb_fournisseurs,
            "min": prix[0],
            "median": milieu,
            "max": prix[-1],
            # L'écart dit s'il y a un marché à faire : 10 % d'écart, personne ne
            # change de dépôt ; 60 %, c'est tout l'argument d'Akora.
            "ecart_pct": round((prix[-1] - prix[0]) / prix[0] * 100) if prix[0] else 0,
            "villes": sorted(groupe["villes"]),
            "derniere": groupe["derniere"],
            "fiable": nb_fournisseurs >= 3,
        })
    resultat.sort(key=lambda r: (-r["nb_fournisseurs"], -r["nb_releves"]))
    return resultat


def historique(materiau_slug: str) -> list[dict]:
    """Le prix médian mois par mois, pour un matériau. Vide avant deux mois."""
    par_mois: dict[str, list[int]] = {}
    for ligne in base.toutes_les_offres_appariees():
        if ligne["materiau_slug"] != materiau_slug:
            continue
        cle = _mois(ligne.get("vu_le") or "")
        if cle:
            par_mois.setdefault(cle, []).append(int(ligne["prix"]))
    return [
        {"mois": mois, "median": int(median(prix)), "releves": len(prix)}
        for mois, prix in sorted(par_mois.items())
    ]


def _fournisseurs_akora_par_famille() -> dict[str, set[str]]:
    """Ce que l'annuaire RÉEL d'Akora couvre déjà, par famille et par localité.

    Sans ce complément, la carte des trous ne verrait que ce que le bot a
    collecté et enverrait prospecter là où un fournisseur est déjà en ligne.
    """
    try:
        lignes = akora.executer(
            "select distinct c.slug as famille, coalesce(l.nom, '') as ville "
            "  from public.produits p "
            "  join public.categories c on c.id = p.categorie_id "
            "  join public.fournisseurs f on f.id = p.fournisseur_id "
            "  left join public.localites l on l.id = f.localite_id "
            " where p.statut = 'actif' and f.statut = 'actif';"
        )
    except akora.ErreurAkora:
        return {}
    couverture: dict[str, set[str]] = {}
    for ligne in lignes:
        couverture.setdefault(ligne["famille"], set()).add(ligne["ville"])
    return couverture


def couverture() -> dict:
    """Où manque-t-il des fournisseurs, et pour quelle famille de matériaux.

    Croise trois sources : ce que le bot a collecté, ce que l'annuaire Akora
    porte déjà, et la liste fermée des huit familles. Ce qui reste vide est la
    prochaine liste d'appels.
    """
    try:
        catalogue = referentiel.charger()
        familles = [
            {"slug": slug, "nom": fiche["nom"]}
            for slug, fiche in catalogue["familles"].items()
        ]
    except Exception:
        familles = []

    prospects_par_ville: dict[str, dict[str, int]] = {}
    for ligne in base.toutes_les_offres_appariees():
        ville = ligne.get("ville") or "Lieu inconnu"
        prospects_par_ville.setdefault(ville, {})
        famille = ligne.get("famille_slug") or ""
        prospects_par_ville[ville][famille] = \
            prospects_par_ville[ville].get(famille, 0) + 1

    en_ligne = _fournisseurs_akora_par_famille()

    cases = []
    for ville, familles_vues in sorted(prospects_par_ville.items()):
        for famille in familles:
            nb = familles_vues.get(famille["slug"], 0)
            deja = ville in en_ligne.get(famille["slug"], set())
            cases.append({
                "ville": ville,
                "famille_slug": famille["slug"],
                "famille_nom": famille["nom"],
                "prospects": nb,
                "en_ligne": deja,
                # Un trou : personne en ligne, et pas non plus de prospect à
                # appeler. C'est là qu'il faut lancer une recherche Facebook.
                "trou": (not deja) and nb == 0,
            })

    return {
        "familles": familles,
        "villes": sorted(prospects_par_ville),
        "cases": cases,
        "trous": [c for c in cases if c["trou"]],
    }


def resume() -> dict:
    """Les trois chiffres du tableau de bord."""
    lignes = base.toutes_les_offres_appariees()
    prix = [int(l["prix"]) for l in lignes]
    villes = {l.get("ville") for l in lignes if l.get("ville")}
    materiaux = {l["materiau_slug"] for l in lignes}
    fraicheur = max((l.get("vu_le") or "" for l in lignes), default="")
    return {
        "releves": len(prix),
        "materiaux_suivis": len(materiaux),
        "villes": len(villes),
        "derniere_maj": fraicheur,
        "age_jours": _age(fraicheur),
    }


def _age(horodatage: str) -> int | None:
    if not horodatage:
        return None
    try:
        quand = datetime.fromisoformat(horodatage)
    except ValueError:
        return None
    if quand.tzinfo is None:
        quand = quand.replace(tzinfo=timezone.utc)
    return max(0, int((datetime.now(timezone.utc) - quand).total_seconds() // 86400))
