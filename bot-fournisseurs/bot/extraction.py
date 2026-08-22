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
MOTIF_ENSEIGNE = re.compile(
    r"\b((?:ets|etablissement[s]?|sarl|sa|sarlu|ei|gie|depot|dépôt|briqueterie|"
    r"carriere|carrière|scierie|quincaillerie|societe|société)"
    r"[\s.\-]+[A-ZÀ-Ü0-9][\w'’\-\.]*(?:\s+[A-ZÀ-Ü0-9][\w'’\-\.]*){0,3})",
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


def analyser(texte: str, cfg: dict) -> dict:
    """Tout ce qu'une publication apprend sur son auteur et sur ce qu'il vend."""
    reduit = referentiel.normaliser(texte)
    ville, quartier = lieux.detecter(texte or "")
    numeros = telephones(texte or "")

    return {
        "telephones": numeros,
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
        "offres": offres(texte or "", cfg),
    }
