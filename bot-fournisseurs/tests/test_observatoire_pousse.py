# -*- coding: utf-8 -*-
"""Les trois gardes de l'observatoire — chacun rejoue son incident réel."""
from bot.observatoire_pousse import (
    empreinte_depot, fusionner_medianes, medianes_du_lot, preparer,
)

CATALOGUE = {
    "bordure-p1": ("ref-bordure", "ml"),
    "planche-15x10-4m": ("ref-planche", "piece"),
    "sable-fin": ("ref-sable", "m3"),
}
LOCALITES = {"antananarivo": "loc-tana"}


def offre(**champs):
    base = {
        # ⚠ Le libellé ÉCRIT son unité : depuis le 03/09/2026, c'est la
        #   condition pour entrer dans l'observatoire public (voir garde 2 bis).
        "id": 1, "materiau_slug": "planche-15x10-4m", "prix": 4700,
        "unite": "piece", "libelle_brut": "Planche 4 700 ar/pièce",
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
        libelle_brut="Épaisseur bois 1, 4 cm misy bordure eo aloha prix 120.000 ar/ml",
    )
    tri = preparer([bordure], CATALOGUE, LOCALITES, {"ref-bordure": (2100, 3)})
    assert tri["valeurs"] == []
    assert len(tri["a_confirmer"]) == 1
    assert "médiane" in tri["a_confirmer"][0]["raison"]
    # La ligne RÉELLE du 01/09 n'écrivait aucune unité : depuis le 03/09 elle
    # est arrêtée encore plus tôt, par le garde de l'unité.
    muette = offre(materiau_slug="bordure-p1", prix=120000, unite="ml",
                   libelle_brut="Épaisseur bois 1, 4 cm misy bordure prix 120.000 ar")
    tri = preparer([muette], CATALOGUE, LOCALITES, {"ref-bordure": (2100, 3)})
    assert tri["valeurs"] == [] and tri["ecartees"]["unite"] == 1


def test_garde_3_muet_sous_deux_depots():
    # Une médiane bâtie sur UN dépôt ne vaut pas référence : on pousse.
    bordure = offre(
        materiau_slug="bordure-p1", prix=120000, unite="ml",
        libelle_brut="bordure 120.000 ar/ml",
    )
    tri = preparer([bordure], CATALOGUE, LOCALITES, {"ref-bordure": (2100, 1)})
    assert len(tri["valeurs"]) == 1 and tri["a_confirmer"] == []


def test_un_ecart_sous_la_mediane_se_controle_aussi():
    sable_cher = offre(
        materiau_slug="sable-fin", prix=200000, unite="m3",
        libelle_brut="fasika 200.000 ar/m3",
    )
    tri = preparer([sable_cher], CATALOGUE, LOCALITES, {"ref-sable": (45000, 4)})
    assert tri["a_confirmer"] and tri["valeurs"] == []


def test_le_lot_porte_sa_propre_mediane():
    """🔴 03/09/2026, juste après la purge : l'observatoire était VIDE, donc le
    garde de vraisemblance n'avait rien à opposer, et trois parpaings à 300,
    350 et 400 Ar sont entrés dans la page publique — alors que le même
    passage à blanc, une minute plus tôt, les avait signalés. Le lot contient
    pourtant quatre dépôts qui annoncent le même parpaing autour de 3 400 Ar.
    """
    lot = [
        offre(id=i, prix=prix, cle=f"depot{i}", telephone_cle=f"26134000000{i}",
              libelle_brut=f"Parpaing {prix} ar/pièce")
        for i, prix in enumerate((3200, 3400, 3800, 400))
    ]
    medianes = medianes_du_lot(lot, CATALOGUE)
    assert medianes["ref-planche"][1] == 4                 # quatre dépôts
    assert 3200 <= medianes["ref-planche"][0] <= 3800

    tri = preparer(lot, CATALOGUE, LOCALITES, medianes)
    assert len(tri["valeurs"]) == 3
    assert [c["prix"] for c in tri["a_confirmer"]] == [400]

    # Un dépôt qui poste dix fois ne pèse pas dix fois.
    répétitions = [offre(id=i, prix=3400, cle="meme", telephone_cle="261340000000")
                   for i in range(10)]
    assert medianes_du_lot(répétitions, CATALOGUE) == {}


def test_les_deux_sources_de_mediane_la_mieux_fournie_gagne():
    assert fusionner_medianes({"a": (100, 2)}, {"a": (900, 5)}) == {"a": (900, 5)}
    assert fusionner_medianes({"a": (100, 9)}, {"a": (900, 3)}) == {"a": (100, 9)}
    assert fusionner_medianes({}, {"b": (7, 2)}) == {"b": (7, 2)}


def test_garde_2_bis_une_unite_MUETTE_n_entre_pas():
    """🔴 03/09/2026, constaté sur le site EN LIGNE. Le catalogue vend le
    moellon au m³, les dépôts le vendent à la PIÈCE (250 à 800 Ar). Six lignes
    « moellon : 400ar », qui n'écrivent aucune unité, héritaient de celle de
    leur référence et sont parties dans l'observatoire PUBLIC à 400 Ar le m³ —
    deux cents fois sous le prix réel. Même mécanisme pour « Parpaing de
    20 20 40 (95.000ar) », prix d'un lot publié comme prix à la pièce.

    Une unité que le vendeur n'a pas écrite n'est pas une unité.
    """
    muettes = [
        offre(materiau_slug="sable-fin", prix=400, unite="m3",
              libelle_brut="moellon: 400ar"),
        offre(materiau_slug="planche-15x10-4m", prix=95000, unite="piece",
              libelle_brut="Parpaing de 20 20 40 (95.000ar)"),
    ]
    tri = preparer(muettes, CATALOGUE, LOCALITES, {})
    assert tri["valeurs"] == [] and tri["ecartees"]["unite"] == 2

    # Écrite et conforme à la référence, elle passe.
    ecrite = offre(materiau_slug="sable-fin", prix=45000, unite="m3",
                   libelle_brut="Fasika 45 000 Ar/m3")
    assert len(preparer([ecrite], CATALOGUE, LOCALITES, {})["valeurs"]) == 1
