"""De quand date une publication Facebook — et de quelle ANNÉE est-elle ?

═══ Post-mortem du 24/08/2026 — pourquoi ce fichier existe ══════════════════

La règle demandée est simple : **on ne collecte que les publications de
l'année en cours**. « Il faut des informations fraîches, pas des publications
de 2019 ou 2020. »

Un filtre d'âge existait pourtant déjà (`jours_max`, 60 jours). Il ne
s'appliquait presque jamais. Mesuré sur `data/bot.db` (lecture seule) :

  - `publications.publie_le` n'était renseigné que **20 fois sur 181** (11 %).
    89 % des publications collectées n'avaient AUCUNE date. Le bot jumeau de
    Fonenako, sur un corpus dix fois plus gros, tombe à 98 sur 1 363 (7 %) ;
  - les 20 formes trouvées sont toutes relatives, toutes françaises, et
    toutes séparées par une **espace insécable U+00A0** :
    `'1\\xa0h'` (5×), `'6\\xa0h'` (3×), `'2\\xa0sem.'` (2×), `'21\\xa0min'` (2×),
    `'1\\xa0sem.'`, `'38\\xa0min'`… ;
  - l'ancien `_age_en_jours()` ne savait lire QUE le relatif. Sur une date
    absolue il rendait `None` ;
  - et le test était `if age is not None and age > jours_max` :
    **date inconnue = publication acceptée**. Un post de 2019 entrait donc
    sans le moindre obstacle.

Et il y avait pire que `None`. L'ancien motif ne fermait pas ses unités par
une frontière de mot (`(min|mn|h|j|d|sem|w|mois|mo|an|y)` sans `\\b`) :

    « 12 juin 2019 »     -> lu « 12 j »  -> 12 jours   -> réputée fraîche
    « 12 juillet 2019 »  -> lu « 12 j »  -> 12 jours   -> réputée fraîche
    « 5 décembre 2019 »  -> lu « 5 d »   -> 5 jours    -> réputée fraîche

Trois vraies dates de 2019 que le filtre des 30 jours laissait passer **en les
croyant récentes**. C'est le `\\b` en fin d'unité, ici, qui corrige ça.

═══ Ce que ce module fait, et rien d'autre ══════════════════════════════════

  1. `age_en_jours()`        — le relatif ET l'absolu, français et anglais ;
  2. `date_de_publication()` — la date réelle, **`None` quand elle est
     inconnue**. Elle ne ment plus : l'ancien comportement datait
     d'aujourd'hui ce qu'il n'avait pas su lire, et un prix « relevé
     aujourd'hui » qui vient d'un post de 2019 est un mensonge affiché ;
  3. `annee_de_publication()` / `verdict()` — la règle d'année.

═══ La décision, telle qu'elle a été prise ══════════════════════════════════

Quand l'année est **indéterminable, on GARDE la publication**. Refuser
l'inconnu supprimerait 93 % de la collecte. Ce module rend donc `None`,
jamais une valeur inventée, et c'est l'appelant qui tranche — mais il tranche
en sachant qu'il ne sait pas.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timedelta

# ── Les espaces qu'on ne voit pas ──────────────────────────────────────────
# U+00A0 est dans TOUTES les formes réellement trouvées en base. Contrairement
# à ce qu'on croit souvent, `\s` de `re` le couvre déjà (motif `str`, donc
# Unicode) — ce n'est PAS lui qui cassait la lecture du relatif. Mais il casse
# tout le reste : un `split(" ")`, une comparaison littérale, un `in`, et les
# gabarits de date absolue de Facebook qui collent « 12 août » avec U+00A0.
# On les ramène donc à l'espace ordinaire une fois pour toutes, en entrée.
ESPACES = {
    0x00A0: " ",   # espace insécable — la seule vue en base
    0x202F: " ",   # espace fine insécable (gabarits français de Facebook)
    0x2009: " ",   # espace fine
    0x2007: " ",   # espace tabulaire
    0x200B: "",    # chasse nulle — vient des noms « stylés »
    0xFEFF: "",    # BOM collé par un copier-coller
}


def _propre(texte: str) -> str:
    """Texte prêt à lire : espaces invisibles normalisées, blancs repliés."""
    reduit = (texte or "").translate(ESPACES)
    return re.sub(r"\s+", " ", reduit).strip()


def sans_accents(texte: str) -> str:
    """Minuscules sans accents. Même décomposition NFKD que `referentiel`."""
    return "".join(
        c for c in unicodedata.normalize("NFKD", texte or "")
        if unicodedata.category(c) != "Mn"
    ).lower()


# ── Unités de temps relatives ──────────────────────────────────────────────
# (forme écrite, nombre de jours qu'elle vaut). Le tableau sert à construire
# UN motif, trié du plus long au plus court : sans ce tri, « mo » mangerait le
# début de « mois » et trois mois vaudraient trois mois… en anglais.
#
# ⚠ Les formes malgaches (`ora`, `andro`, `herinandro`, `volana`, `taona`)
# n'ont **jamais** été vues en base : les 98 dates relevées sont toutes
# françaises. Elles sont là parce qu'un compte Facebook réglé en malgache les
# rendrait et qu'elles ne coûtent rien — pas parce qu'elles ont été observées.
UNITES: dict[str, int] = {
    # minutes / heures : moins d'un jour
    "minutes": 0, "minute": 0, "mins": 0, "min": 0, "mn": 0, "minitra": 0,
    "heures": 0, "heure": 0, "hours": 0, "hour": 0, "hrs": 0, "hr": 0, "h": 0,
    "ora": 0,
    # jours
    "jours": 1, "jour": 1, "days": 1, "day": 1, "andro": 1, "j": 1, "d": 1,
    # semaines
    "semaines": 7, "semaine": 7, "weeks": 7, "week": 7, "herinandro": 7,
    "sem": 7, "wks": 7, "wk": 7, "w": 7,
    # mois
    "mois": 30, "months": 30, "month": 30, "volana": 30, "mos": 30, "mo": 30,
    # années
    "annees": 365, "annee": 365, "years": 365, "year": 365, "taona": 365,
    "ans": 365, "an": 365, "yrs": 365, "yr": 365, "y": 365,
}

_UNITES_ALT = "|".join(
    re.escape(u) for u in sorted(UNITES, key=len, reverse=True)
)

# Le `\b` final est le correctif central de ce fichier : sans lui, « 12 juin »
# se lit « 12 j » et une date de 2019 passe pour vieille de douze jours.
_RE_RELATIF = re.compile(rf"(?<![0-9])(\d+)\s*({_UNITES_ALT})\b")

# Ce qui n'est PAS une date : trop long pour un horodatage Facebook, ou
# écrit comme une légende d'image générée (« Peut être une image de… »).
LONGUEUR_MAX_DATE = 60
_RE_LEGENDE = re.compile(
    r"(peut etre une|peut-etre une|image de|photo de|may be an? |no photo description)"
)

# Formes sans chiffre.
_RE_HIER = re.compile(r"\b(hier|yesterday|omaly)\b")
_RE_INSTANT = re.compile(
    r"(a l'instant|just now|maintenant|vao teo|il y a un instant)"
)

# ── Mois, en toutes lettres ────────────────────────────────────────────────
# Français, anglais, malgache. Les clés sont déjà sans accents et en
# minuscules : la comparaison se fait sur du texte passé par `sans_accents`.
def _mois_du_calendrier() -> dict[str, int]:
    table: dict[str, int] = {}
    lignes = (
        (1,  "janvier janv jan january janoary"),
        (2,  "fevrier fevr fev february feb febroary"),
        (3,  "mars march mar martsa"),
        (4,  "avril avr april apr aprily"),
        (5,  "mai may mey"),
        (6,  "juin june jun jona"),
        (7,  "juillet juil july jul jolay"),
        (8,  "aout aou august aug aogositra"),
        (9,  "septembre sept september sep septambra"),
        (10, "octobre octo october oct oktobra"),
        (11, "novembre nov november novambra"),
        (12, "decembre dec december desambra"),
    )
    for numero, noms in lignes:
        for nom in noms.split():
            table[nom] = numero
    return table


MOIS = _mois_du_calendrier()
_MOIS_ALT = "|".join(re.escape(m) for m in sorted(MOIS, key=len, reverse=True))

# « 12 août 2019 », « 12 août », « 1er mars 2020 », « 23 mars 2020 à 14:05 ».
# Pas de `\b` après le mois : l'abréviation peut finir par un point (« janv. »)
# et `\b` exigerait alors une lettre derrière. `(?![a-z])` dit la bonne chose.
_RE_JOUR_MOIS = re.compile(
    rf"(?<![0-9])(\d{{1,2}})\s*(?:er)?\s+({_MOIS_ALT})\.?(?![a-z])"
    rf"(?:\s*,?\s*(\d{{4}}))?"
)
# « August 12, 2019 », « Aug 12 », « Dec. 3, 2020 ».
_RE_MOIS_JOUR = re.compile(
    rf"(?<![a-z])({_MOIS_ALT})\.?(?![a-z])\s+(\d{{1,2}})(?![0-9])"
    rf"(?:\s*,?\s*(\d{{4}}))?"
)
# « 12/08/2019 », « 12-08-2019 », « 12.08.19 ».
_RE_NUMERIQUE = re.compile(r"(?<![0-9])(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?![0-9])")
# ISO complet : ce que rend `data-utime` côté navigateur, converti en
# `toISOString()`. Aucune interprétation à faire.
_RE_ISO = re.compile(r"(?<![0-9])(\d{4})-(\d{2})-(\d{2})(?![0-9])")


def _construire(annee: int, mois: int, jour: int) -> date | None:
    """Une date, ou `None` si le trio n'en fait pas une (31 février, 29/02…)."""
    try:
        return date(annee, mois, jour)
    except ValueError:
        return None


def _annee_probable(mois: int, jour: int, aujourdhui: date) -> date | None:
    """Sans année écrite : l'année en cours, SAUF si le mois est dans le futur.

    C'est la convention de Facebook : il n'écrit l'année que passé douze mois.
    Un « 12 décembre » lu un 24 août désigne donc le 12 décembre de l'AN
    DERNIER, pas un futur qui n'existe pas encore.
    """
    candidat = _construire(aujourdhui.year, mois, jour)
    if candidat is None:
        # 29 février lu une année non bissextile : l'an dernier l'était peut-être.
        return _construire(aujourdhui.year - 1, mois, jour)
    if candidat > aujourdhui:
        return _construire(aujourdhui.year - 1, mois, jour) or candidat
    return candidat


def _lire_absolu(reduit: str, aujourdhui: date) -> date | None:
    """Date absolue dans un texte déjà mis en minuscules et sans accents."""
    trouve = _RE_ISO.search(reduit)
    if trouve:
        return _construire(int(trouve[1]), int(trouve[2]), int(trouve[3]))

    trouve = _RE_JOUR_MOIS.search(reduit)
    if trouve:
        jour, mois = int(trouve[1]), MOIS[trouve[2]]
        if trouve[3]:
            return _construire(int(trouve[3]), mois, jour)
        return _annee_probable(mois, jour, aujourdhui)

    trouve = _RE_MOIS_JOUR.search(reduit)
    if trouve:
        mois, jour = MOIS[trouve[1]], int(trouve[2])
        if trouve[3]:
            return _construire(int(trouve[3]), mois, jour)
        return _annee_probable(mois, jour, aujourdhui)

    trouve = _RE_NUMERIQUE.search(reduit)
    if trouve:
        premier, second, annee = int(trouve[1]), int(trouve[2]), int(trouve[3])
        if annee < 100:
            annee += 2000 if annee <= 68 else 1900
        # Facebook en français écrit JJ/MM/AAAA — c'est le cas par défaut.
        # On ne bascule en MM/JJ que si le premier nombre NE PEUT PAS être un
        # jour de mois raisonnable alors que le second, lui, ne peut pas être
        # un mois : « 08/23/2019 » n'a pas de 23e mois.
        if premier <= 12 < second:
            mois, jour = premier, second
        else:
            jour, mois = premier, second
        return _construire(annee, mois, jour)
    return None


def _age_relatif(reduit: str) -> int | None:
    """« 1 sem. », « 4 min », « hier » -> âge en jours. `None` si rien à lire."""
    if _RE_INSTANT.search(reduit):
        return 0
    if _RE_HIER.search(reduit):
        return 1
    trouve = _RE_RELATIF.search(reduit)
    if not trouve:
        return None
    return int(trouve[1]) * UNITES[trouve[2]]


def date_de_publication(heure: str, aujourdhui: date | None = None) -> date | None:
    """La date de la publication, ou `None` — JAMAIS aujourd'hui par défaut.

    C'est tout l'objet de cette fonction : rendre `None` plutôt que mentir.
    Un appelant qui date un prix relevé doit pouvoir dire « je ne sais pas »,
    parce qu'un prix estampillé du jour alors qu'il vient d'un post de 2019
    est un chiffre faux, publié, et que plus personne ne pourra recouper.
    """
    aujourdhui = aujourdhui or date.today()
    texte = _propre(heure)
    if not texte:
        return None
    reduit = sans_accents(texte)

    # Une date Facebook est courte, et ce n'est jamais une légende d'image.
    # Le 02/09/2026, « Peut être une image de texte qui dit '034 0348932323
    # 89 323 23 Garantie 10ans 10 » est arrivé ici : « 10ans » s'est lu
    # « il y a dix ans », et une publication de 2026 a été écartée comme
    # datant de 2016 — un dépôt de tôles perdu pour une garantie décennale.
    # Le JS filtre déjà en amont ; on refuse ICI aussi, parce qu'un
    # garde-fou se pose à chaque bout du chemin qu'il protège.
    if len(texte) > LONGUEUR_MAX_DATE or _RE_LEGENDE.search(reduit):
        return None

    # L'absolu passe AVANT le relatif : il est le plus spécifique (un nom de
    # mois, des slashes) et aucune forme relative ne peut y ressembler.
    absolue = _lire_absolu(reduit, aujourdhui)
    if absolue is not None:
        return absolue

    age = _age_relatif(reduit)
    if age is None:
        return None
    return aujourdhui - timedelta(days=age)


def age_en_jours(heure: str, aujourdhui: date | None = None) -> int | None:
    """Âge approximatif en jours, `None` si la date ne se lit pas.

    Remplace l'ancien `_age_en_jours` des collecteurs, dont il garde les
    résultats sur toutes les formes réellement rencontrées (« 1 h » -> 0,
    « 6 j » -> 6, « 2 sem. » -> 14, « 3 mois » -> 90) — et corrige les autres.
    """
    aujourdhui = aujourdhui or date.today()
    quand = date_de_publication(heure, aujourdhui)
    if quand is None:
        return None
    return max((aujourdhui - quand).days, 0)


def annee_de_publication(heure: str, aujourdhui: date | None = None) -> int | None:
    """L'année de la publication, ou `None` si elle est indéterminable."""
    quand = date_de_publication(heure, aujourdhui)
    return quand.year if quand else None


def verdict(heure: str, annee_minimum: int, jours_max: int | None = None,
            aujourdhui: date | None = None) -> dict:
    """Tout ce que l'appelant a besoin de savoir sur la fraîcheur d'un post.

    Renvoie ``{date, annee, age, garder, motif}`` où :

      - ``date``  : `datetime.date` ou `None` (inconnue — on ne l'invente pas) ;
      - ``annee`` : `int` ou `None` ;
      - ``age``   : âge en jours ou `None` ;
      - ``garder``: faux SEULEMENT quand la date est connue ET trop vieille ;
      - ``motif`` : `''`, `'annee'` ou `'age'`, pour le journal et les compteurs.

    **Année indéterminable -> on garde.** C'est la décision assumée : 93 % des
    publications collectées n'ont aucune date lisible, et les refuser
    supprimerait la collecte au lieu de la nettoyer.
    """
    aujourdhui = aujourdhui or date.today()
    quand = date_de_publication(heure, aujourdhui)
    if quand is None:
        return {"date": None, "annee": None, "age": None,
                "garder": True, "motif": ""}
    age = max((aujourdhui - quand).days, 0)
    if quand.year < int(annee_minimum):
        return {"date": quand, "annee": quand.year, "age": age,
                "garder": False, "motif": "annee"}
    if jours_max is not None and age > int(jours_max):
        return {"date": quand, "annee": quand.year, "age": age,
                "garder": False, "motif": "age"}
    return {"date": quand, "annee": quand.year, "age": age,
            "garder": True, "motif": ""}


def en_texte(quand: date | None) -> str:
    """`date` -> `'2026-08-24'`, et `None` -> `''` (colonne laissée VIDE).

    Le vide n'est pas une négligence : c'est l'information « on ne sait pas ».
    Y écrire la date du jour, comme avant, revenait à affirmer une fraîcheur
    qu'on n'a pas constatée.
    """
    return quand.isoformat() if quand else ""


def depuis_iso(horodatage: str) -> date | None:
    """Lit un ISO complet (`data-utime` converti côté navigateur). Tolérant."""
    texte = _propre(horodatage)
    if not texte:
        return None
    try:
        return datetime.fromisoformat(texte.replace("Z", "+00:00")).date()
    except ValueError:
        return None
