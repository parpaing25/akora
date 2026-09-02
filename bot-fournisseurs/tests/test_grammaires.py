"""Les grammaires des matériaux : lire une cote entière, la comparer, la créer.

Toutes les écritures viennent du corpus réel (`data/bot.db`, 02/09/2026) ou
de la capture d'écran d'Andry du même jour (« Le Guide Construction
Madagascar »). Ce qui se joue : « Hourdis 20×20×53 » était rangé en
hourdis 60 × 20 × 20 parce qu'un seul chiffre coïncidait ; un catalogue qui
n'apprend pas ce que le terrain vend reste vide.

    python -m pytest tests/test_grammaires.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import grammaires  # noqa: E402

HOURDIS = [
    {"slug": "hourdis-12", "volume": 0.0144, "poids": 14, "cotes_bloc": (12.0, 20.0, 60.0),
     "attributs": {"hauteur_cm": 12}},
    {"slug": "hourdis-tc-12", "volume": 0.01307, "poids": 11.76, "cotes_bloc": (12.0, 33.0, 33.0),
     "attributs": {}},
    {"slug": "hourdis-20", "volume": 0.024, "poids": 22, "cotes_bloc": (20.0, 20.0, 60.0),
     "attributs": {"hauteur_cm": 20}},
]


# ── Lire une cote ──────────────────────────────────────────────────────────
def test_les_ecritures_du_terrain_donnent_la_meme_cote():
    for ecriture in ("20×20×40", "20x20x40", "(20*20*40)", "40 × 20 × 20 cm",
                     "20 x 20 x 40cm", "400x200x200 mm"):
        assert grammaires.triples(ecriture) == [(20.0, 20.0, 40.0)], ecriture


def test_une_decimale_se_lit():
    assert grammaires.triples("29,5x14x9") == [(9.0, 14.0, 29.5)]
    assert grammaires.triples("Type 3 : (5,5*10,5*21)cm") == [(5.5, 10.5, 21.0)]


def test_le_prix_n_est_jamais_une_cote():
    """« 20x20x40:3200ar » — le montant est retiré avant toute lecture."""
    assert grammaires.triples("20x20x40:3200ar(+2000 stock dispo)") == [(20.0, 20.0, 40.0)]


def test_une_ligne_qui_cite_trois_formats_en_rend_trois():
    lus = grammaires.triples("HOURDIS : (12*33*33) , (15*33*33) , (20*33*33) cm")
    assert lus == [(12.0, 33.0, 33.0), (15.0, 33.0, 33.0), (20.0, 33.0, 33.0)]
    # …et `lire_cote` refuse alors de trancher : trois formats, un prix.
    assert grammaires.lire_cote("hourdis", "HOURDIS : (12*33*33) , (15*33*33) cm") is None


def test_la_cote_du_catalogue_se_lit_dans_n_importe_quel_ordre():
    assert grammaires.cotes_catalogue("40 × 20 × 15 cm") == (15.0, 20.0, 40.0)
    assert grammaires.cotes_catalogue("33,5 × 22 × 2 cm · 15 au m²") == (2.0, 22.0, 33.5)
    assert grammaires.cotes_catalogue("40 × 40 cm") == (40.0, 40.0)
    assert grammaires.cotes_catalogue("Au m³") is None
    assert grammaires.cotes_catalogue(None) is None


# ── Comparer ───────────────────────────────────────────────────────────────
def test_la_cote_exacte_retrouve_sa_reference():
    cote = grammaires.lire_cote("hourdis", "hourdis 60x20x12 : 2 500 Ar")
    assert grammaires.format_existant(cote, HOURDIS)["slug"] == "hourdis-12"
    cote = grammaires.lire_cote("hourdis", "12x33x33 : 2500ar/pièce")
    assert grammaires.format_existant(cote, HOURDIS)["slug"] == "hourdis-tc-12"


def test_un_chiffre_commun_ne_fait_pas_une_reference():
    """🔴 Le cas de la capture : 20×20×53 n'est PAS le hourdis 60 × 20 × 20."""
    cote = grammaires.lire_cote("hourdis", "Hourdis 20×20×53 à 4 800 Ar/pièce")
    assert cote == {"genre": "bloc", "valeur": (20.0, 20.0, 53.0)}
    assert grammaires.format_existant(cote, HOURDIS) is None


# ── Créer ──────────────────────────────────────────────────────────────────
def test_la_reference_nait_avec_son_volume_et_son_poids():
    projet = grammaires.projet_bloc("hourdis", "Hourdis", (20.0, 20.0, 53.0), HOURDIS)
    assert projet["possible"] is True
    assert projet["slug"] == "hourdis-20x20x53"
    assert projet["nom"] == "Hourdis 20 × 20 × 53 cm"
    assert projet["libelle_court"] == "20×20×53"
    assert projet["dimensions"] == "53 × 20 × 20 cm"
    assert projet["unite"] == "piece"
    assert abs(projet["volume"] - 0.0212) < 1e-6
    # Poids = volume × masse volumique MÉDIANE du type (900-970 kg/m³ ici).
    assert projet["densite"] in (900, 917, 972) or 890 <= projet["densite"] <= 980
    assert 18 < projet["poids"] < 21


def test_une_cote_hors_bornes_ne_cree_rien():
    """Un parpaing de 3 cm ou un hourdis de 2 m : ce n'est pas un format."""
    assert grammaires.projet_bloc("parpaing-creux", "Parpaing creux", (3.0, 20.0, 40.0), HOURDIS)["possible"] is False
    assert grammaires.projet_bloc("hourdis", "Hourdis", (20.0, 20.0, 200.0), HOURDIS)["possible"] is False


def test_un_type_sans_reference_pesee_ne_cree_rien():
    assert grammaires.projet_bloc("hourdis", "Hourdis", (20.0, 20.0, 53.0), [])["possible"] is False


def test_le_sable_n_a_pas_de_grammaire():
    assert grammaires.lire_cote("sable", "Fasika 30 000 Ar/m3") is None
    projet = grammaires.projet_de_reference("sable", "Sable", {"genre": "bloc", "valeur": (1, 2, 3)}, [])
    assert projet["possible"] is False


def test_le_fer_se_pese_par_la_physique():
    projet = grammaires.projet_fer("fer-a-beton", "Fer à béton", 20, [])
    assert projet["slug"] == "fer-beton-20" and projet["unite"] == "piece"
    assert abs(projet["poids"] - 29.6) < 0.2          # 0,006165 × 20² × 12 m
    assert grammaires.projet_fer("fer-a-beton", "Fer à béton", 9, [])["possible"] is False


def test_les_autres_grammaires_lisent_leur_cote():
    assert grammaires.lire_cote("fer-a-beton", "Fer 12 : 48 000 Ar la barre") == {"genre": "diametre", "valeur": 12}
    assert grammaires.lire_cote("gravillon", "Gravillon 5/15 : 75 000 Ar/m³") == {"genre": "calibre", "valeur": (5.0, 15.0)}
    assert grammaires.lire_cote("buse", "Buse Ø 400 : 85 000 Ar/ml") == {"genre": "diametre", "valeur": 400}
    assert grammaires.lire_cote("contreplaque", "Contreplaqué 15 mm : 45 000 Ar") == {"genre": "epaisseur", "valeur": 15}
    assert grammaires.lire_cote("beton-pret-emploi", "Béton dosé 350 : 450 000 Ar/m3") == {"genre": "dosage", "valeur": 350}
    assert grammaires.lire_cote("tole", "Tôle ondulée 0,30 x 3m : 22 000 Ar") == {"genre": "tole", "valeur": (30, 3.0, "ondulee")}


def test_la_tole_exige_forme_epaisseur_et_longueur():
    assert grammaires.lire_cote("tole", "Tôle 0,30 : 22 000 Ar") is None            # pas de longueur
    assert grammaires.lire_cote("tole", "Tôle 3 m : 22 000 Ar") is None              # pas d'épaisseur
    assert grammaires.lire_cote("tole", "Tôle 0,30 x 3 m : 22 000 Ar") is None       # pas de forme
    projet = grammaires.projet_tole("tole", "Tôle", 30, 3.0, "bac-galva", [])
    assert projet["slug"] == "bac-galva-030-3m"
