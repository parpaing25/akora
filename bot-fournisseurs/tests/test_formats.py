"""L'atelier des formats, et les deux pièges qu'il existe pour éviter.

Ce que ces tests protègent vient d'une mesure, pas d'une intuition. Le
01/09/2026, sur la base du bot :

  * 233 offres portaient un prix hérité d'un en-tête (« ALU ZINC › -014 :
    8 500 Ar ») et **aucune** n'avait de référence catalogue — parce que
    `extraction._type_seul` retire le format à ces lignes-là, à raison ;
  * conséquence jamais regardée : sur les 97 offres gardées des 32 prospects
    « validés », 35 avaient un prix, 2 une référence, **zéro** les deux. Le
    bouton « Inscrire les fournisseurs validés » refusait donc les 32, et son
    message ne disait pas lequel des deux manquait ;
  * et les unités ne se recouvrent pas : 6 briques de terre comprimée
    relevées **au m²** pour une référence vendue **à la pièce** (une douzaine
    de briques au m² : le prix serait multiplié par douze), une faîtière au
    mètre pour une référence à la pièce.

    python -m pytest tests/test_formats.py -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import formats, inscription  # noqa: E402


# ── Un catalogue minuscule, mais avec le conflit d'unité en vrai ───────────
CATALOGUE = {
    "materiaux": {
        "btc-22": {"slug": "btc-22", "nom": "BTC 22 x 11 x 9", "unite": "piece",
                   "type_slug": "btc", "famille": "briques"},
        "tole-030-3m": {"slug": "tole-030-3m", "nom": "Tôle 0,30 mm · 3 m",
                        "unite": "piece", "type_slug": "tole", "famille": "couverture"},
    },
    "types": {
        "btc": {"nom": "Brique de terre comprimée"},
        "tole": {"nom": "Tôle"},
    },
    # Les références rangées par type : c'est là que le rapprochement par
    # dimensions va chercher les cotes à comparer.
    "par_type": {
        "btc": [{"slug": "btc-22", "nom": "BTC 22 x 11 x 9", "unite": "piece",
                 "attributs": {"epaisseur_cm": 9, "largeur_cm": 11}}],
        "tole": [{"slug": "tole-030-3m", "nom": "Tôle 0,30 mm · 3 m",
                  "unite": "piece", "attributs": {}}],
    },
}

FORMATS_PAR_TYPE = {
    "btc": [{"slug": "btc-22", "nom": "BTC 22 x 11 x 9", "libelle_court": "22 x 11 x 9",
             "unite": "piece"}],
    "tole": [{"slug": "tole-030-3m", "nom": "Tôle 0,30 mm · 3 m",
              "libelle_court": "0,30 mm · 3 m", "unite": "piece"}],
}


def _offre(oid, type_slug, libelle, prix, unite=None, nom="Dépôt A"):
    return {
        "id": oid, "prospect_id": "p-" + nom[-1], "libelle_brut": libelle,
        "prix": prix, "unite": unite, "quantite_min": None,
        "type_slug": type_slug, "type_nom": CATALOGUE["types"][type_slug]["nom"],
        "famille_slug": "x", "prospect_nom": nom, "prospect_statut": "valide",
    }


@pytest.fixture
def catalogue(monkeypatch):
    monkeypatch.setattr(formats.referentiel, "est_charge", lambda: True)
    monkeypatch.setattr(formats.referentiel, "charger", lambda force=False: CATALOGUE)
    monkeypatch.setattr(formats.referentiel, "formats_du_type",
                        lambda slug: FORMATS_PAR_TYPE.get(slug, []))


# ── Regroupement ───────────────────────────────────────────────────────────
def test_le_montant_ne_separe_pas_deux_fois_le_meme_libelle():
    """« -014 : 8 500 Ar » et « -014 : 9 000 Ar » sont UN format, deux prix."""
    a = formats._empreinte("ALU ZINC › -014 : 8 500 Ar")
    b = formats._empreinte("ALU ZINC › -014 : 9 000 Ar")
    assert a == b
    # Mais deux épaisseurs différentes restent deux décisions distinctes.
    assert a != formats._empreinte("ALU ZINC › -018 : 10 500 Ar")


def test_sans_monnaie_ecrite_on_sous_regroupe_plutot_que_de_confondre():
    """Sur-regrouper collerait un format à des offres qui n'en relèvent pas."""
    assert formats._empreinte("-014 : 8500") != formats._empreinte("-014 : 9000")


def test_atelier_groupe_par_type_et_signale_les_unites_incompatibles(catalogue, monkeypatch):
    monkeypatch.setattr(formats.base, "offres_sans_format", lambda: [
        _offre(1, "btc", "Biriky BTC 3 500 Ar/m2", 3500, "m2"),
        _offre(2, "btc", "Biriky BTC 3 800 Ar/m2", 3800, "m2", nom="Dépôt B"),
        _offre(3, "tole", "ALU ZINC › -014 : 8 500 Ar", 8500, "piece"),
    ])
    vue = formats.atelier()
    assert vue["offres"] == 3 and vue["depots"] == 2 and vue["types"] == 2

    btc = next(g for g in vue["groupes"] if g["type_slug"] == "btc")
    tole = next(g for g in vue["groupes"] if g["type_slug"] == "tole")
    # Le m² du terrain contre la pièce du catalogue : il n'y a pas un format à
    # choisir, il y a une conversion à ne pas inventer.
    assert btc["unites_incompatibles"] is True
    assert btc["unites_lues"] == ["m2"] and btc["unites_reference"] == ["piece"]
    assert tole["unites_incompatibles"] is False
    # Les plus gros groupes d'abord : c'est l'ordre dans lequel on débloque.
    assert vue["groupes"][0]["nb_offres"] >= vue["groupes"][-1]["nb_offres"]


def test_la_proposition_par_dimensions_arrive_dans_l_atelier(catalogue, monkeypatch):
    """Une cote écrite dans la ligne désigne sa référence — sans deviner.

    « ✓ 22cmx11cm » contre « BTC 22 x 11 x 9 » : les deux cotes y sont, et une
    seule référence les porte. « -014 » contre des tôles de 0,25 à 0,45 :
    aucune, donc rien — c'est ce rapprochement inventé qui avait étiqueté une
    tôle 0,45 mm au prix d'une 0,14 le 24/08/2026.
    """
    monkeypatch.setattr(formats.base, "offres_sans_format", lambda: [
        _offre(1, "btc", "Biriky › ✓ 11cmx9cm = 3 500 Ar", 3500),
        _offre(2, "tole", "ALU ZINC › -014 : 8 500 Ar", 8500),
    ])
    vue = formats.atelier()
    btc = next(g for g in vue["groupes"] if g["type_slug"] == "btc")
    tole = next(g for g in vue["groupes"] if g["type_slug"] == "tole")
    assert btc["paquets"][0]["propose"]["slug"] == "btc-22"
    assert tole["paquets"][0]["propose"] is None


# ── Application ────────────────────────────────────────────────────────────
def test_un_slug_absent_du_catalogue_n_ecrit_rien(catalogue, monkeypatch):
    """Une liste déroulante périmée ne doit pas écrire une référence morte."""
    def interdit(*_a, **_kw):
        raise AssertionError("écriture alors que le slug est inconnu")

    monkeypatch.setattr(formats.base, "modifier_offre", interdit)
    monkeypatch.setattr(formats.base, "offre", lambda oid: {"unite": "piece"})
    r = formats.appliquer([{"ids": [1], "materiau_slug": "reference-disparue"}])
    assert r["appliquees"] == 0 and r["refusees"] == ["reference-disparue"]


def test_une_unite_qui_ne_correspond_pas_est_refusee(catalogue, monkeypatch):
    """Le cas réel : BTC relevée au m², référence vendue à la pièce."""
    ecrites = []
    monkeypatch.setattr(formats.base, "modifier_offre",
                        lambda oid, **c: ecrites.append((oid, c)))
    monkeypatch.setattr(formats.base, "offre", lambda oid: {"unite": "m2"})

    r = formats.appliquer([{"ids": [1], "materiau_slug": "btc-22"}])
    assert ecrites == []
    assert r["appliquees"] == 0
    assert r["unites_en_conflit"][0]["lue"] == "m2"
    assert r["unites_en_conflit"][0]["reference"] == "piece"


def test_confirmee_l_offre_prend_l_unite_de_la_reference(catalogue, monkeypatch):
    """Confirmer, c'est dire que le prix est bien celui de la référence.

    L'offre repart alors dans l'unité du catalogue : le produit sera créé
    ainsi, et deux unités qui se contredisent dans la même ligne ne veulent
    plus rien dire.
    """
    ecrites = []
    monkeypatch.setattr(formats.base, "modifier_offre",
                        lambda oid, **c: ecrites.append((oid, c)))
    monkeypatch.setattr(formats.base, "offre", lambda oid: {"unite": "m2"})

    r = formats.appliquer([
        {"ids": [1], "materiau_slug": "btc-22", "confirme_unite": True}
    ])
    assert r["appliquees"] == 1
    oid, champs = ecrites[0]
    assert oid == 1
    assert champs["materiau_slug"] == "btc-22"
    assert champs["unite"] == "piece"
    assert champs["ambigu"] == 0 and champs["certitude"] == 100


def test_une_offre_sans_unite_lue_passe_sans_confirmation(catalogue, monkeypatch):
    """Rien à contredire : c'est la référence qui fait foi."""
    ecrites = []
    monkeypatch.setattr(formats.base, "modifier_offre",
                        lambda oid, **c: ecrites.append((oid, c)))
    monkeypatch.setattr(formats.base, "offre", lambda oid: {"unite": None})

    r = formats.appliquer([{"ids": [7], "materiau_slug": "tole-030-3m"}])
    assert r["appliquees"] == 1 and ecrites[0][1]["unite"] == "piece"


# ── Le refus d'inscription ne parle plus que du DÉPÔT ─────────────────────
# 🔴 CE QUI A CHANGÉ LE 01/09/2026. L'inscription exigeait « au moins un
#    produit référencé AVEC un prix ». Or 440 publications sur 526 (84 %) ne
#    portent aucun prix : le tarif se donne au téléphone, pas dans le post. Un
#    dépôt dont on avait le nom, le quartier et le numéro ne pouvait donc pas
#    entrer sur le site, et on attendait un prix qui n'allait jamais tomber.
#
#    Le dépôt entre maintenant avec ses coordonnées. Ses PRODUITS, eux, ne
#    partent qu'une fois complets — et c'est `tri.py` qui en juge.
def test_le_refus_ne_parle_que_du_depot():
    fiche = {"nom": "", "ville": "", "telephone": "",
             "offres": [{"garder": 1, "prix": 8500, "materiau_slug": None,
                         "hors_catalogue": 0, "id": 1}]}
    manques = inscription._ce_qui_manque(fiche, [])
    assert any("nom" in m for m in manques)
    assert any("contact" in m for m in manques)
    assert any("emplacement" in m for m in manques)
    # Plus un mot sur les produits : ils ne bloquent plus la fiche du dépôt.
    assert not any("produit" in m or "prix" in m for m in manques)


def test_un_depot_joignable_et_situe_peut_entrer_sans_aucun_produit():
    """Le cas de 84 % du corpus : un contact, un quartier, aucun prix."""
    fiche = {"nom": "Dépôt Ankadindramamy", "ville": "Antananarivo",
             "telephone": "034 43 484 95", "offres": []}
    assert inscription._ce_qui_manque(fiche, []) == []


def test_un_produit_exige_reference_prix_ET_photo():
    """La règle qui remplace l'ancienne, et elle est plus stricte."""
    offre = {"id": 7, "garder": 1, "materiau_slug": "madrier-70x150-4m",
             "prix": 35000, "hors_catalogue": 0}
    sans_photo = {"nom": "D", "offres": [offre], "photos": []}
    assert inscription._produits_publiables(sans_photo) == []

    avec_photo = {"nom": "D", "offres": [offre],
                  "photos": [{"id": 1, "garder": 1, "offre_ids": [7],
                              "url_o2": "https://a/x.jpg"}]}
    assert len(inscription._produits_publiables(avec_photo)) == 1


# ── Le texte publié au fil ────────────────────────────────────────────────
def test_le_texte_du_fil_tient_dans_la_contrainte_et_dit_sa_source():
    """`publications.texte` impose 10 à 1200 caractères."""
    fiche = {"nom": "Fivarotan-kazo Mirary", "quartier": "Ankadindramamy"}
    publiables = [
        {"materiau_nom": f"Planche {n}", "prix": 4000 + n, "unite": "piece"}
        for n in range(20)
    ]
    texte = inscription._texte_fil(fiche, publiables)
    assert 10 <= len(texte) <= 1200
    assert "Ankadindramamy" in texte
    # Ces prix ont été relevés, pas déclarés : le fil doit le dire.
    assert "annonces publiques" in texte
    # Huit lignes de produits au plus, sinon le fil devient un catalogue.
    assert texte.count("Planche") <= 8
