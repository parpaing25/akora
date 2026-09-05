"""Écarter à la COLLECTE ce qui n'est pas du marché malgache.

Pourquoi cette pièce existe : le 01/09/2026, la table `vehicules` comptait
DEUX lignes, dont une en FCFA (« Sable : de 75 000 à 110 000 FCFA selon le
type de camion ») — une annonce d'Afrique de l'Ouest. Le même jour, un
« magnifique appartement moderne à louer YAOUNDÉ… 170,000frs » était apparié
à une bordure de trottoir T2. Ces publications circulent dans les groupes
Facebook francophones que le bot parcourt ; rien ne les arrêtait à l'entrée,
elles n'étaient écartées qu'après coup, une par une.

La règle : une publication qui affiche ses prix en francs CFA, ou qui se
situe dans une ville d'Afrique francophone continentale, n'est pas un
prospect Akora — c'est un rejet à la porte, compté (`rejet_devise`) et
journalisé comme les autres.

Ce que ce module NE fait PAS : convertir. Un prix FCFA converti en ariary
serait une donnée inventée deux fois (taux du jour + marché différent).
"""
from __future__ import annotations

import re
import unicodedata

# La monnaie, telle qu'elle s'écrit dans les annonces : « 75 000 FCFA »,
# « 170,000frs », « 5000 francs », « prix en XOF ». Le « frs »/« francs »
# n'est retenu QUE collé à un chiffre : le mot seul apparaît dans d'autres
# contextes, un montant en francs jamais sans son montant.
# ⚠ « fmg » n'y est PAS : le franc malgache est une monnaie malgache
# (extraction.py sait le convertir en ariary, ÷ par 5 — il reste courant à
# l'oral). L'écarter viderait de vraies offres.
MOTIF_DEVISE = re.compile(
    r"\b(?:f\.?\s*cfa|cfa|xof|xaf)\b"
    r"|\bfrancs?\s+cfa\b"
    r"|\d\s*(?:frs|francs?)\b",
    re.IGNORECASE,
)

# Villes d'Afrique francophone continentale vues dans les annonces qui ont
# déjà pollué la base. Liste courte et sûre exprès : un nom ambigu qui
# existerait aussi à Madagascar écarterait de vrais dépôts.
VILLES_HORS_ZONE = (
    "yaounde", "douala", "abidjan", "dakar", "cotonou", "lome",
    "ouagadougou", "bamako", "conakry", "brazzaville", "kinshasa",
    "libreville", "niamey", "bangui", "ndjamena", "bafoussam", "bouake",
)

_MOTIFS_VILLES = re.compile(
    r"\b(?:" + "|".join(VILLES_HORS_ZONE) + r")\b", re.IGNORECASE
)


def _sans_accents(texte: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texte or "")
        if unicodedata.category(c) != "Mn"
    )


def hors_zone_monetaire(texte: str) -> str | None:
    """Le motif de rejet, lisible dans le journal — ou None si rien ne cloche.

    Rendre la RAISON et pas un booléen : « HTTP 400 » sans le corps a déjà
    coûté une journée de débogage du mauvais côté (règle du dépôt).
    """
    reduit = _sans_accents(texte)
    devise = MOTIF_DEVISE.search(reduit)
    if devise:
        return f"prix en francs CFA (« {devise.group(0).strip()} »)"
    ville = _MOTIFS_VILLES.search(reduit)
    if ville:
        return f"annonce située hors de Madagascar ({ville.group(0).title()})"
    return None
