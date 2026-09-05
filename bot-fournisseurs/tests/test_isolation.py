"""La suite de tests n'écrit JAMAIS dans la base ni le journal de production.

Le 01/09 et le 02/09/2026, chaque `pytest` a laissé cinq lignes dans le
journal de `data/bot.db` (« reference-disparue », « f-efface »…), affichées
sur le tableau de bord comme de vrais avertissements. `tests/conftest.py`
détourne maintenant tout le dossier de données vers un répertoire jetable ;
ce fichier vérifie que le détour tient — pour `config`, pour `base`, et pour
le journal lui-même.

    python -m pytest tests/test_isolation.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import base, config  # noqa: E402

DEPOT = Path(__file__).resolve().parent.parent


def test_le_dossier_de_donnees_est_hors_du_depot():
    assert DEPOT not in config.DOSSIER_DONNEES.parents, (
        f"les tests pointent sur {config.DOSSIER_DONNEES} : la vraie base")
    assert config.BASE.parent == config.DOSSIER_DONNEES
    assert config.DOSSIER_DONNEES.name.startswith("akora-bot-tests-")


def test_le_journal_des_tests_vit_dans_le_dossier_jetable():
    base.logguer("ligne écrite par test_isolation — ne doit pas être en prod", "info")
    with base._verrou, base.connexion() as cx:
        assert cx.execute("PRAGMA database_list").fetchone()["file"] == str(config.BASE)
    derniere = base.lire_journal(1)[0]["message"]
    assert "test_isolation" in derniere


def test_la_vraie_base_n_est_pas_ouverte_par_les_tests():
    """La base de production est lue par personne ici, même en lecture."""
    vraie = DEPOT / "data" / "bot.db"
    assert config.BASE != vraie
