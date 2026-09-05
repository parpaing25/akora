"""Garde-fous sur le rapprochement des fiches en double.

Les fiches de ce fichier viennent de `data/bot.db` (lecture seule, 24/08/2026),
avec leurs vraies URL de compte. Ce qui a été mesuré ce jour-là :

  - 180 publications pour 180 empreintes — aucun doublon de publication ;
  - aucun doublon de téléphone, aucun doublon d'offre ;
  - mais CINQ groupes de fiches homonymes :
        3× « Fournisseur en Matériaux de construction »
        2× « Varotra vato sy fasika ary biriky »
        2× « Abdel Hamid Moussa Morou »
        2× « Biriky Volombary »
        2× « El Yan »

Et l'explication est la même pour les cinq : `page_url` porte le MÊME
identifiant de compte Facebook, sous deux formes différentes
(`/groups/<g>/user/<id>` d'un côté, `profile.php?id=<id>` de l'autre), ou
depuis deux groupes différents. `cle_de_regroupement` compare des URL
entières : il ne pouvait pas les rapprocher.

Ce que ces tests protègent surtout : **rien ne doit fusionner tout seul.**
« Fournisseur en Matériaux de construction » est une enseigne générique que
des pages réellement différentes portent ; une fusion à l'aveugle collerait
les offres de l'un sur le téléphone de l'autre, sans retour possible.

    python -m pytest tests/test_doublons.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import fusion  # noqa: E402


def fiche(id_, nom, page_url="", telephone_cle=None, statut="a_trier",
          nb_offres=0, nb_publications=1, score=0):
    return {
        "id": id_, "nom": nom, "page_url": page_url,
        "telephone": telephone_cle or "", "telephone_cle": telephone_cle,
        "statut": statut, "nb_offres": nb_offres,
        "nb_publications": nb_publications, "score": score,
        "ville": "", "quartier": "", "derniere_vue": "",
    }


# ── L'identifiant de compte, sous ses trois formes ─────────────────────────
def test_les_deux_formes_d_url_designent_le_meme_compte():
    """C'est le cas RÉEL de « Varotra vato sy fasika ary biriky »."""
    depuis_groupe = {"page_url":
                     "facebook.com/groups/842470991701989/user/61577268412763"}
    depuis_profil = {"page_url": "facebook.com/profile.php?id=61577268412763"}
    assert (fusion._identifiant_facebook(depuis_groupe)
            == fusion._identifiant_facebook(depuis_profil)
            == "61577268412763")


def test_une_page_nommee_est_sa_propre_identite():
    assert fusion._identifiant_facebook(
        {"page_url": "facebook.com/DepotRakoto"}) == "depotrakoto"


def test_un_groupe_n_est_pas_un_compte():
    """Sinon tous les membres d'un même groupe seraient déclarés identiques."""
    assert fusion._identifiant_facebook(
        {"page_url": "facebook.com/groups/842470991701989"}) == ""
    assert fusion._identifiant_facebook({"page_url": ""}) == ""
    assert fusion._identifiant_facebook({}) == ""


# ── Le rapprochement ───────────────────────────────────────────────────────
def test_les_trois_fiches_du_meme_compte_sont_rapprochees():
    """Cas réel : trois fiches, un seul profil (100087465079791)."""
    lot = [
        fiche("a", "Fournisseur en Matériaux de construction",
              "facebook.com/profile.php?id=100087465079791",
              telephone_cle="0341247656", statut="reserve", nb_offres=5),
        fiche("b", "Fournisseur en Matériaux de construction",
              "facebook.com/profile.php?id=100087465079791",
              telephone_cle="0347150095", statut="valide", nb_offres=3,
              nb_publications=3),
        fiche("c", "Fournisseur en Matériaux de construction",
              "facebook.com/profile.php?id=100087465079791",
              statut="valide", nb_offres=1),
    ]
    groupes = fusion.doublons_probables(lot)
    assert len(groupes) == 1
    assert groupes[0]["certitude"] == "compte"
    assert "100087465079791" in groupes[0]["raison"]
    assert len(groupes[0]["fiches"]) == 3
    # La fiche proposée par défaut est la mieux remplie : un numéro, puis le
    # plus d'offres. Proposée — pas imposée : l'interface laisse en cocher
    # une autre avant de fusionner.
    assert groupes[0]["garder"] == "a"


def test_le_meme_vendeur_vu_depuis_deux_groupes():
    """Cas réel « Abdel Hamid Moussa Morou » : deux groupes, un seul compte."""
    lot = [
        fiche("a", "Abdel Hamid Moussa Morou",
              "facebook.com/groups/942814656124265/user/100005060892986"),
        fiche("b", "Abdel Hamid Moussa Morou",
              "facebook.com/groups/494438629556500/user/100005060892986"),
    ]
    groupes = fusion.doublons_probables(lot)
    assert len(groupes) == 1 and groupes[0]["certitude"] == "compte"


def test_un_nom_generique_sur_deux_comptes_reste_un_DOUTE():
    """Le cœur de la consigne : signaler, ne pas fusionner.

    Deux pages qui portent la même enseigne générique NE sont pas la même
    entreprise. Le groupe existe — il faut bien le montrer — mais il est
    marqué `nom`, pas `compte`, et l'interface affiche un garde-fou.
    """
    lot = [
        fiche("a", "Fournisseur en Matériaux de construction",
              "facebook.com/DepotAmbohibao", telephone_cle="0341111111"),
        fiche("b", "Fournisseur en matériaux de construction",
              "facebook.com/DepotItaosy", telephone_cle="0342222222"),
    ]
    groupes = fusion.doublons_probables(lot)
    assert len(groupes) == 1
    assert groupes[0]["certitude"] == "nom"
    # Les deux fiches sont TOUJOURS là : la fonction n'écrit rien.
    assert lot[0]["id"] == "a" and lot[1]["id"] == "b"


def test_la_casse_et_les_accents_ne_separent_pas_deux_homonymes():
    """Même normalisation NFKD que `referentiel.normaliser`."""
    lot = [
        fiche("a", "Ets RAKOTO Matériaux", "facebook.com/PageUne"),
        fiche("b", "ets rakoto materiaux", "facebook.com/PageDeux"),
    ]
    assert len(fusion.doublons_probables(lot)) == 1


def test_un_nom_trop_court_ne_prouve_rien():
    """« Ets », « Dépôt » : tout le monde s'appelle comme ça."""
    lot = [fiche("a", "Ets", "facebook.com/Un"),
           fiche("b", "Ets", "facebook.com/Deux")]
    assert fusion.doublons_probables(lot) == []


def test_les_fiches_deja_tranchees_sortent_du_jeu():
    """Rapprocher deux fiches écartées n'apprend rien et fait du bruit."""
    lot = [
        fiche("a", "Abdel Hamid Moussa Morou",
              "facebook.com/groups/942814656124265/user/100005060892986",
              statut="rejete"),
        fiche("b", "Abdel Hamid Moussa Morou",
              "facebook.com/groups/494438629556500/user/100005060892986",
              statut="rejete"),
    ]
    assert fusion.doublons_probables(lot) == []


def test_une_fiche_seule_n_est_pas_un_doublon():
    assert fusion.doublons_probables(
        [fiche("a", "Varotra vato sy fasika ary biriky",
               "facebook.com/profile.php?id=61577268412763")]) == []


def test_le_compte_l_emporte_sur_le_nom():
    """Un même groupe ne doit pas être annoncé deux fois."""
    lot = [
        fiche("a", "Varotra vato sy fasika ary biriky",
              "facebook.com/groups/842470991701989/user/61577268412763",
              telephone_cle="0389886933", nb_offres=8),
        fiche("b", "Varotra vato sy fasika ary biriky",
              "facebook.com/profile.php?id=61577268412763", nb_offres=3),
    ]
    groupes = fusion.doublons_probables(lot)
    assert len(groupes) == 1 and groupes[0]["certitude"] == "compte"


def test_les_certitudes_solides_passent_devant():
    lot = [
        fiche("a", "Biriky Volombary", "facebook.com/PageA"),
        fiche("b", "Biriky Volombary", "facebook.com/PageB"),
        fiche("c", "El Yan",
              "facebook.com/groups/1909861746337974/user/100075656372657"),
        fiche("d", "El Yan",
              "facebook.com/profile.php?id=100075656372657"),
    ]
    groupes = fusion.doublons_probables(lot)
    assert [g["certitude"] for g in groupes] == ["compte", "nom"]
