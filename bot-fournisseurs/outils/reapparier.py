"""Réapplique l'appariement sur les offres DÉJÀ en base, et l'écrit.

Frère jumeau de `rejouer_appariement.py`, qui lui ne fait que mesurer. Celui-ci
écrit — d'où la sauvegarde obligatoire et le mode « à blanc » par défaut.

🔴 POURQUOI IL EXISTE. Le 24/08/2026, `referentiel.apparier()` a été corrigé :
9 des 23 offres appariées l'étaient à tort, et deux d'entre elles étaient
PUBLIABLES (elles avaient un prix). La pire : un téléviseur
« >32" sans bordure : 410.000ar » rangé en *bordure de trottoir T2 à
410 000 Ar/ml*. Ces lignes alimentent `marche.py`, donc l'observatoire des prix
et le bulletin public signé Akora — un prix faux y devient une information
publiée sous notre nom.

Or corriger le code ne corrige PAS le passé : l'appariement est figé dans la
colonne `materiau_slug` au moment de la collecte. Sans ce passage, les 9 faux
restent en base jusqu'à ce qu'une nouvelle collecte les recouvre — et rien ne
garantit qu'elle les revoie.

Usage :
    python outils/reapparier.py            # à blanc : montre, n'écrit rien
    python outils/reapparier.py --ecrire   # écrit, après sauvegarde
"""
from __future__ import annotations

import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import extraction, referentiel  # noqa: E402
from bot.config import BASE, charger  # noqa: E402

# Les colonnes que l'appariement décide. `garder`, `prix`, `unite` et le reste
# ne sont PAS touchés : ils viennent de l'extraction ou de la main d'Andry.
#
# ⚠ Trois d'entre elles sont NOT NULL DEFAULT 0 : quand l'appariement ne rend
# plus rien, `apparier()` renvoie un dict vide et `.get()` donnerait None — la
# transaction entière échouait sur « NOT NULL constraint failed ». Le défaut
# vit donc ici, à côté du nom de la colonne, plutôt que dans une exception.
CHAMPS = {
    "materiau_slug": None, "materiau_nom": None,
    "type_slug": None, "type_nom": None, "famille_slug": None,
    "certitude": 0, "ambigu": 0, "hors_catalogue": 0,
}


def principal() -> None:
    ecrire = "--ecrire" in sys.argv
    cfg = charger()
    referentiel.charger()

    # Lecture d'abord, toujours en `mode=ro` : tant qu'on n'a pas décidé
    # d'écrire, on ne prend même pas le verrou.
    cx = sqlite3.connect(f"file:{BASE}?mode=ro", uri=True)
    cx.row_factory = sqlite3.Row
    offres = cx.execute("SELECT * FROM offres ORDER BY id").fetchall()
    cx.close()

    changements = []
    for offre in offres:
        libelle = offre["libelle_brut"] or ""
        _, _, consommes = extraction.prix_dans(libelle, cfg)
        neuf = referentiel.apparier(libelle, consommes) or {}
        avant = offre["materiau_slug"]
        apres = neuf.get("materiau_slug")
        if avant == apres:
            continue
        changements.append((offre, neuf, avant, apres))

    perdus = [c for c in changements if c[2] and not c[3]]
    gagnes = [c for c in changements if not c[2] and c[3]]
    remplaces = [c for c in changements if c[2] and c[3]]

    print(f"{len(offres)} offres en base, {len(changements)} changent d'appariement :")
    print(f"   {len(perdus)} retirées (appariement jugé faux aujourd'hui)")
    print(f"   {len(gagnes)} gagnées")
    print(f"   {len(remplaces)} remplacées")
    print()
    for offre, _, avant, apres in changements:
        texte = (offre["libelle_brut"] or "").replace("\n", " ")[:58]
        prix = f" [{offre['prix']} Ar]" if offre["prix"] else ""
        print(f"  #{offre['id']:>3} {texte:<58}{prix}")
        print(f"       {avant or '(rien)'}  ->  {apres or '(rien)'}")

    if not ecrire:
        print("\nÀ blanc : rien n'a été écrit. Relancer avec --ecrire pour appliquer.")
        return
    if not changements:
        print("\nRien à écrire.")
        return

    sauvegarde = Path(f"{BASE}.avant-reappariement-"
                      f"{datetime.now().strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(BASE, sauvegarde)
    print(f"\nSauvegarde : {sauvegarde.name}")

    cx = sqlite3.connect(BASE)
    try:
        with cx:
            for offre, neuf, _, _ in changements:
                valeurs = tuple(
                    defaut if neuf.get(champ) is None else neuf[champ]
                    for champ, defaut in CHAMPS.items()
                )
                cx.execute(
                    f"UPDATE offres SET {', '.join(f'{c} = ?' for c in CHAMPS)} WHERE id = ?",
                    valeurs + (offre["id"],))
        print(f"{len(changements)} offre(s) mise(s) à jour.")
    finally:
        cx.close()


if __name__ == "__main__":
    principal()
