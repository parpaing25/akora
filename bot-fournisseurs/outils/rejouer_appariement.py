"""Rejoue l'appariement sur les offres déjà en base, SANS RIEN ÉCRIRE.

C'est le thermomètre du bot : 60 offres collectées, combien retrouvent un
`materiau_slug` avec le code d'AUJOURD'HUI ? La base est ouverte en lecture
seule (`mode=ro`) — cet outil sert justement à essayer des améliorations de
`referentiel.apparier()` sans risquer d'écraser ce que la collecte a rangé.

Usage :  python outils/rejouer_appariement.py [-v]
  -v : montre chaque offre, appariée ou non, avec le détail.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import extraction, referentiel  # noqa: E402
from bot.config import BASE, charger  # noqa: E402


def principal() -> None:
    bavard = "-v" in sys.argv
    cfg = charger()
    referentiel.charger()

    cx = sqlite3.connect(f"file:{BASE}?mode=ro", uri=True)
    cx.row_factory = sqlite3.Row
    lignes = cx.execute(
        "SELECT id, libelle_brut, materiau_slug FROM offres ORDER BY id"
    ).fetchall()

    apparie, ambigu_type, rien = [], [], []
    for offre in lignes:
        libelle = offre["libelle_brut"] or ""
        _, _, consommes = extraction.prix_dans(libelle, cfg)
        resultat = referentiel.apparier(libelle, consommes)
        if resultat and resultat.get("materiau_slug"):
            apparie.append((offre, resultat))
        elif resultat:
            ambigu_type.append((offre, resultat))
        else:
            rien.append((offre, None))

    if bavard:
        for titre, groupe in (("=== APPARIÉES ===", apparie),
                              ("=== TYPE SEUL (format indécis) ===", ambigu_type),
                              ("=== RIEN ===", rien)):
            print(titre)
            for offre, resultat in groupe:
                detail = ""
                if resultat:
                    detail = (f" -> {resultat.get('materiau_slug') or resultat.get('type_slug')}"
                              f" (certitude {resultat.get('certitude')},"
                              f" ambigu {resultat.get('ambigu')})")
                print(f"  #{offre['id']:>3} {libellecourt(offre)}{detail}")
            print()

    total = len(lignes)
    print(f"{len(apparie)}/{total} appariées (format trouvé), "
          f"{len(ambigu_type)} au type seul, {len(rien)} sans rien. "
          f"En base aujourd'hui : "
          f"{sum(1 for o in lignes if o['materiau_slug'])}/{total}.")


def libellecourt(offre) -> str:
    texte = (offre["libelle_brut"] or "").replace("\n", " ")
    return texte[:70] + ("…" if len(texte) > 70 else "")


if __name__ == "__main__":
    principal()
