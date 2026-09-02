"""Quelle photo montre quel produit, et quel prix a bougé depuis la dernière fois.

🔴 CE QUI A ÉTÉ VU EN LIGNE LE 01/09/2026. La publication de « Fournisseur en
Matériaux de construction » annonçait « Sable fin : 45 000 Ar le m³ » sous
**deux photos de gravillon et de moellon**. Les photos venaient bien de la
publication Facebook d'où sortait le prix — seulement ce post annonçait cinq
matériaux avec les photos des cinq, et on n'en publiait qu'un.

Une photo appartenait à une PUBLICATION, jamais à un produit. `photos.offre_id`
est le lien qui manquait, et il se pose à la main : aucune machine ne distingue
un madrier d'un chevron sur une photo de tas de bois.

    python -m pytest tests/test_photos_produits.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import inscription  # noqa: E402

MADRIER = {"id": 11, "garder": 1, "materiau_slug": "madrier-70x150-4m",
           "materiau_nom": "Madrier 7 x 15 cm, 4 m", "prix": 35000,
           "unite": "piece", "publication_id": "P1"}
PLANCHE = {"id": 22, "garder": 1, "materiau_slug": "planche-15x100-4m",
           "materiau_nom": "Planche 1,5 x 10 cm, 4 m", "prix": 4700,
           "unite": "piece", "publication_id": "P1"}


def _fiche(photos, offres=(MADRIER, PLANCHE)):
    return {"nom": "Dépôt", "quartier": "Ankadindramamy",
            "offres": list(offres), "photos": list(photos)}


def _photo(pid, offre_id=None, publication="P1", url="https://a/x.jpg", garder=1):
    return {"id": pid, "garder": garder, "url_o2": url,
            "offre_id": offre_id, "publication_id": publication}


# ── L'attribution ──────────────────────────────────────────────────────────
def test_seules_les_photos_attribuees_vont_au_produit():
    fiche = _fiche([_photo(1, offre_id=11, url="https://a/madrier.jpg"),
                    _photo(2, offre_id=None, url="https://a/inconnue.jpg")])
    assert inscription.photos_par_offre(fiche) == {11: ["https://a/madrier.jpg"]}


def test_une_photo_pas_encore_envoyee_ne_compte_pas():
    """Sans `url_o2`, l'image est sur ce PC : personne d'autre ne la voit."""
    fiche = _fiche([{"id": 1, "garder": 1, "url_o2": None, "offre_id": 11,
                     "publication_id": "P1"}])
    assert inscription.photos_par_offre(fiche) == {}


def test_une_photo_ecartee_ne_compte_pas():
    fiche = _fiche([_photo(1, offre_id=11, garder=0)])
    assert inscription.photos_par_offre(fiche) == {}


def test_quatre_photos_au_plus_par_produit():
    fiche = _fiche([_photo(i, offre_id=11, url=f"https://a/{i}.jpg")
                    for i in range(1, 8)])
    assert len(inscription.photos_par_offre(fiche)[11]) == 4


# ── Le produit emporte SES photos ─────────────────────────────────────────
def test_le_sql_donne_ses_photos_au_bon_produit():
    fiche = _fiche([_photo(1, offre_id=11, url="https://a/madrier.jpg")])
    sql = inscription._sql_produits(
        "F-1", [MADRIER, PLANCHE], "actif", inscription.photos_par_offre(fiche))
    avant_planche = sql.split("planche-15x100-4m")[0]
    assert "ARRAY['https://a/madrier.jpg']::text[]" in avant_planche
    # La planche, que personne n'a illustrée, part sans photo — pas avec
    # celle du madrier.
    assert sql.count("ARRAY['https://a/madrier.jpg']") == 1


def test_une_resynchronisation_sans_photo_n_efface_pas_celles_en_place():
    sql = inscription._sql_produits("F-1", [MADRIER], "actif", {})
    assert "photos = CASE WHEN cardinality(excluded.photos) > 0" in sql


# ── Le fil ────────────────────────────────────────────────────────────────
def test_le_fil_prend_la_photo_attribuee_a_la_main():
    fiche = _fiche([_photo(1, offre_id=11, url="https://a/madrier.jpg"),
                    _photo(2, offre_id=None, url="https://a/gravillon.jpg")])
    assert inscription._photos_qui_montrent(fiche, [MADRIER]) == [
        "https://a/madrier.jpg"]


def test_le_fil_ne_prend_rien_quand_le_post_annoncait_cinq_materiaux():
    """Le cas réel : cinq offres dans une publication, aucune attribution."""
    offres = [dict(MADRIER, id=i, materiau_slug=f"m-{i}") for i in range(1, 6)]
    fiche = _fiche([_photo(1), _photo(2)], offres=offres)
    assert inscription._photos_qui_montrent(fiche, offres[:1]) == []


def test_le_fil_accepte_la_photo_d_un_post_qui_ne_parlait_que_d_un_produit():
    fiche = _fiche([_photo(1, publication="P9", url="https://a/seule.jpg")],
                   offres=[dict(MADRIER, publication_id="P9")])
    assert inscription._photos_qui_montrent(
        fiche, [dict(MADRIER, publication_id="P9")]) == ["https://a/seule.jpg"]
