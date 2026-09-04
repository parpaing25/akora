"""Deux compétences que le bot n'avait pas, mesurées sur le corpus le 04/09/2026.

1. LA NOTATION COURTE « ÉPAISSEUR/LONGUEUR ». Les dépôts malgaches écrivent
   « Parpaing 10/40 » bien plus souvent que « 10x20x40 » : la hauteur, toujours
   20 cm, ne s'écrit pas. Le bot lisait la forme longue et restait muet devant
   la courte — chez Entreprise Fandresena, la MÊME publication écrit les deux,
   et seule la moitié des lignes recevait sa référence.

2. L'UNITÉ QUI CONTREDIT LA RÉFÉRENCE. 14 offres portaient une référence dont
   l'unité n'était pas la leur, 12 avec un prix : un gravillon vendu au camion
   (485 000 Ar) rattaché à une référence au m³, où le prix courant est 55 000.

    python -m pytest tests/test_notation_courte_et_unites.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from bot import extraction, grammaires, referentiel  # noqa: E402


def _format(type_slug: str, ligne: str):
    """Le slug que la ligne désigne au catalogue, ou None."""
    cote = grammaires.lire_cote(type_slug, ligne)
    if not cote:
        return None
    fiche = referentiel.format_par_cote(type_slug, cote)
    return fiche["slug"] if fiche else None


# ── 1. La notation courte ──────────────────────────────────────────────────
@pytest.mark.parametrize("ligne, attendu", [
    ("Prix Parpaing › 10/40 (2 100Ar)", "parpaing-creux-10"),
    ("Prix Parpaing › 15/40 (2 500Ar)", "parpaing-creux-15"),
    ("Prix Parpaing › 20/40 (3 100Ar)", "parpaing-creux-20"),
    ("- Parpaing : 10/40 (300Ar/pièce)", "parpaing-creux-10"),
    ("- Parpaing : 20/40 (400Ar/pièce)", "parpaing-creux-20"),
])
def test_le_parpaing_se_lit_aussi_en_notation_courte(ligne, attendu):
    """Les six lignes de la publication d'Entreprise Fandresena, mot pour mot."""
    assert _format("parpaing-creux", ligne) == attendu


def test_la_forme_longue_marche_toujours():
    """La correction n'a pas déplacé ce qui fonctionnait."""
    assert _format("brique-creuse", "Briques creuses 10x20x40") == "brique-creuse-10x20x40"


def test_l_epaisseur_et_la_longueur_sont_comparees_a_leur_place():
    """🔴 Le piège : le parpaing 10 mesure 10 × 20 × 40, sa HAUTEUR vaut 20.

    Comparer sans tenir compte de la place ferait de « 20/40 » un parpaing 10
    autant qu'un parpaing 20 — deux références pour une cote, donc le mauvais
    produit une fois sur deux."""
    assert _format("parpaing-creux", "Parpaing 20/40") == "parpaing-creux-20"


def test_deux_cotes_courtes_sur_la_ligne_ne_tranchent_rien():
    """« 20/40 et 15/40 » nomme deux formats pour un seul prix."""
    assert grammaires.lire_cote(
        "parpaing-creux", "Parpaing 20/40 et 15/40 : nous consulter") is None


def test_une_cote_courte_ne_cree_jamais_de_reference():
    """Sans la hauteur, pas de volume ; sans volume, pas de poids. On
    reconnaît une référence existante, on n'en compose pas."""
    projet = grammaires.projet_de_reference(
        "parpaing-creux", "Parpaing creux",
        {"genre": "bloc_court", "valeur": (10.0, 40.0)},
        referentiel.charger()["par_type"].get("parpaing-creux", []))
    assert projet["possible"] is False
    assert "hauteur" in projet["motif"]


def test_le_calibre_du_gravillon_n_est_pas_une_cote_de_bloc():
    """« 5/15 » reste un calibre de carrière : le gravillon n'est pas un bloc."""
    cote = grammaires.lire_cote("gravillon", "Gravillon 5/15 = 55 000ar/m3")
    assert cote == {"genre": "calibre", "valeur": (5.0, 15.0)}


# ── 2. L'unité qui contredit la référence ──────────────────────────────────
def _offre(**champs):
    base = {"libelle_brut": "", "prix": 1000, "materiau_slug": None,
            "materiau_nom": None, "unite": None, "certitude": 90, "ambigu": 0}
    base.update(champs)
    return base


def test_une_reference_au_m3_ne_reste_pas_sur_une_ligne_a_la_piece():
    """Le moellon : 9 dépôts le vendent à la pièce, le catalogue au m³."""
    lues = extraction._ecarter_les_references_d_une_autre_unite([
        _offre(libelle_brut="Moellon 20/20=350ar/p", materiau_slug="moellon",
               materiau_nom="Moellon", unite="piece", prix=350),
    ])
    assert lues[0]["materiau_slug"] is None
    assert lues[0]["ambigu"] == 1
    assert lues[0]["unite"] == "piece", "l'unité LUE reste : c'est elle qui est vraie"
    assert "piece" in lues[0]["unite_incompatible"]


def test_le_gravillon_au_camion_ne_devient_pas_un_prix_au_m3():
    """485 000 Ar le camion publiés au m³, c'est neuf fois le prix courant."""
    lues = extraction._ecarter_les_references_d_une_autre_unite([
        _offre(libelle_brut="Gravillon 5/15 : 485 000Ar / camion",
               materiau_slug="gravillon-5-15", materiau_nom="Gravillon 5/15",
               unite="chargement", prix=485000),
    ])
    assert lues[0]["materiau_slug"] is None


def test_le_type_reste_acquis():
    """L'offre retourne à l'atelier avec son type : ce n'est pas une perte."""
    lues = extraction._ecarter_les_references_d_une_autre_unite([
        _offre(materiau_slug="moellon", unite="piece", type_slug="moellon",
               type_nom="Moellon"),
    ])
    assert lues[0]["type_slug"] == "moellon"


def test_une_unite_conforme_garde_sa_reference():
    """Le garde-fou ne touche à rien quand les deux unités s'accordent."""
    lues = extraction._ecarter_les_references_d_une_autre_unite([
        _offre(materiau_slug="parpaing-creux-10", materiau_nom="Parpaing creux 10",
               unite="piece", prix=300),
    ])
    assert lues[0]["materiau_slug"] == "parpaing-creux-10"
    assert lues[0]["ambigu"] == 0


def test_une_offre_sans_unite_lue_garde_sa_reference():
    """Ne rien lire n'est pas contredire : sans unité écrite, on n'écarte pas."""
    lues = extraction._ecarter_les_references_d_une_autre_unite([
        _offre(materiau_slug="moellon", materiau_nom="Moellon", unite=None),
    ])
    assert lues[0]["materiau_slug"] == "moellon"
