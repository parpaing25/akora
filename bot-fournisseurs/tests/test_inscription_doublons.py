"""Le bot regarde ce qui existe déjà sur Akora avant d'écrire.

Trois situations, trois conduites — et c'est la troisième qui protège un
client :

  * dépôt absent du site           → on crée ;
  * dépôt présent, porté par NOUS  → on adopte sa fiche et on n'ajoute que
                                     les produits qui manquent ;
  * dépôt présent, porté par LUI   → **on n'écrit rien**. Un dépôt qui a
                                     revendiqué sa fiche a relu SES prix ; y
                                     réinjecter ceux qu'on a relevés sur
                                     Facebook des mois plus tôt, c'est écraser
                                     son travail par une lecture de robot.

Sans ce recoupement, un dépôt déjà inscrit repassait par la branche « créer » :
un second fournisseur du même nom à côté du premier — précisément ce que
`revendiquer_fiche()` a un bloc entier pour éviter côté base.

    python -m pytest tests/test_inscription_doublons.py -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import inscription  # noqa: E402

COMPTE_AKORA = "abe73060-3131-4509-b37e-cd8f58805401"
AUTRE_COMPTE = "36d3d8cb-5c42-4cf1-99b1-bb66a5b0be4a"


@pytest.fixture
def annuaire(monkeypatch):
    """Un annuaire à deux dépôts : un à nous, un au client."""
    lignes = [
        {"id": "f-nous", "raison_sociale": "Dépôt Itaosy", "slug": "depot-itaosy",
         "statut": "brouillon", "owner_id": COMPTE_AKORA,
         "tel": "261340267709", "tel2": "",
         "produits": ["planche-25x200-4m", "chevron-80x80-4m"]},
        {"id": "f-client", "raison_sociale": "Hourdis MG", "slug": "hourdis-mg",
         "statut": "actif", "owner_id": AUTRE_COMPTE,
         "tel": "261324704143", "tel2": "",
         "produits": ["hourdis-tc-20"]},
    ]
    monkeypatch.setattr(inscription.akora, "annuaire", lambda: lignes)
    monkeypatch.setattr(inscription, "compte_akora", lambda: COMPTE_AKORA)

    def _deja(telephone, nom=""):
        fin = "".join(c for c in telephone if c.isdigit())[-9:]
        for ligne in lignes:
            if fin and fin and ligne["tel"].endswith(fin):
                return ligne["id"], f"même numéro que « {ligne['raison_sociale']} »"
        return "", ""

    monkeypatch.setattr(inscription.akora, "deja_fournisseur", _deja)
    return lignes


def test_un_depot_inconnu_est_a_creer(annuaire):
    etat = inscription.etat_sur_le_site({"nom": "Neuf", "telephone": "0340000000"})
    assert etat["existe"] is False
    assert etat["produits"] == set()


def test_le_meme_numero_reconnait_le_depot_sans_lien_pose(annuaire):
    """034…, +261 34… et 34… sont un seul abonné : le lien n'est pas requis."""
    etat = inscription.etat_sur_le_site(
        {"nom": "Écrit autrement", "telephone": "+261 34 02 677 09"})
    assert etat["existe"] is True
    assert etat["fournisseur_id"] == "f-nous"
    assert etat["a_nous"] is True
    assert "même numéro" in etat["raison"]


def test_la_fiche_du_client_n_est_PAS_a_nous(annuaire):
    """Le test qui empêche d'écraser les prix d'un dépôt qui a revendiqué."""
    etat = inscription.etat_sur_le_site(
        {"nom": "Hourdis MG", "telephone": "0324704143"})
    assert etat["existe"] is True
    assert etat["a_nous"] is False
    assert etat["statut"] == "actif"


def test_le_lien_deja_pose_fait_foi_sans_numero(annuaire):
    etat = inscription.etat_sur_le_site(
        {"nom": "Peu importe", "telephone": "", "fournisseur_id": "f-nous"})
    assert etat["fournisseur_id"] == "f-nous"
    assert etat["raison"] == "fiche deja liee a ce prospect"


def test_un_lien_qui_pointe_dans_le_vide_ne_bloque_pas(annuaire):
    """Fiche supprimée côté site : on repart d'une recherche, on ne plante pas."""
    etat = inscription.etat_sur_le_site(
        {"nom": "Disparu", "telephone": "0340267709",
         "fournisseur_id": "f-efface-depuis"})
    assert etat["fournisseur_id"] == "f-nous"


def test_seuls_les_produits_absents_sont_a_ecrire(annuaire):
    """Renvoyer un produit déjà là ne ferait que réécrire son prix."""
    etat = inscription.etat_sur_le_site({"nom": "X", "telephone": "0340267709"})
    publiables = [
        {"materiau_slug": "planche-25x200-4m", "prix": 4000},   # déjà là
        {"materiau_slug": "madrier-75x225-4m", "prix": 35000},  # nouveau
    ]
    manquants = [o for o in publiables if o["materiau_slug"] not in etat["produits"]]
    assert [o["materiau_slug"] for o in manquants] == ["madrier-75x225-4m"]
