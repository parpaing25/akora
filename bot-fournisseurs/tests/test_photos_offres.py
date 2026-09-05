"""Une photo montre PLUSIEURS produits — la table de liaison et ses gardes.

Ces tests écrivent dans une VRAIE base SQLite : `tests/conftest.py` détourne
tout le dossier de données vers un répertoire jetable, donc c'est sûr et
gratuit. Aucun test du dépôt ne le faisait, alors que la totalité du risque de
ce changement est en SQL — une cascade qui n'a jamais été exécutée n'est pas
une cascade, c'est une intention.

🔴 CE QUE LE MODÈLE D'AVANT COÛTAIT, mesuré le 03/09/2026 sur
« Fivarotan-kazo Mirary » : 9 produits, 5 photos. `photos.offre_id` étant une
colonne scalaire, cliquer une vignette déjà prise la VOLAIT au produit voisin.
Quatre des neuf articles ne pouvaient donc jamais avoir d'image — et un
produit sans photo ne part jamais sur le site.

    python -m pytest tests/test_photos_offres.py -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import base, fusion, tri  # noqa: E402


# ⚠ CHAQUE TEST TRAVAILLE SUR SON PROPRE DÉPÔT. La base est partagée par la
#   session, `creer_prospect` est idempotent sur la clé et `ajouter_offre`
#   déduplique par matériau : sans identifiants uniques, le deuxième test
#   retrouve le dépôt du premier, `ajouter_offre` rend None, et les échecs
#   parlent de tout sauf du sujet.
_compteur = [0]


def _unique():
    _compteur[0] += 1
    return _compteur[0]


def _depot(nom="Dépôt", marque=None):
    marque = marque if marque is not None else _unique()
    return base.creer_prospect({
        "cle": f"tel:034{marque:07d}", "nom": f"{nom} {marque}",
        "statut": "a_trier", "nb_publications": 1, "telephones_autres": [],
    })


def _offre(pid, slug, prix=35000):
    reference = f"{slug}-{_unique()}"
    return base.ajouter_offre(pid, None, {
        "libelle_brut": f"{reference} {prix} ar", "prix": prix, "unite": "piece",
        "materiau_slug": reference, "materiau_nom": slug, "certitude": 90,
        "ambigu": 0, "hors_catalogue": 0,
    })


def _photo(pid, fichier="tas"):
    nom = f"{fichier}-{_unique()}.jpg"
    base.ajouter_photo(pid, None, nom, "https://fb/x.jpg", 800, 600)
    with base._verrou, base.connexion() as cx:
        return cx.execute(
            "SELECT id FROM photos WHERE prospect_id = ? AND fichier = ?",
            (pid, nom)).fetchone()["id"]


def _liens(photo_id):
    return base.offres_de_la_photo(photo_id)


@pytest.fixture
def tas_de_bois():
    """Le cas réel : UNE photo de tas de bois, DEUX madriers différents."""
    pid = _depot("Fivarotan-kazo Mirary")
    o15 = _offre(pid, "madrier-70x150-4m")
    o17 = _offre(pid, "madrier-70x170-4m", 38000)
    photo = _photo(pid)
    return {"pid": pid, "o15": o15, "o17": o17, "photo": photo}


# ── Le geste ───────────────────────────────────────────────────────────────
def test_une_photo_illustre_deux_produits(tas_de_bois):
    """Le cœur de la demande : attacher au second ne retire pas au premier."""
    assert base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o15"]) is True
    assert base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o17"]) is True
    assert _liens(tas_de_bois["photo"]) == sorted(
        [tas_de_bois["o15"], tas_de_bois["o17"]])


def test_attacher_deux_fois_ne_casse_rien(tas_de_bois):
    """Recliquer est sans effet, pas une erreur."""
    assert base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o15"]) is True
    assert base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o15"]) is True
    assert _liens(tas_de_bois["photo"]) == [tas_de_bois["o15"]]


def test_detacher_n_est_pas_supprimer(tas_de_bois):
    """Retirer d'UN produit laisse la photo, son url_o2, et l'autre lien.

    Le réflexe `DELETE ... WHERE photo_id = ?` doit faire rougir ce test.
    """
    base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o15"])
    base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o17"])
    base.modifier_photo(tas_de_bois["photo"], url_o2="https://o2/tas.jpg")

    base.detacher_photo(tas_de_bois["photo"], tas_de_bois["o15"])

    assert _liens(tas_de_bois["photo"]) == [tas_de_bois["o17"]]
    fiche = base.prospect(tas_de_bois["pid"])
    photo = next(f for f in fiche["photos"] if f["id"] == tas_de_bois["photo"])
    assert photo["url_o2"] == "https://o2/tas.jpg"


# ── Le garde « même dépôt », en SQL et non chez l'appelant ─────────────────
def test_la_photo_d_un_depot_ne_va_pas_au_produit_d_un_autre():
    """L'API l'acceptait déjà : ni `modifier_photo` ni la route ne vérifiaient
    rien, seule l'interface l'empêchait. Une photo partie sous le nom d'un
    autre dépôt, c'est le dépôt qu'on fait passer pour un menteur."""
    a = _depot("Dépôt A")
    b = _depot("Dépôt B")
    photo_a = _photo(a, "chez-a")
    offre_b = _offre(b, "planche-15x100-4m")

    assert base.attacher_photo(photo_a, offre_b) is False
    assert _liens(photo_a) == []


def test_une_offre_inexistante_ne_cree_pas_de_lien(tas_de_bois):
    assert base.attacher_photo(tas_de_bois["photo"], 999_999) is False
    assert _liens(tas_de_bois["photo"]) == []


# ── Les suppressions : la cascade fait le travail, personne d'autre ────────
def test_supprimer_une_offre_partagee_laisse_la_photo_a_l_autre(tas_de_bois):
    """Le test qui prouve que le CASCADE suffit et qu'aucun appelant n'a à
    nettoyer — il y a quatre chemins de suppression, aucun nettoyage écrit
    chez l'un d'eux ne tiendrait."""
    base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o15"])
    base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o17"])
    base.modifier_photo(tas_de_bois["photo"], url_o2="https://o2/tas.jpg")

    base.supprimer_offre(tas_de_bois["o15"])

    assert _liens(tas_de_bois["photo"]) == [tas_de_bois["o17"]]
    fiche = base.prospect(tas_de_bois["pid"])
    photo = next(f for f in fiche["photos"] if f["id"] == tas_de_bois["photo"])
    assert photo["url_o2"] == "https://o2/tas.jpg", "la photo elle-même reste"


def test_supprimer_le_prospect_cascade_jusqu_aux_liens(tas_de_bois):
    """prospect → photos → photos_offres, avec PRAGMA foreign_keys = ON.

    ⚠ On compte les liens de CE dépôt-là, pas toute la table : les autres
      tests de ce fichier laissent les leurs derrière eux, et un compte global
      mesurerait le voisin.
    """
    base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o15"])
    assert _liens(tas_de_bois["photo"]) == [tas_de_bois["o15"]]

    base.supprimer_prospect(tas_de_bois["pid"])

    with base._verrou, base.connexion() as cx:
        restants = cx.execute(
            "SELECT COUNT(*) n FROM photos_offres WHERE photo_id = ? OR offre_id IN (?, ?)",
            (tas_de_bois["photo"], tas_de_bois["o15"], tas_de_bois["o17"]),
        ).fetchone()["n"]
    assert restants == 0


# ── Ce que la fiche rend, et ce que le tri en fait ─────────────────────────
def test_la_fiche_rend_une_ligne_par_photo(tas_de_bois):
    """🔴 LE CONTRAT DE FORME. Un JOIN naïf ferait apparaître la photo deux
    fois, et tout l'aval la compterait deux fois — jusqu'à la téléverser deux
    fois sur o2switch."""
    base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o15"])
    base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o17"])

    fiche = base.prospect(tas_de_bois["pid"])
    photos = [f for f in fiche["photos"] if f["id"] == tas_de_bois["photo"]]
    assert len(photos) == 1
    assert sorted(photos[0]["offre_ids"]) == sorted(
        [tas_de_bois["o15"], tas_de_bois["o17"]])


def test_les_deux_produits_sont_illustres(tas_de_bois):
    """La conséquence utile : les DEUX madriers comptent une photo, donc les
    deux peuvent partir sur le site."""
    base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o15"])
    base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o17"])

    fiche = base.prospect(tas_de_bois["pid"])
    par_offre = tri.photos_par_offre(fiche)
    assert set(par_offre) == {tas_de_bois["o15"], tas_de_bois["o17"]}
    etat = tri.etat_des_offres(fiche)
    assert etat["sans_photo"] == []
    assert etat["nb_pretes"] == 2


def test_une_photo_sans_offre_ids_leve_plutot_que_de_se_taire():
    """Le silence de cette fonction dépublie des dépôts : `inscrire()` finit
    par `aligner_statut_sur_les_produits`, et le planificateur l'appelle tout
    seul jusqu'à 25 dépôts par tournée."""
    with pytest.raises(KeyError):
        tri.photos_par_offre({"photos": [{"id": 1, "garder": 1}]})


# ── La fusion ──────────────────────────────────────────────────────────────
def test_la_fusion_preserve_les_liens(tas_de_bois):
    """Les liens portent `photo_id`/`offre_id`, jamais `prospect_id` : ils
    survivent par construction. Ce test interdit qu'on ajoute un jour un
    `prospect_id` à la table de liaison."""
    base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o15"])
    base.attacher_photo(tas_de_bois["photo"], tas_de_bois["o17"])
    autre = _depot("Mirary bis")

    fusion.absorber(autre, tas_de_bois["pid"])

    assert _liens(tas_de_bois["photo"]) == sorted(
        [tas_de_bois["o15"], tas_de_bois["o17"]])


# ── La porte de derrière ───────────────────────────────────────────────────
def test_modifier_photo_n_ecrit_plus_le_lien(tas_de_bois):
    """C'était LA ligne du vol. `modifier_photo` filtre en silence : si le
    champ passait encore, un appelant croirait avoir écrit."""
    base.modifier_photo(tas_de_bois["photo"], offre_id=tas_de_bois["o15"])
    assert _liens(tas_de_bois["photo"]) == []
    assert "offre_id" not in {"garder", "couverture", "url_o2", "ordre"}
