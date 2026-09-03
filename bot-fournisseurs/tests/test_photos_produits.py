"""Quelle photo montre quel produit, et quel prix a bougé depuis la dernière fois.

🔴 CE QUI A ÉTÉ VU EN LIGNE LE 01/09/2026. La publication de « Fournisseur en
Matériaux de construction » annonçait « Sable fin : 45 000 Ar le m³ » sous
**deux photos de gravillon et de moellon**. Les photos venaient bien de la
publication Facebook d'où sortait le prix — seulement ce post annonçait cinq
matériaux avec les photos des cinq, et on n'en publiait qu'un.

Une photo appartenait à une PUBLICATION, jamais à un produit. Le lien qui
manquait se pose à la main : aucune machine ne distingue un madrier d'un
chevron sur une photo de tas de bois.

⭐ Et depuis le 03/09/2026 il vit dans `photos_offres` : UNE photo peut
montrer PLUSIEURS produits (le tas de bois montre le 7×15 et le 7×17, la photo
d'un tarif montre tous les articles). Mesuré ce jour-là sur « Fivarotan-kazo
Mirary » : 9 produits, 5 photos — quatre articles ne pouvaient jamais partir.

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


def _photo(pid, offre_id=None, publication="P1", url="https://a/x.jpg", garder=1,
           offre_ids=None):
    """Une photo. `offre_id` reste accepte pour la lisibilite des cas a un seul
    produit ; `offre_ids` sert des qu'une photo en illustre plusieurs."""
    if offre_ids is None:
        offre_ids = [offre_id] if offre_id is not None else []
    return {"id": pid, "garder": garder, "url_o2": url,
            "offre_ids": list(offre_ids), "publication_id": publication}


# ── L'attribution ──────────────────────────────────────────────────────────
def test_seules_les_photos_attribuees_vont_au_produit():
    fiche = _fiche([_photo(1, offre_id=11, url="https://a/madrier.jpg"),
                    _photo(2, offre_id=None, url="https://a/inconnue.jpg")])
    assert inscription.photos_par_offre(fiche) == {11: ["https://a/madrier.jpg"]}


def test_une_photo_pas_encore_envoyee_ne_compte_pas():
    """Sans `url_o2`, l'image est sur ce PC : personne d'autre ne la voit."""
    fiche = _fiche([{"id": 1, "garder": 1, "url_o2": None, "offre_ids": [11],
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


# ── Une photo, plusieurs produits ─────────────────────────────────────────
def test_la_meme_url_sous_deux_cles():
    """Égalité STRICTE du dictionnaire : une implémentation qui ne garderait
    que le PREMIER lien passerait un test plus mou, et le 7×17 partirait sans
    photo pendant que l'écran le dirait prêt."""
    fiche = _fiche([_photo(1, offre_ids=[11, 22], url="https://a/tas.jpg")])
    assert inscription.photos_par_offre(fiche) == {
        11: ["https://a/tas.jpg"], 22: ["https://a/tas.jpg"]}


def test_le_plafond_est_par_produit_jamais_par_photo():
    """Une photo de tarif attribuée à SIX produits illustre les six. Un
    `LIMIT 4` posé par réflexe sur la table de liaison couperait le
    cinquième et le sixième — exactement le cas réel qui motive le partage."""
    offres = [dict(MADRIER, id=i, materiau_slug=f"m-{i}") for i in range(1, 7)]
    fiche = _fiche([_photo(1, offre_ids=[1, 2, 3, 4, 5, 6], url="https://a/tarif.jpg")],
                   offres=offres)
    par_offre = inscription.photos_par_offre(fiche)
    assert sorted(par_offre) == [1, 2, 3, 4, 5, 6]
    assert all(urls == ["https://a/tarif.jpg"] for urls in par_offre.values())


def test_le_sql_donne_la_photo_partagee_aux_deux_produits():
    """Par BLOC de produit, pas par comptage global : l'URL figure dans le
    bloc de CHAQUE produit qui la partage. `count == 1` (le test d'à côté)
    reste vrai pour une photo NON partagée — c'est le seul test qui cassait
    franchement sur un comportement correct, et il ne doit pas être relâché
    en `>= 1`."""
    fiche = _fiche([_photo(1, offre_ids=[11, 22], url="https://a/tas.jpg")])
    sql = inscription._sql_produits(
        "F-1", [MADRIER, PLANCHE], "actif", inscription.photos_par_offre(fiche))
    # Le slug de la planche apparaît plusieurs fois dans le SQL (valeurs, ON
    # CONFLICT) : on coupe à sa PREMIÈRE occurrence, comme le test d'à côté.
    bloc_madrier, _, bloc_planche = sql.partition("planche-15x100-4m")
    assert "ARRAY['https://a/tas.jpg']::text[]" in bloc_madrier
    assert "ARRAY['https://a/tas.jpg']::text[]" in bloc_planche
    assert sql.count("ARRAY['https://a/tas.jpg']") == 2


def test_le_fil_ne_repete_pas_une_photo_partagee():
    """Deux, puis cinq produits publiables qui partagent la même photo : le
    post du fil la montre UNE fois, et les quatre places ne sont pas mangées
    par la même image. Le garde `offre.get("id") is not None` était mort
    (évalué après `int(offre["id"])`) : un identifiant à None est ignoré."""
    deux = _fiche([_photo(1, offre_ids=[11, 22], url="https://a/tas.jpg")])
    assert inscription._photos_qui_montrent(deux, [MADRIER, PLANCHE]) == ["https://a/tas.jpg"]

    offres = [dict(MADRIER, id=i, materiau_slug=f"m-{i}") for i in range(1, 6)]
    cinq = _fiche([_photo(1, offre_ids=[1, 2, 3, 4, 5], url="https://a/tarif.jpg"),
                   _photo(2, offre_ids=[5], url="https://a/propre.jpg")], offres=offres)
    assert inscription._photos_qui_montrent(cinq, offres) == [
        "https://a/tarif.jpg", "https://a/propre.jpg"]
    assert inscription._photos_qui_montrent(cinq, offres + [dict(MADRIER, id=None)]) == [
        "https://a/tarif.jpg", "https://a/propre.jpg"]


def test_le_repli_par_publication_ne_s_active_pas_quand_le_partage_suffit():
    """Ce repli est le code même de l'incident du 01/09 (deux photos de
    gravillon sous « Sable fin »). Quand les cinq matériaux d'un post ont
    TOUS la même photo attribuée, ils la reçoivent, et le repli se tait."""
    offres = [dict(MADRIER, id=i, materiau_slug=f"m-{i}") for i in range(1, 6)]
    fiche = _fiche([_photo(1, offre_ids=[1, 2, 3, 4, 5], url="https://a/tarif.jpg"),
                    _photo(2, url="https://a/gravillon.jpg")], offres=offres)
    assert inscription._photos_qui_montrent(fiche, offres[:1]) == ["https://a/tarif.jpg"]


def test_une_photo_partagee_ne_part_qu_une_fois(monkeypatch):
    """Un seul envoi vers o2switch pour une photo attribuée à deux produits.
    `photos_par_offre` range le MÊME objet dans deux seaux ; sans le
    dédoublonnage, elle était compressée et POSTée deux fois."""
    from bot import base, reservation
    fiche = {**_fiche([_photo(1, offre_ids=[11, 22], url=None)]), "id": "F-1"}
    envoyees = []
    monkeypatch.setattr(reservation, "envoyer_ces_photos",
                        lambda f, photos: envoyees.append(list(photos)) or {})
    monkeypatch.setattr(base, "prospect", lambda pid: fiche)
    inscription.televerser_les_photos(fiche, [MADRIER, PLANCHE])
    assert len(envoyees) == 1
    assert [p["id"] for p in envoyees[0]] == [1]
