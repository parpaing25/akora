"""Lecture des offres de transport : camions, capacités, barèmes, zones.

Pourquoi cette pièce existe : sur Akora, le produit n'est pas le prix au dépôt,
c'est le **prix rendu chantier**. Ce prix se calcule avec
`vehicules_livraison` — capacité, prix au km, forfait, kilomètres inclus. Un
fournisseur réservé sans aucun véhicule ne peut donc produire *aucun* prix
livré : la fiche est jolie et le cœur du produit ne tourne pas.

D'où deux choses que le bot sait faire ici :

  1. lire la **flotte d'un dépôt** quand il l'annonce (« livraison par camion
     8 m³, 250 000 Ar le voyage sur Tana ») ;
  2. reconnaître un **transporteur pur** — quelqu'un qui ne vend aucun
     matériau mais loue sa benne. C'est un fournisseur d'un autre genre, et il
     manquait complètement au bot.

⚠️ Règle A2.8 — **aucune donnée inventée**. « 6 roues » est la façon malgache
de dire la taille d'un camion, mais la convertir en mètres cubes serait une
estimation déguisée en mesure : le libellé est gardé, la capacité reste vide,
et l'interface la demande. Un tarif de transport faux se paie en litige, pas
en approximation.
"""
from __future__ import annotations

import re

from . import referentiel

# ── Vocabulaire ────────────────────────────────────────────────────────────
# Ce qui désigne un véhicule de livraison. Le malgache d'abord : « kamiao »,
# « fiara », et les « X roues » qui sont la mesure courante ici.
VEHICULES = {
    "benne": ["benne", "camion benne", "benne basculante", "basculante", "dumper"],
    "plateau": ["plateau", "camion plateau", "porte-engin", "porte engin"],
    "semi": ["semi-remorque", "semi remorque", "semi", "remorque", "tracteur routier"],
    "camion": ["camion", "kamiao", "camionnette", "fourgon"],
    "citerne": ["citerne", "toupie", "malaxeur", "betonniere portee"],
    "leger": ["4x4", "pick-up", "pick up", "bache", "fiara kely"],
}

# « 6 roues », « 10 roues » : une taille de camion, pas une capacité.
MOTIF_ROUES = re.compile(r"\b(\d{1,2})\s*roues?\b")

MOTS_LOCATION = ("location", "louer", "loue", "mihofa", "manofa", "hofa",
                 "a louer", "mila fiara", "transport", "fandefasana",
                 "livraison assuree", "on transporte", "service transport")

# Capacité : « 8 m3 », « 8m³ », « 10 tonnes », « 5 T », « 12 t »
MOTIF_M3 = re.compile(r"(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:m\s*3|m³|metres? cubes?|cubes?)\b")
MOTIF_TONNES = re.compile(r"(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:tonnes?|t)\b(?!\w)")

# Barème : « 250 000 Ar le voyage », « 15 000 Ar/km », « forfait 80 000 »
MOTS_VOYAGE = ("voyage", "trajet", "course", "rotation", "aller", "livraison",
               "dia", "fandehanana")

# Ce qui doit suivre IMMÉDIATEMENT un montant pour le qualifier. La devise et
# les articles sont facultatifs — « 15 000 Ar/km », « 15000 le km »,
# « 400 000 isaky ny dia » s'écrivent tous les trois.
_LIAISON = r"^\s*(?:ar(?:iary)?|mga)?\s*(?:[/-]|par|le|la|pour|isaky\s+ny|amin'?ny)?\s*"
MOTIF_APRES_KM = re.compile(_LIAISON + r"(?:km|kilometres?)\b")
MOTIF_APRES_VOYAGE = re.compile(
    _LIAISON + r"(?:" + "|".join(MOTS_VOYAGE) + r")\b"
)
# « forfait 80 000 », « le voyage 250 000 » : le mot-clé peut aussi précéder.
MOTIF_AVANT_VOYAGE = re.compile(
    r"(?:forfait|prix\s+du|" + "|".join(MOTS_VOYAGE) + r")\W{0,8}$"
)

# Zone et franco
MOTIF_RAYON = re.compile(
    r"(?:rayon|jusqu'?a|dans|autour|environs?|alentours?)\D{0,14}(\d{1,3})\s*km", re.I
)
MOTIF_FRANCO = re.compile(
    r"(?:livraison\s+(?:gratuite|offerte|gratis)|franco|gratuit)\D{0,30}"
    r"(?:a\s+partir\s+de|des|au-?dela\s+de|si)\D{0,10}(\d{1,6})",
    re.I,
)


def _nombre(brut: str) -> float:
    return float(brut.replace(",", ".").replace(" ", ""))


def _montant(brut: str) -> int:
    return int(re.sub(r"[\s.  ]", "", brut))


def semble_transport(texte: str) -> bool:
    """La publication parle-t-elle de transport ou de location de camion ?

    Large exprès : un dépôt qui décrit sa livraison compte autant qu'un
    transporteur pur. Le tri fin se fait ensuite, en regardant s'il vend aussi
    un matériau du catalogue.
    """
    reduit = referentiel.sans_accents(texte or "")
    a_un_vehicule = any(
        mot in reduit for variantes in VEHICULES.values() for mot in variantes
    ) or MOTIF_ROUES.search(reduit) is not None
    return a_un_vehicule and (
        any(mot in reduit for mot in MOTS_LOCATION)
        or any(mot in reduit for mot in MOTS_VOYAGE)
    )


def categorie_vehicule(ligne_normalisee: str) -> tuple[str | None, str | None]:
    """(catégorie, expression trouvée). Les expressions longues d'abord."""
    paires = sorted(
        ((cat, mot) for cat, mots in VEHICULES.items() for mot in mots),
        key=lambda p: len(p[1]), reverse=True,
    )
    for categorie, mot in paires:
        if re.search(rf"(?<![a-z0-9]){re.escape(mot)}(?![a-z0-9])", ligne_normalisee):
            return categorie, mot
    return None, None


def _bareme(ligne: str, cfg: dict) -> dict:
    """Sépare le prix AU VOYAGE du prix AU KILOMÈTRE dans une même ligne.

    « 250 000 Ar le voyage, 15 000 Ar/km au-delà de 20 km » porte les deux, et
    les confondre ferait facturer un aller à 15 000 Ar ou un kilomètre à
    250 000 Ar. On regarde donc ce qui SUIT immédiatement chaque montant.
    """
    from .extraction import MOTIF_MONTANT, _sans_telephones

    propre = _sans_telephones(ligne)
    reduit = referentiel.sans_accents(propre)
    plancher = int(cfg.get("prix_plancher_ar", 200))
    plafond = int(cfg.get("prix_plafond_ar", 50_000_000))

    resultat = {"forfait_base": None, "prix_par_km": None, "prix_minimum": None}
    for trouve in MOTIF_MONTANT.finditer(propre):
        brut, devise = trouve.group(1), (trouve.group(2) or "").lower()
        valeur = _montant(brut)
        if devise in ("fmg", "fg"):
            valeur = round(valeur / int(cfg.get("taux_fmg_ar", 5) or 5))
        if not (plancher <= valeur <= plafond):
            continue
        # Ce qui suit IMMÉDIATEMENT le montant décide de sa nature. Chercher
        # le mot-clé « quelque part dans les 26 caractères suivants » lisait
        # « à partir de 500 parpaings, rayon 25 km » comme un prix de 500 Ar
        # au kilomètre : le « km » était bien là, mais il appartenait au rayon.
        suite = reduit[trouve.end():trouve.end() + 30]
        avant = reduit[max(0, trouve.start() - 24):trouve.start()]
        if MOTIF_APRES_KM.match(suite):
            resultat["prix_par_km"] = resultat["prix_par_km"] or valeur
        elif MOTIF_APRES_VOYAGE.match(suite) or MOTIF_AVANT_VOYAGE.search(avant):
            resultat["forfait_base"] = resultat["forfait_base"] or valeur
        elif "minimum" in suite[:16] or "minimum" in avant:
            resultat["prix_minimum"] = resultat["prix_minimum"] or valeur
    return resultat


def vehicules(texte: str, cfg: dict) -> list[dict]:
    """Les véhicules décrits dans une publication, un par ligne parlante."""
    from .extraction import segments

    trouves: list[dict] = []
    vus: set[str] = set()

    for ligne in segments(texte or ""):
        reduit = referentiel.normaliser(ligne)
        categorie, expression = categorie_vehicule(reduit)
        roues = MOTIF_ROUES.search(reduit)
        if not categorie and not roues:
            continue

        m3 = MOTIF_M3.search(reduit)
        tonnes = MOTIF_TONNES.search(reduit)
        bareme = _bareme(ligne, cfg)

        # Une ligne qui nomme un camion sans rien dire d'autre n'apprend rien :
        # ni capacité, ni tarif, ni même que c'est une offre.
        if not any([m3, tonnes, roues, bareme["forfait_base"], bareme["prix_par_km"]]):
            continue

        capacite_m3 = _nombre(m3.group(1)) if m3 else None
        capacite_kg = _nombre(tonnes.group(1)) * 1000 if tonnes else None

        libelle = []
        if categorie:
            libelle.append({"benne": "Camion benne", "plateau": "Camion plateau",
                            "semi": "Semi-remorque", "camion": "Camion",
                            "citerne": "Camion citerne",
                            "leger": "Véhicule léger"}[categorie])
        else:
            libelle.append("Camion")
        if roues:
            libelle.append(f"{roues.group(1)} roues")
        if capacite_m3:
            libelle.append(f"{capacite_m3:g} m³")
        elif capacite_kg:
            libelle.append(f"{capacite_kg / 1000:g} t")
        nom = " ".join(libelle)

        if nom in vus:
            continue
        vus.add(nom)

        # La certitude ne récompense que ce qui est ÉCRIT. Un camion nommé sans
        # capacité ni tarif reste une piste, pas une ligne de barème.
        certitude = 30
        if capacite_m3 or capacite_kg:
            certitude += 35
        if bareme["forfait_base"] or bareme["prix_par_km"]:
            certitude += 25
        if categorie:
            certitude += 10

        trouves.append({
            "libelle_brut": ligne[:180],
            "nom": nom,
            "categorie": categorie or ("roues" if roues else None),
            "capacite_m3": capacite_m3,
            "capacite_kg": capacite_kg,
            "aller_retour": 1 if "aller-retour" in reduit or "aller retour" in reduit else 0,
            "certitude": min(100, certitude),
            **bareme,
        })

    # Le tarif est presque toujours sur une AUTRE ligne que le camion :
    #
    #     Camion benne 8m3 dispo tous les jours
    #     250 000 Ar le voyage sur Tana
    #     15 000 Ar/km au-delà de 20 km
    #
    # Lire ligne à ligne rendait donc un camion sans aucun prix. On rattrape en
    # relisant le texte entier — mais SEULEMENT s'il n'y a qu'un véhicule :
    # avec deux camions et deux tarifs, rien ne dit lequel va avec lequel, et
    # attribuer au hasard vaudrait moins que laisser vide.
    if len(trouves) == 1:
        global_ = _bareme(texte or "", cfg)
        vehicule = trouves[0]
        complete = False
        for champ in ("forfait_base", "prix_par_km", "prix_minimum"):
            if not vehicule.get(champ) and global_.get(champ):
                vehicule[champ] = global_[champ]
                complete = True
        if complete:
            vehicule["certitude"] = min(100, vehicule["certitude"] + 20)
    return trouves


def zone(texte: str) -> dict:
    """Rayon de livraison annoncé et seuil de franco, s'ils sont écrits."""
    reduit = referentiel.normaliser(texte or "")
    rayon = MOTIF_RAYON.search(reduit)
    franco = MOTIF_FRANCO.search(reduit)
    return {
        "rayon_km": float(rayon.group(1)) if rayon else None,
        # Un franco à 3 chiffres est un nombre de sacs, à 6 chiffres un montant
        # en ariary. On garde le brut : c'est à l'interface de trancher, pas à
        # une règle qui se tromperait une fois sur deux.
        "seuil_franco": _montant(franco.group(1)) if franco else None,
    }


def analyser(texte: str, cfg: dict) -> dict:
    """Tout ce qu'une publication dit du transport."""
    flotte = vehicules(texte, cfg)
    return {
        "vehicules": flotte,
        "est_transporteur": bool(flotte) and semble_transport(texte),
        **zone(texte),
    }
