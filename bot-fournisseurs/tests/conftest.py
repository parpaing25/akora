"""Isole la suite de tests de la VRAIE base et du VRAI journal.

🔴 POURQUOI CE FICHIER EXISTE. Les 01/09 et 02/09/2026, CHAQUE `pytest` a
écrit cinq lignes dans `data/bot.db` — « Formats refusés (absents du
catalogue) : reference-disparue », « "Disparu" pointe vers un fournisseur
absent du site (f-efface) »… — parce que `base.logguer()` écrit dans la base
désignée par `bot.config.BASE`, et que rien ne la détournait. Le journal de
production s'est rempli de faux avertissements, affichés sur le tableau de
bord et lus par une autre session comme de l'activité réelle.

`bot/config.py` prévoit `AKORA_BOT_DATA` exactement pour ça. Ce fichier le
pose AVANT tout import de `bot.*` : pytest charge `conftest.py` avant les
modules de test, et `config.py` lit la variable au moment de son import.
Le dossier est jetable, propre à chaque session de tests, et n'existe nulle
part dans le dépôt.

La règle, pour toute nouvelle suite : un test n'écrit JAMAIS dans une base
ou un journal de production. `tests/test_isolation.py` le vérifie.
"""
import os
import shutil
import tempfile
from pathlib import Path

DOSSIER_DE_TEST = Path(tempfile.mkdtemp(prefix="akora-bot-tests-"))
os.environ["AKORA_BOT_DATA"] = str(DOSSIER_DE_TEST)

# Le catalogue en cache est la seule pièce du vrai dossier `data/` qu'un test
# a le droit de LIRE : sans lui, `referentiel.charger()` irait le chercher sur
# Supabase — un test qui dépend du réseau — et l'écrirait dans le dossier
# jetable. On le copie ; on ne pointe jamais dessus.
_CACHE = Path(__file__).resolve().parent.parent / "data" / "referentiel.json"
if _CACHE.exists():
    shutil.copy(_CACHE, DOSSIER_DE_TEST / "referentiel.json")
