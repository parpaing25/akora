"""Garde-fous sur la lecture des prix et sur ce qui n'est PAS une offre.

Chaque texte de ce fichier est un libellé RÉELLEMENT collecté, recopié depuis
`data/bot.db` avec son numéro d'offre ou l'identifiant de sa publication. Aucun
n'a été inventé — même règle que `tests/test_referentiel.py` : une orthographe
imaginée à la table produit un test qui passe et un bot qui rate.

Ce qui se joue ici : un prix faux se PUBLIE. Il devient un produit sur
akora.fonenako.mg, puis une ligne de l'observatoire des prix, puis une phrase du
bulletin public signé Akora. Un prix manquant, lui, se rattrape à la collecte
suivante. C'est pourquoi ces tests vérifient autant ce qui doit être LU que ce
qui doit être REFUSÉ.

    python -m pytest tests/test_extraction_offres.py -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import extraction, referentiel  # noqa: E402
from bot.config import CACHE_REFERENTIEL  # noqa: E402

CFG = {"prix_plancher_ar": 200, "prix_plancher_unitaire_ar": 50,
       "prix_plafond_ar": 50_000_000, "taux_fmg_ar": 5}


@pytest.fixture(scope="module", autouse=True)
def catalogue():
    """Le catalogue vient du CACHE DISQUE : aucun test ne touche le réseau."""
    if not CACHE_REFERENTIEL.exists():
        pytest.skip("Catalogue absent — Réglages › Synchroniser le référentiel.")
    return referentiel.charger()


def prix(ligne):
    return extraction.prix_dans(ligne, CFG)[0]


# ── Ce qu'un prix doit valoir ──────────────────────────────────────────────
def test_le_point_est_un_separateur_de_milliers():
    """« 75.000ar » n'est pas 75 ariary — offres #42 et #43."""
    assert prix("Gravillon 75.000ar/m³(moyenne)") == 75_000
    assert prix("Fasika 45.000ar/m³(gros,myenne,fin)") == 45_000


def test_la_devise_collee_au_nombre():
    """« 700ar/pcs » (#44), « 3500ar pièce iray » (publication 54163a22)."""
    assert prix("Moellon lehibe 700ar/pcs") == 700
    assert prix("Moellon ordinaire 550ar/pcs") == 550
    assert prix("3500ar pièce iray") == 3_500


def test_le_prix_en_fin_de_ligne():
    """La forme la plus courante : le libellé, puis le montant (#47, #144)."""
    assert prix("planche coffrage 4m 4500 ar livré gratuit "
                "raha miotran'ny 300 isa") == 4_500
    assert prix("Planche 2eme choix 4000ar") == 4_000
    assert prix("#CHEVRON  4m = 9 000ar") == 9_000


def test_la_brique_a_moins_de_200_ariary():
    """🔴 Trois vrais tarifs perdus par le plancher unique à 200 Ar.

    Deux causes empilées, et il fallait lever les deux : le motif de montant
    exigeait TROIS chiffres (80 et 90 étaient invisibles), et le plancher
    refusait tout ce qui était sous 200 Ar. Une brique se vend 80 Ar la pièce.
    """
    assert prix("Biriky masaka :90ar/pièce") == 90                    # #124
    assert prix("Biriky 120ar/pcs(biriky tanimanga ankadivoribe)") == 120   # #45
    assert prix("Efa Mora anie oa zao ny biriky e Biriky Tanimanga mafy "
                "Tsara avy ety ankadivoribe 80ar ny iray ety ampotony") == 80  # #23


def test_le_plancher_haut_tient_hors_du_prix_a_la_piece():
    """Le plancher bas ne vaut QUE pour un prix à la pièce.

    Sans cette condition, « 100 Ar » posé n'importe où deviendrait un tarif de
    mètre cube. La ligne #52 (« Refiny trano miaraka tany 100ar », une vente de
    maison) n'annonce aucune unité : elle reste sous le plancher de 200 Ar.
    """
    assert prix("Refiny trano miaraka tany 100ar") is None


def test_le_fmg_est_converti():
    """Le taux vit dans la configuration, pas dans le code."""
    assert prix("vidiny 1 750 000 Fmg") == 350_000


# ── Ce qui ne doit JAMAIS devenir un prix ──────────────────────────────────
def test_un_numero_de_telephone_n_est_pas_un_prix():
    """Le garde-fou historique : il ne doit pas bouger."""
    assert prix("Contact : 034 43 484 95  n'a mp.....") is None
    assert prix("0341247656/0347150095") is None


def test_un_nombre_sans_devise_n_est_pas_un_prix():
    """🔴 Le chemin du « nombre nu » produisait 8 prix, tous faux.

    Une année (#164), le code postal d'un vendeur français (#129), le rang d'un
    commentaire (#40), un pourcentage (#33), un seuil de livraison gratuite. On
    n'a pas resserré la liste de mots : on a retiré le chemin.
    """
    assert prix("Nanomboka ny 20 Aogositra 2026 ny asa fanarenana "
                "ny trano fidiovana") is None
    assert prix("CUVE EAU DE PLUIE BÉTON – HARNES 62440 | NOS PRIX SECTEUR") is None
    assert prix("Participant anonyme 591") is None
    assert prix("Livraison gratuite raha maka manomboka @ 400 ISA") is None
    assert prix("Prix : 6000 fixe") is None


def test_un_millier_abrege_n_est_pas_lu_de_travers():
    """« 800M fmg » = 800 MILLIONS de Fmg. Lire 800 serait pire que rien."""
    assert prix("prix 800M fmg a deb") is None


def test_une_dimension_n_est_pas_un_prix():
    """« 0,25 » d'épaisseur et « 0,80mm » ne sont pas des montants."""
    assert prix("Épaisseur 0,80mm") is None
    assert prix("Largeur :13cm") is None
    # …mais le montant de la même ligne, si (publication 231c557e).
    assert prix("0,25. 13000 ar/M") == 13_000


# ── Ce qui n'est pas une offre du tout ─────────────────────────────────────
def test_le_remerciement_n_est_pas_une_offre():
    """La page remercie sa clientèle ; « TÔLE » est dans sa raison sociale."""
    assert extraction.raison_hors_offre(
        "Misaotra indrindra anareo mpanjifa izay mbola matoky sy misafidy "
        "an'i MORA TÔLE hatrany")                                       # #76
    assert extraction.raison_hors_offre(
        "AZA MISALASALA HAMETRAKA NY FAHATOKISANAO ETO AMIN'NY MORA TÔLE!")  # #77


def test_la_cote_de_batiment_n_est_pas_une_offre():
    """« 14m sur 6m » est un métré demandé, pas un tarif (#5, #40)."""
    assert extraction.raison_hors_offre(
        "Raha tranon'akoho 14m sur 6m mety malany biriky firy sy tôle "
        "firy eo ho eo ?") is not None
    # ⚠ Une cote AVEC un prix reste une offre : un panneau de bararata se vend
    # bien au format (publication 3cb94f36).
    assert extraction.raison_hors_offre("1mx2m : 7000 ar", a_un_prix=True) is None


def test_la_demande_d_acheteur_n_est_pas_une_offre():
    """« ohatrinona » = « combien ? » (#31), « iza … mitady » (#22)."""
    assert extraction.raison_hors_offre(
        "ohatrinona ny droit ny acte de vente eny @ commune raha tany 1are?"
    ) is not None
    assert extraction.raison_hors_offre(
        "Iza Ilay mitady mpamatsy Matériaux de construction"
    ) is not None


def test_mitady_seul_ne_condamne_pas_un_vendeur():
    """⚠ « Raha mitady tôle tsara » = « SI VOUS cherchez de la tôle » (#62).

    C'est une accroche de vendeur. Prendre « mitady » pour un mot d'acheteur
    ferait disparaître les meilleures annonces du corpus.

    Depuis le 02/09/2026, une phrase sans prix n'est plus une offre par
    elle-même — mais elle n'est pas une DEMANDE non plus : elle ouvre
    l'en-tête, et le tarif qui suit lui est rattaché.
    """
    accroche = "Raha mitady tôle tsara, matanjaka ary prix abordable, ity no fotoana!"
    assert extraction.raison_hors_offre(accroche) != "demande d'acheteur"
    lues = extraction.offres(accroche + "\n0,30 : 22 000 Ar/m", CFG)
    assert len(lues) == 1
    assert lues[0]["type_slug"] == "tole" and lues[0]["prix"] == 22_000


def test_le_mobilier_facebook_n_est_pas_une_offre():
    """Ramassé avec le texte quand le bot lit les commentaires (#40)."""
    assert extraction.raison_hors_offre("Participant anonyme 591") is not None
    assert extraction.raison_hors_offre("Voir la traduction") is not None


def test_l_adresse_electronique_n_est_pas_une_offre():
    """Héritée d'un en-tête « posse placo platre », elle valait 770 Ar."""
    assert extraction.raison_hors_offre(
        "MAIL rakotoarison770@gmail .com Voir moins") is not None


def test_l_article_de_presse_n_est_pas_une_offre():
    """Les groupes généralistes ramènent de la presse (#164, #167, #168)."""
    assert extraction.raison_hors_offre(
        "Toy izao ny hakanton’ny TSENA BAZARIKELY foto-drafitr’asa vita ao "
        "Antsiranana. Notokanan’ny Minisitra LYLYSON RENÉ DE ROLLAND ny asa"
    ) is not None


def test_le_libelle_court_reste_une_offre():
    """⚠ Le filtre ne doit pas manger les vraies lignes de stock."""
    for ligne in ("Gravillon", "FASIKA", "Faîtière", "Biriky tanimanga",
                  "Planche de coffrage", "GALVA BAC/ONDULÉS"):
        assert extraction.raison_hors_offre(ligne) is None, ligne


# ── Le piège du nom de page ────────────────────────────────────────────────
PUB_MORA_TOLE = """NY TANJONAY DIA NY HAHAFA_PO ANAREO HATRANY!
GALVABAC 0.30 PROMOTION BE: 18.000Ar/m
Kalitao tsara sy azo antoka no atolotray,
MORA TÔLE
KALITAO AZO ANTOKA, VIDINY MIRARY!
TOERANA AHITANA ANAY :
Usine Mora Tôle — alohan’i Yandy By Pass
Magasin Ankadimbahoaka — alohan’i Galana
GASY MIFANOHANA!"""


def test_le_nom_de_page_qui_contient_un_materiau():
    """🔴 « MORA TÔLE » produisait une offre de tôle par phrase de publicité.

    Publication ce7903f4 : le mot « tôle » n'est pas dans la phrase, il est dans
    la raison sociale. La marque se reconnaît à sa répétition.
    """
    marques = extraction.marques_de_page(PUB_MORA_TOLE)
    assert "mora tole" in marques
    assert extraction.raison_hors_offre(
        "Usine Mora Tôle — alohan’i Yandy By Pass", marques=marques) == "nom de page"


def test_l_ordre_du_couple_protege_les_vrais_materiaux():
    """⚠ « fer turkey » (#140) et « biriky fotsy » (#119) sont des matériaux.

    Ils ont leur mot inconnu APRÈS le matériau, là où une enseigne le porte
    devant. Sans cette condition, le filtre mangerait deux vrais stocks.
    """
    texte = "FER TURKEY disponible\nfer turkey arrivage\nBiriky fotsy\nbiriky fotsy"
    marques = extraction.marques_de_page(texte)
    assert "fer turkey" not in marques
    assert "biriky fotsy" not in marques


# ── L'en-tête porte le matériau, la ligne porte le prix ────────────────────
PUB_ALUZINC = """TONGA NDRAY NY ARRIVAGE
ALU ZINC
-014 : 8 500 Ar
-018 : 10 500 Ar
-020 : 12 000 Ar
-025 : 13 000 Ar"""

PUB_BOIS = """#PLANCHE coffrage 4m :(KALITAO TSARA)
✓ 10cmx1,5cmx4m = 4 700 ar...
✓ 12cmx1, 5cmx4m = 5 300 ar...
#MADRIER 4m (#KALITAO tsy mihova) #mena/#mahitsy
✓ 10cmx6cmx4m = 25 000ar
✓ 15cmx7cmx4m = 35 000ar"""


def test_l_en_tete_donne_son_materiau_aux_lignes_chiffrees():
    """⭐ 110 lignes du corpus portaient un prix qu'aucun matériau ne réclamait.

    Publication 6c35578b : « ALU ZINC » nomme le matériau, les lignes qui
    suivent portent l'épaisseur et le prix. Chacune est une offre.
    """
    lues = extraction.offres(PUB_ALUZINC, CFG)
    montants = sorted(o["prix"] for o in lues if o["prix"])
    assert montants == [8_500, 10_500, 12_000, 13_000]
    assert all(o["type_slug"] == "tole" for o in lues)


def test_l_en_tete_ne_transmet_JAMAIS_un_format():
    """🔴 Le point le plus dangereux du mécanisme.

    `apparier("ALU ZINC 014 : 8 500 Ar")` répond `bac-aluzinc-045-6m` : une tôle
    de 0,45 mm — que le même dépôt affiche à 24 000 Ar six lignes plus bas —
    étiquetée à 8 500 Ar. Le catalogue Akora connaît quatre formats de tôle, les
    vendeurs en listent seize. Une offre héritée reste au TYPE, `ambigu`, et
    l'interface demande la référence.
    """
    heritees = [o for o in extraction.offres(PUB_ALUZINC, CFG) if "›" in o["libelle_brut"]]
    assert heritees
    for offre in heritees:
        assert offre["materiau_slug"] is None
        assert offre["ambigu"] == 1


def test_le_libelle_herite_garde_son_en_tete():
    """« -014 : 8 500 Ar » seul ne veut rien dire dans la liste d'Andry."""
    lues = extraction.offres(PUB_ALUZINC, CFG)
    assert any(o["libelle_brut"].startswith("ALU ZINC ›") for o in lues)


def test_chaque_prix_de_la_liste_devient_une_offre():
    """Sans le prix dans l'empreinte, seize épaisseurs faisaient UNE offre."""
    montants = sorted(o["prix"] for o in extraction.offres(PUB_BOIS, CFG) if o["prix"])
    assert montants == [4_700, 5_300, 25_000, 35_000]


def test_le_format_dementi_par_la_ligne_retombe_au_type():
    """🔴 « GALVABAC 0.30 » n'est pas le `bac-galva-040-4m` du catalogue.

    L'appariement se fait sur le mot, le vendeur écrit le chiffre, et le
    catalogue n'a qu'un bac galvanisé — en 0,40 mm. 18 000 Ar/m est le prix du
    0,30. Publié sous la référence du 0,40, c'est un prix faux signé Akora.
    """
    lues = [o for o in extraction.offres(PUB_MORA_TOLE, CFG) if o["prix"] == 18_000]
    assert lues, "la ligne chiffrée doit rester une offre"
    assert lues[0]["materiau_slug"] is None
    assert lues[0]["type_slug"] == "tole"


def test_le_repli_en_prose_ne_porte_jamais_de_prix():
    """🔴 Les 4 prix que ce repli a produits sur le corpus étaient faux.

    Lire un montant sur un texte ENTIER, c'est ne pas savoir à quel matériau il
    se rapporte. Le repli sert à garder le prospect, pas à deviner son tarif.
    """
    # Publication 304cd5a6, offre #31 : la seule ligne est une question
    # d'acheteur, donc écartée ; le repli s'applique au texte entier et lui
    # donnait « 3 000 Ar » — le prix que l'acheteur DEMANDAIT de confirmer.
    prose = ("ohatrinona ny droit ny acte de vente eny @ commune raha tany "
             "1are? marina ve hoe 3000Ar ny m² ?")
    lues = extraction.offres(prose, CFG)
    assert lues and lues[0]["prix"] is None
