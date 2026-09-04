"""Les GRAMMAIRES des matériaux : comment chaque type écrit son format.

C'est la compétence qui manquait au bot le 02/09/2026. Il savait reconnaître
un mot (« hourdis », « parpaing ») et un chiffre isolé (« 15 »), mais pas
lire une COTE COMPLÈTE et la comparer entière au catalogue :

    « Hourdis 20×20×53 à 4 800 Ar/pièce »   -> hourdis-20 (60 × 20 × 20)   FAUX
    « Parpaings 20×20×40 … 3 800 Ar/unité » -> parpaing-creux-20            juste,
                                                 mais par chance (le « 20 »)

Une cote de bloc s'écrit dans n'importe quel ordre — « 20×20×40 » sur la
publication, « 40 × 20 × 20 cm » au catalogue — et c'est le MÊME bloc. On
la ramène donc à sa forme canonique, du plus petit au plus grand, avant de
comparer. Une cote qui ne correspond à AUCUNE référence n'est pas une
erreur : c'est une référence que le site ignore encore, et ce module sait
la composer — nom, slug, libellé, volume, poids — pour que le catalogue
s'enrichisse de ce que le terrain vend vraiment (demande d'Andry, 02/09).

🔒 CE QUI NE NAÎT JAMAIS ICI
   * une cote hors des bornes de son type (un parpaing de 3 cm, un hourdis de
     2 m) : c'est un nombre de pièces, un prix, une année — pas un format ;
   * une référence dont on ne saurait pas calculer le poids : la masse
     volumique vient des références déjà en place pour ce type, jamais d'un
     chiffre choisi ici ;
   * un format pour un type dont la grammaire n'est pas écrite (sable, ciment,
     tuile…) : ces types se déclinent par qualité ou par marque, et une
     machine ne les devine pas — l'atelier des formats reste leur chemin.
"""
from __future__ import annotations

import re
import statistics

# « 20x20x40 », « 20 × 20 × 53 cm », « (12*33*33) », « 6x11x22 » — trois
# cotes, séparées par x, × ou *, avec ou sans unité, avec ou sans espaces.
# Un point ou une virgule fait une décimale : « 29,5x14x9 ».
_NOMBRE = r"(\d{1,3}(?:[.,]\d{1,2})?)"
_SEP = r"\s*(?:cm|mm|m)?\s*[x×*]\s*"
TRIPLE = re.compile(rf"(?<![\d.,]){_NOMBRE}{_SEP}{_NOMBRE}{_SEP}{_NOMBRE}\s*(cm|mm|m)?(?![\d.,x×*])",
                    re.IGNORECASE)
DOUBLE = re.compile(rf"(?<![\d.,]){_NOMBRE}{_SEP}{_NOMBRE}\s*(cm|mm|m)?(?![\d.,x×*])",
                    re.IGNORECASE)
CALIBRE = re.compile(r"(?<![\d.,/])(\d{1,2}(?:[.,]\d)?)\s*/\s*(\d{1,2}(?:[.,]\d)?)(?![\d.,/])")
DIAMETRE = re.compile(r"(?:(?<![a-z])(?:o|ø|diam(?:etre)?|dia|fer|ha|fe|t|ba)\s*)(\d{1,2})(?![\d.,])",
                      re.IGNORECASE)
EPAISSEUR_TOLE = re.compile(r"(?<![\d.,])0\s*[.,]\s*(\d{2})(?![\d.,])|(?<![\d.,])(\d{2})\s*/\s*100(?![\d.,])")
LONGUEUR_M = re.compile(r"(?<![\d.,])(\d{1,2}(?:[.,]\d)?)\s*m(?![a-z0-9²³])", re.IGNORECASE)
DOSAGE = re.compile(r"(?<![\d.,])(1[5-9]0|[2-4][05]0)(?![\d.,])")
# 🔴 UN MONTANT NE COMMENCE JAMAIS AU MILIEU D'UNE COTE. La forme naive
# (`\d[\d\s.,]*\s*ar`) est gloutonne et traverse l'espace : sur la ligne
# normalisee « parpaing 20x20x40 3 400 ariary / pcs » elle partait du « 40 »
# de la cote et emportait « 40 3 400 ariary ». Il ne restait que « 20x20 »,
# la cote entiere disparaissait, et « Parpaing 20x20x40 : 3 400 Ar » finissait
# range en parpaing creux **10** a 3 400 Ar (03/09/2026, Beton ECO) — le
# mauvais produit au prix d'un autre, exactement ce qui alimente
# l'observatoire des prix.
#
# D'ou les deux verrous : on ne demarre pas juste apres un chiffre ou un
# separateur de cote (`x`, `×`, `*`), et les milliers se comptent par blocs
# de TROIS chiffres exactement — « 40 3 400 » n'en est pas un.
MONTANT = re.compile(
    r"(?<![\dx×*.,])(?:\d{1,3}(?:[\s.  ]\d{3})+|\d{2,9})"
    r"(?:[.,]\d{1,2})?\s*(?:ar|ariary|fmg)\b",
    re.IGNORECASE,
)


def _nombre(brut: str) -> float:
    return float(brut.replace(",", ".").replace(" ", ""))


def _texte(valeur: float) -> str:
    """« 7,5 » et non « 7.5 » ; « 15 » et non « 15.0 »."""
    if abs(valeur - round(valeur)) < 1e-9:
        return str(int(round(valeur)))
    return f"{valeur:.10g}".replace(".", ",")


def sans_les_montants(ligne: str) -> str:
    return MONTANT.sub(" ", ligne or "")


def triples(ligne: str) -> list[tuple[float, float, float]]:
    """Les cotes complètes (a×b×c) de la ligne, chacune en forme canonique.

    En centimètres ; « mm » est converti, « m » aussi (une brique de 0,22 m
    existe sur les tarifs des briqueteries). Trié du plus petit au plus grand :
    « 20×20×40 » et « 40 × 20 × 20 » rendent la même chose.
    """
    resultats = []
    for trouve in TRIPLE.finditer(sans_les_montants(ligne)):
        unite = (trouve.group(4) or "").lower()
        valeurs = [_nombre(trouve.group(i)) for i in (1, 2, 3)]
        if unite == "mm":
            valeurs = [v / 10 for v in valeurs]
        elif unite == "m":
            valeurs = [v * 100 for v in valeurs]
        if any(v <= 0 for v in valeurs):
            continue
        resultats.append(tuple(sorted(valeurs)))
    return resultats


def cotes_catalogue(dimensions: str | None) -> tuple | None:
    """La cote canonique d'une référence, lue dans son champ `dimensions`.

    « 40 × 20 × 15 cm » -> (15, 20, 40) ; « 22 × 11 × 6 cm » -> (6, 11, 22) ;
    « 33,5 × 22 × 2 cm · 15 au m² » -> (2, 22, 33,5) ; « Au m³ » -> None.
    Deux cotes (« 40 × 40 cm », un regard) rendent un couple.
    """
    if not dimensions:
        return None
    # Le point médian et le point-virgule séparent des compléments (« · 15 au
    # m² ») ; la virgule, elle, est une décimale (« 33,5 ») — on ne coupe pas dessus.
    tete = re.split(r"[·;]", dimensions)[0]
    trouve = TRIPLE.search(tete)
    if trouve:
        return tuple(sorted(_nombre(trouve.group(i)) for i in (1, 2, 3)))
    trouve = DOUBLE.search(tete)
    if trouve:
        return tuple(sorted(_nombre(trouve.group(i)) for i in (1, 2)))
    return None


# ── Les grammaires, type par type ──────────────────────────────────────────
# Pour chaque type qui se décline par une cote : comment la lire, dans quelles
# bornes elle est plausible, et comment nommer la référence qui en naît. Les
# bornes viennent des formats réels du catalogue et des tarifs du corpus,
# pas d'un manuel : un hourdis fait 12 à 25 cm de haut et 33 à 60 de long.
BLOCS = {
    # type : (min cm, max cm) pour chacune des trois cotes triées
    "parpaing-creux": ((8, 25), (15, 30), (30, 60)),
    "parpaing-plein": ((8, 25), (15, 30), (30, 60)),
    "hourdis": ((8, 30), (15, 40), (30, 70)),
    "brique-creuse": ((5, 25), (10, 30), (20, 50)),
    "brique-pleine": ((3, 15), (8, 20), (15, 35)),
    "btc": ((4, 15), (8, 20), (15, 35)),
    "adobe": ((6, 20), (10, 25), (20, 45)),
    "habillage-terre-cuite": ((1, 6), (4, 25), (15, 45)),
    "claustra": ((5, 20), (15, 50), (15, 50)),
}
DIAMETRES_FER = (6, 8, 10, 12, 14, 16, 20, 25, 32)
DIAMETRES_BUSE = (200, 300, 400, 500, 600, 800, 1000, 1200)
EPAISSEURS_CONTREPLAQUE = (3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 22, 25)
EPAISSEURS_PAVE = (4, 6, 8, 10, 12)
CALIBRES_GRAVILLON = ((0, 5), (3, 8), (5, 15), (5, 20), (10, 20), (15, 25), (20, 40), (25, 40), (40, 70))
DOSAGES_BETON = (150, 200, 250, 300, 350, 400, 450)
EPAISSEURS_TOLE = (14, 16, 18, 20, 22, 25, 27, 30, 35, 40, 45, 50, 60)
LONGUEURS_TOLE = (2, 2.5, 3, 3.5, 4, 5, 6)

ACIER_KG_PAR_M_PAR_MM2 = 0.006165        # masse d'une barre = 0,006165 × d² kg/m

# Les seuls types qui se décrivent par une SECTION (deux cotes + une
# longueur) : le bois scié. 🔴 Sans cette liste, la première tournée du
# 03/09/2026 a créé « Gravillon et cailloux 2 x 3 cm, 8 m » à partir d'une
# ligne « gravillon 2/3 … 8 m³ » : la lecture de section marchait, la densité
# du gravillon était constante, rien ne disait que le type n'a pas de section.
TYPES_A_SECTION = frozenset({"madrier", "planche", "chevron", "latte", "bois-carre", "volige"})


def densite_du_type(par_type: list[dict]) -> float | None:
    """La masse volumique médiane des références DÉJÀ en place pour ce type.

    Médiane, pas moyenne : un poids saisi de travers ne doit pas déplacer
    toutes les références suivantes. `None` sans référence pesée — alors on
    ne crée rien, parce qu'un poids se calcule ou ne s'écrit pas.
    """
    ratios = []
    for fiche in par_type:
        try:
            volume = float(fiche.get("volume") or fiche.get("volume_m3_unite_defaut") or 0)
            poids = float(fiche.get("poids") or fiche.get("poids_kg_unite_defaut") or 0)
        except (TypeError, ValueError):
            continue
        if volume > 0 and poids > 0:
            ratios.append(poids / volume)
    return round(statistics.median(ratios)) if ratios else None


def _refus(motif: str) -> dict:
    return {"possible": False, "motif": motif}


def _projet(type_slug: str, type_nom: str, slug: str, nom: str, court: str,
            dimensions: str, unite: str, volume: float, poids: float,
            attributs: dict, ordre: float, densite: float | None) -> dict:
    return {
        "possible": True, "motif": "", "type_slug": type_slug, "slug": slug,
        "nom": nom, "libelle_court": court, "dimensions": dimensions,
        "unite": unite, "volume": round(volume, 6), "poids": round(poids, 3),
        "densite": densite, "attributs": attributs, "ordre_format": ordre,
    }


def projet_bloc(type_slug: str, type_nom: str, cotes: tuple, par_type: list[dict]) -> dict:
    """Un parpaing, un hourdis, une brique : trois cotes, à la pièce."""
    bornes = BLOCS.get(type_slug)
    if not bornes:
        return _refus("ce type ne se décline pas par une cote de bloc")
    if len(cotes) != 3:
        return _refus("il faut trois cotes pour un bloc")
    for valeur, (mini, maxi) in zip(cotes, bornes):
        if not (mini <= valeur <= maxi):
            return _refus(f"cote {_texte(valeur)} cm hors des bornes du {type_nom.lower()} "
                          f"({mini}–{maxi} cm)")
    densite = densite_du_type(par_type)
    if densite is None:
        return _refus("aucune référence pesée pour ce type : le poids ne se calculerait pas")
    h, l, L = cotes
    volume = (h / 100) * (l / 100) * (L / 100)
    court = "×".join(_texte(v) for v in (h, l, L))
    slug = f"{type_slug}-{court.replace('×', 'x').replace(',', '')}"
    return _projet(
        type_slug, type_nom, slug,
        nom=f"{type_nom} {' × '.join(_texte(v) for v in (h, l, L))} cm",
        court=court,
        dimensions=f"{_texte(L)} × {_texte(l)} × {_texte(h)} cm",
        unite="piece", volume=volume, poids=volume * densite,
        attributs={"epaisseur_cm": h, "largeur_cm": l, "longueur_cm": L},
        ordre=h, densite=densite,
    )


def projet_fer(type_slug: str, type_nom: str, diametre: int, par_type: list[dict]) -> dict:
    """Une barre de fer à béton : Ø en mm, barre de 12 m. Le poids est de la physique."""
    if diametre not in DIAMETRES_FER:
        return _refus(f"Ø{diametre} n'est pas un diamètre courant de fer à béton")
    longueur = 12.0
    poids = ACIER_KG_PAR_M_PAR_MM2 * diametre * diametre * longueur
    volume = 3.14159 * (diametre / 2000) ** 2 * longueur
    return _projet(
        type_slug, type_nom, f"fer-beton-{diametre}",
        nom=f"{type_nom} Ø{diametre}", court=f"Ø{diametre}",
        dimensions="Barre de 12 m", unite="piece", volume=volume, poids=poids,
        attributs={"diametre_mm": diametre, "longueur_m": longueur},
        ordre=diametre, densite=7850,
    )


def projet_gravillon(type_slug: str, type_nom: str, calibre: tuple, par_type: list[dict]) -> dict:
    a, b = calibre
    if (a, b) not in CALIBRES_GRAVILLON:
        return _refus(f"calibre {_texte(a)}/{_texte(b)} inconnu des carrières")
    densite = densite_du_type(par_type) or 1450
    court = f"{_texte(a)}/{_texte(b)}"
    return _projet(
        type_slug, type_nom, f"gravillon-{_texte(a)}-{_texte(b)}".replace(",", ""),
        nom=f"Gravillon {court}", court=court, dimensions="Au m³",
        unite="m3", volume=1.0, poids=densite,
        attributs={"calibre": court}, ordre=a, densite=densite,
    )


def projet_buse(type_slug: str, type_nom: str, diametre: int, par_type: list[dict]) -> dict:
    if diametre not in DIAMETRES_BUSE:
        return _refus(f"Ø{diametre} mm n'est pas un diamètre courant de buse")
    densite = densite_du_type(par_type)
    if densite is None:
        return _refus("aucune buse pesée au catalogue")
    # Volume d'encombrement d'un mètre de buse : un cylindre de Ø extérieur
    # ≈ Ø + 2 × 8 cm de paroi.
    rayon = (diametre / 1000 + 0.16) / 2
    volume = 3.14159 * rayon * rayon * 1.0
    return _projet(
        type_slug, type_nom, f"buse-beton-{diametre}",
        nom=f"Buse béton Ø{diametre}", court=f"Ø{diametre}",
        dimensions=f"Diamètre {diametre} mm", unite="ml", volume=volume,
        poids=volume * densite, attributs={"diametre_mm": diametre},
        ordre=diametre, densite=densite,
    )


def projet_contreplaque(type_slug: str, type_nom: str, epaisseur_mm: int,
                        par_type: list[dict]) -> dict:
    if epaisseur_mm not in EPAISSEURS_CONTREPLAQUE:
        return _refus(f"{epaisseur_mm} mm n'est pas une épaisseur courante de contreplaqué")
    densite = densite_du_type(par_type) or 600
    volume = 1.22 * 2.44 * epaisseur_mm / 1000
    return _projet(
        type_slug, type_nom, f"contreplaque-{epaisseur_mm}mm",
        nom=f"Contreplaqué {epaisseur_mm} mm", court=f"{epaisseur_mm} mm",
        dimensions="122 × 244 cm", unite="piece", volume=volume,
        poids=volume * densite, attributs={"epaisseur_mm": epaisseur_mm},
        ordre=epaisseur_mm, densite=densite,
    )


def projet_pave(type_slug: str, type_nom: str, epaisseur_cm: int, par_type: list[dict]) -> dict:
    if epaisseur_cm not in EPAISSEURS_PAVE:
        return _refus(f"{epaisseur_cm} cm n'est pas une épaisseur courante de pavé")
    densite = densite_du_type(par_type) or 2250
    volume = epaisseur_cm / 100          # un m² de pavé
    return _projet(
        type_slug, type_nom, f"pave-autobloquant-{epaisseur_cm}",
        nom=f"Pavé autobloquant {epaisseur_cm} cm", court=f"{epaisseur_cm} cm",
        dimensions=f"Épaisseur {epaisseur_cm} cm", unite="m2", volume=volume,
        poids=volume * densite, attributs={"epaisseur_cm": epaisseur_cm},
        ordre=epaisseur_cm, densite=densite,
    )


def projet_beton(type_slug: str, type_nom: str, dosage: int, par_type: list[dict]) -> dict:
    if dosage not in DOSAGES_BETON:
        return _refus(f"dosage {dosage} inconnu des centrales")
    return _projet(
        type_slug, type_nom, f"beton-{dosage}",
        nom=f"Béton dosé à {dosage} kg/m³", court=f"{dosage} kg/m³",
        dimensions=f"Dosage {dosage}", unite="m3", volume=1.0, poids=2400,
        attributs={"dosage_kg_m3": dosage}, ordre=dosage, densite=2400,
    )


def projet_tole(type_slug: str, type_nom: str, epaisseur_centiemes: int, longueur_m: float,
                variante: str, par_type: list[dict]) -> dict:
    """Une tôle : épaisseur en centièmes de mm (« 0,30 » -> 30), longueur, et sa
    forme — ondulée galvanisée, bac galvanisé, bac alu-zinc."""
    if epaisseur_centiemes not in EPAISSEURS_TOLE:
        return _refus(f"0,{epaisseur_centiemes:02d} mm n'est pas une épaisseur courante de tôle")
    if longueur_m not in LONGUEURS_TOLE:
        return _refus(f"{_texte(longueur_m)} m n'est pas une longueur courante de tôle")
    formes = {
        "ondulee": ("tole-ondulee", "Tôle ondulée galvanisée", "Ondulée galvanisée"),
        "bac-galva": ("bac-galva", "Bac galvanisé", "Bac galvanisé"),
        "bac-aluzinc": ("bac-aluzinc", "Bac alu-zinc", "Bac alu-zinc"),
    }
    if variante not in formes:
        return _refus("forme de tôle non précisée (ondulée, bac galva, bac alu-zinc)")
    prefixe, nom_forme, dims = formes[variante]
    epaisseur_mm = epaisseur_centiemes / 100
    volume = 0.9 * longueur_m * 0.01          # encombrement d'une feuille roulée
    densite = densite_du_type(par_type) or 500
    L = _texte(longueur_m)
    return _projet(
        type_slug, type_nom, f"{prefixe}-{epaisseur_centiemes:03d}-{L.replace(',', '')}m",
        nom=f"{nom_forme} 0,{epaisseur_centiemes:02d} mm, {L} m",
        court=f"{'Bac ' if 'bac' in variante else ''}0,{epaisseur_centiemes:02d} · {L} m".strip(),
        dimensions=f"{dims}, {L} m", unite="piece", volume=volume,
        poids=volume * densite,
        attributs={"epaisseur_mm": epaisseur_mm, "longueur_m": longueur_m},
        ordre=epaisseur_mm, densite=densite,
    )


# ── Lire la cote d'un type dans une ligne ──────────────────────────────────
def lire_cote(type_slug: str, ligne: str) -> dict | None:
    """Ce que la ligne écrit comme cote POUR CE TYPE, ou None.

    Renvoie `{"genre": ..., "valeur": ...}` : `bloc` (triple), `diametre`,
    `calibre`, `epaisseur`, `dosage`, `tole` (épaisseur, longueur, forme).
    Deux cotes du même genre sur la ligne = aucune (la ligne cite deux formats).
    """
    propre = sans_les_montants(ligne or "").lower().replace("×", "x")
    if type_slug in BLOCS:
        lus = triples(propre)
        if len(lus) == 1:
            return {"genre": "bloc", "valeur": lus[0]}
        if lus:
            return None            # deux cotes complètes : la ligne cite deux formats
        # 🔴 LA NOTATION COURTE « ÉPAISSEUR/LONGUEUR », la plus répandue des
        #   dépôts malgaches : « Parpaing 10/40 », « 15/40 », « 20/40 ». La
        #   hauteur (20 cm) est si standard qu'elle ne s'écrit pas. Mesuré le
        #   04/09/2026 : 63 % des offres (200 sur 317) attendaient un format à
        #   la main, et le parpaing en tête — le bot lisait « 20x20x40 » mais
        #   restait muet devant « 20/40 », que le même dépôt écrit deux lignes
        #   plus bas.
        #
        #   Rien n'est deviné : la paire est comparée aux cotes du CATALOGUE,
        #   à leur place (la plus petite est l'épaisseur, la plus grande la
        #   longueur), et il faut qu'elle n'y désigne qu'une seule référence.
        courts = {(_nombre(m.group(1)), _nombre(m.group(2)))
                  for m in CALIBRE.finditer(propre)}
        if len(courts) == 1:
            epaisseur, longueur = courts.pop()
            if epaisseur < longueur:
                return {"genre": "bloc_court", "valeur": (epaisseur, longueur)}
        return None
    if type_slug == "fer-a-beton":
        trouves = {int(m.group(1)) for m in DIAMETRE.finditer(propre)}
        return {"genre": "diametre", "valeur": trouves.pop()} if len(trouves) == 1 else None
    if type_slug == "gravillon":
        trouves = {(_nombre(m.group(1)), _nombre(m.group(2))) for m in CALIBRE.finditer(propre)}
        return {"genre": "calibre", "valeur": trouves.pop()} if len(trouves) == 1 else None
    if type_slug == "buse":
        trouves = {int(v) for v in re.findall(r"(?<![\d.,])(\d{3,4})(?![\d.,])", propre)}
        return {"genre": "diametre", "valeur": trouves.pop()} if len(trouves) == 1 else None
    if type_slug == "contreplaque":
        trouves = {int(m) for m in re.findall(r"(?<![\d.,])(\d{1,2})\s*mm", propre)}
        return {"genre": "epaisseur", "valeur": trouves.pop()} if len(trouves) == 1 else None
    if type_slug == "pave":
        trouves = {int(m) for m in re.findall(r"(?<![\d.,])(\d{1,2})\s*cm", propre)}
        return {"genre": "epaisseur", "valeur": trouves.pop()} if len(trouves) == 1 else None
    if type_slug == "beton-pret-emploi":
        trouves = {int(m) for m in DOSAGE.findall(propre)}
        return {"genre": "dosage", "valeur": trouves.pop()} if len(trouves) == 1 else None
    if type_slug == "tole":
        epaisseurs = {int(m.group(1) or m.group(2)) for m in EPAISSEUR_TOLE.finditer(propre)}
        longueurs = {_nombre(m.group(1)) for m in LONGUEUR_M.finditer(propre)}
        if len(epaisseurs) != 1 or len(longueurs) != 1:
            return None
        if "aluzinc" in propre or "alu zinc" in propre or "alu-zinc" in propre:
            forme = "bac-aluzinc"
        elif "bac" in propre or "galvabac" in propre:
            forme = "bac-galva"
        elif "ondul" in propre:
            forme = "ondulee"
        else:
            return None
        return {"genre": "tole", "valeur": (epaisseurs.pop(), longueurs.pop(), forme)}
    return None


def projet_de_reference(type_slug: str, type_nom: str, cote: dict,
                        par_type: list[dict]) -> dict:
    """La référence que cette cote réclame pour ce type — ou le motif du refus."""
    genre, valeur = cote["genre"], cote["valeur"]
    if genre == "bloc":
        return projet_bloc(type_slug, type_nom, valeur, par_type)
    if genre == "bloc_court":
        # Deux cotes sur trois : la hauteur n'est pas écrite. On sait
        # RECONNAÎTRE une référence existante avec ça, jamais en composer une
        # neuve — inventer la hauteur, c'est inventer le volume, donc le poids.
        return _refus("la hauteur n'est pas écrite : « épaisseur/longueur » "
                      "reconnaît une référence, elle n'en crée pas")
    if type_slug == "fer-a-beton" and genre == "diametre":
        return projet_fer(type_slug, type_nom, int(valeur), par_type)
    if type_slug == "gravillon" and genre == "calibre":
        return projet_gravillon(type_slug, type_nom, valeur, par_type)
    if type_slug == "buse" and genre == "diametre":
        return projet_buse(type_slug, type_nom, int(valeur), par_type)
    if type_slug == "contreplaque" and genre == "epaisseur":
        return projet_contreplaque(type_slug, type_nom, int(valeur), par_type)
    if type_slug == "pave" and genre == "epaisseur":
        return projet_pave(type_slug, type_nom, int(valeur), par_type)
    if type_slug == "beton-pret-emploi" and genre == "dosage":
        return projet_beton(type_slug, type_nom, int(valeur), par_type)
    if type_slug == "tole" and genre == "tole":
        return projet_tole(type_slug, type_nom, valeur[0], valeur[1], valeur[2], par_type)
    return _refus("aucune grammaire pour ce type")


def format_existant(cote: dict, par_type: list[dict]) -> dict | None:
    """La référence du type dont la cote est EXACTEMENT celle lue, si elle est seule."""
    genre, valeur = cote["genre"], cote["valeur"]
    retenus = []
    for fiche in par_type:
        attributs = fiche.get("attributs") or {}
        if genre == "bloc" and fiche.get("cotes_bloc") == tuple(valeur):
            retenus.append(fiche)
        elif genre == "bloc_court":
            # « 10/40 » = épaisseur 10, longueur 40. On compare AUX PLACES :
            # sans cela « 20/40 » retiendrait aussi le parpaing 10 (10 × 20 ×
            # 40), dont la HAUTEUR vaut 20 — deux références pour une cote, et
            # le mauvais produit une fois sur deux.
            cotes = fiche.get("cotes_bloc")
            if (cotes and len(cotes) == 3
                    and cotes[0] == valeur[0] and cotes[2] == valeur[1]):
                retenus.append(fiche)
        elif genre == "diametre" and str(attributs.get("diametre_mm")) == str(int(valeur)):
            retenus.append(fiche)
        elif genre == "calibre" and str(attributs.get("calibre") or "").replace(",", ".") == \
                f"{_texte(valeur[0])}/{_texte(valeur[1])}".replace(",", "."):
            retenus.append(fiche)
        elif genre == "epaisseur" and (
                str(attributs.get("epaisseur_mm")) == str(int(valeur))
                or str(attributs.get("epaisseur_cm")) == str(int(valeur))):
            retenus.append(fiche)
        elif genre == "dosage" and str(attributs.get("dosage_kg_m3")) == str(int(valeur)) \
                and not attributs.get("pompe"):
            retenus.append(fiche)
        elif genre == "tole":
            epaisseur, longueur, forme = valeur
            slug = fiche.get("slug") or ""
            prefixe = {"ondulee": "tole-ondulee", "bac-galva": "bac-galva",
                       "bac-aluzinc": "bac-aluzinc"}[forme]
            if (slug.startswith(prefixe)
                    and abs(float(attributs.get("epaisseur_mm") or 0) * 100 - epaisseur) < 0.5
                    and float(attributs.get("longueur_m") or 0) == float(longueur)):
                retenus.append(fiche)
    return retenus[0] if len(retenus) == 1 else None
