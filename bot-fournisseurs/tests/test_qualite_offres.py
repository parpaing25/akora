"""Les deux revues de qualité, et les cas réels qui les ont fait naître.

Le 01/09/2026, en préparant la publication des quatre premiers dépôts créés
par le bot, la revue des 278 offres retenues a montré que **30 % n'étaient pas
des matériaux** : 20 terrains à vendre (« TANY MORA BE… 70 000 Ar par m² »
rangés en brique de terre comprimée), 17 tableaux blancs (« Certains modèles
avec bordure noire › 90×120 cm » rangés en bordure de trottoir), 6 tuyaux
souples devenus des buses béton, 5 annonces d'un essayeur d'or devenues du
gravillon, 9 annonces en FCFA venues d'Afrique de l'Ouest.

Et deux offres, déjà appariées et prêtes à devenir des produits, portaient un
prix venu d'une AUTRE ligne que leur libellé — dont une planche de coffrage à
28 000 Ar quand le dépôt les vend 4 700.

    python -m pytest tests/test_qualite_offres.py -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from outils import hors_perimetre, prix_orphelins  # noqa: E402


def _offre(oid, libelle, prix=None, slug=None):
    return {"id": oid, "libelle_brut": libelle, "prix": prix,
            "materiau_slug": slug, "prospect_nom": "Dépôt", "garder": 1}


# ── Hors périmètre ─────────────────────────────────────────────────────────
@pytest.mark.parametrize("libelle, motif", [
    ("TANY MORA BE AMBOANJOBE MIALA 6MINUTE RN7 › PRIX: 70 000Ar par m2", "terrain"),
    ("Terrain de 500 M2 (7 lots disponibles) en bordure de route", "terrain"),
    ("Certains modèles avec bordure noire › 90×120 cm : 125.000 Ar", "bureau"),
    ("Tableau blanc double face Blanc / Vert – bordure noire", "bureau"),
    ("Boulon mécanique, tige filetée, écrou, clous,", "quincaillerie"),
    ("Tuyau souple be sady maivana › 15 mètres : 30 000Ar", "plomberie"),
    ("Placo Platre Plaquiste Lovasoa", "service"),
    ("Mpanefy na misera volamena, volafotsy, vato sns", "service"),
    ("Barre de FER 10 A prix 4800f unité", "devise"),
    ("PRIX : 110.000 FCFA / M2 ( PRIX PLANCHÉ)", "devise"),
    ("Grillage ST galva ( Fotsy › Prix :260.000ar", "reference_absente"),
])
def test_ce_qui_doit_sortir(monkeypatch, libelle, motif):
    monkeypatch.setattr(hors_perimetre.base, "offres_gardees_vivantes",
                        lambda: [_offre(1, libelle)])
    trouvees = hors_perimetre.candidats()
    assert len(trouvees) == 1, f"non détecté : {libelle}"
    assert trouvees[0]["motif"] == motif


@pytest.mark.parametrize("libelle", [
    # Du vrai gros œuvre : rien de tout cela ne doit sortir.
    "Parpaing agglo › 10x20x40:2200ar",
    "Fasika 45.000ar/m³(gros,myenne,fin)",
    "#CHEVRON  4m = 9 000ar",
    "(5isa)FER 10 TURKEY (25000ar ny iray)",
    "Biriky 120ar/pcs(biriky tanimanga ankadivoribe)",
    "Gravillon :60000ar/m³",
    "#MADRIER 4m › ✓ 15cmx7cmx4m = 35 000ar",
    "Hourdis 20x33x33 : 3 400 Ar",
    # « tanimanga » contient « tany » : le motif terrain ne doit pas mordre.
    "Biriky Tanimanga mafy Tsara avy ety ankadivoribe",
])
def test_ce_qui_doit_rester(monkeypatch, libelle):
    monkeypatch.setattr(hors_perimetre.base, "offres_gardees_vivantes",
                        lambda: [_offre(1, libelle)])
    assert hors_perimetre.candidats() == [], f"écarté à tort : {libelle}"


# ── Prix orphelins ─────────────────────────────────────────────────────────
def test_le_prix_qui_vient_d_une_autre_ligne_est_vu(monkeypatch):
    """Les deux cas réels du 01/09/2026, et eux seuls."""
    monkeypatch.setattr(prix_orphelins.base, "offres_gardees_vivantes", lambda: [
        # Le dépôt écrit « lehibe 700 » et « ordinaire 550 » : le bot a gardé
        # le libellé du premier avec le prix du second.
        _offre(224, "Moellon lehibe 700ar/pcs", 550, "moellon"),
        # « #planche de rive 4m = 28 000 ar », collé à l'en-tête coffrage.
        _offre(406, "#PLANCHE coffrage 4m :(KALITAO TSARA)", 28000,
               "planche-30x200-4m"),
    ])
    vues = prix_orphelins.orphelines()
    assert {o["id"] for o in vues} == {224, 406}


@pytest.mark.parametrize("libelle, prix", [
    ("Fasika 45.000ar/m³(gros,myenne,fin)", 45000),   # séparateur point
    ("✓ 10cmx1,5cmx4m = 4 700 ar", 4700),             # espace dans le montant
    ("#CHEVRON  4m = 9 000ar", 9000),
    ("Biriky 120ar/pcs", 120),
    ("Gravillon :60000ar/m³", 60000),
])
def test_un_prix_ecrit_dans_son_libelle_ne_bouge_pas(monkeypatch, libelle, prix):
    monkeypatch.setattr(prix_orphelins.base, "offres_gardees_vivantes",
                        lambda: [_offre(1, libelle, prix)])
    assert prix_orphelins.orphelines() == [], f"faux positif : {libelle}"


def test_une_offre_sans_prix_n_est_pas_concernee(monkeypatch):
    monkeypatch.setattr(prix_orphelins.base, "offres_gardees_vivantes",
                        lambda: [_offre(1, "Moellon", None)])
    assert prix_orphelins.orphelines() == []
