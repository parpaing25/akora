"""Lecture d'une publication Facebook : qui vend, quoi, à quel prix, où.

Les publications de dépôts malgaches ont presque toutes la même forme : une
ligne d'accroche, puis un tarif ligne par ligne, puis un numéro.

    TAF-DEPOT Ambohibao
    Parpaing 15 ........ 1 400 Ar
    Parpaing 20 ........ 1 800 Ar
    Hourdis 12 ......... 1 900 Ar/pce
    Fasika 1 camion 8m3 : 320 000 Ar
    Livraison possible. Antsoy 034 12 345 67

D'où le découpage en segments : **une ligne = une offre**. La lecture en prose
n'est qu'un rattrapage, parce qu'elle confond systématiquement quel montant va
avec quel matériau dès qu'il y en a plus d'un.
"""
from __future__ import annotations

import re

from . import lieux, referentiel

# ── Téléphone ──────────────────────────────────────────────────────────────
# Les quatre opérateurs mobiles (032 Orange, 033 Airtel, 034 Telma, 038 Blueline)
# et le fixe 020. Les séparateurs sont libres : espace, point, tiret, rien.
MOTIF_TELEPHONE = re.compile(
    r"(?<![0-9])(?:\+?261[\s.\-]?|0)?\s?((?:3[2-4]|38|20)(?:[\s.\-]?\d){7,8})(?![0-9])"
)

MOTS_WHATSAPP = ("whatsapp", "whatsap", "wathsapp", "wtsp", "wa.me", "watsap")

# ── Prix ───────────────────────────────────────────────────────────────────
# Un montant, avec ou sans séparateur de milliers, suivi ou non d'une devise.
# `\d{3}` groupés : « 1 400 », « 1.400 », « 1400 », « 320 000 ».
MOTIF_MONTANT = re.compile(
    r"(?<![0-9,.])(\d{1,3}(?:[\s. ]\d{3})+|\d{3,9})\s*"
    r"(ar(?:iary)?|mga|fmg|fg)?(?![0-9])",
    re.IGNORECASE,
)
DEVISES_FMG = ("fmg", "fg")

# Mots qui annoncent un prix — ils font accepter un nombre nu comme montant.
ANNONCES_PRIX = ("prix", "vidiny", "ar", "ariary", "tarif", "cout", "a partir de",
                 "des", "vend", "amidy", "mivarotra", "promo")

# Ce qui n'est PAS un prix, même écrit comme tel.
PIEGES_PRIX = ("cin", "nif", "stat", "rcs", "compte", "reference", "ref",
               "abonne", "vues", "membres", "code")

# ── Nom d'entreprise dans le texte ─────────────────────────────────────────
# `[^\S\n]` et non `\s` : l'enseigne tient sur UNE ligne. Avec `\s`, « DEPOT
# MANDROSOA Ambohibao \n Tarif du jour » devenait un seul nom, et le numéro de
# téléphone de la ligne suivante finissait dans la raison sociale.
# Les mots retenus après le mot-clé doivent commencer par une lettre : sans
# ça, « Depot Ambohimanarina 032 00 111 » passait tel quel.
MOTIF_ENSEIGNE = re.compile(
    r"\b((?:ets|etablissement[s]?|sarl|sarlu|gie|depot|dépôt|briqueterie|"
    r"carriere|carrière|scierie|societe|société)"
    r"[^\S\n.\-]*[.\-]?[^\S\n]*"
    r"[A-ZÀ-Ü][\w'’-]*(?:[^\S\n]+[A-ZÀ-Ü][\w'’-]*){0,3})",
    re.IGNORECASE,
)

# ── Livraison / retrait ────────────────────────────────────────────────────
MOTS_LIVRAISON = ("livraison", "livre", "livrons", "fandefasana", "alefa",
                  "transport assure", "on livre", "livrable")
MOTS_RETRAIT = ("sur place", "retrait", "a emporter", "depot", "venir chercher",
                "eto an-toerana", "aka eto")

# Vocabulaire malgache fréquent : sert à choisir la langue du message de contact.
MOTS_MALGACHES = ("amidy", "mivarotra", "vidiny", "misy", "antsoy", "azafady",
                  "tonga", "faha", "sy", "ary", "eto", "any", "ianao", "ianareo",
                  "fasika", "biriky", "vato", "hazo", "vy", "simenitra", "tafo")


def _chiffres(texte: str) -> str:
    return "".join(c for c in texte if c.isdigit())


def normaliser_telephone(brut: str) -> tuple[str, str]:
    """(affichage « 034 12 345 67 », clé « 0341234567 »). ('', '') si invalide."""
    chiffres = _chiffres(brut)
    if chiffres.startswith("261"):
        chiffres = "0" + chiffres[3:]
    elif not chiffres.startswith("0"):
        chiffres = "0" + chiffres
    if len(chiffres) != 10 or chiffres[:3] not in ("032", "033", "034", "038", "020"):
        return "", ""
    affichage = f"{chiffres[:3]} {chiffres[3:5]} {chiffres[5:8]} {chiffres[8:]}"
    return affichage, chiffres


def telephones(texte: str) -> list[dict]:
    """Tous les numéros valides du texte, sans doublon, dans l'ordre d'apparition."""
    trouves, vus = [], set()
    for correspondance in MOTIF_TELEPHONE.finditer(texte):
        affichage, cle = normaliser_telephone(correspondance.group(1))
        if not cle or cle in vus:
            continue
        vus.add(cle)
        trouves.append({"affichage": affichage, "cle": cle})
    return trouves


def _sans_telephones(texte: str) -> str:
    """Retire les numéros avant de chercher un prix.

    « 034 12 345 67 » contient « 345 » et « 12 » : sans ce nettoyage, un numéro
    devient un tarif, et le prix d'un parpaing devient 34 000 000 Ar.
    """
    return MOTIF_TELEPHONE.sub(" ", texte)


def prix_dans(ligne: str, cfg: dict) -> tuple[int | None, str | None, set[str]]:
    """(montant en ariary, devise d'origine, chiffres consommés).

    Les chiffres consommés sont renvoyés pour que l'appariement au référentiel
    ne relise pas un montant comme un format.
    """
    propre = _sans_telephones(ligne)
    reduit = referentiel.sans_accents(propre)
    if any(piege in reduit for piege in PIEGES_PRIX):
        return None, None, set()

    plancher = int(cfg.get("prix_plancher_ar", 200))
    plafond = int(cfg.get("prix_plafond_ar", 50_000_000))
    taux_fmg = int(cfg.get("taux_fmg_ar", 5)) or 5
    annonce = any(mot in reduit for mot in ANNONCES_PRIX)

    for correspondance in MOTIF_MONTANT.finditer(propre):
        brut, devise = correspondance.group(1), (correspondance.group(2) or "").lower()
        # Un nombre nu n'est un prix que si la ligne annonce un prix : sinon
        # « hourdis 60x20x12 » donnerait 601 200.
        if not devise and not annonce:
            continue
        valeur = int(re.sub(r"[\s. ]", "", brut))
        if devise in DEVISES_FMG:
            valeur = round(valeur / taux_fmg)
        if not (plancher <= valeur <= plafond):
            continue
        consommes = set(re.findall(r"\d+", brut))
        return valeur, ("Fmg" if devise in DEVISES_FMG else "Ar"), consommes
    return None, None, set()


def quantite_min_dans(ligne: str) -> int | None:
    """« minimum 100 pièces », « à partir de 50 » -> 100, 50."""
    reduit = referentiel.normaliser(ligne)
    trouve = re.search(
        r"(?:minim(?:um|om)|min|a partir de|manomboka|au moins)\D{0,12}(\d{1,5})", reduit
    )
    if not trouve:
        return None
    valeur = int(trouve.group(1))
    return valeur if 2 <= valeur <= 100_000 else None


# ── Découpage en segments ──────────────────────────────────────────────────
SEPARATEURS = re.compile(r"[\n\r•▪◾✅✔☑➡►·]+")


def segments(texte: str) -> list[str]:
    """Une ligne = une offre. Les lignes qui portent plusieurs prix sont recoupées."""
    morceaux: list[str] = []
    for brut in SEPARATEURS.split(texte or ""):
        ligne = brut.strip(" \t-–—=*.:_")
        if not ligne:
            continue
        # « Parpaing 15 : 1400 Ar, hourdis 12 : 1900 Ar » sur une seule ligne :
        # deux montants suivis d'une devise = deux offres.
        if len(MOTIF_MONTANT.findall(_sans_telephones(ligne))) > 1 and (
            "," in ligne or ";" in ligne or "/" in ligne
        ):
            morceaux.extend(m.strip() for m in re.split(r"[;,]", ligne) if m.strip())
        else:
            morceaux.append(ligne)
    return morceaux


def offres(texte: str, cfg: dict) -> list[dict]:
    """Les offres lisibles dans une publication.

    Une ligne sans matériau reconnu est ignorée ; une ligne avec matériau mais
    sans prix est gardée (un dépôt qui annonce son stock sans tarif reste un
    fournisseur à contacter — c'est même souvent celui qu'on veut).
    """
    resultat: list[dict] = []
    deja: set[str] = set()

    for ligne in segments(texte):
        montant, devise, consommes = prix_dans(ligne, cfg)
        appariement = referentiel.apparier(ligne, consommes)
        if appariement is None:
            continue
        empreinte = appariement.get("materiau_slug") or appariement.get("type_slug") or ligne
        if empreinte in deja:
            continue
        deja.add(empreinte)

        unite = referentiel.unite_dans(ligne) or appariement.get("unite")
        resultat.append({
            "libelle_brut": ligne[:180],
            "prix": montant,
            "devise_source": devise,
            "unite": unite,
            "quantite_min": quantite_min_dans(ligne),
            **{c: appariement[c] for c in (
                "materiau_slug", "materiau_nom", "type_slug", "type_nom",
                "famille_slug", "certitude", "ambigu", "hors_catalogue")},
        })

    # Rattrapage : rien ligne par ligne, mais le texte entier parle bien d'un
    # matériau (publication en prose, « nous vendons du sable et du gravillon »).
    if not resultat:
        appariement = referentiel.apparier(texte)
        if appariement:
            montant, devise, _ = prix_dans(texte, cfg)
            resultat.append({
                "libelle_brut": (texte or "").strip()[:180],
                "prix": montant,
                "devise_source": devise,
                "unite": referentiel.unite_dans(texte) or appariement.get("unite"),
                "quantite_min": None,
                **{c: appariement[c] for c in (
                    "materiau_slug", "materiau_nom", "type_slug", "type_nom",
                    "famille_slug", "certitude", "ambigu", "hors_catalogue")},
            })
    return resultat


# ── Identité du vendeur ────────────────────────────────────────────────────
def enseigne(texte: str) -> str | None:
    """Le nom commercial écrit dans le texte, s'il y en a un.

    Le nom du profil Facebook reste le repli — mais « Ets RAKOTO Matériaux »
    écrit dans l'annonce vaut mieux qu'un prénom de compte personnel.
    """
    trouve = MOTIF_ENSEIGNE.search(texte or "")
    if not trouve:
        return None
    nom = re.sub(r"\s+", " ", trouve.group(1)).strip(" .-")
    return nom[:80] if len(nom) >= 5 else None


def langue(texte: str) -> str:
    """« fr » ou « mg » — la langue du message de prospection à préparer."""
    reduit = referentiel.normaliser(texte)
    mots = set(reduit.split())
    malgaches = sum(1 for mot in MOTS_MALGACHES if mot in mots)
    return "mg" if malgaches >= 3 else "fr"


# ── Côté acheteur : ce qu'une demande dit du besoin ────────────────────────
MOTS_URGENCE = ("urgent", "urgence", "maintenant", "aujourd'hui", "au plus vite",
                "rapidement", "haingana", "anio", "maika", "des demain",
                "cette semaine", "tout de suite")

# « 3 camions », « 50 sacs », « 2 m3 », « 1000 briques ». L'unité vient juste
# après le nombre : c'est ce qui distingue « 3 camions » d'un prix « 3 000 ».
MOTIF_QUANTITE = re.compile(
    r"(\d{1,5}(?:[.,]\d{1,2})?)\s*"
    r"(camions?|voyages?|bennes?|sacs?|gony|m\s*3|m³|tonnes?|briques?|"
    r"pieces?|pcs?|palettes?|bottes?|paquets?|m\s*2|m²)\b",
    re.IGNORECASE,
)

# Le nombre seul suivi du matériau : « mila fasika 3 camion », « 500 parpaing ».
MOTS_UNITES_QUANTITE = {
    "camion": "chargement", "camions": "chargement", "voyage": "chargement",
    "voyages": "chargement", "benne": "chargement", "bennes": "chargement",
    "sac": "sac", "sacs": "sac", "gony": "sac",
    "m3": "m3", "m 3": "m3", "m³": "m3",
    "tonne": "tonne", "tonnes": "tonne",
    "brique": "piece", "briques": "piece", "piece": "piece", "pieces": "piece",
    "pc": "piece", "pcs": "piece",
    "palette": "palette", "palettes": "palette",
    "botte": "botte", "bottes": "botte", "paquet": "botte", "paquets": "botte",
    "m2": "m2", "m 2": "m2", "m²": "m2",
}


def quantite_demandee(texte: str) -> tuple[float | None, str | None]:
    """(quantité, unité Akora) du besoin exprimé, sinon (None, None)."""
    propre = _sans_telephones(texte or "")
    trouve = MOTIF_QUANTITE.search(propre)
    if not trouve:
        return None, None
    try:
        valeur = float(trouve.group(1).replace(",", ".").replace(" ", ""))
    except ValueError:
        return None, None
    unite = MOTS_UNITES_QUANTITE.get(
        re.sub(r"\s+", "", trouve.group(2).lower()), None
    )
    # Au-delà de 100 000 on n'est plus dans une quantité de chantier mais dans
    # un montant mal lu.
    return (valeur, unite) if 0 < valeur <= 100_000 else (None, None)


def budget_dans(texte: str, cfg: dict) -> int | None:
    """Le budget annoncé par un acheteur, s'il en donne un."""
    reduit = referentiel.sans_accents(texte or "")
    if not any(mot in reduit for mot in ("budget", "vola", "je dispose", "maximum")):
        return None
    montant, _, _ = prix_dans(texte, cfg)
    return montant


def est_urgente(texte: str) -> bool:
    reduit = referentiel.sans_accents(texte or "")
    return any(mot in reduit for mot in MOTS_URGENCE)


def analyser_demande(texte: str, cfg: dict) -> dict:
    """Ce qu'une demande d'acheteur apprend : quoi, combien, où, pour quand.

    L'appariement au catalogue est le même que pour une offre — c'est ce qui
    permet de dire à un dépôt « il y a eu 12 demandes de sable dans votre zone
    cette semaine » plutôt que « il y a de la demande ».
    """
    ville, quartier = lieux.detecter(texte or "")
    numeros = telephones(texte or "")
    appariement = referentiel.apparier(texte or "")
    quantite, unite = quantite_demandee(texte or "")

    return {
        "telephone": numeros[0]["affichage"] if numeros else None,
        "telephone_cle": numeros[0]["cle"] if numeros else None,
        "ville": ville,
        "quartier": quartier,
        "langue": langue(texte or ""),
        "quantite": quantite,
        "unite": unite or referentiel.unite_dans(texte or ""),
        "budget": budget_dans(texte or "", cfg),
        "urgence": 1 if est_urgente(texte or "") else 0,
        "materiau_slug": (appariement or {}).get("materiau_slug"),
        "materiau_nom": (appariement or {}).get("materiau_nom"),
        "type_slug": (appariement or {}).get("type_slug"),
        "type_nom": (appariement or {}).get("type_nom"),
        "famille_slug": (appariement or {}).get("famille_slug"),
    }


def analyser(texte: str, cfg: dict) -> dict:
    """Tout ce qu'une publication apprend sur son auteur et sur ce qu'il vend."""
    from . import transport      # importé ici : évite un cycle au chargement

    reduit = referentiel.normaliser(texte)
    ville, quartier = lieux.detecter(texte or "")
    numeros = telephones(texte or "")
    flotte = transport.analyser(texte or "", cfg)
    offres_lues = offres(texte or "", cfg)

    # Ce qu'il EST : un dépôt vend des matériaux, un transporteur loue sa
    # benne, et beaucoup font les deux. La distinction commande le score, le
    # message envoyé, et ce qu'on écrit dans sa fiche réservée.
    if offres_lues and flotte["vehicules"]:
        nature = "mixte"
    elif flotte["est_transporteur"] or (flotte["vehicules"] and not offres_lues):
        nature = "transporteur"
    else:
        nature = "depot"

    return {
        "telephones": numeros,
        "nature": nature,
        "vehicules": flotte["vehicules"],
        "rayon_km": flotte["rayon_km"],
        "seuil_franco": flotte["seuil_franco"],
        "telephone": numeros[0]["affichage"] if numeros else None,
        "telephone_cle": numeros[0]["cle"] if numeros else None,
        "whatsapp": any(mot in reduit for mot in MOTS_WHATSAPP),
        "nom": enseigne(texte or ""),
        "metier": referentiel.metier_dans(texte or ""),
        "ville": ville,
        "quartier": quartier,
        "livre": any(mot in reduit for mot in MOTS_LIVRAISON),
        "retrait_sur_place": any(mot in reduit for mot in MOTS_RETRAIT),
        "langue": langue(texte or ""),
        # Déjà calculées plus haut : les relire ferait tourner deux fois
        # l'appariement de toutes les lignes, pour le même résultat.
        "offres": offres_lues,
    }
