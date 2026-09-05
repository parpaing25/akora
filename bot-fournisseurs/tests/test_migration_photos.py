"""La reprise de `photos.offre_id` dans `photos_offres` — une fois, sans casse.

`initialiser()` s'exécute à l'IMPORT de `bot.base` : une exception ici
tuerait le serveur, le planificateur, chaque outil et la suite de tests
entière. Et `_verrou` n'est pas réentrant : un appel imbriqué à `logguer`,
`lire_etat` ou `ecrire_etat` gèlerait le démarrage sans un mot. Ces tests
jouent donc la reprise sur une base FABRIQUÉE, avec le curseur ouvert, comme
`initialiser()` le fait.

    python -m pytest tests/test_migration_photos.py -q
"""
import sqlite3
import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import base  # noqa: E402


def _base_ancienne(chemin: Path) -> sqlite3.Connection:
    """Une base d'AVANT : le schéma d'aujourd'hui, la colonne gelée remplie,
    la table de liaison vide et aucun drapeau."""
    cx = sqlite3.connect(chemin)
    cx.row_factory = sqlite3.Row
    cx.execute("PRAGMA foreign_keys = ON")
    cx.executescript(base.SCHEMA)
    for table, colonnes in base.COLONNES_AJOUTEES.items():
        existantes = {l["name"] for l in cx.execute(f"PRAGMA table_info({table})")}
        for nom, definition in colonnes:
            if nom not in existantes:
                cx.execute(f"ALTER TABLE {table} ADD COLUMN {nom} {definition}")
    cx.execute("INSERT INTO prospects (id, cle, nom, statut, cree_le, maj_le) "
               "VALUES ('A', 'tel:1', 'A', 'a_trier', 't', 't')")
    cx.execute("INSERT INTO prospects (id, cle, nom, statut, cree_le, maj_le) "
               "VALUES ('B', 'tel:2', 'B', 'a_trier', 't', 't')")
    for oid, pid, libelle in ((869, "A", "madrier"), (877, "A", "bois carre"), (900, "B", "planche")):
        cx.execute("INSERT INTO offres (id, prospect_id, libelle_brut, vu_le) VALUES (?, ?, ?, 't')",
                   (oid, pid, libelle))
    # Les cinq couples réels du 03/09/2026 ((195,869) (196,869) (197,877)
    # (198,869) (199,864)), plus deux pièges : une offre absente (864 n'est
    # pas là) et une offre d'un AUTRE dépôt (900 est à B).
    for pid, oid in ((195, 869), (196, 869), (197, 877), (198, 869), (199, 864), (200, 900)):
        cx.execute("INSERT INTO photos (id, prospect_id, fichier, offre_id) VALUES (?, 'A', ?, ?)",
                   (pid, f"p{pid}.jpg", oid))
    cx.commit()
    return cx


def _liens(cx):
    return sorted(tuple(l) for l in cx.execute(
        "SELECT photo_id, offre_id FROM photos_offres"))


def test_la_reprise_verse_chaque_lien_sans_en_perdre(tmp_path):
    cx = _base_ancienne(tmp_path / "ancienne.db")
    base._reprendre_les_liens_photos(cx)
    assert _liens(cx) == [(195, 869), (196, 869), (197, 877), (198, 869)]


def test_une_offre_absente_ou_d_un_autre_depot_est_ecartee_sans_lever(tmp_path):
    """(199, 864) : l'offre n'existe pas. (200, 900) : l'offre est à B.
    Ni l'une ni l'autre ne doit lever — la reprise tourne à l'import."""
    cx = _base_ancienne(tmp_path / "pieges.db")
    base._reprendre_les_liens_photos(cx)            # ne lève pas
    liens = _liens(cx)
    assert (199, 864) not in liens and (200, 900) not in liens


def test_la_reprise_ne_se_rejoue_pas(tmp_path):
    """Le drapeau dans `etat` fait foi, pas l'état de la table : un lien
    DÉTACHÉ à la main entre deux démarrages ne ressuscite pas — et
    « rejouer si la table est vide » aurait le même défaut (détacher le
    dernier lien vide la table)."""
    cx = _base_ancienne(tmp_path / "rejeu.db")
    base._reprendre_les_liens_photos(cx)
    cx.execute("DELETE FROM photos_offres WHERE photo_id = 196")
    cx.execute("DELETE FROM photos_offres")          # même vidée entièrement
    base._reprendre_les_liens_photos(cx)
    assert _liens(cx) == []
    assert cx.execute("SELECT COUNT(*) n FROM etat WHERE cle = ?",
                      (base.CLE_REPRISE_PHOTOS,)).fetchone()["n"] == 1


def test_initialiser_rend_la_main():
    """`_verrou` est un `threading.Lock()` non réentrant que `initialiser()`
    détient : un `logguer`/`lire_etat`/`ecrire_etat` glissé dans la reprise
    gèlerait le démarrage sans message. Un délai borné attrape la faute la
    plus facile à commettre de ce chantier."""
    fini = threading.Event()
    threading.Thread(target=lambda: (base.initialiser(), fini.set()), daemon=True).start()
    assert fini.wait(10), "initialiser() ne rend pas la main : interblocage sur _verrou"
