"""Reconnaissance des lieux malgaches dans une publication.

Un quartier reconnu vaut mieux qu'une ville : sur Akora, le prix rendu chantier
se calcule au kilomètre depuis le dépôt, et « Ambohibao » place un dépôt à
15 km d'un chantier qu'« Antananarivo » laisserait n'importe où.

Ce module ne fait que **nommer** un lieu. Il n'invente JAMAIS de coordonnées :
la latitude et la longitude viennent de la table `localites` d'Akora, via
`akora.localite_par_nom()`, et restent nulles quand la localité y est inconnue
(règle A2.8 : le site affiche alors « distance non calculable » plutôt qu'un
chiffre faux).
"""
from __future__ import annotations

import re
import unicodedata

# Quartiers et communes de l'agglomération d'Antananarivo (les plus cités dans
# les annonces). L'ordre n'a pas d'importance : on prend le plus long trouvé.
QUARTIERS_TANA = [
    "Ambatobe", "Ivandry", "Ambohibao", "Analamahitsy", "Ankorondrano", "Andraharo",
    "Alarobia", "Tsiadana", "Ambodivona", "Antanimena", "Isoraka", "Tsaralalana",
    "Behoririka", "Andravoahangy", "Ampandrana", "Ankadifotsy", "Mahamasina",
    "Ampefiloha", "Anosy", "Ambohipo", "Ankatso", "Ambohijatovo", "Faravohitra",
    "Ambatonakanga", "Antaninandro", "Ampasanimalo", "Ampasampito", "Manjakaray",
    "Ankadikely", "Ilafy", "Sabotsy Namehana", "Talatamaty", "Ivato",
    "Ambohidratrimo", "Antehiroka", "Ankadimbahoaka", "Anosizato", "Andranonahoatra",
    "Itaosy", "Ambohijanaka", "Tanjombato", "Ankadindramamy", "Andoharanofotsy",
    "Alasora", "Ambohimangakely", "Ankaraobato", "Fenoarivo", "Ambohimanarina",
    "Mandroseza", "Ambanidia", "Ambohimiandra", "Nanisana", "Ankerana",
    "Soanierana", "Analakely", "Andohalo", "Besarety", "Amboditsiry",
    "Ambohitrarahaba", "Ambatomaro", "Anjanahary", "Bemasoandro", "Ampitatafika",
    "Anosibe", "Ankasina", "Andavamamba", "Isotry", "Soarano", "Antsakaviro",
    "Ampahibe", "Ankadivato", "Antsahabe", "Ambohidrapeto", "Manjakandriana",
    "Anjeva", "Carion", "Ambohitrimanjaka", "Ivato Aeroport", "Andranomena",
    "Andrefan'Ambohijanahary", "Ambodihady", "Ambohimahitsy", "Mandrosoa",
    "Ambatoroka", "Ankazomanga", "Tsimbazaza", "Anosipatrana", "Ambodin'Isotry",
    "Ambohimanambola", "Masay", "Betongolo", "Antanimora", "Andrononobe",
    "Ankadilalana", "Iavoloha", "Ambatolampy Tsimahafotsy", "Sabotsy",
    "Ampangabe", "Anosiala", "Mahitsy", "Imerintsiatosika", "Arivonimamo",
    "Ambatolampy", "Behenjy", "Ankadinandriana", "Ambohidahy", "Ambatomena",
    "67 ha", "67ha", "Soixante-sept hectares", "Cité Planton", "Villa Berthe",
    "Ampasika", "Ambodivoanjo", "Ambohitsoa", "Andohanimandroseza", "Amboaroy",
]

# Villes et localités du reste du pays → nom canonique : variantes acceptées.
VILLES = {
    "Antananarivo": ["antananarivo", "tananarive", "tana", "antananarivo ville"],
    "Toamasina": ["toamasina", "tamatave"],
    "Antsirabe": ["antsirabe"],
    "Fianarantsoa": ["fianarantsoa", "fianara"],
    "Mahajanga": ["mahajanga", "majunga"],
    "Toliara": ["toliara", "tulear", "tuléar", "toliary"],
    "Antsiranana": ["antsiranana", "diego suarez", "diego-suarez", "diego"],
    "Nosy Be": ["nosy be", "nosy-be", "nosybe", "hell ville", "hell-ville"],
    "Morondava": ["morondava"],
    "Sambava": ["sambava"],
    "Taolagnaro": ["taolagnaro", "fort dauphin", "fort-dauphin"],
    "Manakara": ["manakara"],
    "Farafangana": ["farafangana"],
    "Ambositra": ["ambositra"],
    "Moramanga": ["moramanga"],
    "Ambatondrazaka": ["ambatondrazaka"],
    "Maevatanana": ["maevatanana"],
    "Marovoay": ["marovoay"],
    "Antalaha": ["antalaha"],
    "Andapa": ["andapa"],
    "Vohemar": ["vohemar", "vohémar", "iharana"],
    "Ambanja": ["ambanja"],
    "Ambilobe": ["ambilobe"],
    "Miandrivazo": ["miandrivazo"],
    "Tsiroanomandidy": ["tsiroanomandidy"],
    "Ihosy": ["ihosy"],
    "Betroka": ["betroka"],
    "Ambovombe": ["ambovombe"],
    "Mananjary": ["mananjary"],
    "Vatomandry": ["vatomandry"],
    "Brickaville": ["brickaville", "vohibinany"],
    "Fenoarivo Atsinanana": ["fenoarivo atsinanana", "fenerive est", "fénérive est"],
    "Maroantsetra": ["maroantsetra"],
    "Sainte-Marie": ["sainte marie", "sainte-marie", "nosy boraha"],
    "Foulpointe": ["foulpointe", "mahavelona"],
    "Mahambo": ["mahambo"],
    "Ifaty": ["ifaty"],
    "Anakao": ["anakao"],
    "Ankify": ["ankify"],
    "Mantasoa": ["mantasoa"],
    "Ampefy": ["ampefy"],
    "Antsohihy": ["antsohihy"],
    "Port-Bergé": ["port berge", "port-bergé", "boriziny"],
    "Mandritsara": ["mandritsara"],
    "Bekily": ["bekily"],
    "Morafenobe": ["morafenobe"],
    "Maintirano": ["maintirano"],
    "Belo sur Tsiribihina": ["belo sur tsiribihina", "belo-sur-tsiribihina"],
    "Ranomafana": ["ranomafana"],
    "Ambalavao": ["ambalavao"],
    "Manjakandriana": ["manjakandriana"],
    "Ambatolampy": ["ambatolampy"],
    "Arivonimamo": ["arivonimamo"],
    "Miarinarivo": ["miarinarivo"],
    "Tsiafahy": ["tsiafahy"],
}


def _sans_accents(texte: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texte) if unicodedata.category(c) != "Mn"
    ).lower()


def _trouver(aiguille: str, meule_normalisee: str) -> bool:
    """Cherche une expression en respectant les frontières de mot."""
    motif = re.escape(_sans_accents(aiguille)).replace(r"\ ", r"[\s\-']+")
    return re.search(rf"(?<![a-z0-9]){motif}(?![a-z0-9])", meule_normalisee) is not None


def detecter(texte: str) -> tuple[str | None, str | None]:
    """Renvoie (ville, quartier). L'un des deux peut être None."""
    normalise = _sans_accents(texte)

    # Le quartier d'abord : c'est l'information la plus précise.
    quartiers = sorted(QUARTIERS_TANA, key=len, reverse=True)
    quartier = next((q for q in quartiers if _trouver(q, normalise)), None)

    ville = None
    for canonique, variantes in VILLES.items():
        for variante in sorted(variantes, key=len, reverse=True):
            if _trouver(variante, normalise):
                ville = canonique
                break
        if ville:
            break

    # Un quartier de Tana implique Antananarivo, sauf si une autre ville est
    # nommée explicitement (« Ambatobe » existe aussi ailleurs, mais l'annonce
    # qui cite Tamatave parle de Tamatave).
    if quartier and not ville:
        ville = "Antananarivo"
    if quartier and ville and ville != "Antananarivo":
        quartier = None

    return ville, quartier


def normaliser(ville: str | None, quartier: str | None) -> tuple[str | None, str | None]:
    """Remet un quartier à sa place quand il a atterri dans « ville ».

    Le modèle écrit volontiers `city = "Talatamaty"` — un quartier de Tana.
    Sur le site, `city` sert aux filtres et aux regroupements : y mettre un
    quartier disperse les annonces d'Antananarivo en dizaines de villes.
    """
    ville = (ville or "").strip() or None
    quartier = (quartier or "").strip() or None
    if not ville:
        return ville, quartier

    normalise = _sans_accents(ville)
    est_quartier = any(_trouver(q, normalise) for q in QUARTIERS_TANA)
    connue = any(
        _trouver(v, normalise) for variantes in VILLES.values() for v in variantes
    )
    if est_quartier and not connue:
        return "Antananarivo", quartier or ville
    return ville, quartier
