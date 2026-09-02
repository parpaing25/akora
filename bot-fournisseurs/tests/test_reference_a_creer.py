"""Créer au catalogue la référence qu'une ligne réclame — ou dire pourquoi non.

C'est le geste qui fait converger les deux bases : ce que la collecte trouve
et que le site ignorait, le site l'apprend. Mais un catalogue qui accueille
n'importe quelle cote cesse d'être comparable, et comparer est la seule raison
d'être d'Akora. Trois conditions, donc :

  · la ligne ÉCRIT une section complète (deux cotes et une longueur) ;
  · le type se décrit par une section — vrai du bois scié, faux d'une tôle
    (épaisseur × longueur), d'un parpaing (épaisseur seule), d'un sable (m³) ;
  · les références déjà en place s'accordent sur une masse volumique, donc le
    poids se CALCULE au lieu de s'inventer.

    python -m pytest tests/test_reference_a_creer.py -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import referentiel  # noqa: E402

CATALOGUE = {
    "types": {
        "madrier": {"nom": "Madrier"},
        "bois-rond": {"nom": "Bois rond et bambou"},
        "chevron": {"nom": "Chevron"},
        "tole": {"nom": "Tôle"},
    },
    "materiaux": {"madrier-70x150-4m": {"slug": "madrier-70x150-4m"}},
    "par_type": {
        # Deux références qui s'accordent : 650 et 652 kg/m³.
        "madrier": [
            {"slug": "madrier-70x150-4m", "volume": 0.042, "poids": 27.3},
            {"slug": "madrier-75x225-4m", "volume": 0.0675, "poids": 44.0},
        ],
        # Le bambou à 400 et l'eucalyptus à 731 : le type mélange des matières.
        "bois-rond": [
            {"slug": "bois-rond-8-10-4m", "volume": 0.028, "poids": 20.0},
            {"slug": "bambou-8-10-5m", "volume": 0.030, "poids": 12.0},
        ],
        # Un bois scié dont les références ne s'accordent pas : 651 et 400.
        "chevron": [
            {"slug": "chevron-60x80-4m", "volume": 0.0192, "poids": 12.5},
            {"slug": "chevron-bidon", "volume": 0.030, "poids": 12.0},
        ],
        "tole": [{"slug": "tole-030-3m", "volume": 0.005, "poids": 2.0}],
    },
}


@pytest.fixture
def catalogue(monkeypatch):
    monkeypatch.setattr(referentiel, "charger", lambda force=False: CATALOGUE)


# ── La masse volumique se déduit, elle ne se choisit pas ──────────────────
def test_la_densite_vient_des_references_en_place(catalogue):
    assert referentiel.densite_du_type("madrier") == 651


def test_un_type_qui_melange_des_matieres_n_a_pas_de_densite(catalogue):
    """Bambou 400 kg/m³ contre eucalyptus 714 : rien à en tirer."""
    assert referentiel.densite_du_type("bois-rond") is None


def test_une_seule_reference_ne_fait_pas_une_convention(catalogue):
    assert referentiel.densite_du_type("tole") is None


# ── Ce qui naît, et ce qui ne naît pas ───────────────────────────────────
def test_une_section_complete_donne_une_reference(catalogue):
    projet = referentiel.reference_a_creer("madrier", "✓ 15cm*6cmx4m = 30 000ar")
    assert projet["possible"] is True
    assert projet["slug"] == "madrier-60x150-4m"
    assert projet["nom"] == "Madrier 6 x 15 cm, 4 m"
    # Volume calculé : 0,06 × 0,15 × 4 = 0,036 m³ ; poids = × 651.
    assert projet["volume"] == pytest.approx(0.036)
    assert projet["poids"] == pytest.approx(0.036 * 651, rel=1e-3)


def test_l_ordre_d_ecriture_ne_change_pas_la_reference(catalogue):
    """« 15x6 » et « 6x15 » sont la MÊME section — sinon le catalogue éclate."""
    a = referentiel.reference_a_creer("madrier", "15cmx6cmx4m")
    b = referentiel.reference_a_creer("madrier", "6cmx15cmx4m")
    assert a["slug"] == b["slug"] == "madrier-60x150-4m"


def test_une_reference_deja_presente_ne_se_recree_pas(catalogue):
    projet = referentiel.reference_a_creer("madrier", "15cmx7cmx4m")
    assert projet["possible"] is False
    assert "existe" in projet["motif"]


def test_des_cotes_ambigues_ne_creent_rien(catalogue):
    """« 13, 14 cm » est une fourchette : on ne choisit pas à la place du dépôt."""
    projet = referentiel.reference_a_creer("madrier", "13, 14cmx2cmx4m")
    assert projet["possible"] is False
    assert "ambigu" in projet["motif"]


def test_sans_longueur_rien_ne_naît(catalogue):
    projet = referentiel.reference_a_creer("madrier", "17cm*7cm")
    assert projet["possible"] is False
    assert "longueur" in projet["motif"]


def test_la_longueur_de_l_en_tete_peut_completer(catalogue):
    """« #MADRIER 4m » au-dessus, « 17cm*7cm » en dessous : la ligne se complète."""
    projet = referentiel.reference_a_creer("madrier", "17cm*7cm", longueur_repli=4)
    assert projet["possible"] is True and projet["slug"] == "madrier-70x170-4m"


def test_un_type_sans_densite_constante_ne_cree_rien(catalogue):
    projet = referentiel.reference_a_creer("chevron", "5*5*4m")
    assert projet["possible"] is False
    assert "masse volumique" in projet["motif"]


def test_un_type_sans_section_ne_cree_rien(catalogue):
    """🔴 03/09/2026 : « 2/ Gravillon : 560 000 Ar 8m3 livré » était devenu
    « Gravillon et cailloux 2 x 3 cm, 8 m ». Le bois rond non plus n'a pas
    de section — il se décrit par un diamètre."""
    projet = referentiel.reference_a_creer("bois-rond", "5*5*4m")
    assert projet["possible"] is False
    assert "section" in projet["motif"]


def test_une_ligne_sans_cote_ne_cree_rien(catalogue):
    projet = referentiel.reference_a_creer("madrier", "✓ Mm >>>>> 3 500ar")
    assert projet["possible"] is False
