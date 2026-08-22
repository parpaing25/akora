"""Appariement d'un texte Facebook au catalogue fermé d'Akora.

C'est la pièce qui n'existe pas dans le bot de Fonenako, et c'est la plus
importante : sur Akora, **un produit sans `materiau_ref_id` ne peut jamais
passer en `actif`** (contrainte `produits_publiable_avec_reference`). Autrement
dit, une offre que le bot n'arrive pas à rattacher au référentiel n'est pas une
offre — c'est une note à trier à la main.

Trois niveaux, comme la base : famille › type › format.

  « Parpaing 15 : 1 400 Ar »   ->  agglomeres / parpaing-creux / parpaing-creux-15
  « Biriky 1300 ar »           ->  agglomeres / parpaing-creux / AMBIGU (quel format ?)
  « Fasika 90 000 le m3 »      ->  granulats  / sable          / AMBIGU (fin ? rivière ?)
  « Fer 8 : 22 000 la barre »  ->  acier      / fer-a-beton    / fer-a-beton-8

Une offre ambiguë n'est PAS jetée : elle est gardée avec son type, et
l'interface demande le format en un clic. Jeter aurait fait perdre la moitié
des publications malgaches, où « biriky » tout court est la norme.
"""
from __future__ import annotations

import json
import re
import unicodedata
from difflib import SequenceMatcher

from . import akora, base
from .config import CACHE_REFERENTIEL

# Mots trop courants pour désigner un matériau à eux seuls. Sans cette liste,
# « plancher » (synonyme de hourdis) attrape toutes les phrases qui parlent de
# l'étage, et « fil » attrape « fil d'attente ».
TROP_COURANTS = {"dalle", "plancher", "panneau", "boite", "chambre", "fil",
                 "pierre", "tany", "hazo", "vato", "biriky", "bloc", "tafo"}

# Unités reconnues dans le texte -> enum `unite` d'Akora.
UNITES = {
    "piece": ["piece", "pieces", "pce", "pcs", "unite", "u", "iray", "pc"],
    "sac": ["sac", "sacs", "gony", "sachet"],
    "m3": ["m3", "m³", "metre cube", "metres cubes", "mcube", "cube"],
    "tonne": ["tonne", "tonnes", "t", "tn"],
    "m2": ["m2", "m²", "metre carre", "metres carres"],
    "ml": ["ml", "metre lineaire", "metre", "metres", "barre", "barres", "longueur"],
    "botte": ["botte", "bottes", "fagot", "paquet"],
    "chargement": ["chargement", "camion", "benne", "voyage", "remorque", "toby"],
    "palette": ["palette", "palettes"],
}

# Ce que le fournisseur EST, en un mot — colonne `fournisseurs.metier`.
METIERS = {
    "Dépôt": ["depot", "quincaillerie", "magasin", "stock", "vente materiaux"],
    "Briqueterie": ["briqueterie", "briquerie", "fabrique de brique", "biriky"],
    "Carrière": ["carriere", "concassage", "concasseur", "gisement"],
    "Scierie": ["scierie", "sciage", "menuiserie", "hazo"],
    "Centrale à béton": ["centrale a beton", "beton pret", "toupie", "malaxeur"],
    "Transporteur": ["transport", "camion benne", "location camion"],
}


def sans_accents(texte: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texte or "")
        if unicodedata.category(c) != "Mn"
    ).lower()


def normaliser(texte: str) -> str:
    """Minuscules, sans accents, ponctuation ramenée à des espaces."""
    reduit = sans_accents(texte)
    reduit = reduit.replace("²", "2").replace("³", "3").replace("ø", "o")
    reduit = re.sub(r"[^a-z0-9x/,.'-]+", " ", reduit)
    return re.sub(r"\s+", " ", reduit).strip()


def _mot_present(expression: str, dans: str) -> bool:
    """Cherche une expression en respectant les frontières de mot."""
    motif = re.escape(sans_accents(expression)).replace(r"\ ", r"[\s\-']+")
    return re.search(rf"(?<![a-z0-9]){motif}(?![a-z0-9])", dans) is not None


# ── Chargement du catalogue ────────────────────────────────────────────────
_catalogue: dict | None = None


def charger(force: bool = False) -> dict:
    """Le référentiel, depuis le cache disque ou depuis Akora."""
    global _catalogue
    if _catalogue is not None and not force:
        return _catalogue
    if CACHE_REFERENTIEL.exists() and not force:
        _catalogue = _indexer(json.loads(CACHE_REFERENTIEL.read_text(encoding="utf-8")))
        return _catalogue
    return synchroniser()


def synchroniser() -> dict:
    """Retélécharge le référentiel depuis Akora et le met en cache."""
    global _catalogue
    brut = akora.lire_referentiel()
    CACHE_REFERENTIEL.parent.mkdir(parents=True, exist_ok=True)
    CACHE_REFERENTIEL.write_text(
        json.dumps(brut, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    _catalogue = _indexer(brut)
    base.logguer(
        f"Référentiel Akora synchronisé : {len(brut['familles'])} familles, "
        f"{len(brut['types'])} types, {len(brut['materiaux'])} formats.",
        "succes",
    )
    return _catalogue


def est_charge() -> bool:
    return _catalogue is not None or CACHE_REFERENTIEL.exists()


def _formats_du_slug(slug: str, type_slug: str | None) -> list[str]:
    """« parpaing-creux-15 » sous le type « parpaing-creux » -> ['15'].

    Le suffixe du slug est l'indication de format la plus fiable du référentiel :
    il existe toujours, là où `libelle_court` peut ne pas avoir été rempli.
    """
    if type_slug and slug.startswith(type_slug + "-"):
        reste = slug[len(type_slug) + 1:]
    else:
        reste = slug.rsplit("-", 1)[-1] if "-" in slug else ""
    return [m for m in re.split(r"[-_]", reste) if m]


def _indexer(brut: dict) -> dict:
    """Prépare les tables de recherche une fois pour toutes."""
    types = {t["slug"]: dict(t) for t in brut.get("types", [])}
    materiaux = {}
    par_type: dict[str, list[dict]] = {}

    for materiau in brut.get("materiaux", []):
        fiche = dict(materiau)
        attributs = fiche.get("attributs") or {}
        if isinstance(attributs, str):
            attributs = json.loads(attributs)
        fiche["attributs"] = attributs

        # Les repères numériques qui distinguent ce format des autres du type :
        # suffixe du slug, libellé court, dimensions, et les attributs chiffrés.
        reperes = set(_formats_du_slug(fiche["slug"], fiche.get("type_slug")))
        for source in (fiche.get("libelle_court"), fiche.get("dimensions")):
            if source:
                reperes.update(re.findall(r"[0-9]+", str(source)))
        for cle in ("epaisseur_cm", "hauteur_cm", "largeur_cm", "longueur_cm",
                    "diametre_mm", "diametre"):
            if attributs.get(cle) is not None:
                reperes.add(str(int(float(attributs[cle]))))
        fiche["reperes"] = {r for r in reperes if r}

        # Les mots du nom qui n'appartiennent pas au type : « fin », « rivière »,
        # « CEM II ». Ce sont eux qui départagent « Sable fin » de « Sable de
        # rivière », là où aucun chiffre ne le fait.
        mots_type = set(re.split(r"[\s-]+", normaliser(
            (types.get(fiche.get("type_slug"), {}) or {}).get("nom", "")
        )))
        fiche["mots_distinctifs"] = {
            m for m in re.split(r"[\s,()-]+", normaliser(fiche["nom"]))
            if len(m) >= 2 and m not in mots_type and not m.isdigit()
        }
        fiche["nom_normalise"] = normaliser(fiche["nom"])

        materiaux[fiche["slug"]] = fiche
        par_type.setdefault(fiche.get("type_slug") or "", []).append(fiche)

    # Index des appellations : chaque expression pointe vers un type, avec un
    # poids. Le nom officiel vaut plus qu'un synonyme, qui peut être partagé
    # (« biriky » désigne aussi bien un parpaing qu'une brique).
    appellations: list[tuple[str, str, int]] = []
    for slug, fiche in types.items():
        if fiche.get("nom"):
            appellations.append((normaliser(fiche["nom"]), slug, 6))
        if fiche.get("nom_mg"):
            appellations.append((normaliser(fiche["nom_mg"]), slug, 5))
        synonymes = fiche.get("synonymes") or []
        if isinstance(synonymes, str):
            synonymes = json.loads(synonymes)
        for synonyme in synonymes:
            expression = normaliser(synonyme)
            if expression:
                appellations.append((expression, slug, 2 if " " in expression else 1))
        fiche["synonymes"] = synonymes

    # Les expressions longues d'abord : « parpaing creux » doit gagner contre
    # « parpaing », et « vato madinika » contre « vato ».
    appellations.sort(key=lambda a: len(a[0]), reverse=True)

    return {
        "familles": {f["slug"]: f for f in brut.get("familles", [])},
        "types": types,
        "materiaux": materiaux,
        "par_type": par_type,
        "appellations": appellations,
    }


# ── Appariement ────────────────────────────────────────────────────────────
def _candidats_types(ligne_normalisee: str) -> list[tuple[str, int, str]]:
    """(slug de type, poids, expression trouvée), du plus probable au moins."""
    catalogue = charger()
    marques: dict[str, tuple[int, str]] = {}
    for expression, slug, poids in catalogue["appellations"]:
        if len(expression) < 3:
            continue
        if expression in TROP_COURANTS and poids <= 1:
            # Un synonyme trop courant ne suffit pas seul, mais il compte quand
            # un autre indice a déjà désigné le même type.
            if slug not in marques:
                continue
        if not _mot_present(expression, ligne_normalisee):
            continue
        precedent = marques.get(slug)
        cumul = (precedent[0] if precedent else 0) + poids
        marques[slug] = (cumul, expression if not precedent else precedent[1])
    return sorted(
        ((slug, poids, expression) for slug, (poids, expression) in marques.items()),
        key=lambda c: (-c[1], -len(c[2])),
    )


def _nombres_de_format(ligne_normalisee: str, exclure: set[str]) -> list[str]:
    """Les nombres qui peuvent être un format, jamais un prix.

    Un prix de matériau à Madagascar se compte en milliers ; un format se
    compte en centimètres ou en millimètres. Le seuil à 1 000 sépare les deux
    sans jamais avoir besoin de savoir lequel est lequel.
    """
    trouves = []
    for brut in re.findall(r"\d+(?:[.,]\d+)?", ligne_normalisee):
        entier = brut.split(",")[0].split(".")[0]
        if entier in exclure:
            continue
        try:
            valeur = int(entier)
        except ValueError:
            continue
        if 1 <= valeur <= 1000:
            trouves.append(entier)
    return trouves


def _choisir_format(type_slug: str, ligne_normalisee: str,
                    nombres_prix: set[str]) -> tuple[dict | None, int]:
    """(matériau, certitude 0-100). None si le format reste indécidable."""
    catalogue = charger()
    candidats = catalogue["par_type"].get(type_slug) or []
    if not candidats:
        return None, 0
    if len(candidats) == 1:
        # Type à format unique (poutrelle, fil recuit…) : aucune ambiguïté.
        return candidats[0], 90

    nombres = _nombres_de_format(ligne_normalisee, nombres_prix)

    # 1. Une dimension complète écrite telle quelle : « 40x20x15 ».
    dimension = re.search(r"\d+\s*x\s*\d+(?:\s*x\s*\d+)?", ligne_normalisee)
    if dimension:
        compacte = re.sub(r"\s*", "", dimension.group(0))
        for materiau in candidats:
            reference = re.sub(r"\s*", "", normaliser(materiau.get("dimensions") or ""))
            if reference and reference == compacte:
                return materiau, 98
        # Sinon la dernière valeur de la dimension est l'épaisseur : c'est la
        # convention des blocs (40x20x15 = un 15).
        derniere = re.findall(r"\d+", compacte)[-1]
        for materiau in candidats:
            if derniere in materiau["reperes"]:
                return materiau, 92

    # 2. Un repère numérique du format présent dans la ligne.
    for nombre in nombres:
        correspondants = [m for m in candidats if nombre in m["reperes"]]
        if len(correspondants) == 1:
            return correspondants[0], 90
        if len(correspondants) > 1:
            return correspondants[0], 60

    # 3. Aucun chiffre ne tranche : les mots distinctifs (« fin », « rivière »).
    meilleur, points = None, 0
    for materiau in candidats:
        trouves = sum(
            1 for mot in materiau["mots_distinctifs"]
            if len(mot) >= 3 and _mot_present(mot, ligne_normalisee)
        )
        if trouves > points:
            meilleur, points = materiau, trouves
    if meilleur:
        return meilleur, min(85, 55 + points * 15)

    return None, 0


def apparier(libelle: str, nombres_prix: set[str] | None = None) -> dict | None:
    """Rattache un libellé au catalogue. None si rien ne s'en approche.

    `nombres_prix` : les chiffres déjà identifiés comme un montant, à ne pas
    relire comme un format. Sans ça, « hourdis 1 800 Ar » ferait chercher un
    hourdis de 800.
    """
    if not libelle or not libelle.strip():
        return None
    ligne = normaliser(libelle)
    nombres_prix = nombres_prix or set()

    candidats = _candidats_types(ligne)
    if not candidats:
        # Dernier recours : le nom complet d'un format, écrit presque à
        # l'identique. Rattrape « contreplaqué 15 mm » quand le type n'a pas été
        # vu parce que le mot est écrit « ctp ».
        catalogue = charger()
        meilleur, ressemblance = None, 0.0
        for materiau in catalogue["materiaux"].values():
            proche = SequenceMatcher(None, ligne, materiau["nom_normalise"]).ratio()
            if proche > ressemblance:
                meilleur, ressemblance = materiau, proche
        if meilleur and ressemblance >= 0.72:
            type_fiche = charger()["types"].get(meilleur.get("type_slug"), {})
            return _fiche(meilleur, type_fiche, int(ressemblance * 80), ambigu=False)
        return None

    type_slug, poids, _ = candidats[0]
    type_fiche = charger()["types"].get(type_slug, {})
    materiau, certitude = _choisir_format(type_slug, ligne, nombres_prix)

    # Deux types se disputent la ligne (« biriky » = parpaing ou brique) :
    # la certitude baisse, l'interface demandera confirmation.
    if len(candidats) > 1 and candidats[1][1] >= poids:
        certitude = min(certitude, 55)

    if materiau is None:
        return {
            "materiau_slug": None,
            "materiau_nom": None,
            "type_slug": type_slug,
            "type_nom": type_fiche.get("nom"),
            "famille_slug": type_fiche.get("famille"),
            "unite": None,
            "certitude": min(50, poids * 8),
            "ambigu": 1,
            "hors_catalogue": 0,
        }
    return _fiche(materiau, type_fiche, certitude, ambigu=False)


def _fiche(materiau: dict, type_fiche: dict, certitude: int, ambigu: bool) -> dict:
    return {
        "materiau_slug": materiau["slug"],
        "materiau_nom": materiau["nom"],
        "type_slug": materiau.get("type_slug") or type_fiche.get("slug"),
        "type_nom": type_fiche.get("nom"),
        "famille_slug": materiau.get("famille") or type_fiche.get("famille"),
        "unite": materiau.get("unite"),
        "certitude": max(0, min(100, certitude)),
        "ambigu": 1 if ambigu else 0,
        "hors_catalogue": 0,
    }


def unite_dans(texte: str) -> str | None:
    """L'unité de vente annoncée dans une ligne, sinon None."""
    ligne = normaliser(texte)
    for enum, variantes in UNITES.items():
        for variante in sorted(variantes, key=len, reverse=True):
            if _mot_present(variante, ligne):
                return enum
    return None


def metier_dans(texte: str) -> str | None:
    """Dépôt, Briqueterie, Carrière… — ce que le fournisseur EST."""
    ligne = normaliser(texte)
    for metier, variantes in METIERS.items():
        for variante in variantes:
            if _mot_present(variante, ligne):
                return metier
    return None


def formats_du_type(type_slug: str) -> list[dict]:
    """Les formats proposés dans l'interface quand une offre est ambiguë."""
    catalogue = charger()
    return [
        {
            "slug": m["slug"],
            "nom": m["nom"],
            "libelle_court": m.get("libelle_court"),
            "unite": m.get("unite"),
        }
        for m in catalogue["par_type"].get(type_slug, [])
    ]


def arbre() -> list[dict]:
    """Familles › types › formats, pour les listes déroulantes de l'interface."""
    catalogue = charger()
    par_famille: dict[str, dict] = {}
    for slug, famille in catalogue["familles"].items():
        par_famille[slug] = {"slug": slug, "nom": famille["nom"], "types": []}
    for slug, type_fiche in catalogue["types"].items():
        famille = par_famille.get(type_fiche.get("famille"))
        if famille is None:
            continue
        famille["types"].append({
            "slug": slug,
            "nom": type_fiche["nom"],
            "formats": formats_du_type(slug),
        })
    return list(par_famille.values())
