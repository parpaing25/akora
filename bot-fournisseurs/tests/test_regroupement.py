"""Le regroupement par COMPTE Facebook — le nerf du bot, mesuré et réparé.

Mesuré le 02/09/2026 sur `data/bot.db` : 26 comptes Facebook tenaient
62 fiches. Le même vendeur vu depuis deux groupes, ou vu une fois avec son
numéro et une fois sans, faisait deux fiches — parce que la clé de
regroupement comparait des adresses entières
(`groups/<g>/user/<id>` ≠ `profile.php?id=<id>`) et parce que l'absorption
« une publication tardive apporte enfin le numéro » n'existait que pour la
clé exacte.

Ce que ces tests fixent :
  - la clé se réduit à l'IDENTIFIANT du compte, sous ses quatre écritures ;
  - un groupe n'est jamais une clé (sinon tous ses posts anonymes se
    rangent dans une seule fiche) ;
  - une publication SANS numéro rejoint la fiche du même compte ;
  - une publication AVEC numéro rejoint la fiche sans numéro du même compte
    et lui donne le sien ;
  - deux numéros différents sous un même compte restent DEUX fiches — c'est
    `doublons_probables` qui les signale, un humain qui tranche.

    python -m pytest tests/test_regroupement.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import base, fusion  # noqa: E402

SOURCE_GROUPE = {"id": 7, "nom": "Groupe A", "genre": "groupe",
                 "url": "https://www.facebook.com/groups/842470991701989"}
SOURCE_PAGE = {"id": 8, "nom": "Dépôt Rakoto", "genre": "page",
               "url": "https://www.facebook.com/DepotRakoto/"}
CFG = {}


def lecture(telephone_cle=None, nom=""):
    return {
        "telephone_cle": telephone_cle,
        "telephone": telephone_cle and f"0{telephone_cle[1:3]} {telephone_cle[3:5]} "
                                       f"{telephone_cle[5:8]} {telephone_cle[8:]}",
        "telephones": [{"cle": telephone_cle}] if telephone_cle else [],
        "nom": nom, "offres": [], "langue": "mg",
    }


def post(auteur, auteur_url):
    return {"auteur": auteur, "auteur_url": auteur_url, "texte": "biriky"}


# ── La clé ─────────────────────────────────────────────────────────────────
def test_le_telephone_passe_avant_tout():
    cle = fusion.cle_de_regroupement(
        lecture("0341234567"), post("X", "https://www.facebook.com/profile.php?id=1"),
        SOURCE_GROUPE)
    assert cle == "tel:0341234567"


def test_les_quatre_ecritures_d_un_compte_donnent_la_meme_cle():
    formes = [
        "https://www.facebook.com/profile.php?id=61577268412763&sk=about",
        "https://www.facebook.com/groups/842470991701989/user/61577268412763/",
        "https://www.facebook.com/groups/494438629556500/user/61577268412763",
        "https://www.facebook.com/people/Varotra-Vato/61577268412763/",
    ]
    cles = {fusion.cle_de_regroupement(lecture(), post("V", f), SOURCE_GROUPE)
            for f in formes}
    assert cles == {"fb:61577268412763"}


def test_un_groupe_n_est_jamais_une_cle():
    """L'auteur « le groupe lui-même » : on retombe sur nom + source."""
    cle = fusion.cle_de_regroupement(
        lecture(), post("FIFANAMPIANA", "https://www.facebook.com/groups/590432639702255/"),
        SOURCE_GROUPE)
    assert cle == "nom:fifanampiana|src:7"


def test_une_page_source_est_sa_propre_cle():
    cle = fusion.cle_de_regroupement(lecture(), post("", ""), SOURCE_PAGE)
    assert cle == "fb:depotrakoto"


def test_une_adresse_de_page_nommee_se_reduit_a_son_nom():
    cle = fusion.cle_de_regroupement(
        lecture(), post("Dépôt", "https://www.facebook.com/DepotAmbohibao?ref=xav"),
        SOURCE_GROUPE)
    assert cle == "fb:depotambohibao"


# ── L'enregistrement, sur la base jetable ──────────────────────────────────
def test_le_meme_compte_vu_depuis_deux_groupes_fait_une_fiche():
    pid1, neuf1 = fusion.enregistrer(
        lecture(nom="Varotra vato"), post("Varotra vato",
        "https://www.facebook.com/groups/1/user/700000000000001"), SOURCE_GROUPE, CFG)
    pid2, neuf2 = fusion.enregistrer(
        lecture(), post("Varotra vato",
        "https://www.facebook.com/groups/2/user/700000000000001"),
        {**SOURCE_GROUPE, "id": 9}, CFG)
    assert (neuf1, neuf2) == (True, False)
    assert pid1 == pid2
    assert base.prospect(pid1)["nb_publications"] == 2


def test_une_publication_tardive_apporte_le_numero_a_la_fiche_du_compte():
    """L'absorption promise depuis le 23/08, enfin codée."""
    pid1, _ = fusion.enregistrer(
        lecture(nom="Biriky Tsara"), post("Biriky Tsara",
        "https://www.facebook.com/groups/1/user/700000000000002"), SOURCE_GROUPE, CFG)
    assert base.prospect(pid1)["telephone_cle"] is None

    pid2, neuf = fusion.enregistrer(
        lecture("0343354309"), post("Biriky Tsara",
        "https://www.facebook.com/profile.php?id=700000000000002"), SOURCE_GROUPE, CFG)
    assert neuf is False and pid2 == pid1
    fiche = base.prospect(pid1)
    assert fiche["telephone_cle"] == "0343354309"
    assert fiche["cle"] == "tel:0343354309"       # la fiche prend la clé la plus sûre


def test_une_publication_sans_numero_rejoint_la_fiche_qui_en_a_un():
    pid1, _ = fusion.enregistrer(
        lecture("0382225413", nom="Tjsl Tojo"), post("Tjsl Tojo",
        "https://www.facebook.com/groups/1/user/700000000000003"), SOURCE_GROUPE, CFG)
    pid2, neuf = fusion.enregistrer(
        lecture(), post("Tjsl Tojo",
        "https://www.facebook.com/groups/5/user/700000000000003"), SOURCE_GROUPE, CFG)
    assert neuf is False and pid2 == pid1
    assert base.prospect(pid1)["cle"] == "tel:0382225413"   # la clé téléphone reste


def test_deux_numeros_sous_un_meme_compte_restent_deux_fiches():
    """Deux lignes pour un dépôt, ou deux dépôts derrière un compte partagé ?
    Ce n'est pas au bot de trancher : il signale, il ne fusionne pas."""
    pid1, _ = fusion.enregistrer(
        lecture("0383074745", nom="Hazo Rn3"), post("Hazo Rn3",
        "https://www.facebook.com/groups/1/user/700000000000004"), SOURCE_GROUPE, CFG)
    pid2, neuf = fusion.enregistrer(
        lecture("0348739741", nom="Hazo Rn3"), post("Hazo Rn3",
        "https://www.facebook.com/groups/1/user/700000000000004"), SOURCE_GROUPE, CFG)
    assert neuf is True and pid2 != pid1
    groupes = fusion.doublons_probables(base.lister_prospects(limite=5000))
    assert any(g["certitude"] == "compte" and "700000000000004" in g["raison"]
               for g in groupes)


def test_une_fiche_a_l_ancienne_cle_est_retrouvee_par_son_compte():
    """Les fiches d'avant le 02/09 portent `fb:facebook.com/profile.php?id=…`.
    Une collecte neuve doit les retrouver, pas en ouvrir une seconde."""
    ancien = base.creer_prospect({
        "cle": "fb:facebook.com/profile.php?id=700000000000005",
        "nom": "El Yan", "page_url": "facebook.com/profile.php?id=700000000000005",
        "statut": "a_trier", "nb_publications": 1, "telephones_autres": [],
    })
    pid, neuf = fusion.enregistrer(
        lecture(), post("El Yan",
        "https://www.facebook.com/groups/9/user/700000000000005"), SOURCE_GROUPE, CFG)
    assert neuf is False and pid == ancien


def test_deux_auteurs_anonymes_d_un_groupe_ne_se_melangent_pas():
    """Deux publications « du groupe » dans deux groupes : deux fiches."""
    pid1, _ = fusion.enregistrer(
        lecture(), post("Groupe Un", "https://www.facebook.com/groups/111"),
        {**SOURCE_GROUPE, "id": 21}, CFG)
    pid2, _ = fusion.enregistrer(
        lecture(), post("Groupe Deux", "https://www.facebook.com/groups/222"),
        {**SOURCE_GROUPE, "id": 22}, CFG)
    assert pid1 != pid2
    assert base.prospect(pid1)["cle"].startswith("nom:")
