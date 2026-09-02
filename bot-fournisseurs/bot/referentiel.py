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

from . import akora, base, grammaires
from .config import CACHE_REFERENTIEL

# Mots qui ne suffisent JAMAIS seuls : ce sont des mots de la langue courante
# avant d'être des synonymes. Sans cette liste, « plancher » (synonyme de
# hourdis) attrape toute phrase qui parle d'un étage, et « fil » attrape
# « fil d'attente ». Ils ne comptent que si un autre indice a déjà désigné le
# même type.
SYNONYMES_INSUFFISANTS = {"dalle", "plancher", "panneau", "boite", "chambre",
                          "fil", "pierre", "paquet", "grillage"}

# Certaines appellations désignent bien un matériau, mais PLUSIEURS types se
# les partagent : « biriky » vaut parpaing et brique, « vato » vaut gravillon
# et moellon, « parpaing » vaut creux et plein. Les écarter serait absurde —
# c'est ainsi que les dépôts écrivent. On les garde, on prend le type le plus
# courant de la famille, et on plafonne la certitude pour que l'interface
# demande confirmation.
#
# La liste n'est PAS écrite ici : elle se déduit du catalogue au chargement
# (toute expression qui pointe vers deux types ou plus). Le jour où une famille
# est ajoutée côté site, le partage se recalcule tout seul.
PLAFOND_PARTAGE = 55

# ── Comment les dépôts écrivent VRAIMENT ───────────────────────────────────
# Chaque ligne de cette table vient d'un libellé lu dans data/bot.db, pas d'une
# liste d'orthographes imaginées à la table. Le numéro entre parenthèses est
# l'offre où l'écriture a été relevée — c'est la seule justification qui vaille,
# et c'est aussi ce qui permet de retirer une règle devenue inutile.
#
# La réécriture s'applique des DEUX côtés — au texte lu et aux noms du
# catalogue — parce que `normaliser()` sert aux deux. C'est voulu : « alu-zinc »
# du catalogue et « ALUZINC » d'une publication doivent tomber sur le même mot,
# sinon la comparaison ne peut pas avoir lieu.
ECRITURES: list[tuple[str, str]] = [
    # « ONDUILLE », « ONDUILÉ », « ONDULÉS » — quatre graphies pour une tôle
    # ondulée, dans quatre publications du même vendeur (#38, #65, #66, #98).
    (r"\bondu[iy]?l+[ée]*e?s?\b", "ondulee"),
    # « GALVABAC » collé, écrit ainsi par MORA TÔLE (#15) et repris tel quel
    # ailleurs (#98). Sans la coupure, ni « galva » ni « bac » n'existent dans
    # la ligne : le mot entier ne ressemble à rien du catalogue.
    (r"\bgalva\s*-?\s*bac\b", "galva bac"),
    (r"\bbac\s*-?\s*galva(nise[e]?)?\b", "bac galva"),
    # Le catalogue écrit « alu-zinc », les vendeurs « ALUZINC » ou « ALU ZINC »
    # (#65, #72, #98). Un seul mot des deux côtés.
    (r"\balu\s*-?\s*zinc\b", "aluzinc"),
    # Graphies du gravillon et du moellon relevées telles quelles (#83, #46).
    (r"\bcay?[il]+asse\b", "caillasse"),
    (r"\bmo[eë]l+ons?\b", "moellon"),
    # « briky » (#6), « brik » — le mot malgache pour brique/parpaing.
    (r"\bb[ir]{2}[ck]?[iy]+\b", "biriky"),
    (r"\bbriky\b", "biriky"),
    # « fasica » pour « fasika » : le c et le k s'échangent tout le temps.
    (r"\bfasic[ka]?\b", "fasika"),
]


def _reecrire(ligne: str) -> str:
    for motif, remplacement in ECRITURES:
        ligne = re.sub(motif, remplacement, ligne)
    return ligne


# Des appellations vues dans les publications et absentes du catalogue Akora.
# Elles ne sont PAS ajoutées au catalogue : le site est la source de vérité des
# références, et le bot n'a pas à lui inventer des synonymes. Elles vivent ici,
# du côté de la lecture, avec l'offre où elles ont été relevées.
SYNONYMES_CORPUS: dict[str, list[str]] = {
    # « caillasse » est listée à côté de « moellon » et de « gravillon » dans
    # les mêmes énumérations (#22, #46, #83) : c'est bien la pierre concassée.
    "gravillon": ["caillasse", "vatokely", "vato kely", "vato madinika"],
    # « biriky masaka » = brique CUITE (#124). Sans elle, « biriky » seul part
    # sur le parpaing, premier de sa famille — un contresens sur la matière.
    "brique-creuse": ["biriky masaka", "biriky nasaka", "brique volom-bary"],
    # « fanitso » est déjà au catalogue ; « prelaque » et « galvabac » non.
    "tole": ["prelaque", "prelaquee", "galvabac", "tolle"],
    "moellon": ["vato lehibe", "vato be"],
}

# Ce qui RESSEMBLE à un matériau et n'en est pas. Sans cette liste, un
# rond-point devient du fer à béton (#3), un perforateur devient du béton prêt
# à l'emploi (#103) et une bobine de fil à souder devient de l'armature (#102).
# Une offre mal classée n'est pas neutre : elle pollue l'observatoire des prix,
# et c'est de là que sort le bulletin public.
PIEGES: dict[str, list[str]] = {
    "fer-a-beton": [
        r"rond\s*-?\s*point",       # « Ambohimangakely Rond-Point » (#3)
        r"acier\s+inox",             # « Acier inoxydable » (#108)
        r"\bmig\b",                  # « Rouleau MIG Acier » — fil de soudure (#102)
        r"rideau\s+metallique",
    ],
    "beton-pret-emploi": [
        r"beton\s+cire",             # « résine époxy, béton ciré » (#29)
        r"perforateur",              # « 1 Pérforateur béton » (#103)
        r"vibreur",                  # « Vibreur à béton » (#111)
        r"aiguille\s+vibrante",
    ],
    # « Dalle » et « plancher » ouvrent le hourdis ; « dalle de sol », elle,
    # est un carrelage, hors périmètre d'Akora.
    "hourdis": [r"dalle\s+de\s+sol", r"dalle\s+podotactile"],
    # Celui-ci n'est pas cosmétique. « > 32" sans bordure : 410.000 ar » est une
    # annonce de TÉLÉVISION (#107, #109) ; classée en bordure de trottoir, elle
    # entrait dans l'observatoire des prix à 410 000 Ar le mètre linéaire — et
    # l'observatoire est ce qui alimente le bulletin PUBLIC signé Akora.
    "bordure": [r"sans\s+bordure", r"ecran", r"\bpouces?\b", r"\btv\b", r"smart"],
}

# Les diamètres que le catalogue connaît vraiment. Toute écriture de fer doit
# retomber sur l'un d'eux, sinon on ne propose rien : un « fer 9 » n'existe pas,
# et l'arrondir au 8 le plus proche ferait vendre du 8 pour du 9.
DIAMETRES_FER = ("6", "8", "10", "12", "14", "16")

# Le slug du type dans le catalogue Akora. Écrit une fois, relu partout.
TYPE_FER = "fer-a-beton"

# Le repli « la ligne ressemble au nom d'un format » ne vaut que sur une ligne
# assez longue pour qu'une ressemblance veuille dire quelque chose.
LONGUEUR_REPLI = 9
RESSEMBLANCE_REPLI = 0.82

# Comment un vendeur écrit un fer à béton. Deux niveaux, parce que le second
# est ambigu dans ce corpus :
#   • les marqueurs SÛRS nomment le métal (« fer 8 », « rond 8 », « vy 10 ») ;
#   • les CODES courts (« BA 8 », « HA 10 », « T12 ») sont la notation du
#     ferrailleur — mais « ha » est aussi l'hectare, et ce corpus est plein
#     d'annonces de terrain (#20, #31, #67). Ils ne sont donc lus que si la
#     ligne ne parle pas de terrain.
_FER_SUR = re.compile(
    r"(?<![a-z0-9])(?:fer|rond|vy|acier|armature|ferraille)"
    r"(?:\s*(?:a|de|en)?\s*beton)?(?:\s*tors?(?:ade)?)?"
    r"[\s:.-]*(?:o|diametre|dia|no?)?[\s:.-]*"
    r"(\d{1,2})(?:\s*mm)?(?![0-9])"
)
_FER_CODE = re.compile(
    # « o » est le Ø du clavier : `normaliser()` le ramène à un o, et « Ø8 »
    # devient « o8 » — la seule trace qu'il reste du symbole de diamètre.
    r"(?<![a-z0-9])(?:ba|ha|t|fe|o)[\s.-]?(\d{1,2})(?:\s*mm)?(?![0-9])"
)
_PARLE_DE_TERRAIN = re.compile(
    r"(?<![a-z0-9])(?:tany|terrain|are|ares|hectare|hectares|ha\b\s*de)"
)


def diametre_de_fer(ligne_normalisee: str, codes_courts: bool = True) -> str | None:
    """« BA 8 », « fer 8 », « rond 8 », « Ø8 » -> « 8 ». None si rien de sûr.

    Le calibre est la seule chose qui distingue les six fers du catalogue :
    sans lui, l'offre reste au type et personne ne peut la mettre en ligne.

    `codes_courts=False` ne garde que les écritures qui NOMMENT le métal. Cette
    distinction sert à trancher : un calibre annoncé avec son métal fait
    autorité, un code court est un indice de plus.
    """
    for trouve in _FER_SUR.finditer(ligne_normalisee):
        if trouve.group(1) in DIAMETRES_FER:
            return trouve.group(1)
    if not codes_courts or _PARLE_DE_TERRAIN.search(ligne_normalisee):
        return None
    for trouve in _FER_CODE.finditer(ligne_normalisee):
        if trouve.group(1) in DIAMETRES_FER:
            return trouve.group(1)
    return None


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
    # « quincaillerie » n'est PAS un dépôt de gros œuvre : c'est justement le
    # hors-périmètre d'Akora. La classer ici la ferait entrer par la fenêtre.
    "Dépôt": ["depot", "magasin materiaux", "stock", "vente materiaux"],
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
    """Minuscules, sans accents, ponctuation ramenée à des espaces, graphies unifiées.

    La réécriture vient EN DERNIER, une fois les accents tombés et la
    ponctuation ramenée à des espaces : `ECRITURES` peut alors s'écrire en
    lettres nues, sans avoir à prévoir « ONDULÉ », « ondulè » et « Ondule ».
    """
    reduit = sans_accents(texte)
    reduit = reduit.replace("²", "2").replace("³", "3").replace("ø", "o")
    # « 20×20×53 » et « (12*33*33) » sont des cotes : le signe de
    # multiplication devient le « x » que tout le reste sait lire. Sans ça,
    # « Hourdis 20×20×53 » perdait ses cotes et retombait sur le « 20 » seul —
    # un hourdis de 60 × 20 × 20 au prix d'un 20 × 20 × 53 (02/09/2026).
    reduit = re.sub(r"(?<=\d)\s*[×*]\s*(?=\d)", "x", reduit)
    reduit = re.sub(r"[^a-z0-9x/,.'-]+", " ", reduit)
    reduit = re.sub(r"\s+", " ", reduit).strip()
    return _reecrire(reduit)


def _mot_present(expression: str, dans: str) -> bool:
    """Cherche une expression en respectant les frontières de mot."""
    motif = re.escape(sans_accents(expression)).replace(r"\ ", r"[\s\-']+")
    return re.search(rf"(?<![a-z0-9]){motif}(?![a-z0-9])", dans) is not None


# Longueur en dessous de laquelle un début de mot ne prouve plus rien : « bac »
# est le début de « bacterie », « alu » celui de « aluminium ».
DEBUT_MINIMAL = 5


def _mot_present_ou_abrege(expression: str, dans: str) -> bool:
    """Comme `_mot_present`, mais accepte l'abrégé courant du chantier.

    Personne n'écrit « tôle galvanisée » : on écrit « tôle galva ». Le
    catalogue, lui, écrit le mot entier. Sans cette tolérance, le seul mot qui
    sépare un bac galvanisé d'un bac alu-zinc n'est jamais trouvé, et les deux
    formats restent à égalité — donc indécidables — sur toutes les lignes.
    """
    if _mot_present(expression, dans):
        return True
    cible = sans_accents(expression)
    if len(cible) <= DEBUT_MINIMAL:
        return False
    return any(
        len(mot) >= DEBUT_MINIMAL and len(mot) < len(cible) and cible.startswith(mot)
        for mot in re.split(r"[^a-z0-9]+", dans)
    )


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

        # Deux niveaux de repères numériques, et la distinction compte :
        #
        #   « clés »   — ce qui DISTINGUE ce format des autres du même type :
        #                le suffixe du slug, le libellé court, les attributs
        #                chiffrés ;
        #   « larges » — tout ce qui traîne dans les dimensions.
        #
        # Sans la séparation, « Fer 12 » tombait sur le fer Ø6 : tous les fers
        # portent « barre de 12 m » dans leurs dimensions, donc tous
        # répondaient à « 12 », et le premier de la liste gagnait.
        cles = set(_formats_du_slug(fiche["slug"], fiche.get("type_slug")))
        if fiche.get("libelle_court"):
            cles.update(re.findall(r"[0-9]+", str(fiche["libelle_court"])))
        for cle in ("epaisseur_cm", "hauteur_cm", "largeur_cm", "longueur_cm",
                    "diametre_mm", "diametre"):
            if attributs.get(cle) is not None:
                cles.add(str(int(float(attributs[cle]))))
        larges = set(cles)
        if fiche.get("dimensions"):
            larges.update(re.findall(r"[0-9]+", str(fiche["dimensions"])))
        fiche["reperes_cles"] = {r for r in cles if r}
        fiche["reperes"] = {r for r in larges if r}
        # La cote ENTIÈRE d'un bloc, en forme canonique (du plus petit au plus
        # grand) : c'est elle qu'on compare à ce qu'un dépôt écrit.
        fiche["cotes_bloc"] = grammaires.cotes_catalogue(fiche.get("dimensions"))

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
    for rang, (slug, fiche) in enumerate(types.items()):
        # Le rang est l'ordre d'affichage du catalogue sur le site. Il sert à
        # départager : « parpaing » tout court vaut parpaing CREUX, parce que
        # c'est le premier de sa famille — et c'est bien ce qu'on vend quand on
        # ne précise pas.
        fiche["rang"] = rang

        if fiche.get("nom"):
            appellations.append((normaliser(fiche["nom"]), slug, 6))
            # Personne n'écrit « parpaing creux 15 » ni « gravillon et
            # cailloux » : on écrit « parpaing 15 », « gravillon ». Le premier
            # mot du nom officiel est donc une appellation à part entière,
            # moins sûre que le nom entier mais bien plus fréquente.
            premier = normaliser(fiche["nom"]).split(" ")[0]
            if len(premier) >= 4 and premier != normaliser(fiche["nom"]):
                appellations.append((premier, slug, 3))
        if fiche.get("nom_mg"):
            appellations.append((normaliser(fiche["nom_mg"]), slug, 5))
        synonymes = fiche.get("synonymes") or []
        if isinstance(synonymes, str):
            synonymes = json.loads(synonymes)
        # Les synonymes du catalogue, puis ceux relevés dans les publications.
        # Les seconds sont marqués comme tels : le jour où le site adopte l'un
        # d'eux, il apparaîtra en double et la ligne pourra être retirée d'ici.
        for synonyme in list(synonymes) + SYNONYMES_CORPUS.get(slug, []):
            expression = normaliser(synonyme)
            if expression:
                appellations.append((expression, slug, 2 if " " in expression else 1))
        fiche["synonymes"] = synonymes
        fiche["synonymes_corpus"] = SYNONYMES_CORPUS.get(slug, [])

    # Les expressions longues d'abord : « parpaing creux » doit gagner contre
    # « parpaing », et « vato madinika » contre « vato ».
    appellations.sort(key=lambda a: len(a[0]), reverse=True)

    # Quelles appellations plusieurs types se disputent-ils ? Déduit du
    # catalogue, jamais écrit à la main.
    proprietaires: dict[str, set[str]] = {}
    for expression, slug, _ in appellations:
        proprietaires.setdefault(expression, set()).add(slug)

    return {
        "familles": {f["slug"]: f for f in brut.get("familles", [])},
        "types": types,
        "materiaux": materiaux,
        "par_type": par_type,
        "appellations": appellations,
        "partagees": {e for e, slugs in proprietaires.items() if len(slugs) > 1},
    }


# ── Appariement ────────────────────────────────────────────────────────────
def _candidats_types(ligne_normalisee: str) -> list[tuple[str, int, str, bool]]:
    """(slug de type, poids, expression trouvée, partagée) — du plus probable au moins.

    `partagée` dit que la reconnaissance ne tient qu'à un mot que plusieurs
    types se disputent (« biriky », « vato ») : l'appelant plafonne alors la
    certitude, pour que l'interface demande confirmation au lieu de trancher
    en silence.
    """
    catalogue = charger()
    marques: dict[str, dict] = {}
    for expression, slug, poids in catalogue["appellations"]:
        if len(expression) < 3:
            continue
        if expression in SYNONYMES_INSUFFISANTS and slug not in marques:
            # Ces mots-là ne comptent que si un autre indice a déjà désigné le
            # même type. Seuls, ils n'ouvrent jamais un candidat.
            continue
        if not _mot_present(expression, ligne_normalisee):
            continue
        marque = marques.setdefault(slug, {"poids": 0, "expression": expression,
                                           "partage": True})
        marque["poids"] += poids
        # Il suffit d'UNE appellation non partagée pour lever le doute :
        # « fer » ne désigne que le fer à béton, « parpaing » désigne deux types.
        if expression not in catalogue["partagees"]:
            marque["partage"] = False

    # Personne n'a encore reconnu la ligne : on retente en tolérant la faute
    # de frappe. En DERNIER recours, jamais en parallèle — sinon un mot mal lu
    # viendrait concurrencer un mot bien lu, et « biriky » perdrait contre le
    # « briky » approximatif d'un autre type.
    if not marques:
        for expression, slug, poids in catalogue["appellations"]:
            if len(expression) < LONGUEUR_FLOUE or expression in SYNONYMES_INSUFFISANTS:
                continue
            if _ressemble_a_un_mot(expression, ligne_normalisee):
                marque = marques.setdefault(
                    slug, {"poids": 0, "expression": expression, "partage": True}
                )
                # Poids 1 quoi qu'il arrive : une reconnaissance approximative
                # ne doit jamais peser autant qu'un nom écrit correctement.
                marque["poids"] += 1
                if expression not in catalogue["partagees"]:
                    marque["partage"] = False

    # Un mot du catalogue peut se trouver dans une expression qui ne parle pas
    # du tout du matériau. Le piège ne baisse pas le poids : il RETIRE le
    # candidat, parce qu'un rond-point n'est pas « un peu » du fer à béton.
    for slug, motifs in PIEGES.items():
        if slug in marques and any(re.search(m, ligne_normalisee) for m in motifs):
            del marques[slug]

    # À égalité de poids, le type le mieux placé dans le catalogue gagne :
    # c'est le plus courant de sa famille, et c'est celui qu'on vend quand on
    # écrit « biriky » sans préciser.
    types = catalogue["types"]
    return sorted(
        ((slug, m["poids"], m["expression"], m["partage"]) for slug, m in marques.items()),
        key=lambda c: (-c[1], types.get(c[0], {}).get("rang", 999)),
    )


# Une faute de frappe ne se devine que sur un mot assez long : en dessous de
# six lettres, « bac » et « sac », « vato » et « vita » sont à une lettre l'un
# de l'autre, et la tolérance inventerait des offres.
LONGUEUR_FLOUE = 6
RESSEMBLANCE_MINIMALE = 0.88


def _ressemble_a_un_mot(expression: str, ligne_normalisee: str) -> bool:
    """Un mot de la ligne est-il ce mot-là, à une faute près ?

    Mot à mot, jamais ligne entière : comparer « fasika » à une phrase de
    trente mots donne un score minuscule, et comparer une phrase à un nom de
    matériau donne les faux amis du repli général (« planéité » ≈ « latérite »).
    """
    for mot in re.split(r"[^a-z0-9]+", ligne_normalisee):
        if len(mot) < LONGUEUR_FLOUE:
            continue
        if abs(len(mot) - len(expression)) > 2:
            continue
        if SequenceMatcher(None, mot, expression).ratio() >= RESSEMBLANCE_MINIMALE:
            return True
    return False


def _format_par_repere(type_slug: str, valeur: str) -> dict | None:
    """Le format d'un type qui porte ce repère chiffré, s'il est le seul.

    Sert au fer à béton : le diamètre lu dans « BA 8 » doit retomber sur une
    référence du catalogue, jamais sur un slug fabriqué à la main — le jour où
    le site ajoute un Ø20, il apparaîtra ici sans qu'on touche à ce fichier.
    """
    correspondants = [
        m for m in charger()["par_type"].get(type_slug, [])
        if valeur in m["reperes_cles"]
    ]
    return correspondants[0] if len(correspondants) == 1 else None


def _nombres_de_format(ligne_normalisee: str, exclure: set[str]) -> list[str]:
    """Les nombres qui peuvent être un format, jamais un prix.

    Un prix de matériau à Madagascar se compte en milliers ; un format se
    compte en centimètres ou en millimètres. Le seuil à 1 000 sépare les deux
    sans jamais avoir besoin de savoir lequel est lequel.
    """
    # Les cotes d'un BÂTIMENT, retirées avant tout le reste. « Raha tranon'akoho
    # 14m sur 6m » (#5) et « 12m sur 8 » (#40) sont deux acheteurs qui décrivent
    # leur chantier ; le 6 et le 4 tombaient sur la longueur d'une tôle, et deux
    # questions devenaient deux offres de bac. Le « x » n'est PAS dans la liste :
    # « 40x20x15 » est une vraie dimension de bloc, et l'étape 1 en dépend.
    ligne_normalisee = re.sub(
        r"\d+(?:[.,]\d+)?\s*m?\s*(?:sur|par)\s*\d+(?:[.,]\d+)?\s*m?\b",
        " ", ligne_normalisee,
    )
    # Un montant écrit en millions n'est pas un format. « efa niditra
    # +40millions d'ariary » (#40) donnait un 40, et 40 est l'épaisseur du bac
    # galvanisé : une maison de 40 millions devenait une offre de tôle.
    ligne_normalisee = re.sub(
        r"\d+(?:[.,]\d+)?\s*(?:millions?|milliona|tapitrisa|milliards?)", " ",
        ligne_normalisee,
    )
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

    # 0. Une cote COMPLÈTE de bloc (« 20x20x40 », « 12x33x33 ») se compare
    #    entière, dans n'importe quel ordre d'écriture. Deux cotes sur la
    #    ligne = deux formats pour un prix : on ne tranche pas. Une cote qui
    #    ne correspond à AUCUNE référence n'en désigne aucune — surtout pas
    #    celle qui partage un chiffre avec elle : « 20x20x53 » n'est pas le
    #    hourdis 60 × 20 × 20, c'est une référence à créer.
    if any(m.get("cotes_bloc") and len(m["cotes_bloc"]) == 3 for m in candidats):
        lues = grammaires.triples(ligne_normalisee)
        if len(lues) > 1:
            return None, 0
        if len(lues) == 1:
            exacts = [m for m in candidats if m.get("cotes_bloc") == lues[0]]
            if len(exacts) == 1:
                return exacts[0], 98
            if not exacts:
                return None, 0
            # Plusieurs références partagent cette cote (brique repressée et
            # brique cuite pleine font toutes deux 22 × 11 × 6) : ce sont les
            # mots qui trancheront, parmi elles seulement.
            candidats = exacts

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

    # 2. Le format dont TOUS les repères sont dans la ligne. « Gravillon 5/15 »
    # porte les deux chiffres du format : c'est une signature, pas un indice.
    if len(nombres) >= 2:
        jeu = set(nombres)
        complets = [
            m for m in candidats
            if m["reperes_cles"] and m["reperes_cles"] <= jeu
        ]
        if len(complets) == 1:
            return complets[0], 95

    # 3. Un repère numérique du format présent dans la ligne. Les repères
    # « clés » d'abord — ceux qui distinguent vraiment un format d'un autre.
    for jeu_reperes, note in (("reperes_cles", 90), ("reperes", 75)):
        for nombre in nombres:
            correspondants = [m for m in candidats if nombre in m[jeu_reperes]]
            if not correspondants:
                continue
            if len(correspondants) == 1:
                return correspondants[0], note
            # Plusieurs formats portent ce chiffre. Le MOINS qualifié gagne :
            # « hourdis 12 » désigne le 60×20×12, pas le 33×33×12 — celui-là
            # s'annonce toujours « TC ». Si deux formats sont aussi peu
            # qualifiés l'un que l'autre, on ne tranche pas.
            sobres = sorted(correspondants, key=lambda m: len(m["reperes_cles"]))
            if len(sobres[0]["reperes_cles"]) < len(sobres[1]["reperes_cles"]):
                return sobres[0], note - 15
            return None, 0

    # 4. Aucun chiffre ne tranche : les mots distinctifs (« fin », « rivière »).
    comptes = [
        (materiau, sum(
            1 for mot in materiau["mots_distinctifs"]
            if len(mot) >= 3 and _mot_present_ou_abrege(mot, ligne_normalisee)
        ))
        for materiau in candidats
    ]
    meilleur_score = max((n for _, n in comptes), default=0)
    en_tete = [m for m, n in comptes if n == meilleur_score and n > 0]
    # Un seul format en tête : c'est lui. Plusieurs : la ligne les cite tous
    # (« GALVA BAC/ONDULÉS » en cite deux), et choisir le premier de la liste
    # reviendrait à tirer au sort. On ne tranche pas — l'interface demandera.
    # C'est déjà la règle de l'étape 3 ; elle manquait ici.
    if len(en_tete) == 1:
        return en_tete[0], min(85, 55 + meilleur_score * 15)

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

    # Le calibre d'un fer se lit avant tout le reste : « BA 8 » et « T12 » ne
    # contiennent aucun mot du catalogue, et « fer 12 » perdrait son 12 si le
    # montant l'avait déjà consommé.
    diametre = diametre_de_fer(ligne)

    # « rond à béton 10 » : le mot « béton » vaut 6 points parce qu'il ouvre le
    # nom d'un type, « rond » n'en vaut qu'un parce qu'il n'est qu'un synonyme
    # — et l'offre partait en béton prêt à l'emploi. Un calibre annoncé AVEC
    # son métal renverse ce classement : personne n'écrit un diamètre à côté
    # d'un béton dosé.
    if diametre and diametre_de_fer(ligne, codes_courts=False):
        candidats = sorted(candidats, key=lambda candidat: candidat[0] != TYPE_FER)

    if not candidats:
        if diametre:
            fer = _format_par_repere(TYPE_FER, diametre)
            if fer:
                return _fiche(fer, charger()["types"].get(TYPE_FER, {}), 88, ambigu=False)
        # Dernier recours : le nom complet d'un format, écrit presque à
        # l'identique. Rattrape « contreplaqué 15 mm » quand le type n'a pas été
        # vu parce que le mot est écrit « ctp ».
        #
        # Le seuil était à 0,72, et il mentait : sur le corpus collecté ce repli
        # n'a JAMAIS rattrapé une vraie offre, il a seulement transformé
        # « Planéité » (0,75) et « terte » (0,77) en latérite. Comparer une
        # ligne entière à un nom de matériau n'a de sens que si la ligne EST ce
        # nom — d'où la longueur minimale et le seuil relevé.
        catalogue = charger()
        if len(ligne) < LONGUEUR_REPLI:
            return None
        meilleur, ressemblance = None, 0.0
        for materiau in catalogue["materiaux"].values():
            proche = SequenceMatcher(None, ligne, materiau["nom_normalise"]).ratio()
            if proche > ressemblance:
                meilleur, ressemblance = materiau, proche
        if meilleur and ressemblance >= RESSEMBLANCE_REPLI:
            type_fiche = catalogue["types"].get(meilleur.get("type_slug"), {})
            return _fiche(meilleur, type_fiche, int(ressemblance * 80), ambigu=False)
        return None

    type_slug, poids, _, partage = candidats[0]
    type_fiche = charger()["types"].get(type_slug, {})
    materiau, certitude = _choisir_format(type_slug, ligne, nombres_prix)

    # « Fer à béton : 22 000 la barre de 8 » — le type est trouvé, le format
    # non, parce que le 8 n'était pas là où l'étape 3 le cherchait.
    if materiau is None and type_slug == TYPE_FER and diametre:
        materiau = _format_par_repere(TYPE_FER, diametre)
        if materiau is not None:
            certitude = 88

    # La reconnaissance ne tient qu'à un mot partagé (« biriky » = parpaing ou
    # brique), ou deux types se disputent la ligne à poids égal : la certitude
    # est plafonnée et l'interface demandera confirmation. On ne jette rien —
    # c'est ainsi que les dépôts écrivent, et une offre écartée est une offre
    # perdue.
    if partage or (len(candidats) > 1 and candidats[1][1] >= poids):
        certitude = min(certitude, PLAFOND_PARTAGE)

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
            # La cote que la ligne écrit et que le catalogue ignore se lit
            # dans `extraction`, sur la ligne BRUTE — ici elle est normalisée
            # et le montant avale le chiffre qui le précède.
            "cote_lue": None,
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
        "cote_lue": None,
    }


def fiche_du_format(materiau: dict, certitude: int = 95) -> dict:
    """La fiche d'appariement d'une référence désignée par sa cote exacte."""
    type_fiche = charger()["types"].get(materiau.get("type_slug"), {})
    return _fiche(materiau, type_fiche, certitude, ambigu=False)


def format_par_cote(type_slug: str, cote: dict) -> dict | None:
    """La référence de ce type dont la cote est EXACTEMENT celle lue, si elle est seule."""
    return grammaires.format_existant(cote, charger()["par_type"].get(type_slug, []))


def reference_depuis_cote(type_slug: str, cote: dict) -> dict:
    """La référence que cette cote réclame — `{"possible", "motif", ...}`.

    Les blocs, le fer, le gravillon, la buse, le contreplaqué, le pavé, le
    béton dosé et la tôle ont leur grammaire (`grammaires.py`) ; le bois scié
    passe par `reference_a_creer` (section). Un slug déjà pris ne se recrée
    pas : deux dépôts qui écrivent la même cote tombent sur la même référence.
    """
    catalogue = charger()
    fiche_type = catalogue["types"].get(type_slug)
    if not fiche_type:
        return {"possible": False, "motif": "type inconnu du catalogue"}
    if cote.get("genre") == "section":
        return reference_a_creer(type_slug, cote["valeur"])
    projet = grammaires.projet_de_reference(
        type_slug, fiche_type["nom"], cote, catalogue["par_type"].get(type_slug, []))
    if projet.get("possible") and projet["slug"] in catalogue["materiaux"]:
        return {"possible": False, "motif": "cette reference existe deja",
                "slug": projet["slug"]}
    return projet


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


# « 15cmx7cmx4m », « 10,11cmx1, 5cm », « 5*5 », « 17cm*7cm », « 14/6 »
# ⚠ PAS de \\b apres l'unite : « 15cmx7cmx4m » n'a aucune frontiere de
#   mot entre « cm » et « x », et le motif n'y lisait qu'UNE cote sur trois.
#   Le tarif le mieux ecrit du corpus repartait donc sans reference.
MESURE = re.compile(r"(\d+(?:[.,]\s?\d+)?)\s*(cm|mm|m)?", re.I)
# « 14/6 », la notation malgache d'une section. DEUX dans la meme ligne et
# la ligne parle de deux articles pour un seul prix : « Madrier 5 m 14/6 dia
# 15/6 : 50 000 Ar » — le prix est celui du 15/6, le rapprochement tombait
# sur le 14/6, faute d'un 6x15 au catalogue. On ne tranche pas ce genre de
# ligne : on la laisse a l'humain.
SECTION_COURTE = re.compile(r"\d+\s*/\s*\d+")
# Un montant ecrit comme un Malgache l'ecrit : « 35 000ar », « 35.000 Ar ».
MONTANT_ECRIT = re.compile(r"\d[\d\s.,\u202f\u00a0]*\s*(?:ar|ariary|fmg)\b", re.I)


def _sans_les_montants(ligne: str) -> str:
    """La ligne debarrassee de ses prix.

    🔴 SANS CE NETTOYAGE, LE PRIX DEVIENT UNE DIMENSION. « ✓ Mm >>> 3 500ar »
       se lit « 3 » et « 500 », et un bois rond se rapproche alors d'une
       section de 3 cm qui n'a jamais ete ecrite. Mesure du 01/09/2026 : c'est
       ce qui gonflait le compte des lignes « sans reference » — le tarif
       relu comme une cote.
    """
    return MONTANT_ECRIT.sub(" ", ligne or "")


def dimensions_du_format(fiche: dict) -> dict:
    """(epaisseur, largeur en cm ; longueur en m) d'une reference.

    Depuis `attributs` quand ils sont la, sinon depuis le slug : la convention
    du catalogue est uniforme, `<type>-<AAxBB>-<L>m` avec AA et BB en
    millimetres. Une reference dont on ne sait pas lire les cotes ne se
    rapproche pas — elle ne se devine pas non plus.
    """
    attributs = fiche.get("attributs") or {}
    dims: dict[str, float] = {}
    for cle, sortie in (("epaisseur_cm", "e"), ("largeur_cm", "l"),
                        ("longueur_m", "L")):
        valeur = attributs.get(cle)
        if valeur is not None:
            try:
                dims[sortie] = float(valeur)
            except (TypeError, ValueError):
                pass
    if "e" not in dims or "l" not in dims:
        trouve = re.search(r"-(\d+)x(\d+)-", fiche.get("slug", ""))
        if trouve:
            dims["e"] = int(trouve.group(1)) / 10
            dims["l"] = int(trouve.group(2)) / 10
    if "L" not in dims:
        trouve = re.search(r"-(\d+)m$", fiche.get("slug", ""))
        if trouve:
            dims["L"] = float(trouve.group(1))
    return dims


def densite_du_type(type_slug: str) -> float | None:
    """La masse volumique que le catalogue applique DEJA a ce type.

    Deduite des references existantes, jamais choisie : si le madrier est a
    650 kg/m3 et la planche a 653, une nouvelle section de bois se pesera
    pareil. Rendue seulement quand les references du type s'accordent — un
    ecart large veut dire que le type melange des matieres (le bois rond
    contient du bambou a 400 et de l'eucalyptus a 731), et alors on ne pese
    rien du tout.
    """
    densites = []
    for fiche in charger()["par_type"].get(type_slug, []):
        volume = fiche.get("volume") or fiche.get("volume_m3_unite_defaut")
        poids = fiche.get("poids") or fiche.get("poids_kg_unite_defaut")
        try:
            volume, poids = float(volume), float(poids)
        except (TypeError, ValueError):
            continue
        if volume > 0 and poids > 0:
            densites.append(poids / volume)
    if len(densites) < 2:
        return None
    moyenne = sum(densites) / len(densites)
    if (max(densites) - min(densites)) / moyenne > 0.10:
        return None
    return round(moyenne)


def reference_a_creer(type_slug: str, ligne: str,
                      longueur_repli: float | None = None) -> dict:
    """Ce qu'il faudrait ecrire au catalogue pour que cette ligne existe.

    Rend `{"possible": bool, "motif": str, ...}` — jamais une exception : la
    reponse « non, et voici pourquoi » vaut autant que la reference elle-meme.

    🔒 CE QUI DOIT ETRE VRAI POUR QU'UNE REFERENCE NAISSE
      * la ligne ECRIT une section complete (deux cotes et une longueur) ;
      * le type se decrit par une section — c'est le cas du bois scie, ce
        n'est pas celui d'une tole (epaisseur x longueur), d'un parpaing
        (epaisseur seule) ni d'un sable (vendu au m3) ;
      * les references deja en place s'accordent sur une masse volumique, donc
        le poids se CALCULE au lieu de s'inventer.

    Sans ces trois, on rend le motif et on n'ecrit rien. Un catalogue qui
    accueille n'importe quelle cote cesse d'etre comparable, et comparer est
    la seule raison d'etre d'Akora.
    """
    from . import cotes as mod_cotes

    fiche_type = charger()["types"].get(type_slug)
    if not fiche_type:
        return {"possible": False, "motif": "type inconnu du catalogue"}

    section = mod_cotes.section(ligne)
    if not section:
        return {"possible": False,
                "motif": "aucune cote lisible dans la ligne"}
    if not section.get("longueur_m") and longueur_repli:
        section["longueur_m"] = longueur_repli
    if not section.get("longueur_m"):
        return {"possible": False, "motif": "longueur absente"}
    if not section.get("sure"):
        return {"possible": False,
                "motif": "cotes ambigues : " + ", ".join(
                    str(c) for c in section["cotes_en_trop"])}

    densite = densite_du_type(type_slug)
    if densite is None:
        return {"possible": False,
                "motif": "ce type n'a pas de masse volumique constante — "
                         "le poids ne se calculerait pas, il s'inventerait"}

    volume = mod_cotes.volume_m3(section)
    if not volume:
        return {"possible": False, "motif": "volume incalculable"}

    identifiant = mod_cotes.slug(type_slug, section)
    if identifiant in charger()["materiaux"]:
        return {"possible": False, "motif": "cette reference existe deja",
                "slug": identifiant}

    noms = mod_cotes.libelles(fiche_type["nom"], section)
    return {
        "possible": True,
        "motif": "",
        "slug": identifiant,
        "type_slug": type_slug,
        "unite": "piece",
        "volume": volume,
        "poids": round(volume * densite, 3),
        "densite": densite,
        "ordre_format": section["epaisseur_cm"],
        "attributs": {
            "longueur_m": section["longueur_m"],
            "epaisseur_cm": section["epaisseur_cm"],
            "largeur_cm": section["largeur_cm"],
        },
        **noms,
    }


def propose_par_dimensions(type_slug: str, ligne: str) -> dict | None:
    """La reference dont TOUTES les cotes sont ecrites dans la ligne.

    🔴 CE QUE CETTE FONCTION FAIT, ET CE QU'ELLE NE FERA JAMAIS.

       Une ligne de tarif porte son format sans porter son materiau :

           #MADRIER 4m : (KININIA MENA BE)     <- le materiau, sans cote
           ✓ 15cmx7cmx4m= 35 000ar             <- la cote, sans materiau

       `apparier()` cherche un MOT de materiau et ne trouve rien dans la
       seconde ligne : elle repart sans reference, et son prix avec. Le type,
       lui, vient de l'en-tete — c'est acquis et ce n'est pas une supposition.

       Reste a choisir le format. On ne le devine pas : on exige que la ligne
       ECRIVE les cotes exactes d'une reference, et **d'une seule**. « 15, 7,
       4m » contre « Madrier 7 x 15 . 4 m » : les trois y sont. « -014 »
       contre des toles de 0,25 / 0,30 / 0,40 / 0,45 : aucune, donc rien —
       et c'est precisement le rapprochement invente qui avait etiquete une
       tole 0,45 mm au prix d'une 0,14 le 24/08/2026.

       Deux references possibles = aucune proposition. Une ligne qui nomme
       deux sections (« 14/6 dia 15/6 : 50 000 Ar ») rend donc `None` des que
       les deux existent au catalogue.

    Le resultat reste une PROPOSITION : l'atelier la pre-selectionne et la
    signale comme telle, un humain confirme. Rien ne s'ecrit d'ici.
    """
    propre = normaliser(_sans_les_montants(ligne))
    if len(SECTION_COURTE.findall(propre)) > 1:
        return None
    mesures = []
    for trouve in MESURE.finditer(propre):
        brut = trouve.group(1).replace(" ", "").replace(",", ".")
        try:
            valeur = float(brut)
        except ValueError:
            continue
        if 0 < valeur <= 600:
            mesures.append((valeur, (trouve.group(2) or "").lower()))
    if not mesures:
        return None

    en_cm = {v for v, u in mesures if u in ("cm", "")}
    en_cm |= {v / 10 for v, u in mesures if u == "mm"}
    en_m = {v for v, u in mesures if u == "m"}

    retenus = []
    for fiche in charger()["par_type"].get(type_slug, []):
        dims = dimensions_du_format(fiche)
        if "e" not in dims or "l" not in dims:
            continue
        if dims["e"] not in en_cm or dims["l"] not in en_cm:
            continue
        if "L" in dims and en_m and dims["L"] not in en_m:
            continue
        retenus.append(fiche)
    if len(retenus) != 1:
        return None
    fiche = retenus[0]
    return {"slug": fiche["slug"], "nom": fiche["nom"],
            "libelle": fiche.get("libelle_court") or fiche["nom"],
            "unite": fiche.get("unite")}


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
