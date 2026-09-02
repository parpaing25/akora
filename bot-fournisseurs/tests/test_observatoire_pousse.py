# -*- coding: utf-8 -*-
"""Les trois gardes de l'observatoire — chacun rejoue son incident réel."""
from bot.observatoire_pousse import empreinte_depot, preparer

CATALOGUE = {
    "bordure-p1": ("ref-bordure", "ml"),
    "planche-15x10-4m": ("ref-planche", "piece"),
    "sable-fin": ("ref-sable", "m3"),
}
LOCALITES = {"antananarivo": "loc-tana"}


def offre(**champs):
    base = {
        "id": 1, "materiau_slug": "planche-15x10-4m", "prix": 4700,
        "unite": "piece", "libelle_brut": "Planche 4 700 ar",
        "devise_source": "Ar", "publie_le": "2026-09-01", "vu_le": "2026-09-01",
        "telephone_cle": "261340000000", "cle": "k", "quartier": None,
        "ville": "Antananarivo",
    }
    base.update(champs)
    return base


def test_le_cas_nominal_passe_et_porte_son_empreinte():
    tri = preparer([offre()], CATALOGUE, LOCALITES, {})
    assert len(tri["valeurs"]) == 1
    ref_id, lieu, prix, unite, emp, date = tri["valeurs"][0]
    assert (ref_id, lieu, prix, unite, date) == ("ref-planche", "loc-tana", 4700, "piece", "2026-09-01")
    assert emp == empreinte_depot("261340000000", "k")
    assert "261340000000" not in emp  # jamais le numéro en clair


def test_garde_1_prix_orphelin():
    # La planche à 28 000 au lieu de 4 700 (pairage cassé, 01/09).
    tri = preparer([offre(prix=28000)], CATALOGUE, LOCALITES, {})
    assert tri["valeurs"] == [] and tri["ecartees"]["prix_orphelin"] == 1


def test_garde_2_unite_contraire_et_devise():
    tri = preparer(
        [offre(unite="sac"), offre(devise_source="Fcfa")],
        CATALOGUE, LOCALITES, {},
    )
    assert tri["valeurs"] == []
    assert tri["ecartees"]["unite"] == 1 and tri["ecartees"]["devise"] == 1


def test_garde_3_la_bordure_a_120000_part_en_a_confirmer():
    # L'incident du 01/09 : planche appariée en bordure P1, médiane connue ~2100.
    bordure = offre(
        materiau_slug="bordure-p1", prix=120000, unite="ml",
        libelle_brut="Épaisseur bois 1, 4 cm misy bordure eo aloha prix 120.000 ar",
    )
    tri = preparer([bordure], CATALOGUE, LOCALITES, {"ref-bordure": (2100, 3)})
    assert tri["valeurs"] == []
    assert len(tri["a_confirmer"]) == 1
    assert "médiane" in tri["a_confirmer"][0]["raison"]


def test_garde_3_muet_sous_deux_depots():
    # Une médiane bâtie sur UN dépôt ne vaut pas référence : on pousse.
    bordure = offre(
        materiau_slug="bordure-p1", prix=120000, unite="ml",
        libelle_brut="bordure 120.000 ar",
    )
    tri = preparer([bordure], CATALOGUE, LOCALITES, {"ref-bordure": (2100, 1)})
    assert len(tri["valeurs"]) == 1 and tri["a_confirmer"] == []


def test_unite_inconnue_passe_prix_bas_vraisemblable_aussi():
    # Unité absente = on n'affirme rien (la RPC du site filtrera) ; et un
    # écart SOUS la médiane se contrôle comme un écart au-dessus.
    sable_cher = offre(
        materiau_slug="sable-fin", prix=200000, unite=None,
        libelle_brut="fasika 200.000 ar",
    )
    tri = preparer([sable_cher], CATALOGUE, LOCALITES, {"ref-sable": (45000, 4)})
    assert tri["a_confirmer"] and tri["valeurs"] == []
