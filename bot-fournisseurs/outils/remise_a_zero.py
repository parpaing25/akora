"""Remet la collecte LOCALE à zéro, en gardant ce qui n'est pas de la collecte.

Demande d'Andry du 02/09/2026 : « enlève toutes les données qu'on a eues sur
la collecte et on reprend tout de 0 avec de la bonne base ». La base d'avant
apprenait mal (regroupement, dates, cotes) ; ce qu'elle contient ne vaut pas
d'être trié à la main.

Ce qui PART : prospects, publications, offres, photos, véhicules,
événements, demandes, matériaux absents, candidats de sources, journal — et
le dossier `data/prospects/` (captures et photos).

Ce qui RESTE : les sources (groupes, pages, recherches — la configuration de
la veille), la liste rouge (`refuses` : un refus est définitif, il survit à
tout), la session Facebook et la configuration. Les compteurs des sources
repartent de zéro, et le créneau planifié est oublié pour que la prochaine
tournée parte dès que possible.

Tout est sauvegardé avant : la base entière dans `data/archives/`, le dossier
des photos déplacé à côté. Rien n'est irréversible.

Usage :
    python outils/remise_a_zero.py            # à blanc : compte, n'efface rien
    python outils/remise_a_zero.py --ecrire   # efface, après sauvegarde
"""
from __future__ import annotations

import io
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot.config import BASE, DOSSIER_DONNEES, DOSSIER_PROSPECTS  # noqa: E402

TABLES_COLLECTE = ("prospects", "publications", "offres", "photos", "vehicules",
                   "evenements", "demandes", "materiaux_absents", "candidats_sources",
                   "journal")
CLES_ETAT_A_OUBLIER = ("planificateur_dernier_creneau", "planificateur_dernieres_taches",
                       "derniere_prospection_sources")


def principal() -> int:
    ecrire = "--ecrire" in sys.argv
    cx = sqlite3.connect(f"file:{BASE}?mode=ro", uri=True)
    comptes = {t: cx.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in TABLES_COLLECTE}
    sources = cx.execute("SELECT COUNT(*) FROM sources").fetchone()[0]
    refuses = cx.execute("SELECT COUNT(*) FROM refuses").fetchone()[0]
    cx.close()
    photos = sum(1 for _ in DOSSIER_PROSPECTS.rglob("*")) if DOSSIER_PROSPECTS.exists() else 0

    print("À effacer :")
    for t, n in comptes.items():
        print(f"   {t:<20} {n:>6}")
    print(f"   {'fichiers photos':<20} {photos:>6}")
    print(f"Gardés : {sources} sources, {refuses} refus (liste rouge), session Facebook, config.")
    if not ecrire:
        print("\nÀ blanc. Relancer avec --ecrire pour effacer.")
        return 0

    horodatage = datetime.now().strftime("%Y%m%d-%H%M%S")
    archives = DOSSIER_DONNEES / "archives"
    archives.mkdir(parents=True, exist_ok=True)
    sauvegarde = archives / f"bot.db.avant-remise-a-zero-{horodatage}"
    shutil.copy2(BASE, sauvegarde)
    print(f"\nSauvegarde : {sauvegarde}")
    if DOSSIER_PROSPECTS.exists():
        cible = archives / f"prospects-avant-remise-a-zero-{horodatage}"
        shutil.move(str(DOSSIER_PROSPECTS), str(cible))
        print(f"Photos déplacées : {cible}")

    cx = sqlite3.connect(BASE, timeout=30)
    with cx:
        cx.execute("PRAGMA foreign_keys = OFF")
        for t in TABLES_COLLECTE:
            cx.execute(f"DELETE FROM {t}")
        cx.execute("UPDATE sources SET nb_trouves = 0, derniere_collecte = NULL")
        for cle in CLES_ETAT_A_OUBLIER:
            cx.execute("DELETE FROM etat WHERE cle = ?", (cle,))
        cx.execute("DELETE FROM sqlite_sequence WHERE name IN ('offres','photos','vehicules','evenements','journal')")
    cx.execute("VACUUM")
    cx.close()
    print("Collecte locale remise à zéro. Les sources et la liste rouge sont intactes.")
    return 0


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.exit(principal())
