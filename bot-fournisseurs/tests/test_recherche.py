"""Les sources de genre « recherche » : ce qui les rendait muettes.

Mesuré le 02/09/2026 sur `data/bot.db` : treize recherches, DEUX publications
en dix jours, et les sept recherches de transport rendaient chacune
« 0 publication(s) mise(s) en file » en onze secondes. Le diagnostic
(`outils/diagnostic_recherche.py`, sur « hourdis Antananarivo ») a montré
deux causes :

  1. la page de résultats contient bien des publications (2 au chargement,
     9 après trois défilements), mais ses premiers écrans sont des conseils
     et des questions : deux défilements sans VENDEUR neuf, et le bot
     abandonnait la page ;
  2. le premier lien « /posts/ » de chaque bloc est l'adresse de la recherche
     elle-même (facebook.com/search/posts/?q=…) : toutes les publications
     recevaient ce même permalien.

    python -m pytest tests/test_recherche.py -q
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import collecteur  # noqa: E402
from tests.test_fraicheur import FAUX_DOM  # noqa: E402


# ── Quand abandonner une source ────────────────────────────────────────────
def test_un_groupe_s_abandonne_des_qu_il_n_apporte_plus_de_vendeur():
    assert collecteur.defilement_sterile("groupe", neufs=0, inedits=12) is True
    assert collecteur.defilement_sterile("groupe", neufs=1, inedits=12) is False
    assert collecteur.limite_steriles("groupe") == 2


def test_une_recherche_continue_tant_qu_elle_montre_de_l_inedit():
    """Les premiers écrans d'une recherche ne sont pas des vendeurs : ce n'est
    pas une raison de partir."""
    assert collecteur.defilement_sterile("recherche", neufs=0, inedits=5) is False
    assert collecteur.defilement_sterile("recherche", neufs=0, inedits=0) is True
    assert collecteur.limite_steriles("recherche") == 4


def test_le_fil_et_les_pages_gardent_la_regle_des_groupes():
    for genre in ("fil", "page"):
        assert collecteur.defilement_sterile(genre, neufs=0, inedits=9) is True
        assert collecteur.limite_steriles(genre) == 2


# ── Le permalien sur une page de résultats ─────────────────────────────────
CAS_RECHERCHE = r"""
poserDocument([creer("div", {role: "article", "aria-posinset": "1"},
  "Hourdis 12 : 1 900 Ar, livraison Tana, 034 12 345 67", [
  creer("a", {href: "https://www.facebook.com/search/posts/?q=hourdis%20Antananarivo"}, "Résultats"),
  creer("a", {href: "https://www.facebook.com/HourdisMG/posts/pfbid0abc"}, "3 j"),
  creer("h3", {}, "", [creer("a", {href: "https://www.facebook.com/HourdisMG?__cft__[0]=x"}, "Hourdis Madagascar")]),
  creer("img", {src: "https://scontent.xx.fbcdn.net/h.jpg", width: "800", height: "600"}),
])]);
console.log(JSON.stringify(extraire(400).map((p) => [p.permalien, p.auteur_url])));
"""


@pytest.mark.skipif(shutil.which("node") is None,
                    reason="Node absent — la relecture du JS est sautée.")
def test_le_permalien_n_est_jamais_l_adresse_de_la_recherche():
    programme = (FAUX_DOM + "\nconst extraire = "
                 + collecteur.JS_EXTRAIRE_FIL + ";\n" + CAS_RECHERCHE)
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False,
                                     encoding="utf-8") as f:
        f.write(programme)
        chemin = f.name
    fini = subprocess.run(["node", chemin], capture_output=True, text=True,
                          encoding="utf-8")
    assert fini.returncode == 0, fini.stderr[:800]
    lot = json.loads(fini.stdout)
    assert len(lot) == 1
    permalien, _auteur_url = lot[0]
    assert permalien == "https://www.facebook.com/HourdisMG/posts/pfbid0abc"
    assert "search" not in permalien
    # `auteur_url` n'est pas vérifié ici : le faux DOM ignore la partie
    # ancêtre des sélecteurs (« h3 a » y vaut « a »). Sur le vrai Facebook,
    # le diagnostic du 02/09/2026 a rendu « facebook.com/HourdisMG?… » — c'est
    # là que ça se vérifie.
