"""La mesure exacte d'un matériau, lue dans la ligne du dépôt.

C'est la pièce qui manquait entre ce que le terrain écrit et ce que le
catalogue connaît. Un dépôt annonce :

    #MADRIER 4m : (KININIA MENA BE)
    ✓ 15cmx7cmx4m= 35 000ar
    ✓ 17cmx7cmx4m = 38 000ar

Le type vient de l'en-tête, la **cote** vient de la ligne. Ce module ne fait
que lire cette cote — exactement, ou pas du tout.

🔴 POURQUOI LA FORME CANONIQUE EST TOUT L'ENJEU. Le même madrier s'écrit
   « 15cmx7cmx4m », « 7/15 », « 17cm*7cm », « Madrier 5 m 14/6 ». Sans mise en
   forme commune, chaque écriture deviendrait une référence distincte au
   catalogue — et deux dépôts vendant la même section ne se compareraient
   plus. Or comparer est la seule raison d'être d'Akora.

   On range donc toujours la section du plus petit au plus grand :
   `(épaisseur, largeur, longueur)`. `15x7` et `7x15` rendent la même chose.

🔒 CE QU'IL NE FAIT JAMAIS
   * deviner une cote absente — « Mm », « GM », « 2eme choix » ne rendent rien ;
   * lire un prix comme une dimension : « ✓ Mm >>> 3 500ar » donnerait une
     section de 3 cm, et c'est ce qui gonflait les compteurs le 01/09/2026.
     Les montants sont retirés AVANT toute lecture ;
   * trancher une ligne qui nomme deux sections pour un seul prix
     (« Madrier 5 m 14/6 dia 15/6 : 50 000 Ar » — le prix est celui du 15/6).
"""
from __future__ import annotations

import re

# « 15cmx7cmx4m », « 10,11cmx1, 5cm », « 5*5 », « 17cm*7cm », « 14/6 ».
# ⚠ Pas de \b après l'unité : « 15cmx7cmx4m » n'a aucune frontière de mot
#   entre « cm » et « x », et le motif n'y lisait qu'une cote sur trois.
MESURE = re.compile(r"(\d+(?:[.,]\s?\d+)?)\s*(cm|mm|m)?", re.IGNORECASE)

# Un montant écrit comme un Malgache l'écrit : « 35 000ar », « 35.000 Ar ».
MONTANT = re.compile(r"\d[\d\s.,  ]*\s*(?:ar|ariary|fmg)\b", re.IGNORECASE)

# « 14/6 », la notation courte d'une section. Deux dans la même ligne, et la
# ligne parle de deux articles pour un seul prix.
SECTION_COURTE = re.compile(r"\d+\s*/\s*\d+")

# Au-delà, ce n'est plus une section de bois : c'est un nombre de pièces, une
# année, un numéro de téléphone.
CM_MAX = 300.0
M_MAX = 12.0


def sans_les_montants(ligne: str) -> str:
    """La ligne débarrassée de ses prix. À faire AVANT de lire des cotes."""
    return MONTANT.sub(" ", ligne or "")


def deux_sections(ligne: str) -> bool:
    """La ligne nomme-t-elle deux articles pour un seul prix ?"""
    return len(SECTION_COURTE.findall(sans_les_montants(ligne))) > 1


def _valeurs(brut: str) -> list[float]:
    """« 1, 5 » est UN nombre décimal ; « 13, 14 » en est DEUX.

    La règle vient de l'écriture réelle des dépôts : une décimale n'a qu'un
    chiffre après la virgule (1,5 · 2,5 · 0,40), tandis qu'une fourchette
    aligne deux nombres de même taille (« 10,11cm », « 13, 14cm » = de 10 à
    11 cm). Confondre les deux donnait une section de 13,14 cm — une cote qui
    n'existe nulle part.
    """
    morceaux = re.split(r"[.,]\s*", brut.replace(" ", ""))
    if len(morceaux) == 2 and len(morceaux[0]) >= 2 and len(morceaux[1]) >= 2:
        return [float(morceaux[0]), float(morceaux[1])]
    try:
        return [float(brut.replace(" ", "").replace(",", "."))]
    except ValueError:
        return []


def mesures(ligne: str) -> dict:
    """Les nombres lisibles comme des cotes, séparés par unité.

    Renvoie {cm, m} — deux LISTES, pas deux ensembles : « 5*5 » est une
    section carrée, et un ensemble la réduirait à une seule cote. Un nombre
    sans unité est compté en cm : c'est ainsi que les dépôts écrivent
    (« 17cm*7cm », « 14/6 »), et une longueur porte presque toujours son « m ».
    """
    propre = sans_les_montants(ligne)
    en_cm: list[float] = []
    en_m: list[float] = []
    for trouve in MESURE.finditer(propre):
        unite = (trouve.group(2) or "").lower()
        for valeur in _valeurs(trouve.group(1)):
            if valeur <= 0:
                continue
            if unite == "m":
                if valeur <= M_MAX and valeur not in en_m:
                    en_m.append(valeur)
            elif unite == "mm":
                if valeur / 10 <= CM_MAX:
                    en_cm.append(valeur / 10)
            elif valeur <= CM_MAX:
                en_cm.append(valeur)
    return {"cm": en_cm, "m": en_m}


def section(ligne: str) -> dict | None:
    """La section CANONIQUE écrite dans la ligne, ou None.

    `{"epaisseur_cm", "largeur_cm", "longueur_m"}` — épaisseur ≤ largeur
    toujours, quel que soit l'ordre d'écriture du dépôt. `longueur_m` peut
    manquer : beaucoup de lignes la portent dans leur en-tête (« #MADRIER
    4m »), et c'est à l'appelant de la fournir.

    Exige DEUX cotes en centimètres, pas une : une seule ne fait pas une
    section, et la prendre pour telle inventerait la seconde.
    """
    if deux_sections(ligne):
        return None
    lues = mesures(ligne)
    cm = sorted(lues["cm"])
    if len(cm) < 2:
        return None
    # Les deux plus petites valeurs forment la section. Une troisième (« 10,11
    # cm » d'une fourchette, un nombre de pièces resté là) ne la change pas :
    # elle rend la ligne DOUTEUSE, et le doute se signale plus haut.
    epaisseur, largeur = cm[0], cm[1]
    longueur = min(lues["m"]) if lues["m"] else None
    return {
        "epaisseur_cm": epaisseur,
        "largeur_cm": largeur,
        "longueur_m": longueur,
        "cotes_en_trop": cm[2:],
        "sure": len(cm) == 2,
    }


def volume_m3(cotes: dict) -> float | None:
    """Le volume d'une pièce, calculé — jamais estimé."""
    if not cotes or not cotes.get("longueur_m"):
        return None
    return round(
        (cotes["epaisseur_cm"] / 100)
        * (cotes["largeur_cm"] / 100)
        * cotes["longueur_m"], 5)


def _nombre(valeur: float) -> str:
    """« 7,5 » et non « 7.5 » ; « 15 » et non « 15.0 »."""
    entier = int(valeur)
    if abs(valeur - entier) < 1e-9:
        return str(entier)
    return f"{valeur:.10g}".replace(".", ",")


def libelles(type_nom: str, cotes: dict) -> dict:
    """Le nom, le libellé court et les dimensions, à la convention du catalogue.

    Reprises telles quelles des références déjà en base : « Madrier 7 x 15 cm,
    4 m » / « 7 × 15 · 4 m » / « 7 × 15 cm, 4 m ». Une convention qui varie
    d'une ligne à l'autre rend le catalogue illisible bien avant d'être faux.
    """
    e, l = _nombre(cotes["epaisseur_cm"]), _nombre(cotes["largeur_cm"])
    L = _nombre(cotes["longueur_m"]) if cotes.get("longueur_m") else ""
    suffixe_nom = f", {L} m" if L else ""
    suffixe_court = f" · {L} m" if L else ""
    return {
        "nom": f"{type_nom} {e} x {l} cm{suffixe_nom}",
        "libelle_court": f"{e} × {l}{suffixe_court}",
        "dimensions": f"{e} × {l} cm{suffixe_nom}",
    }


def slug(type_slug: str, cotes: dict) -> str:
    """`madrier-70x150-4m` — millimètres, puis la longueur en mètres.

    La convention du catalogue, à la lettre : c'est elle qui permet de relire
    les cotes d'une référence quand ses attributs manquent.
    """
    e = int(round(cotes["epaisseur_cm"] * 10))
    l = int(round(cotes["largeur_cm"] * 10))
    fin = f"-{_nombre(cotes['longueur_m'])}m" if cotes.get("longueur_m") else ""
    return f"{type_slug}-{e}x{l}{fin}".replace(",", "")
