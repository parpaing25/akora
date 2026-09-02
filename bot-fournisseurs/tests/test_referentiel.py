"""Garde-fous sur l'appariement d'un libellé au catalogue Akora.

Chaque texte de ce fichier est un libellé RÉELLEMENT collecté, recopié depuis
`data/bot.db` avec son numéro d'offre. Aucun n'a été inventé : une orthographe
imaginée à la table produit un test qui passe et un bot qui rate.

Ce qui se joue ici n'est pas cosmétique. Sur Akora, un produit sans
`materiau_ref_id` ne peut jamais passer en `actif` — une offre non appariée
n'est pas une offre. Et un produit MAL apparié est pire : il entre dans
l'observatoire des prix, et l'observatoire alimente le bulletin PUBLIC.

    python -m pytest tests/test_referentiel.py -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import referentiel  # noqa: E402
from bot.config import CACHE_REFERENTIEL  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def catalogue():
    """Le catalogue vient du CACHE DISQUE : aucun test ne touche le réseau.

    Sans cache, il n'y a rien à apparier — mieux vaut le dire que faire
    échouer vingt tests sur la même cause.
    """
    if not CACHE_REFERENTIEL.exists():
        pytest.skip("Catalogue absent — Réglages › Synchroniser le référentiel.")
    return referentiel.charger()


def slug(texte, prix=None):
    resultat = referentiel.apparier(texte, prix)
    return (resultat or {}).get("materiau_slug")


def type_slug(texte, prix=None):
    resultat = referentiel.apparier(texte, prix)
    return (resultat or {}).get("type_slug")


# ── Ce que le module promet dans son en-tête ───────────────────────────────
def test_les_exemples_de_la_docstring_tiennent_toujours():
    """La garantie de base : ces quatre-là ne doivent jamais régresser."""
    assert slug("Parpaing 15 : 1 400 Ar", {"1", "400"}) == "parpaing-creux-15"
    assert type_slug("Biriky 1300 ar", {"1300"}) == "parpaing-creux"
    assert slug("Biriky 1300 ar", {"1300"}) is None      # quel format ?
    assert type_slug("Fasika 90 000 le m3", {"90", "000"}) == "sable"
    assert slug("Fer 8 : 22 000 la barre", {"22", "000"}) == "fer-beton-8"


# ── Fers à béton : les six écritures du ferrailleur ────────────────────────
# Aucune offre de fer dans le corpus collecté à ce jour — ces cas viennent donc
# de la manière dont un dépôt écrit son stock, pas de la base. C'est assumé et
# c'est la seule famille dans ce cas : le calibre est la SEULE chose qui
# distingue les six fers du catalogue, sans lui l'offre est inutilisable.
@pytest.mark.parametrize("texte, attendu", [
    ("BA 8", "fer-beton-8"),
    ("BA8 disponible", "fer-beton-8"),
    ("HA 10", "fer-beton-10"),
    ("T12", "fer-beton-12"),
    ("fer 8", "fer-beton-8"),
    ("fer de 12", "fer-beton-12"),
    ("fer à béton 16", "fer-beton-16"),
    ("rond 8", "fer-beton-8"),
    ("rond à béton 10", "fer-beton-10"),
    ("fer tor 10", "fer-beton-10"),
    ("Ø8 barre de 12 m", "fer-beton-8"),
    ("vy 6 misy ao", "fer-beton-6"),
])
def test_les_ecritures_du_fer_a_beton(texte, attendu):
    assert slug(texte) == attendu


def test_un_diametre_absent_du_catalogue_ne_sarrondit_pas():
    """« fer 9 » n'existe pas. L'arrondir au 8 ferait vendre du 8 pour du 9."""
    assert slug("fer 9") is None
    assert type_slug("fer 9") == "fer-a-beton"
    assert slug("BA 20") is None


def test_les_hectares_ne_sont_pas_des_fers():
    """« ha » est le code du fer à haute adhérence ET l'hectare.

    Ce corpus est plein d'annonces de terrain (offres #20, #31, #67) : le code
    court ne se lit pas quand la ligne parle de tany.
    """
    assert type_slug("Tany 59 ares") != "fer-a-beton"
    assert slug("tany 10 ha amidy eto Antsirabe") is None


# ── Orthographes réellement rencontrées ────────────────────────────────────
def test_galvabac_colle_en_un_mot():
    """Offre #15 — « GALVABAC » écrit d'un bloc par MORA TÔLE.

    Sans la coupure, ni « galva » ni « bac » n'existent dans la ligne : le mot
    entier ne ressemble à rien du catalogue, et l'offre restait au type.
    """
    texte = "TÔLE GALVABAC GRIS — ÉLÉGANCE & SOLIDITÉ POUR VOTRE TOITURE !"
    assert slug(texte) == "bac-galva-040-4m"


def test_aluzinc_ecrit_en_un_mot_ou_deux():
    """Offre #72 — le catalogue écrit « alu-zinc », les vendeurs « ALUZINC »."""
    texte = ("Nous avons le plaisir de vous annoncer le nouvel arrivage de nos "
             "TÔLES ALUZINC PRÉLAQUÉES chez MORA TÔLE !")
    assert slug(texte) == "bac-aluzinc-045-6m"
    assert slug("TOLE ALU ZINC BAC SY ONDUILLE") == "bac-aluzinc-045-6m"


def test_les_quatre_graphies_de_la_tole_ondulee():
    """« ONDUILLE » (#65), « ONDUILÉ » (#98), « ONDULÉS » (#38) — un seul mot."""
    for graphie in ("ondulée", "ondulés", "onduillé", "onduile", "ONDUILLE"):
        assert referentiel.normaliser(f"tôle {graphie}").endswith("ondulee")


def test_biriky_masaka_est_une_brique_cuite():
    """Offre #124 — « masaka » veut dire CUITE.

    « biriky » seul part sur le parpaing, premier de sa famille. Avec
    « masaka », c'est de la terre cuite : un contresens sur la matière, donc
    sur le prix et sur la famille affichée.
    """
    assert type_slug("Biriky masaka :90ar/pièce", {"90"}) == "brique-creuse"


def test_les_synonymes_releves_dans_les_publications():
    """« caillasse » (#83) et « vatokely » (#37) désignent le gravillon."""
    assert type_slug("caillasse disponible") == "gravillon"
    assert type_slug("BRIQUE volom-bary , FASIKA , GRAVILLONS , CAYLLASSE") is not None
    assert type_slug("izahay dia manana vatokely ho anizay mitady") == "gravillon"


def test_une_faute_de_frappe_reste_lisible():
    """La tolérance ne joue qu'en dernier recours, et seulement sur les mots longs."""
    assert type_slug("gravilon disponible") == "gravillon"
    assert type_slug("contreplaqe 10 mm") == "contreplaque"
    # Trop court pour qu'une lettre de différence veuille dire quelque chose.
    assert type_slug("vita") is None


# ── Ce qui RESSEMBLE à un matériau et n'en est pas ─────────────────────────
def test_un_rond_point_nest_pas_du_fer_a_beton():
    """Offre #3 — « rond » est un synonyme de fer à béton au catalogue."""
    assert type_slug("Ambohimangakely Rond-Point") != "fer-a-beton"


def test_les_outils_de_chantier_ne_sont_pas_du_beton():
    """Offres #103 et #111 — un perforateur et un vibreur se LOUENT."""
    assert type_slug("1 Pérforateur béton") != "beton-pret-emploi"
    assert type_slug("Vibreur à béton disponible location vente") != "beton-pret-emploi"
    assert type_slug("résine époxy , béton ciré") != "beton-pret-emploi"


def test_la_soudure_et_linox_ne_sont_pas_des_armatures():
    """Offres #102 et #108 — « acier » ouvre le fer à béton, à tort ici."""
    assert type_slug("Rouleau  MIG Acier") != "fer-a-beton"
    assert type_slug("Acier inoxydable") != "fer-a-beton"


def test_une_television_nentre_pas_dans_lobservatoire_des_prix():
    """Offre #109 — le pire cas trouvé, et il était PUBLIABLE.

    « > 32" sans bordure : 410.000 ar » partait en bordure de trottoir T2 à
    410 000 Ar le mètre linéaire. L'observatoire médiane par matériau, et c'est
    lui qui alimente le bulletin public signé Akora.
    """
    texte = '>32"+sans+bordure+:+410.000ar+ou+2M+50fmg'
    assert slug(texte, {"410", "000"}) is None
    assert type_slug(texte, {"410", "000"}) != "bordure"


# ── Les cotes d'un bâtiment ne sont pas des formats ────────────────────────
def test_les_dimensions_dune_maison_ne_font_pas_une_tole():
    """Offres #5 et #40 — deux ACHETEURS qui décrivent leur chantier.

    « 14m sur 6m » : le 6 tombait sur la longueur du bac alu-zinc, et une
    question devenait une offre.
    """
    question = ("Raha tranon'akoho 14m sur 6m mety malany biriky firy sy "
                "tôle firy eo ho eo ?")
    assert slug(question) is None
    assert slug("12m sur 8 nenay ao fa mitafo tôle, efa niditra +40millions d'ariary") is None


def test_un_montant_en_millions_nest_pas_une_epaisseur():
    """« +40millions d'ariary » (#40) donnait un 40 — l'épaisseur du bac galva."""
    assert "40" not in referentiel._nombres_de_format(
        referentiel.normaliser("efa niditra +40millions d'ariary"), set()
    )


def test_une_vraie_dimension_de_bloc_survit():
    """Le « x » n'est pas dans la liste des cotes : l'étape 1 en dépend."""
    assert slug("Parpaing 40x20x15 : 1400 Ar", {"1400"}) == "parpaing-creux-15"


# ── Ne pas trancher au hasard ──────────────────────────────────────────────
def test_une_ligne_qui_cite_deux_formats_reste_au_type():
    """Offres #38 et #66 — « GALVA BAC/ONDULÉS » vend les deux.

    Choisir le premier de la liste revenait à tirer au sort. L'offre garde son
    type, et l'interface demande le format en un clic.
    """
    assert slug("GALVA BAC/ONDULÉS") is None
    assert type_slug("GALVA BAC/ONDULÉS") == "tole"
    assert slug("#TOLE_GALVA_BAC_SY_ONDULÉE_MiLOKO") is None


def test_un_bac_sans_autre_precision_reste_au_type():
    """Offre #73 — « BAC » tout court : galvanisé ou alu-zinc, on ne sait pas."""
    assert slug("BAC") is None
    assert type_slug("BAC") == "tole"


def test_le_repli_par_ressemblance_ne_fabrique_plus_de_laterite():
    """Offres #26 et #55 — « Planéité » (0,75) et « terte » (0,77) passaient.

    Sur tout le corpus collecté, ce repli n'a jamais rattrapé une vraie offre :
    il n'a produit que ces deux-là.
    """
    assert slug("Planéité") is None
    assert slug("terte") is None
