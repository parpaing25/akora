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
# Un montant, avec ou sans séparateur de milliers, SUIVI DE SA DEVISE.
#
# Deux chiffres suffisent (`\d{2,9}` et non `\d{3,9}`) : une brique se vend
# 80 Ar la pièce. Le seuil à trois chiffres rendait invisibles « 80ar ny iray »
# (#23) et « Biriky masaka :90ar/pièce » (#124) — pas « trop bas » : invisibles,
# le motif ne les voyait même pas. Le garde-fou contre « 0,25 » et « 0,80mm »
# n'est pas la longueur du nombre, c'est le `(?<![0-9,.])` qui refuse un nombre
# précédé d'une virgule ou d'un point.
#
# Séparateurs de milliers acceptés : « 1 400 », « 1.400 », « 1400 », « 320 000 ».
MOTIF_MONTANT = re.compile(
    r"(?<![0-9,.])(\d{1,3}(?:[\s. ]\d{3})+|\d{2,9})\s*"
    r"(ar(?:iary)?|mga|fmg|fg)?(?![0-9])",
    re.IGNORECASE,
)
DEVISES_FMG = ("fmg", "fg")

# 🔴 UN PRIX PORTE SA DEVISE, SINON CE N'EST PAS UN PRIX.
#
#   Il y avait ici une liste de mots — « prix », « vidiny », « ar »… — qui
#   faisait accepter un nombre NU comme montant dès qu'un de ces mots traînait
#   sur la ligne. Deux fautes empilées :
#
#     1. la recherche se faisait par sous-chaîne, et « ar » est une sous-chaîne
#        de la moitié du malgache (« fanarenana », « arrivage », « Aogositra ») :
#        le vantail était donc ouvert en permanence ;
#     2. même refermé sur des frontières de mot, il ne servait plus à rien.
#        MESURÉ le 24/08/2026 sur les 124 publications collectées : le chemin
#        du nombre nu produisait ENCORE 8 prix, et les 8 étaient faux —
#        « manomboka @ 400 ISA » (un seuil de livraison gratuite, pas un tarif),
#        « Prix : 6000 fixe » (un loyer), « HARNES 62440 » (le code postal d'un
#        vendeur français, #129), « prix 800M fmg » (800 MILLIONS lus 800).
#        Zéro vrai prix. Une liste de mots qui n'attrape que du faux ne se
#        corrige pas, elle se retire.
#
#   Ce que ça coûte : « Fasika 90 000 le m3 » sans « Ar » ne sera plus lu. Aucun
#   dépôt n'écrit ainsi dans le corpus — et un prix manquant se rattrape à la
#   collecte suivante, un prix faux se publie sous le nom d'Akora.

# Ce qui n'est PAS un prix, même écrit comme tel. Frontières de mot ici aussi :
# cherché en sous-chaîne, « ref » mangeait « refy » — la mesure, le métré, qui
# ouvre une ligne de tarif de tôle sur deux (« zay refiny tadiavinao ») — et
# « cin » mangeait « cinq », « stat » « statut ».
PIEGES_PRIX = ("cin", "nif", "stat", "rcs", "compte", "reference", "ref",
               "abonne", "vues", "membres", "code")


def _motif_de_mots(mots) -> re.Pattern:
    """Un « l'un de ces mots », frontières de mot comprises, espaces souples."""
    corps = "|".join(
        re.escape(mot).replace(r"\ ", r"[\s\-']+") for mot in mots
    )
    return re.compile(rf"(?<![a-z0-9])(?:{corps})(?![a-z0-9])")


MOTIF_PIEGE_PRIX = _motif_de_mots(PIEGES_PRIX)

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
    if MOTIF_PIEGE_PRIX.search(reduit):
        return None, None, set()

    # Le plancher dépend de l'UNITÉ, pas de l'humeur : une brique se vend 80 Ar
    # la pièce (#23, #45, #124), un mètre cube de sable jamais. Un plancher
    # unique à 200 Ar jetait les trois tarifs de brique du corpus ; l'abaisser
    # pour tout le monde aurait laissé passer n'importe quelle mesure.
    # `prix_plancher_ar` sert aussi au fret (`transport.py`), où 200 Ar reste
    # le bon seuil : un voyage de camion ne coûte pas 80 Ar.
    a_la_piece = referentiel.unite_dans(ligne) == "piece"
    plancher = int(cfg.get("prix_plancher_unitaire_ar", 50) if a_la_piece
                   else cfg.get("prix_plancher_ar", 200))
    plafond = int(cfg.get("prix_plafond_ar", 50_000_000))
    taux_fmg = int(cfg.get("taux_fmg_ar", 5)) or 5

    for correspondance in MOTIF_MONTANT.finditer(propre):
        brut, devise = correspondance.group(1), (correspondance.group(2) or "").lower()
        if not devise:
            continue
        valeur = int(re.sub(r"[\s. ]", "", brut))
        if devise in DEVISES_FMG:
            valeur = round(valeur / taux_fmg)
        if not (plancher <= valeur <= plafond):
            continue
        consommes = set(re.findall(r"\d+", brut))
        return valeur, ("Fmg" if devise in DEVISES_FMG else "Ar"), consommes
    return None, None, set()


def porte_un_prix(texte: str) -> bool:
    """Y a-t-il un tarif lisible quelque part, sans chercher lequel ?

    Même définition que `prix_dans` — un montant SUIVI DE SA DEVISE — et c'est
    volontaire : `collecteur.a_un_prix()` s'appuie dessus pour décider s'il faut
    ouvrir la publication et lire les commentaires. Deux définitions qui
    divergent, et le bot renonce à chercher un prix qu'il n'a pas su lire.
    """
    return any(correspondance.group(2)
               for correspondance in MOTIF_MONTANT.finditer(_sans_telephones(texte or "")))


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


# ── Ce qui n'est PAS une offre ─────────────────────────────────────────────
# 🔴 MESURÉ LE 24/08/2026 : 174 offres tirées de 116 publications, 21 avec un
#   prix. Une bonne part du reste n'était pas une offre du tout — remerciements,
#   cotes de bâtiment, questions d'acheteur, articles de presse, et surtout le
#   nom d'une page qui contient un matériau. Chaque règle ci-dessous porte le
#   numéro de l'offre RÉELLE qui l'a motivée : c'est la seule justification qui
#   vaille, et c'est ce qui permettra de retirer une règle devenue inutile.
#
# Une ligne écartée ne crée plus d'offre ET ne sert plus d'en-tête : un titre
# faux propagerait son matériau à toute la liste de tarifs qui le suit.

# Mobilier du fil et des commentaires, ramassé avec le texte des publications.
# « Participant anonyme 591 » (#40) devenait une offre de tôle à 591 Ar.
MOTS_CHROME_LIGNE = ("participant anonyme", "voir la traduction",
                     "voir plus de commentaire", "ecrivez un commentaire",
                     "contributeur", "meilleur contributeur", "top fan",
                     "voir 1 reponse", "voir les reponses", "sary fanehoana")

# Remerciements, salutations, slogans. Une page qui remercie sa clientèle ne
# vend rien dans cette phrase-là : « Misaotra indrindra anareo mpanjifa … MORA
# TÔLE » (#76, #78), « AZA MISALASALA HAMETRAKA NY FAHATOKISANAO ETO AMIN'NY
# MORA TÔLE » (#77) et « MITETE VE NY TAFO? AZA MIANDRY … » (#11) donnaient
# chacune une offre de toiture sans prix.
MOTS_COURTOISIE = ("misaotra", "mankasitraka", "salama", "miarahaba", "arahaba",
                   "tratry ny taona", "veloma", "mirary soa", "mahavitasoa",
                   "aza misalasala", "aza miandry", "aza adino", "aza matahotra",
                   "tongava", "fahatokisana", "fahafaham-po", "afa-po",
                   "merci", "bonjour", "bonsoir", "bienvenue", "chers clients",
                   "n hesitez pas", "a bientot")

# L'acheteur qui cherche. « mitady » seul ne suffit pas : « Raha mitady tôle
# tsara … ity no fotoana! » (#62) est une accroche de VENDEUR — « si vous
# cherchez de la tôle ». D'où les tournures complètes, jamais le verbe seul.
MOTIFS_DEMANDE_LIGNE = (
    re.compile(r"(?<![a-z])mila(?![a-z])"),               # « mila fasika aho »
    re.compile(r"je (?:cherche|recherche)"),
    re.compile(r"besoin de"),
    re.compile(r"qui (?:vend|peut)"),
    re.compile(r"(?<![a-z])ohatrinona(?![a-z])"),         # « combien ? » (#31)
    re.compile(r"(?<![a-z])iza(?![a-z]).{0,25}mitady"),   # « iza ilay mitady » (#22)
    re.compile(r"mba omeo"),                              # « mba omeo prix » (#86)
)

# Cote de bâtiment : « Raha tranon'akoho 14m sur 6m … » (#5), « 12m sur 8 nenay
# ao fa mitafo tôle » (#40). C'est un métré demandé, jamais un tarif — d'où
# l'exigence qu'aucun prix ne figure sur la ligne : « 1mx2m : 7000 ar » est un
# panneau de bararata bien réel.
MOTIF_COTE_BATIMENT = re.compile(
    r"(?<![0-9])\d{1,3}\s*m(?![a-z0-9])\s*(?:sur|x|\*)\s*\d{1,3}")

# Adresse électronique ou lien. « MAIL rakotoarison770@gmail .com » passait
# pour un plâtre à 770 Ar une fois l'en-tête « posse placo platre » hérité.
MOTIF_ADRESSE_WEB = re.compile(r"[\w.+-]+@[\w-]{2,}|https?://|www\.")

# Au-delà, la ligne est une phrase et pas un tarif. Les articles de presse
# ramassés dans les groupes généralistes (#164, #167, #168, #171) et les
# récits de chantier (#30, #33, #59) tiennent tous en phrases longues sans le
# moindre montant.
MOTS_MAX_PROSE = 14

# Un tarif tient sur une ligne courte. « Misoratra olona 1 accès voiture
# taratasy cadasitra misy dorit de visite 10000ar » (#52) est une phrase de
# vente de maison qui cite un montant — pas une ligne de tarif de matériau.
MOTS_MAX_TARIF = 10

# Portée d'un en-tête, en lignes retenues. Mesuré sur les 116 publications :
# 8 lignes -> 117 offres chiffrées, 12 -> 126, 20 -> 137, et au-delà plus rien
# ne bouge. Vingt, donc : c'est ce qu'il faut pour franchir les huit lignes de
# couleurs qui séparent « TÔLES GALVABAC PRÉLAQUÉES » de son tarif, et pas
# plus — un titre ne doit pas contaminer le paragraphe d'après.
PORTEE_ENTETE = 20

_VOCABULAIRE: set[str] = set()


def _vocabulaire_catalogue() -> set[str]:
    """Les mots que le catalogue connaît. Calculé une fois, gardé en mémoire."""
    global _VOCABULAIRE
    if not _VOCABULAIRE:
        _VOCABULAIRE = {
            mot
            for expression, _, _ in referentiel.charger()["appellations"]
            for mot in expression.split()
        }
    return _VOCABULAIRE


def marques_de_page(texte: str) -> tuple[str, ...]:
    """Les enseignes écrites dans la publication dont le nom porte un matériau.

    🔴 LE PIÈGE LE PLUS PRODUCTIF DU CORPUS. La page « MORA TÔLE » publie de la
       publicité de marque sans un seul tarif, et chacune de ses phrases
       produisait une offre de tôle : #68, #71, #75, #76, #77, #78, #79, #151.
       Idem « Malagasy Tafo » (#89, #90). Le mot « tôle » n'était pas dans la
       phrase — il était dans la raison sociale.

    Une marque se reconnaît à sa RÉPÉTITION : le nom revient à chaque
    paragraphe, là où un matériau cité une fois reste un matériau. On ne retient
    donc que les couples « mot inconnu du catalogue + mot du catalogue » vus au
    moins deux fois dans la même publication.

    ⚠ L'ORDRE COMPTE, et il n'est pas décoratif : « mora tôle » et « malagasy
      tafo » portent leur mot de marque DEVANT. Accepter l'ordre inverse ferait
      de « fer turkey » (#140) et de « biriky fotsy » (#119) des enseignes — ce
      sont deux matériaux qu'un dépôt vend pour de bon.
    """
    vocabulaire = _vocabulaire_catalogue()
    comptes: dict[str, int] = {}
    mots = referentiel.normaliser(texte or "").split()
    for premier, second in zip(mots, mots[1:]):
        if len(premier) < 3 or len(second) < 3:
            continue
        if premier in vocabulaire or second not in vocabulaire:
            continue
        couple = f"{premier} {second}"
        comptes[couple] = comptes.get(couple, 0) + 1
    return tuple(couple for couple, vu in comptes.items() if vu >= 2)


def raison_hors_offre(ligne: str, a_un_prix: bool = False,
                      marques: tuple[str, ...] = ()) -> str | None:
    """Pourquoi cette ligne n'est pas une offre — None si c'en est une.

    Renvoyer la RAISON plutôt qu'un booléen : `outils/diagnostic_offres.py` en
    fait son classement, et une règle qui n'écarte plus rien se voit alors du
    premier coup d'œil.
    """
    reduit = referentiel.normaliser(ligne)
    if len(reduit) < 3:
        return "vide"
    if any(mot in reduit for mot in MOTS_CHROME_LIGNE):
        return "mobilier facebook"
    if MOTIF_ADRESSE_WEB.search(referentiel.sans_accents(ligne)):
        return "adresse ou lien"
    if any(motif.search(reduit) for motif in MOTIFS_DEMANDE_LIGNE):
        return "demande d'acheteur"

    # Tout ce qui suit se juge sur l'ABSENCE de prix. Un vendeur qui remercie sa
    # clientèle ET donne son tarif dans la même ligne donne bien son tarif.
    if a_un_prix:
        return None
    if MOTIF_COTE_BATIMENT.search(reduit):
        return "cote de batiment"
    if any(mot in reduit for mot in MOTS_COURTOISIE):
        return "remerciement ou slogan"
    if len(reduit.split()) >= MOTS_MAX_PROSE:
        return "phrase, pas un tarif"
    if marques:
        nu = reduit
        for marque in marques:
            nu = nu.replace(marque, " ")
        if referentiel.apparier(nu) is None and referentiel.apparier(reduit):
            return "nom de page"
    return None


# Ce que la ligne dit du FORMAT, dans les deux grandeurs que les vendeurs
# écrivent : l'épaisseur d'une tôle (« 0,30 », « 0.30 », « 30/100 ») et la
# longueur d'un bois (« 4m », « 5m »). Ramenées aux repères du catalogue.
MOTIF_EPAISSEUR = re.compile(
    r"(?<![0-9])0\s*[.,]\s*(\d{2})(?![0-9])|(?<![0-9])(\d{2})\s*/\s*100(?![0-9])")
MOTIF_LONGUEUR = re.compile(r"(?<![0-9,.])([2-8])\s*m(?![a-z0-9])")


def _format_dementi(ligne: str, fiche: dict) -> bool:
    """La ligne annonce-t-elle un format que le matériau retenu ne porte pas ?

    🔴 DEUX FAUX PRODUITS PUBLIABLES SUR LE CORPUS DU 24/08/2026, tous deux
       nés du même mécanisme : l'appariement se fait sur le MOT, le vendeur
       écrit le CHIFFRE, et le catalogue Akora n'a qu'un format par appellation.

       « GALVABAC 0.30 PROMOTION BE: 18.000Ar/m » -> `bac-galva-040-4m`, seul
       bac galvanisé du catalogue, mais en 0,40 mm : 18 000 Ar/m est le prix du
       0,30, pas celui du 0,40.
       « #madrier 5m = 45 000ar » -> `madrier-75x225-4m` : un madrier de 5 m
       facturé sous la référence du 4 m.

    Quand la ligne dément le format, on retombe au type et l'interface demande
    la référence. Inventer la référence, c'est publier un prix faux sous le nom
    d'Akora — ce que `outils/reapparier.py` a déjà eu à réparer une fois.
    """
    slug = fiche.get("materiau_slug")
    if not slug:
        return False
    reduit = referentiel.normaliser(ligne)
    reperes = set((referentiel.charger()["materiaux"].get(slug) or {}).get("reperes") or ())

    epaisseur = MOTIF_EPAISSEUR.search(reduit)
    if epaisseur:
        code = epaisseur.group(1) or epaisseur.group(2)
        if not ({code, code.lstrip("0"), "0" + code} & reperes):
            return True

    longueurs = {f"{trouve.group(1)}m" for trouve in MOTIF_LONGUEUR.finditer(reduit)}
    attendues = {repere for repere in reperes if re.fullmatch(r"\dm", str(repere))}
    return bool(longueurs and attendues and not (longueurs & attendues))


def _type_seul(fiche: dict) -> dict:
    """La même fiche, réduite à son TYPE — le format est effacé.

    🔴 POURQUOI ON N'HÉRITE JAMAIS D'UN FORMAT. Coller l'en-tête « ALU ZINC » à
       la ligne « 014 : 8 500 Ar » et passer le tout à `apparier()` répond
       `bac-aluzinc-045-6m` : une tôle de 0,45 mm — que le MÊME dépôt affiche à
       24 000 Ar six lignes plus bas — étiquetée à 8 500 Ar. Le catalogue Akora
       connaît quatre formats de tôle, les vendeurs en listent seize : le
       rapprochement est forcément inventé.

       Un format inventé devient un produit publié et une ligne de
       l'observatoire des prix. C'est la faute que `outils/reapparier.py` a dû
       rattraper le 24/08/2026 — en pire, parce qu'elle serait industrielle. On
       garde donc le type, le prix et le libellé brut ; l'interface demande le
       format en un clic (`<select data-offre-champ="materiau_slug">`).
    """
    return {**fiche,
            "materiau_slug": None, "materiau_nom": None, "ambigu": 1,
            "certitude": min(int(fiche.get("certitude") or 0), 45)}


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
        #
        # ⚠ On ne compte QUE les montants qui portent leur devise. Comptés sans
        #   elle, « ✓ 13, 14cmx2cmx4m = 8 500 ar » passait pour trois montants
        #   et se faisait couper en deux au niveau de la virgule — alors qu'il
        #   n'y a là qu'un seul prix et deux cotes de section.
        chiffres = sum(1 for trouve in MOTIF_MONTANT.finditer(_sans_telephones(ligne))
                       if trouve.group(2))
        if chiffres > 1 and ("," in ligne or ";" in ligne or "/" in ligne):
            morceaux.extend(m.strip() for m in re.split(r"[;,]", ligne) if m.strip())
        else:
            morceaux.append(ligne)
    return morceaux


def offres(texte: str, cfg: dict) -> list[dict]:
    """Les offres lisibles dans une publication.

    Une ligne sans matériau reconnu est ignorée ; une ligne avec matériau mais
    sans prix est gardée (un dépôt qui annonce son stock sans tarif reste un
    fournisseur à contacter — c'est même souvent celui qu'on veut).

    ⭐ L'EN-TÊTE PORTE LE MATÉRIAU, LA LIGNE PORTE LE PRIX. C'est la forme
       normale d'un tarif malgache, et le découpage « une ligne = une offre » la
       perdait tout entière :

           ALU ZINC            <- le matériau, sans prix
           -014 : 8 500 Ar     <- le prix, sans matériau
           -018 : 10 500 Ar

       Mesuré le 24/08/2026 sur les 124 publications collectées : **109 lignes
       portaient un prix lisible qu'aucun matériau ne réclamait**, contre 21
       offres chiffrées en tout dans la lecture d'alors. Le prix était là depuis
       le début ; personne ne le ramassait. L'en-tête ne transmet que son TYPE,
       jamais un format — voir `_type_seul()`.
    """
    resultat: list[dict] = []
    deja: set[tuple] = set()
    marques = marques_de_page(texte)
    entete: dict | None = None
    depuis_entete = 0

    for ligne in segments(texte):
        montant, devise, consommes = prix_dans(ligne, cfg)
        if raison_hors_offre(ligne, montant is not None, marques):
            continue

        appariement = referentiel.apparier(ligne, consommes)
        herite = False
        if appariement is not None:
            if _format_dementi(ligne, appariement):
                appariement = _type_seul(appariement)
            entete, depuis_entete = {"texte": ligne, "fiche": appariement}, 0
        else:
            depuis_entete += 1
            if (montant is None or entete is None
                    or depuis_entete > PORTEE_ENTETE
                    or len(ligne.split()) > MOTS_MAX_TARIF):
                continue
            appariement, herite = _type_seul(entete["fiche"]), True

        # Le montant entre dans l'empreinte : sans lui, les seize épaisseurs de
        # tôle d'un même tarif se réduisaient à UNE offre, puisqu'elles portent
        # toutes le type « tole ». C'est ce qui faisait qu'une liste de prix
        # complète ne rapportait qu'une ligne.
        empreinte = (appariement.get("materiau_slug")
                     or appariement.get("type_slug") or ligne, montant)
        if empreinte in deja:
            continue
        deja.add(empreinte)

        # Le libellé garde l'en-tête : « ALU ZINC › -014 : 8 500 Ar » se relit,
        # « -014 : 8 500 Ar » tout seul ne veut plus rien dire dans la liste
        # d'Andry.
        libelle = f"{entete['texte'][:70]} › {ligne}" if herite else ligne
        resultat.append({
            "libelle_brut": libelle[:180],
            "prix": montant,
            "devise_source": devise,
            "unite": referentiel.unite_dans(ligne) or appariement.get("unite"),
            "quantite_min": quantite_min_dans(ligne),
            **{c: appariement[c] for c in (
                "materiau_slug", "materiau_nom", "type_slug", "type_nom",
                "famille_slug", "certitude", "ambigu", "hors_catalogue")},
        })

    # Rattrapage : rien ligne par ligne, mais le texte entier parle bien d'un
    # matériau (publication en prose, « nous vendons du sable et du gravillon »).
    #
    # 🔴 SANS PRIX, JAMAIS. Lire un montant sur un texte ENTIER, c'est ne pas
    #   savoir à quel matériau il se rapporte — le préambule du module le dit
    #   déjà. Les quatre prix que ce repli a produits sur le corpus étaient
    #   faux, les quatre : « 3000Ar ny m² ? » d'une question d'acheteur (#31),
    #   le « à 300% » d'un récit de chantier (#33), le « Participant anonyme
    #   591 » d'un fil de commentaires (#40) et le code postal « HARNES 62440 »
    #   d'un vendeur français (#129). Deux d'entre eux étaient PUBLIABLES. Le
    #   repli sert à ne pas perdre le prospect, pas à deviner son tarif.
    if not resultat:
        appariement = referentiel.apparier(texte)
        if appariement:
            resultat.append({
                "libelle_brut": (texte or "").strip()[:180],
                "prix": None,
                "devise_source": None,
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
    #
    # Le piège : « Fandefasana fasika sy vato » (transport de sable et de
    # pierre) nomme du sable — mais c'est ce que le camion CHARGE, pas ce que
    # son propriétaire VEND. Le départage tient en une question : ces matériaux
    # ont-ils un prix ? Un dépôt affiche un tarif par matériau ; un
    # transporteur affiche un tarif par voyage.
    cargaison = (
        flotte["est_transporteur"]
        and offres_lues
        and not any(o.get("prix") for o in offres_lues)
    )
    if cargaison:
        offres_lues = []

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
