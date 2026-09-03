"""Le planificateur rattrape un créneau manqué, et enchaîne les tâches APRÈS.

Le 02/09/2026, le bot est resté mort de 21 h 48 la veille à 14 h 20 (gardien
désactivé). Avec la fenêtre de 30 minutes d'alors, la collecte de 10 h
était perdue pour la journée : le premier passage aurait été celui de 17 h.
Un créneau reste maintenant dû jusqu'à l'arrivée du suivant.

Second point : `lancer_collecte` rend la main dès que le fil est parti. Les
« tâches du jour » (inscriptions, réservations…) démarraient donc PENDANT
la collecte, sur les données de la veille, alors que l'en-tête promettait
« après ». Elles passent désormais par un rappel `apres`, exécuté à la fin
de la collecte — ou tout de suite si elle n'a pas pu partir.

    python -m pytest tests/test_planificateur.py -q
"""
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from bot import base, session_claude  # noqa: E402
from bot import planificateur as plan  # noqa: E402

HEURES = ["10:00", "17:00"]


@pytest.fixture(autouse=True)
def aucune_session_claude(monkeypatch):
    """Ces tests tournent… depuis une session Claude. Sans ce détour, le garde
    du 03/09 (« pas de tournée tant qu'une session tourne ») verrait les
    marqueurs RÉELS de ~/.claude/sessions-actives/ et suspendrait chaque
    collecte simulée — sept tests tombés le 03/09/2026, pour cette raison
    exacte. Le garde a son propre test, plus bas."""
    monkeypatch.setattr(session_claude, "active", lambda *_a, **_k: None)


def _a(h, m=0, jour=2):
    return datetime(2026, 9, jour, h, m)


# ── Quel créneau est dû ────────────────────────────────────────────────────
def test_avant_le_premier_passage_rien_n_est_du():
    assert plan.creneau_du(HEURES, _a(9, 59)) == ""


def test_un_creneau_reste_du_jusqu_au_suivant():
    assert plan.creneau_du(HEURES, _a(10, 0)) == "10:00"
    assert plan.creneau_du(HEURES, _a(10, 29)) == "10:00"
    assert plan.creneau_du(HEURES, _a(14, 20)) == "10:00"      # le cas du 02/09
    assert plan.creneau_du(HEURES, _a(16, 59)) == "10:00"


def test_le_dernier_creneau_reste_du_jusqu_a_minuit():
    assert plan.creneau_du(HEURES, _a(17, 0)) == "17:00"
    assert plan.creneau_du(HEURES, _a(23, 50)) == "17:00"


# ── Le déclenchement, sur la base jetable ──────────────────────────────────
def _planificateur(appels, lancee=True):
    """Un planificateur SANS son fil d'horloge, piloté à la main."""
    p = plan.Planificateur.__new__(plan.Planificateur)
    p.est_occupe = lambda: False
    p.synchroniser = None                  # pas de retour du site en test

    def lancer(reglages, apres=None):
        appels.append(("collecte", reglages))
        if lancee and apres:
            apres()                        # la collecte finit, puis les tâches
        return lancee

    p.lancer_collecte = lancer
    return p


def _config(monkeypatch, **extra):
    cfg = {"collecte_auto": True, "heures_collecte": HEURES, "objectif_par_jour": 0,
           "scrolls_max_par_source": 25, "posts_max_par_source": 40,
           "auto_inscription": False, "auto_synchro": False}
    cfg.update(extra)
    monkeypatch.setattr(plan, "charger", lambda: cfg)
    base.ecrire_etat(plan.CLE_DERNIER, "")
    base.ecrire_etat(plan.CLE_TACHES, "")
    return cfg


def test_un_bot_revenu_a_14h20_rattrape_la_collecte_de_10h(monkeypatch):
    _config(monkeypatch)
    appels = []
    p = _planificateur(appels)
    p._verifier(_a(14, 20))
    assert [a[0] for a in appels] == ["collecte"]
    assert base.lire_etat(plan.CLE_DERNIER) == "2026-09-02 10:00"


def test_un_creneau_fait_ne_se_refait_pas(monkeypatch):
    _config(monkeypatch)
    appels = []
    p = _planificateur(appels)
    p._verifier(_a(10, 1))
    p._verifier(_a(12, 0))
    p._verifier(_a(16, 59))
    assert len(appels) == 1


def test_le_creneau_suivant_repart_a_son_heure(monkeypatch):
    _config(monkeypatch)
    appels = []
    p = _planificateur(appels)
    p._verifier(_a(14, 20))
    p._verifier(_a(17, 0))
    assert len(appels) == 2
    assert base.lire_etat(plan.CLE_DERNIER) == "2026-09-02 17:00"


def test_occupe_on_attend_sans_consommer_le_creneau(monkeypatch):
    _config(monkeypatch)
    appels = []
    p = _planificateur(appels)
    p.est_occupe = lambda: True
    p._verifier(_a(10, 5))
    assert appels == []
    assert base.lire_etat(plan.CLE_DERNIER) == ""
    p.est_occupe = lambda: False
    p._verifier(_a(10, 6))
    assert len(appels) == 1


def test_une_session_claude_suspend_la_tournee_sans_consommer_le_creneau(monkeypatch):
    """🔴 Règle d'Andry du 03/09/2026 : tant qu'une session Claude tourne sur
    ce PC, aucune tournée automatique — c'est Chromium qui mange la RAM. Le
    créneau n'est pas consommé : il part de lui-même quand la session
    s'éteint, et la suspension n'est dite qu'une fois."""
    _config(monkeypatch)
    appels = []
    p = _planificateur(appels)
    monkeypatch.setattr(session_claude, "active",
                        lambda *_a, **_k: "1 session(s) Claude active(s) sur ce PC")
    p._verifier(_a(10, 5))
    p._verifier(_a(10, 6))
    assert appels == []
    assert base.lire_etat(plan.CLE_DERNIER) == ""
    dites = [l for l in base.lire_journal(20) if "suspendue" in l["message"]]
    assert len(dites) == 1, "la suspension se dit une fois par créneau, pas toutes les 30 s"

    monkeypatch.setattr(session_claude, "active", lambda *_a, **_k: None)   # la session s'éteint
    p._verifier(_a(10, 7))
    assert [a[0] for a in appels] == ["collecte"]
    assert base.lire_etat(plan.CLE_DERNIER) == "2026-09-02 10:00"


def test_les_taches_du_jour_passent_apres_la_collecte(monkeypatch):
    _config(monkeypatch)
    ordre = []
    p = plan.Planificateur.__new__(plan.Planificateur)
    p.est_occupe = lambda: False
    p.synchroniser = None

    def lancer(reglages, apres=None):
        ordre.append("collecte")
        apres()
        return True

    p.lancer_collecte = lancer
    monkeypatch.setattr(p, "_taches_du_jour", lambda cfg: ordre.append("taches"))
    p._verifier(_a(10, 0))
    assert ordre == ["collecte", "taches"]


def test_si_la_collecte_ne_part_pas_les_taches_tournent_quand_meme(monkeypatch):
    _config(monkeypatch)
    ordre = []
    p = _planificateur(ordre, lancee=False)
    monkeypatch.setattr(p, "_taches_du_jour", lambda cfg: ordre.append("taches"))
    p._verifier(_a(10, 0))
    assert ordre == [("collecte", None), "taches"]


def test_le_dernier_creneau_creuse_plus_loin_si_l_objectif_manque(monkeypatch):
    _config(monkeypatch, objectif_par_jour=15)
    appels = []
    p = _planificateur(appels)
    p._verifier(_a(17, 0))
    assert appels[0][1] == {"scrolls_max_par_source": 50, "posts_max_par_source": 80}


def test_la_recherche_automatique_de_sources_attend_aussi_la_fin_de_la_session(monkeypatch):
    """La tournée n'est pas la seule chose qui ouvre Chromium.

    Le 03/09/2026 à 23 h 38, avec six sessions ouvertes, le bot frère Fonenako
    a enchaîné une prospection de sources sous Chromium juste après sa
    collecte : le garde ne couvrait que la tournée. La date n'est pas
    consommée — la recherche partira avec les tâches du jour suivant."""
    from bot import collecteur as col

    cfg = _config(monkeypatch, prospection_auto_jours=1)
    base.ecrire_etat(plan.CLE_PROSPECTION_SOURCES, "")
    lances = []
    monkeypatch.setattr(col.collecteur, "prospecter_sources",
                        lambda *a, **k: lances.append(1) or {})
    p = _planificateur([])

    monkeypatch.setattr(session_claude, "active",
                        lambda *_a, **_k: "1 session(s) Claude active(s) sur ce PC")
    p._prospecter_sources(cfg)
    assert lances == []
    assert base.lire_etat(plan.CLE_PROSPECTION_SOURCES, "") == ""

    monkeypatch.setattr(session_claude, "active", lambda *_a, **_k: None)
    p._prospecter_sources(cfg)
    assert lances == [1]
    assert base.lire_etat(plan.CLE_PROSPECTION_SOURCES, "") != ""
