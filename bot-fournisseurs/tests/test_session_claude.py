"""Règle du 03/09/2026 : « Arrêter » coupe aussi une prospection de sources.

Avant, l'ordre d'arrêt ne coupait que la tournée : une prospection lancée à
sa suite déroulait ses recherches Facebook jusqu'au bout, Chromium ouvert.
Le garde de la recherche AUTOMATIQUE est dans tests/test_planificateur.py.

    python -m pytest tests/test_session_claude.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import sources_prospection as sp  # noqa: E402


class _Onglet:
    """Un onglet Playwright de carton : il note les visites et ne trouve rien."""

    def __init__(self):
        self.visites = []

    def goto(self, url, **_kw):
        self.visites.append(url)

    def wait_for_timeout(self, _ms):
        pass

    class mouse:                                   # noqa: N801 — imite Playwright
        @staticmethod
        def wheel(_x, _y):
            pass

    def evaluate(self, _js):
        return []

    def is_closed(self):
        return False


def _prospection_sans_base(monkeypatch):
    monkeypatch.setattr(sp.base, "urls_sources", lambda: set())
    monkeypatch.setattr(sp.base, "candidats_ecartes", lambda: set())
    monkeypatch.setattr(sp.base, "logguer", lambda *a, **k: None)
    monkeypatch.setattr(sp.time, "sleep", lambda _s: None)


def test_l_ordre_d_arret_interrompt_la_prospection(monkeypatch):
    _prospection_sans_base(monkeypatch)
    onglet = _Onglet()
    reponses = iter([False, True, True, True])
    resultat = sp.prospecter(onglet, requetes=["vente gravillon"], config={},
                             arreter=lambda: next(reponses))
    assert len(onglet.visites) == 1
    assert resultat == []


def test_sans_ordre_d_arret_la_prospection_va_au_bout(monkeypatch):
    _prospection_sans_base(monkeypatch)
    onglet = _Onglet()
    sp.prospecter(onglet, requetes=["vente gravillon"], config={})
    assert len(onglet.visites) == 2
