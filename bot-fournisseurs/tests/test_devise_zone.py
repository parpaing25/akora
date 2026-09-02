# -*- coding: utf-8 -*-
"""Le filtre de zone monétaire — les cas qui ont réellement pollué la base."""
from bot.devise_zone import hors_zone_monetaire


def test_fcfa_du_vehicule_du_26_08():
    # La ligne réelle qui a fait la moitié de la table vehicules.
    motif = hors_zone_monetaire(
        "Sable* : De 75 000 à 110 000 FCFA selon le type de camion (10 ou 12 roues)"
    )
    assert motif is not None and "CFA" in motif


def test_frs_colle_au_montant_de_yaounde():
    # L'appartement camerounais apparié en bordure T2 le 01/09.
    motif = hors_zone_monetaire(
        "magnifique appartement moderne à louer YAOUNDÉ quartier Odza 170,000frs"
    )
    assert motif is not None


def test_ville_seule_suffit():
    assert hors_zone_monetaire("Livraison gravier sur Douala et environs") is not None


def test_xof_et_franc_cfa_en_toutes_lettres():
    assert hors_zone_monetaire("paiement en XOF accepté") is not None
    assert hors_zone_monetaire("3 500 francs CFA le sac") is not None


def test_les_vraies_offres_malgaches_passent():
    for texte in (
        "Parpaing creux 40x20x15 : 1 400 Ar",
        "Fasika : 30 000 Ar/m³, livraison Tana",
        "Madrier 7,5 x 22,5 cm, 4 m : 35 000 ar",
        "Vato 12 000 fmg",              # le franc malgache reste malgache
        "Tôle 0,20 : 18.000 Ariary",
    ):
        assert hors_zone_monetaire(texte) is None, texte


def test_frs_ne_mord_pas_sans_montant_ni_les_mots_voisins():
    # « francs » sans chiffre collé, ou une syllabe dans un mot plus long,
    # ne doivent rien déclencher.
    assert hors_zone_monetaire("vita amin'ny fomba frantsay") is None
    assert hors_zone_monetaire("miresaka francs isika fa tsy vola") is None
