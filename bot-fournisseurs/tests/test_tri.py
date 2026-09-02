"""Le tri : ce qui est prêt, ce qui manque, à qui il faut téléphoner.

🔴 LA MESURE QUI A TOUT CHANGÉ, le 01/09/2026 : **440 publications sur 526
(84 %) ne portent aucun prix**. Le tarif ne se met pas dans le post, il se
donne au téléphone. Le bot exigeait pourtant « au moins un produit référencé
AVEC un prix » pour créer la fiche d'un dépôt — donc un dépôt dont on avait le
nom, le quartier et le numéro ne pouvait pas entrer sur le site, et on
attendait un prix qui n'allait jamais tomber tout seul.

D'où la séparation que ces tests protègent :

  · un DÉPÔT entre avec un nom, un contact, un emplacement — rien de plus ;
  · un PRODUIT ne part qu'avec sa référence du catalogue, son PRIX et sa
    PHOTO désignée. Les trois. Un produit sans prix ne se compare pas, sans
    photo il ne s'achète pas.

    python -m pytest tests/test_tri.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import tri  # noqa: E402


def _offre(oid, slug="madrier-70x150-4m", prix=35000, garder=1, hors=0):
    return {"id": oid, "garder": garder, "materiau_slug": slug, "prix": prix,
            "hors_catalogue": hors, "materiau_nom": "Madrier 7 x 15 cm, 4 m",
            "type_nom": "Madrier"}


def _photo(pid, offre_id, garder=1):
    return {"id": pid, "garder": garder, "offre_id": offre_id,
            "url_o2": "https://a/x.jpg"}


# ── Le produit : trois conditions, pas deux ───────────────────────────────
def test_reference_prix_et_photo_sinon_rien():
    complete = {"offres": [_offre(1)], "photos": [_photo(9, 1)]}
    assert tri.etat_des_offres(complete)["nb_pretes"] == 1


def test_sans_photo_le_produit_n_est_pas_pret():
    """La condition ajoutée le 01/09 : une image, ou le produit reste ici."""
    etat = tri.etat_des_offres({"offres": [_offre(1)], "photos": []})
    assert etat["nb_pretes"] == 0
    assert etat["sans_photo"] and not etat["sans_prix"]


def test_sans_prix_le_produit_attend_un_appel():
    etat = tri.etat_des_offres(
        {"offres": [_offre(1, prix=None)], "photos": [_photo(9, 1)]})
    assert etat["nb_pretes"] == 0 and len(etat["sans_prix"]) == 1


def test_sans_reference_le_produit_attend_l_atelier():
    etat = tri.etat_des_offres(
        {"offres": [_offre(1, slug=None)], "photos": [_photo(9, 1)]})
    assert etat["nb_pretes"] == 0 and len(etat["sans_reference"]) == 1


def test_une_photo_attribuee_A_UNE_AUTRE_offre_ne_compte_pas():
    """Le cas réel : cinq matériaux dans un post, les photos des cinq."""
    etat = tri.etat_des_offres(
        {"offres": [_offre(1), _offre(2)], "photos": [_photo(9, 1)]})
    assert etat["nb_pretes"] == 1
    assert [o["id"] for o in etat["sans_photo"]] == [2]


def test_une_offre_ecartee_ou_hors_catalogue_n_attend_plus_rien():
    etat = tri.etat_des_offres({
        "offres": [_offre(1, garder=0), _offre(2, hors=1)], "photos": []})
    assert etat["nb_pretes"] == 0
    assert etat["sans_photo"] == [] and etat["sans_prix"] == []


# ── Le dépôt : trois conditions aussi, mais ce ne sont pas les mêmes ──────
def test_le_depot_entre_avec_nom_contact_et_lieu_SANS_aucun_produit():
    """Le cas de 84 % du corpus."""
    fiche = {"nom": "Dépôt Anosibe", "telephone": "034 05 807 46",
             "quartier": "Anosibe", "offres": [], "photos": []}
    assert tri.fiche_depot_complete(fiche) == []


def test_un_depot_sans_contact_ne_sert_a_personne():
    fiche = {"nom": "Dépôt", "quartier": "Anosibe"}
    manques = tri.fiche_depot_complete(fiche)
    assert any("contact" in m for m in manques)


def test_une_page_facebook_vaut_contact():
    """Le numéro arrive souvent en commentaire ; la page, elle, est toujours là."""
    fiche = {"nom": "Dépôt", "quartier": "Anosibe",
             "page_url": "https://facebook.com/depot"}
    assert tri.fiche_depot_complete(fiche) == []


def test_une_coordonnee_vaut_emplacement():
    fiche = {"nom": "Dépôt", "telephone": "034 05 807 46", "lat": -18.9}
    assert tri.fiche_depot_complete(fiche) == []


def test_un_depot_sans_nom_ni_lieu_est_refuse():
    manques = tri.fiche_depot_complete({"telephone": "034 05 807 46"})
    assert any("nom" in m for m in manques)
    assert any("emplacement" in m for m in manques)
