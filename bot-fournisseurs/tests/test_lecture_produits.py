"""Lire une publication comme un acheteur la lit : le matériau, sa cote, son prix.

Les textes sont RÉELS : la capture d'écran d'Andry du 02/09/2026 (« Le Guide
Construction Madagascar », publication du jour), les trois publications de
la même page déjà en base, et des lignes de tarif recopiées depuis
`data/bot.db`. Ce qui se jouait : sept « produits » sans prix tirés de
phrases (« Solution idéale pour un plancher fini durable »), et le seul
vrai tarif — « Dimensions : 20 × 20 × 53 cm / Prix : 4 800 Ar / pièce » —
jamais lu, parce que la cote et le prix étaient sur deux lignes.

    python -m pytest tests/test_lecture_produits.py -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import collecteur, extraction, referentiel  # noqa: E402
from bot.config import CACHE_REFERENTIEL  # noqa: E402

CFG = {"prix_plancher_ar": 200, "prix_plancher_unitaire_ar": 50,
       "prix_plafond_ar": 50_000_000, "taux_fmg_ar": 5,
       "prix_obligatoire": True, "produits_min_sans_prix": 3}


@pytest.fixture(scope="module", autouse=True)
def catalogue():
    if not CACHE_REFERENTIEL.exists():
        pytest.skip("Catalogue absent — Réglages › Synchroniser le référentiel.")
    return referentiel.charger()


POST_DU_JOUR = """🏗️ Vous avez un chantier en cours ou un projet de construction à venir ?
Vous recherchez des matériaux fiables pour avancer dans vos travaux en toute sérénité ?
Le Guide Construction Madagascar vous propose des matériaux adaptés à vos besoins : hourdis, poutrelles et parpaings de qualité pour vos différents projets de construction. 🔨
✨ Nos produits :
🔸 Hourdis 20×20×53 à 4 800 Ar/pièce
🔸 Poutrelles sur mesure à partir de 67 000 Ar/ml
🔸 Parpaings 20×20×40 de qualité supérieure à 3 800 Ar/unité
Que ce soit pour une construction neuve, une extension ou des travaux de rénovation, nous sommes là pour vous accompagner dans vos besoins en matériaux.
🚚 Livraison partout à Madagascar
📞 034 45 548 19
📧 contact@gcm.mg"""

FICHE_PRODUIT = """… HOURDIS DISPONIBLES, construisez en toute confiance !
Vous démarrez un chantier ou une construction en cours ?
Le Guide Construction met à votre disposition des hourdis solides, fiables et prêts à l’emploi.
- Dimensions : 20 × 20 × 53 cm
- Prix : 4 800 Ar / pièce
Pourquoi choisir nos hourdis ?
- Grande solidité et durabilité
- Pose facile et rapide
Stock disponible – contactez-nous dès maintenant !
+261 38 57 782 97 | +261 34 71 394 80"""

PROSE = """PLANCHER FINI – HOURDIS & POUTRELLES
Optez pour une solution fiable et durable pour vos constructions avec nos systèmes de plancher fini en hourdis et poutrelles.
Structure solide et sécurisée
Matériaux résistants et conformes aux normes
Solution idéale pour un plancher fini durable
Adapté aux maisons, villas et bâtiments professionnels
Devis gratuit sous 24h
034 71 394 80 / 038 36 553 87"""


def par_libelle(lues, morceau):
    return next(o for o in lues if morceau in o["libelle_brut"])


# ── La capture d'écran ─────────────────────────────────────────────────────
def test_les_trois_produits_du_post_du_jour():
    lues = extraction.offres(POST_DU_JOUR, CFG)
    assert len(lues) == 3, [o["libelle_brut"] for o in lues]

    hourdis = par_libelle(lues, "Hourdis 20x20x53")
    assert hourdis["prix"] == 4_800 and hourdis["unite"] == "piece"
    assert hourdis["type_slug"] == "hourdis"
    # 🔴 Pas le hourdis 60 × 20 × 20 : la cote entière ne correspond à rien,
    # c'est une référence à créer.
    assert hourdis["materiau_slug"] is None
    assert hourdis["cote_lue"] == {"genre": "bloc", "valeur": (20.0, 20.0, 53.0)}

    poutrelle = par_libelle(lues, "Poutrelles")
    assert poutrelle["prix"] == 67_000 and poutrelle["unite"] == "ml"
    assert poutrelle["materiau_slug"] == "poutrelle-beton"

    parpaing = par_libelle(lues, "Parpaings 20x20x40")
    assert parpaing["prix"] == 3_800 and parpaing["unite"] == "piece"
    assert parpaing["materiau_slug"] == "parpaing-creux-20"      # 40 × 20 × 20 = 20×20×40


def test_une_fiche_produit_sur_trois_lignes_fait_une_offre():
    """Le matériau au-dessus, « Dimensions : » puis « Prix : » — une seule offre."""
    lues = extraction.offres(FICHE_PRODUIT, CFG)
    chiffrees = [o for o in lues if o["prix"]]
    assert len(chiffrees) == 1
    offre = chiffrees[0]
    assert offre["prix"] == 4_800 and offre["unite"] == "piece"
    assert offre["type_slug"] == "hourdis" and offre["materiau_slug"] is None
    assert offre["cote_lue"] == {"genre": "bloc", "valeur": (20.0, 20.0, 53.0)}


def test_les_phrases_ne_font_plus_de_produits():
    """Sept « produits » sans prix le 02/09 ; ici, aucun tarif -> aucune offre chiffrée,
    et jamais une phrase comme produit."""
    lues = extraction.offres(PROSE, CFG)
    assert not [o for o in lues if o["prix"]]
    for o in lues:
        assert "Solution" not in o["libelle_brut"]
        assert "Optez" not in o["libelle_brut"]
        assert "Adapté" not in o["libelle_brut"]


def test_le_post_sans_prix_est_refuse_a_la_porte_le_post_chiffre_entre():
    lecture = extraction.analyser(PROSE, CFG)
    assert collecteur.admission(lecture, CFG) == "refuse"
    lecture = extraction.analyser(POST_DU_JOUR, CFG)
    assert collecteur.admission(lecture, CFG) == "prix"
    assert lecture["telephone"] == "034 45 548 19"


# ── Les lignes du corpus ───────────────────────────────────────────────────
def test_les_blocs_se_lisent_dans_n_importe_quel_ordre():
    texte = ("Disponible parpaing 20x20x40\n20x20x40:3200ar(+2000 stock dispo)\n"
             "15x20x40:2700ar(+600 stock dispo)\n10x20x40:2200ar(+500 stock dispo)")
    lues = [o for o in extraction.offres(texte, CFG) if o["prix"]]
    assert [(o["materiau_slug"], o["prix"]) for o in lues] == [
        ("parpaing-creux-20", 3200), ("parpaing-creux-15", 2700), ("parpaing-creux-10", 2200)]
    assert all(o["certitude"] >= 95 for o in lues)


def test_les_hourdis_tc_par_leur_cote():
    texte = ("HOURDIS : (12*33*33) , (15*33*33) , (20*33*33) cm\n"
             "20x33x33 : 3400ar/pièce\n15x33x33 : 2800ar/pièce\n12x33x33 : 2500ar/pièce")
    lues = [o for o in extraction.offres(texte, CFG) if o["prix"]]
    assert [o["materiau_slug"] for o in lues] == ["hourdis-tc-20", "hourdis-tc-15", "hourdis-tc-12"]


def test_une_cote_partagee_se_tranche_par_les_mots():
    """22 × 11 × 6 : brique repressée ET brique cuite pleine. Le mot décide."""
    lues = extraction.offres("Brique repressée (6x11x22) : 2200 Ar/pcs , 42 pcs/m²", CFG)
    assert lues[0]["materiau_slug"] == "brique-repressee-6x11x22"
    assert lues[0]["unite"] == "piece" and lues[0]["prix"] == 2200


def test_le_bois_scie_par_sa_section():
    texte = ("#MADRIER 4m : (KININIA MENA BE)\n✓ 15cmx7cmx4m= 35 000ar\n"
             "✓ 17cmx7cmx4m = 38 000ar\n✓ 14cmx6cmx5m = 45 000ar")
    lues = [o for o in extraction.offres(texte, CFG) if o["prix"]]
    assert [o["materiau_slug"] for o in lues] == [
        "madrier-70x150-4m", "madrier-70x170-4m", "madrier-60x140-5m"]


def test_un_diametre_inconnu_remonte_comme_reference_a_creer():
    lues = extraction.offres("Fer 20 : 120 000 Ar la barre", CFG)
    assert lues[0]["type_slug"] == "fer-a-beton" and lues[0]["materiau_slug"] is None
    assert lues[0]["cote_lue"] == {"genre": "diametre", "valeur": 20}


def test_un_calibre_inconnu_remonte_comme_reference_a_creer():
    lues = extraction.offres("Gravillon 10/20 : 70 000 Ar/m3", CFG)
    assert lues[0]["cote_lue"] == {"genre": "calibre", "valeur": (10.0, 20.0)}
    assert lues[0]["unite"] == "m3"


def test_un_lot_se_ramene_a_l_unite():
    """« 560 000 Ar 8m3 livré » = 70 000 Ar le m³ — c'est de l'arithmétique.
    Le 03/09/2026 cette ligne avait fait naître « Gravillon et cailloux
    2 x 3 cm, 8 m » au catalogue : un gravillon n'a pas de section."""
    lues = extraction.offres("2/ Gravillon : 560 000 Ar 8m3 livré", CFG)
    assert lues[0]["prix"] == 70_000 and lues[0]["unite"] == "m3"
    assert lues[0]["type_slug"] == "gravillon" and lues[0]["materiau_slug"] is None
    assert lues[0]["cote_lue"] is None
    lues = extraction.offres("Fasika 1 camion 8m3 : 320 000 Ar", CFG)
    assert lues[0]["prix"] == 40_000 and lues[0]["unite"] == "m3"
    # Déjà écrit par unité : rien ne se divise.
    lues = extraction.offres("Gravillon 5/15 camion 8m3 : 75 000 Ar/m³", CFG)
    assert lues[0]["prix"] == 75_000 and lues[0]["unite"] == "m3"
    assert extraction.quantite_vendue("Béton 350 : 450 000 Ar/m3") is None
    assert extraction.quantite_vendue("1 camion 8m3 dia 6m3 : 320 000 Ar") is None   # deux lots


def test_le_gravillon_n_a_pas_de_section():
    assert referentiel.reference_a_creer("gravillon", "2 x 3 cm, 8 m")["possible"] is False
    assert referentiel.reference_a_creer("madrier", "15cmx7cmx4m")["possible"] in (True, False)


def test_l_unite_apres_le_prix_prime():
    assert extraction.unite_apres_prix("Épaisseur 0,30 → 17.500 Ar/m") == "ml"
    assert extraction.unite_apres_prix("Moellon lehibe 700ar/pcs") == "piece"
    assert extraction.unite_apres_prix("PRIX: 70 000Ar par m2") == "m2"
    assert extraction.unite_apres_prix("3 500 Ar/pc") == "piece"
    assert extraction.unite_apres_prix("30 000ariary m3") == "m3"
    assert extraction.unite_apres_prix("1500ar / unité") == "piece"
    assert extraction.unite_apres_prix("Fasika 30 000 Ar") is None


# ── La porte ───────────────────────────────────────────────────────────────
def test_un_depot_serieux_sans_prix_entre_dans_la_liste_d_appels():
    lecture = {"offres": [{"type_slug": "sable"}, {"type_slug": "gravillon"},
                          {"type_slug": "parpaing-creux"}], "vehicules": []}
    assert collecteur.admission(lecture, CFG) == "serieux"
    lecture["offres"] = lecture["offres"][:2]
    assert collecteur.admission(lecture, CFG) == "refuse"


def test_un_transporteur_entre_sans_prix_materiau():
    assert collecteur.admission({"offres": [], "vehicules": [{"nom": "benne"}]}, CFG) == "transport"


def test_la_page_d_un_depot_devient_une_adresse_a_suivre():
    assert collecteur.url_de_suivi("https://www.facebook.com/GuideConstructionMada?__cft__[0]=x") \
        == "https://www.facebook.com/guideconstructionmada"
    assert collecteur.url_de_suivi("https://www.facebook.com/groups/1/user/61577268412763/") \
        == "https://www.facebook.com/profile.php?id=61577268412763"
    assert collecteur.url_de_suivi("https://www.facebook.com/groups/590432639702255/") == ""
