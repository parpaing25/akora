"""Base SQLite locale : sources, prospects, publications, offres, prospection.

Une seule base, un seul fichier (data/bot.db) : facile à sauvegarder, facile à
jeter.

Ce qui change par rapport au bot d'annonces de Fonenako, et qui commande tout
le reste : **l'unité n'est pas la publication, c'est le FOURNISSEUR**. Un dépôt
qui poste son tarif dans cinq groupes n'est pas cinq prospects — c'est un seul,
avec cinq publications et une dizaine d'offres. Le regroupement se fait sur le
téléphone normalisé, sinon sur l'adresse de la page Facebook.
"""
from __future__ import annotations

import json
import re
import secrets as _secrets
import sqlite3
import threading
import uuid
from datetime import datetime, timezone

from .config import BASE, DOSSIER_DONNEES

_verrou = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nom               TEXT NOT NULL,
    url               TEXT NOT NULL UNIQUE,
    genre             TEXT NOT NULL DEFAULT 'groupe',
    requete           TEXT,
    actif             INTEGER NOT NULL DEFAULT 1,
    derniere_collecte TEXT,
    nb_trouves        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prospects (
    id               TEXT PRIMARY KEY,
    cle              TEXT UNIQUE,
    nom              TEXT NOT NULL DEFAULT '',
    nom_valide       INTEGER NOT NULL DEFAULT 0,
    metier           TEXT,
    telephone        TEXT,
    telephone_cle    TEXT,
    telephones_autres TEXT NOT NULL DEFAULT '[]',
    whatsapp         INTEGER NOT NULL DEFAULT 0,
    page_url         TEXT,
    auteur_fb        TEXT,
    ville            TEXT,
    quartier         TEXT,
    adresse          TEXT,
    lat              REAL,
    lng              REAL,
    langue           TEXT NOT NULL DEFAULT 'fr',
    retrait_sur_place INTEGER NOT NULL DEFAULT 0,
    livre            INTEGER NOT NULL DEFAULT 0,
    -- 'depot' | 'transporteur' | 'mixte'. Un transporteur ne vend aucun
    -- matériau : il loue sa benne. C'est un fournisseur d'un autre genre, et
    -- sans lui aucun « prix rendu chantier » n'est calculable.
    nature           TEXT NOT NULL DEFAULT 'depot',
    rayon_km         REAL,
    seuil_franco     INTEGER,

    statut           TEXT NOT NULL DEFAULT 'a_trier',
    score            INTEGER NOT NULL DEFAULT 0,
    niveau           TEXT,
    detail_score     TEXT NOT NULL DEFAULT '[]',
    manques          TEXT NOT NULL DEFAULT '[]',
    note             TEXT,

    nb_publications  INTEGER NOT NULL DEFAULT 0,
    premiere_vue     TEXT,
    derniere_vue     TEXT,

    lu_par_llm       INTEGER NOT NULL DEFAULT 0,
    llm_confiance    INTEGER,
    llm_doute        TEXT,
    llm_resume       TEXT,

    jeton            TEXT UNIQUE,
    fiche_url        TEXT,
    reserve_le       TEXT,
    prospect_distant TEXT,

    contacte_le      TEXT,
    canal_contact    TEXT,
    nb_relances      INTEGER NOT NULL DEFAULT 0,
    derniere_relance TEXT,
    prochaine_action TEXT,
    revendique_le    TEXT,
    fournisseur_id   TEXT,

    cree_le          TEXT NOT NULL,
    maj_le           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publications (
    id          TEXT PRIMARY KEY,
    prospect_id TEXT,
    empreinte   TEXT UNIQUE,
    permalien   TEXT,
    source_id   INTEGER,
    source_nom  TEXT,
    auteur      TEXT,
    publie_le   TEXT,
    collecte_le TEXT NOT NULL,
    texte       TEXT NOT NULL,
    dossier     TEXT,
    nb_offres   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS offres (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id    TEXT NOT NULL,
    publication_id TEXT,
    libelle_brut   TEXT NOT NULL,
    materiau_slug  TEXT,
    materiau_nom   TEXT,
    type_slug      TEXT,
    type_nom       TEXT,
    famille_slug   TEXT,
    unite          TEXT,
    prix           INTEGER,
    devise_source  TEXT,
    quantite_min   INTEGER,
    certitude      INTEGER NOT NULL DEFAULT 0,
    ambigu         INTEGER NOT NULL DEFAULT 0,
    hors_catalogue INTEGER NOT NULL DEFAULT 0,
    garder         INTEGER NOT NULL DEFAULT 1,
    vu_le          TEXT NOT NULL,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS photos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id    TEXT NOT NULL,
    publication_id TEXT,
    fichier        TEXT NOT NULL,
    url_source     TEXT,
    largeur        INTEGER,
    hauteur        INTEGER,
    garder         INTEGER NOT NULL DEFAULT 1,
    couverture     INTEGER NOT NULL DEFAULT 0,
    ordre          INTEGER NOT NULL DEFAULT 0,
    url_o2         TEXT,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evenements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id TEXT NOT NULL,
    ts          TEXT NOT NULL,
    genre       TEXT NOT NULL,
    message     TEXT NOT NULL,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refuses (
    cle    TEXT PRIMARY KEY,
    nom    TEXT,
    motif  TEXT,
    ts     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS materiaux_absents (
    libelle     TEXT PRIMARY KEY,
    occurrences INTEGER NOT NULL DEFAULT 1,
    exemple     TEXT,
    derniere    TEXT NOT NULL
);

-- ── La flotte : ce qui rend le « prix rendu chantier » calculable ─────────
-- Miroir de `vehicules_livraison` côté Akora. Une capacité ou un tarif absent
-- reste NULL : on ne convertit pas « 6 roues » en mètres cubes (règle A2.8).
CREATE TABLE IF NOT EXISTS vehicules (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id    TEXT NOT NULL,
    publication_id TEXT,
    libelle_brut   TEXT NOT NULL,
    nom            TEXT NOT NULL,
    categorie      TEXT,
    capacite_m3    REAL,
    capacite_kg    REAL,
    prix_par_km    INTEGER,
    forfait_base   INTEGER,
    km_inclus      REAL,
    prix_minimum   INTEGER,
    aller_retour   INTEGER NOT NULL DEFAULT 0,
    certitude      INTEGER NOT NULL DEFAULT 0,
    garder         INTEGER NOT NULL DEFAULT 1,
    vu_le          TEXT NOT NULL,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

-- ── Les demandes d'acheteurs ──────────────────────────────────────────────
-- « Mila fasika 3 camion aho eto Ivato » : un besoin daté, chiffré, localisé.
-- Le bot les jetait ; c'est pourtant ce qui prouve la demande à un dépôt qui
-- hésite. Elles restent INTERNES : rien n'est republié, personne n'a donné son
-- accord pour ça.
CREATE TABLE IF NOT EXISTS demandes (
    id            TEXT PRIMARY KEY,
    empreinte     TEXT UNIQUE,
    permalien     TEXT,
    source_id     INTEGER,
    source_nom    TEXT,
    auteur        TEXT,
    auteur_url    TEXT,
    texte         TEXT NOT NULL,
    publie_le     TEXT,
    collecte_le   TEXT NOT NULL,
    dossier       TEXT,

    telephone     TEXT,
    telephone_cle TEXT,
    ville         TEXT,
    quartier      TEXT,
    langue        TEXT NOT NULL DEFAULT 'fr',

    materiau_slug TEXT,
    materiau_nom  TEXT,
    type_slug     TEXT,
    type_nom      TEXT,
    famille_slug  TEXT,
    quantite      REAL,
    unite         TEXT,
    budget        INTEGER,
    urgence       INTEGER NOT NULL DEFAULT 0,

    statut        TEXT NOT NULL DEFAULT 'nouvelle',
    note          TEXT
);

CREATE TABLE IF NOT EXISTS journal (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      TEXT NOT NULL,
    niveau  TEXT NOT NULL,
    message TEXT NOT NULL
);

-- Groupes et pages repérés par la prospection, en attente de votre verdict.
-- `ecarte` est une mémoire volontaire : sans elle, chaque prospection
-- reproposerait les mêmes trente groupes déjà refusés.
CREATE TABLE IF NOT EXISTS candidats_sources (
    cle        TEXT PRIMARY KEY,          -- identifiant Facebook du groupe/page
    genre      TEXT NOT NULL,             -- 'groupe' | 'page'
    nom        TEXT NOT NULL,
    url        TEXT NOT NULL,
    effectif   INTEGER,                   -- membres (groupe) ou abonnés (page)
    rythme     INTEGER,                   -- publications par jour, si affiché
    prive      INTEGER NOT NULL DEFAULT 0,
    lieu       TEXT,
    categorie  TEXT,
    requete    TEXT,                      -- la recherche qui l'a fait sortir
    -- Comment on l'a connu, et ce qu'il a RÉELLEMENT donné. Une source vue à
    -- l'œuvre sur le fil vaut mieux qu'une source jugée sur son nombre de
    -- membres : « 5 annonces retenues sur 6 vues » est une preuve, pas un
    -- pronostic.
    origine    TEXT NOT NULL DEFAULT 'recherche',   -- 'recherche' | 'fil'
    vues       INTEGER NOT NULL DEFAULT 0,   -- publications croisées
    retenues   INTEGER NOT NULL DEFAULT 0,   -- celles qui remplissaient nos critères
    publiees   INTEGER NOT NULL DEFAULT 0,   -- celles qui ont fini sur le site
    vu_dabord  TEXT,                         -- première fois qu'on l'a croisé
    note       INTEGER NOT NULL DEFAULT 0,
    niveau     TEXT,
    alertes    TEXT,                      -- JSON
    details    TEXT,                      -- JSON, pour montrer le pourquoi
    vu_le      TEXT NOT NULL,
    statut     TEXT NOT NULL DEFAULT 'nouveau',   -- nouveau | adopte | ecarte
    decide_le  TEXT
);

CREATE TABLE IF NOT EXISTS etat (
    cle    TEXT PRIMARY KEY,
    valeur TEXT
);

CREATE INDEX IF NOT EXISTS idx_prospects_statut ON prospects(statut);
CREATE INDEX IF NOT EXISTS idx_prospects_tel    ON prospects(telephone_cle);
CREATE INDEX IF NOT EXISTS idx_prospects_score  ON prospects(score DESC);
CREATE INDEX IF NOT EXISTS idx_pub_prospect     ON publications(prospect_id);
CREATE INDEX IF NOT EXISTS idx_offres_prospect  ON offres(prospect_id);
CREATE INDEX IF NOT EXISTS idx_offres_materiau  ON offres(materiau_slug);
CREATE INDEX IF NOT EXISTS idx_photos_prospect  ON photos(prospect_id);
CREATE INDEX IF NOT EXISTS idx_evt_prospect     ON evenements(prospect_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_journal_ts       ON journal(ts DESC);
CREATE INDEX IF NOT EXISTS idx_vehicules_prosp  ON vehicules(prospect_id);
CREATE INDEX IF NOT EXISTS idx_demandes_statut  ON demandes(statut, collecte_le DESC);
CREATE INDEX IF NOT EXISTS idx_demandes_mat     ON demandes(materiau_slug);
"""

# Colonnes ajoutées après coup. SQLite n'a pas d'`ADD COLUMN IF NOT EXISTS` :
# une base créée avant ces champs doit être complétée au démarrage, sinon
# toutes les requêtes tombent sur « no such column » — et on ne jette pas la
# base d'un utilisateur pour ajouter trois colonnes.
COLONNES_AJOUTEES = {
    "candidats_sources": [
        ("origine", "TEXT NOT NULL DEFAULT 'recherche'"),
        ("vues", "INTEGER NOT NULL DEFAULT 0"),
        ("retenues", "INTEGER NOT NULL DEFAULT 0"),
        ("publiees", "INTEGER NOT NULL DEFAULT 0"),
        ("vu_dabord", "TEXT"),
    ],
    "prospects": [
        ("nature", "TEXT NOT NULL DEFAULT 'depot'"),
        ("rayon_km", "REAL"),
        ("seuil_franco", "INTEGER"),
        # Le site d'un dépôt, quand il en donne un dans sa publication : un
        # canal de contact de plus, et le signe d'une entreprise établie.
        ("site_web", "TEXT"),
        # Le groupe ou la page d'où venait la publication. C'est ce qui permet
        # de créditer la source quand la fiche part en ligne : une fiche
        # réservée est la seule preuve solide qu'un groupe vaut la peine.
        ("origine_cle", "TEXT"),
    ],
}

# Colonnes rendues comme des listes côté interface, mais stockées en JSON.
CHAMPS_JSON = ("manques", "detail_score", "telephones_autres")

# Les statuts, dans l'ordre du parcours d'un prospect.
STATUTS = (
    "a_trier", "incomplet", "valide", "reserve", "a_contacter", "contacte",
    "relance", "revendique", "refuse", "rejete", "doublon", "deja_client",
)


def connexion() -> sqlite3.Connection:
    DOSSIER_DONNEES.mkdir(parents=True, exist_ok=True)
    cx = sqlite3.connect(BASE, timeout=30)
    cx.row_factory = sqlite3.Row
    cx.execute("PRAGMA foreign_keys = ON")
    return cx


def initialiser() -> None:
    with _verrou, connexion() as cx:
        cx.executescript(SCHEMA)
        for table, colonnes in COLONNES_AJOUTEES.items():
            existantes = {
                ligne["name"]
                for ligne in cx.execute(f"PRAGMA table_info({table})").fetchall()
            }
            for nom, definition in colonnes:
                if nom not in existantes:
                    cx.execute(f"ALTER TABLE {table} ADD COLUMN {nom} {definition}")


def maintenant() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _sortir(ligne: sqlite3.Row | None) -> dict | None:
    if ligne is None:
        return None
    valeurs = dict(ligne)
    for champ in CHAMPS_JSON:
        if isinstance(valeurs.get(champ), str):
            try:
                valeurs[champ] = json.loads(valeurs[champ])
            except json.JSONDecodeError:
                valeurs[champ] = []
    return valeurs


# ── Journal ────────────────────────────────────────────────────────────────
def logguer(message: str, niveau: str = "info") -> None:
    with _verrou, connexion() as cx:
        cx.execute(
            "INSERT INTO journal (ts, niveau, message) VALUES (?, ?, ?)",
            (maintenant(), niveau, message),
        )
        # Le journal ne doit pas grossir sans fin : on garde les 2 000 dernières.
        cx.execute(
            "DELETE FROM journal WHERE id NOT IN "
            "(SELECT id FROM journal ORDER BY id DESC LIMIT 2000)"
        )
    print(f"[{niveau}] {message}", flush=True)


def lire_journal(limite: int = 60) -> list[dict]:
    with _verrou, connexion() as cx:
        lignes = cx.execute(
            "SELECT ts, niveau, message FROM journal ORDER BY id DESC LIMIT ?",
            (limite,),
        ).fetchall()
    return [dict(l) for l in lignes]


# ── État ───────────────────────────────────────────────────────────────────
def ecrire_etat(cle: str, valeur: str) -> None:
    with _verrou, connexion() as cx:
        cx.execute(
            "INSERT INTO etat (cle, valeur) VALUES (?, ?) "
            "ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
            (cle, valeur),
        )


def lire_etat(cle: str, defaut: str = "") -> str:
    with _verrou, connexion() as cx:
        ligne = cx.execute("SELECT valeur FROM etat WHERE cle = ?", (cle,)).fetchone()
    return ligne["valeur"] if ligne else defaut


# ── Sources ────────────────────────────────────────────────────────────────
def sources(actives_seulement: bool = False, pour_collecte: bool = False) -> list[dict]:
    requete = "SELECT * FROM sources"
    if actives_seulement:
        requete += " WHERE actif = 1"
    # Pour une collecte, on commence par la source la plus anciennement vue :
    # l'ordre par identifiant sert toujours les mêmes en premier, et les
    # dernières de la liste ne sont jamais atteintes quand le temps manque.
    requete += (
        " ORDER BY derniere_collecte IS NOT NULL, derniere_collecte, id"
        if pour_collecte else " ORDER BY id"
    )
    with _verrou, connexion() as cx:
        return [dict(l) for l in cx.execute(requete).fetchall()]


# -- Candidats repérés par la prospection de sources -------------------------
def urls_sources() -> set[str]:
    """Les adresses déjà surveillées, pour ne pas les reproposer."""
    with _verrou, connexion() as cx:
        lignes = cx.execute("SELECT url FROM sources").fetchall()
    # Facebook écrit la même source de dix façons : on compare sur l'essentiel.
    return {_cle_url(l["url"]) for l in lignes} | {l["url"] for l in lignes}


def _cle_url(url: str) -> str:
    u = (url or "").strip().lower().rstrip("/")
    u = re.sub(r"^https?://(www\.|m\.|web\.)?facebook\.com", "", u)
    return re.sub(r"\?.*$", "", u)


def candidats_ecartes() -> set[str]:
    with _verrou, connexion() as cx:
        return {
            l["cle"] for l in cx.execute(
                "SELECT cle FROM candidats_sources WHERE statut IN ('ecarte', 'adopte')"
            ).fetchall()
        }


def ajouter_candidat(c: dict) -> bool:
    """Range un candidat. Renvoie True s'il est nouveau.

    Un candidat déjà jugé n'est pas réveillé : on rafraîchit seulement ses
    chiffres, parce qu'un groupe grossit et que sa note doit suivre.
    """
    with _verrou, connexion() as cx:
        existe = cx.execute(
            "SELECT statut FROM candidats_sources WHERE cle = ?", (c["cle"],)
        ).fetchone()
        if existe:
            cx.execute(
                "UPDATE candidats_sources SET effectif = ?, rythme = ?, note = ?, "
                "niveau = ?, alertes = ?, details = ?, vu_le = ? WHERE cle = ?",
                (c.get("effectif"), c.get("rythme_par_jour"), c.get("note", 0),
                 c.get("niveau"), json.dumps(c.get("alertes") or [], ensure_ascii=False),
                 json.dumps(c.get("details") or [], ensure_ascii=False),
                 maintenant(), c["cle"]),
            )
            return False
        cx.execute(
            "INSERT INTO candidats_sources (cle, genre, nom, url, effectif, rythme, "
            "prive, lieu, categorie, requete, note, niveau, alertes, details, vu_le) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (c["cle"], c["genre"], c["nom"], c["url"], c.get("effectif"),
             c.get("rythme_par_jour"), int(bool(c.get("prive"))), c.get("lieu"),
             c.get("categorie"), c.get("requete"), c.get("note", 0), c.get("niveau"),
             json.dumps(c.get("alertes") or [], ensure_ascii=False),
             json.dumps(c.get("details") or [], ensure_ascii=False), maintenant()),
        )
        return True


def observer_source(cle: str, genre: str, nom: str, url: str,
                    retenue: bool = False, deja_vue: bool = False) -> None:
    """Note qu'on a croisé une publication venant de cette source.

    C'est la mesure la plus honnête dont on dispose : elle ne prédit pas ce
    qu'une source vaut, elle constate ce qu'elle a donné. Un groupe croisé
    douze fois sur le fil sans qu'une seule publication remplisse nos critères
    n'a pas à devenir une source, quel que soit son nombre de membres.

    Une source DÉJÀ surveillée ou DÉJÀ écartée n'est pas comptée : le fil sert
    à découvrir, pas à re-proposer ce qui est tranché.
    """
    if not cle or not nom:
        return
    with _verrou, connexion() as cx:
        deja = cx.execute(
            "SELECT statut FROM candidats_sources WHERE cle = ?", (cle,)
        ).fetchone()
        if deja and deja["statut"] != "nouveau":
            return
        if cx.execute("SELECT 1 FROM sources WHERE url = ?", (url,)).fetchone():
            return
        if deja:
            # `deja_vue` : la vue a été comptée avant le tri, on n'ajoute ici
            # que la retenue. Sans ça, une publication gardée compterait deux
            # vues et fausserait le rendement vers le bas.
            if deja_vue:
                cx.execute(
                    "UPDATE candidats_sources SET retenues = retenues + 1, "
                    "vu_le = ? WHERE cle = ?", (maintenant(), cle))
            else:
                cx.execute(
                    "UPDATE candidats_sources SET vues = vues + 1, "
                    "retenues = retenues + ?, vu_le = ? WHERE cle = ?",
                    (1 if retenue else 0, maintenant(), cle))
        else:
            cx.execute(
                "INSERT INTO candidats_sources (cle, genre, nom, url, origine, "
                "vues, retenues, vu_le, vu_dabord) VALUES (?,?,?,?,'fil',1,?,?,?)",
                (cle, genre, nom, url, 1 if retenue else 0,
                 maintenant(), maintenant()),
            )


def compter_publication_source(cle: str) -> None:
    """Une annonce venue de cette source est passée en ligne : la meilleure preuve."""
    if not cle:
        return
    with _verrou, connexion() as cx:
        cx.execute(
            "UPDATE candidats_sources SET publiees = publiees + 1 WHERE cle = ?",
            (cle,),
        )


def candidats(statut: str = "nouveau", limite: int = 300) -> list[dict]:
    with _verrou, connexion() as cx:
        lignes = cx.execute(
            "SELECT * FROM candidats_sources WHERE statut = ? "
            "ORDER BY note DESC, effectif DESC LIMIT ?",
            (statut, limite),
        ).fetchall()
    sortie = []
    for l in lignes:
        d = dict(l)
        for cle in ("alertes", "details"):
            try:
                d[cle] = json.loads(d[cle] or "[]")
            except (json.JSONDecodeError, TypeError):
                d[cle] = []
        sortie.append(d)
    return sortie


def decider_candidat(cle: str, statut: str) -> dict | None:
    """« adopte » ou « ecarte ». Adopter crée la source du même coup."""
    with _verrou, connexion() as cx:
        c = cx.execute(
            "SELECT * FROM candidats_sources WHERE cle = ?", (cle,)
        ).fetchone()
        if not c:
            return None
        cx.execute(
            "UPDATE candidats_sources SET statut = ?, decide_le = ? WHERE cle = ?",
            (statut, maintenant(), cle),
        )
        c = dict(c)
    if statut == "adopte":
        ajouter_source(c["nom"], c["url"], c["genre"],
                       requete=c.get("requete") or "")
    return c


def compter_candidats() -> dict:
    with _verrou, connexion() as cx:
        lignes = cx.execute(
            "SELECT statut, COUNT(*) n FROM candidats_sources GROUP BY statut"
        ).fetchall()
    return {l["statut"]: l["n"] for l in lignes}


def ajouter_source(nom: str, url: str, genre: str = "groupe", requete: str = "") -> dict:
    with _verrou, connexion() as cx:
        existante = cx.execute("SELECT * FROM sources WHERE url = ?", (url,)).fetchone()
        if existante:
            return dict(existante)
        curseur = cx.execute(
            "INSERT INTO sources (nom, url, genre, requete) VALUES (?, ?, ?, ?)",
            (nom, url, genre, requete or None),
        )
        ligne = cx.execute(
            "SELECT * FROM sources WHERE id = ?", (curseur.lastrowid,)
        ).fetchone()
    return dict(ligne)


def modifier_source(sid: int, **champs) -> None:
    autorises = {"nom", "url", "genre", "requete", "actif",
                 "derniere_collecte", "nb_trouves"}
    champs = {c: v for c, v in champs.items() if c in autorises}
    if not champs:
        return
    assignations = ", ".join(f"{c} = ?" for c in champs)
    with _verrou, connexion() as cx:
        cx.execute(
            f"UPDATE sources SET {assignations} WHERE id = ?", (*champs.values(), sid)
        )


def rendement_des_sources() -> list[dict]:
    """Ce que chaque source a VRAIMENT rapporté, et une note sur 100.

    Le compteur `nb_trouves` disait combien de publications une source avait
    mises en file — pas si elles valaient quelque chose. Une source peut en
    donner quarante et pas un seul prix.

    Tout est donc recalculé depuis les données, jamais depuis un compteur qui
    dérive : publications gardées, fournisseurs distincts, offres appariées au
    catalogue, offres avec un prix. Une source parcourue sans rien donner
    depuis longtemps se voit, et se coupe.

    La note répond à une seule question : **faut-il continuer à la parcourir ?**
    """
    with _verrou, connexion() as cx:
        lignes = cx.execute(
            """SELECT s.*,
                 (SELECT COUNT(*) FROM publications v WHERE v.source_id = s.id)
                   AS publications,
                 (SELECT COUNT(DISTINCT v.prospect_id) FROM publications v
                   WHERE v.source_id = s.id AND v.prospect_id IS NOT NULL)
                   AS fournisseurs,
                 (SELECT COUNT(*) FROM offres o
                    JOIN publications v ON v.id = o.publication_id
                   WHERE v.source_id = s.id) AS offres,
                 (SELECT COUNT(*) FROM offres o
                    JOIN publications v ON v.id = o.publication_id
                   WHERE v.source_id = s.id AND o.materiau_slug IS NOT NULL)
                   AS offres_appariees,
                 (SELECT COUNT(*) FROM offres o
                    JOIN publications v ON v.id = o.publication_id
                   WHERE v.source_id = s.id AND o.prix IS NOT NULL)
                   AS offres_avec_prix,
                 (SELECT COUNT(*) FROM demandes d WHERE d.source_id = s.id)
                   AS demandes,
                 (SELECT MAX(v.collecte_le) FROM publications v
                   WHERE v.source_id = s.id) AS derniere_trouvaille
               FROM sources s ORDER BY s.id"""
        ).fetchall()

    resultat = []
    for ligne in lignes:
        source = dict(ligne)
        source.update(_noter_source(source))
        resultat.append(source)
    # La meilleure d'abord ; celles jamais parcourues restent en bas, sans note
    # — les classer à zéro laisserait croire qu'elles ont démérité.
    resultat.sort(key=lambda s: (s["note"] is None, -(s["note"] or 0)))
    return resultat


def _noter_source(source: dict) -> dict:
    """{note, niveau, verdict} — ou note None si la source n'a jamais tourné."""
    if not source.get("derniere_collecte"):
        return {"note": None, "niveau": "neuve",
                "verdict": "jamais parcourue"}

    fournisseurs = source.get("fournisseurs") or 0
    appariees = source.get("offres_appariees") or 0
    avec_prix = source.get("offres_avec_prix") or 0
    demandes_ = source.get("demandes") or 0

    # Les paliers, plutôt qu'une règle de trois : une source qui donne trois
    # fournisseurs vaut déjà largement le détour, et la vingtième n'apporte
    # pas sept fois plus que la troisième.
    def palier(valeur: int, seuils, points) -> int:
        for seuil, gain in zip(seuils, points):
            if valeur <= seuil:
                return gain
        return points[-1]

    note = 0
    note += palier(fournisseurs, (0, 1, 3, 8), (0, 12, 24, 32, 35))
    note += palier(appariees, (0, 2, 6, 15), (0, 8, 16, 22, 25))
    # Le prix pèse autant que l'appariement : c'est ce qui manque le plus, et
    # une source qui en ramène régulièrement vaut deux qui n'en donnent aucun.
    note += palier(avec_prix, (0, 1, 4, 10), (0, 10, 18, 22, 25))
    note += palier(demandes_, (0, 1, 4), (0, 3, 5, 5))

    age = _age_en_jours(source.get("derniere_trouvaille"))
    if age is None:
        fraicheur, mot = 0, "rien trouvé pour l'instant"
    elif age <= 7:
        fraicheur, mot = 10, "active cette semaine"
    elif age <= 30:
        fraicheur, mot = 6, f"dernière trouvaille il y a {age} j"
    elif age <= 90:
        fraicheur, mot = 2, f"muette depuis {age} j"
    else:
        fraicheur, mot = 0, f"muette depuis {age} j"
    note += fraicheur

    note = max(0, min(100, note))
    if note >= 65:
        niveau, verdict = "fiable", f"{fournisseurs} fournisseur(s), {avec_prix} prix — {mot}"
    elif note >= 35:
        niveau, verdict = "moyenne", f"{fournisseurs} fournisseur(s), {avec_prix} prix — {mot}"
    elif source.get("publications"):
        niveau, verdict = "faible", f"{source['publications']} publication(s), rien d'exploitable — {mot}"
    else:
        niveau, verdict = "muette", f"parcourue, aucune publication retenue — {mot}"
    return {"note": note, "niveau": niveau, "verdict": verdict}


def _age_en_jours(horodatage: str | None) -> int | None:
    if not horodatage:
        return None
    try:
        quand = datetime.fromisoformat(horodatage)
    except ValueError:
        return None
    if quand.tzinfo is None:
        quand = quand.replace(tzinfo=timezone.utc)
    return max(0, int((datetime.now(timezone.utc) - quand).total_seconds() // 86400))


def supprimer_source(sid: int) -> None:
    with _verrou, connexion() as cx:
        cx.execute("DELETE FROM sources WHERE id = ?", (sid,))


# ── Prospects ──────────────────────────────────────────────────────────────
def trouver_prospect(cle: str) -> dict | None:
    """Le regroupement : même clé = même fournisseur, quelle que soit la source."""
    if not cle:
        return None
    with _verrou, connexion() as cx:
        return _sortir(
            cx.execute("SELECT * FROM prospects WHERE cle = ?", (cle,)).fetchone()
        )


def prospect_par_telephone(telephone_cle: str) -> dict | None:
    if not telephone_cle:
        return None
    with _verrou, connexion() as cx:
        return _sortir(cx.execute(
            "SELECT * FROM prospects WHERE telephone_cle = ? LIMIT 1", (telephone_cle,)
        ).fetchone())


def prospect(pid: str) -> dict | None:
    with _verrou, connexion() as cx:
        ligne = cx.execute("SELECT * FROM prospects WHERE id = ?", (pid,)).fetchone()
        if ligne is None:
            return None
        fiche = _sortir(ligne)
        fiche["offres"] = [dict(o) for o in cx.execute(
            "SELECT * FROM offres WHERE prospect_id = ? "
            "ORDER BY garder DESC, famille_slug, materiau_nom", (pid,)
        ).fetchall()]
        fiche["photos"] = [dict(p) for p in cx.execute(
            "SELECT * FROM photos WHERE prospect_id = ? "
            "ORDER BY couverture DESC, ordre", (pid,)
        ).fetchall()]
        fiche["publications"] = [dict(p) for p in cx.execute(
            "SELECT id, permalien, source_nom, publie_le, texte, dossier, nb_offres "
            "FROM publications WHERE prospect_id = ? ORDER BY collecte_le DESC", (pid,)
        ).fetchall()]
        fiche["vehicules"] = [dict(v) for v in cx.execute(
            "SELECT * FROM vehicules WHERE prospect_id = ? "
            "ORDER BY garder DESC, capacite_m3", (pid,)
        ).fetchall()]
        fiche["evenements"] = [dict(e) for e in cx.execute(
            "SELECT ts, genre, message FROM evenements WHERE prospect_id = ? "
            "ORDER BY ts DESC LIMIT 40", (pid,)
        ).fetchall()]
    return fiche


def creer_prospect(champs: dict) -> str:
    """Crée un prospect. Renvoie son identifiant (existant si la clé est connue)."""
    deja = trouver_prospect(champs.get("cle") or "")
    if deja:
        return deja["id"]
    horodatage = maintenant()
    donnees = {
        "id": str(uuid.uuid4()),
        "cree_le": horodatage,
        "maj_le": horodatage,
        "premiere_vue": horodatage,
        "derniere_vue": horodatage,
        # Le jeton de revendication est tiré ICI, une fois pour toutes : c'est
        # lui qui figure dans le message envoyé au fournisseur, il ne doit
        # jamais changer d'une relance à l'autre.
        "jeton": _secrets.token_urlsafe(24),
    }
    for champ, valeur in champs.items():
        donnees[champ] = (
            json.dumps(valeur, ensure_ascii=False) if champ in CHAMPS_JSON else valeur
        )
    colonnes = ", ".join(donnees)
    trous = ", ".join("?" for _ in donnees)
    with _verrou, connexion() as cx:
        cx.execute(
            f"INSERT INTO prospects ({colonnes}) VALUES ({trous})",
            tuple(donnees.values()),
        )
    return donnees["id"]


def modifier_prospect(pid: str, champs: dict) -> None:
    if not champs:
        return
    champs = dict(champs)
    champs["maj_le"] = maintenant()
    valeurs = [
        json.dumps(v, ensure_ascii=False) if c in CHAMPS_JSON else v
        for c, v in champs.items()
    ]
    assignations = ", ".join(f"{c} = ?" for c in champs)
    with _verrou, connexion() as cx:
        cx.execute(f"UPDATE prospects SET {assignations} WHERE id = ?", (*valeurs, pid))


def supprimer_prospect(pid: str) -> None:
    with _verrou, connexion() as cx:
        cx.execute("DELETE FROM prospects WHERE id = ?", (pid,))


def lister_prospects(statut: str = "", source_id: int = 0, recherche: str = "",
                     famille: str = "", tri: str = "score",
                     limite: int = 400) -> list[dict]:
    conditions, parametres = [], []
    if statut and statut != "tous":
        conditions.append("p.statut = ?")
        parametres.append(statut)
    if source_id:
        conditions.append(
            "EXISTS (SELECT 1 FROM publications v "
            "WHERE v.prospect_id = p.id AND v.source_id = ?)"
        )
        parametres.append(source_id)
    if famille:
        conditions.append(
            "EXISTS (SELECT 1 FROM offres o WHERE o.prospect_id = p.id "
            "AND o.garder = 1 AND o.famille_slug = ?)"
        )
        parametres.append(famille)
    if recherche:
        conditions.append(
            "(p.nom LIKE ? OR p.telephone LIKE ? OR p.ville LIKE ? OR p.quartier LIKE ? "
            "OR EXISTS (SELECT 1 FROM offres o WHERE o.prospect_id = p.id "
            "AND o.materiau_nom LIKE ?))"
        )
        parametres += [f"%{recherche}%"] * 5

    ordres = {
        "score": "p.score DESC, p.derniere_vue DESC",
        "recent": "p.derniere_vue DESC",
        "offres": "nb_offres DESC, p.score DESC",
        "nom": "p.nom COLLATE NOCASE",
    }
    ou = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    with _verrou, connexion() as cx:
        lignes = cx.execute(
            f"""SELECT p.*,
                   (SELECT COUNT(*) FROM offres o
                     WHERE o.prospect_id = p.id AND o.garder = 1)  AS nb_offres,
                   (SELECT COUNT(*) FROM photos f
                     WHERE f.prospect_id = p.id AND f.garder = 1)  AS nb_photos,
                   (SELECT f.fichier FROM photos f
                     WHERE f.prospect_id = p.id AND f.garder = 1
                     ORDER BY f.couverture DESC, f.ordre LIMIT 1)  AS photo_couverture,
                   (SELECT f.publication_id FROM photos f
                     WHERE f.prospect_id = p.id AND f.garder = 1
                     ORDER BY f.couverture DESC, f.ordre LIMIT 1)  AS photo_publication,
                   (SELECT group_concat(DISTINCT o.type_nom) FROM offres o
                     WHERE o.prospect_id = p.id AND o.garder = 1)  AS types_vendus
                FROM prospects p {ou}
             ORDER BY {ordres.get(tri, ordres['score'])} LIMIT ?""",
            (*parametres, limite),
        ).fetchall()
    return [_sortir(l) for l in lignes]


def compteurs() -> dict:
    with _verrou, connexion() as cx:
        par_statut = {l["statut"]: l["n"] for l in cx.execute(
            "SELECT statut, COUNT(*) n FROM prospects GROUP BY statut"
        ).fetchall()}
        offres = cx.execute(
            "SELECT COUNT(*) n FROM offres WHERE garder = 1"
        ).fetchone()["n"]
        appariees = cx.execute(
            "SELECT COUNT(*) n FROM offres WHERE garder = 1 AND materiau_slug IS NOT NULL"
        ).fetchone()["n"]
        publications = cx.execute("SELECT COUNT(*) n FROM publications").fetchone()["n"]
    return {
        **{statut: par_statut.get(statut, 0) for statut in STATUTS},
        "total": sum(par_statut.values()),
        "offres": offres,
        "offres_appariees": appariees,
        "publications": publications,
    }


# ── Publications ───────────────────────────────────────────────────────────
def publication_existe(empreinte: str) -> bool:
    with _verrou, connexion() as cx:
        return cx.execute(
            "SELECT 1 FROM publications WHERE empreinte = ?", (empreinte,)
        ).fetchone() is not None


def ajouter_publication(champs: dict) -> str | None:
    donnees = {"id": str(uuid.uuid4()), "collecte_le": maintenant(), **champs}
    colonnes = ", ".join(donnees)
    trous = ", ".join("?" for _ in donnees)
    try:
        with _verrou, connexion() as cx:
            cx.execute(
                f"INSERT INTO publications ({colonnes}) VALUES ({trous})",
                tuple(donnees.values()),
            )
    except sqlite3.IntegrityError:
        return None          # empreinte déjà vue
    return donnees["id"]


def rattacher_publication(pubid: str, prospect_id: str, nb_offres: int = 0) -> None:
    with _verrou, connexion() as cx:
        cx.execute(
            "UPDATE publications SET prospect_id = ?, nb_offres = ? WHERE id = ?",
            (prospect_id, nb_offres, pubid),
        )


def supprimer_publication(pubid: str) -> None:
    with _verrou, connexion() as cx:
        cx.execute("DELETE FROM publications WHERE id = ?", (pubid,))


# ── Offres ─────────────────────────────────────────────────────────────────
def ajouter_offre(prospect_id: str, publication_id: str | None, offre: dict) -> int | None:
    """Ajoute une offre, sauf si le même matériau est déjà connu du prospect.

    Un dépôt reposte son tarif chaque semaine : sans ce garde-fou, un prospect
    finirait avec quarante fois « parpaing 15 à 1 400 Ar ». Quand le matériau
    est déjà là, on ne duplique pas — on rafraîchit le prix, car le dernier
    tarif publié est celui qui vaut.
    """
    empreinte = offre.get("materiau_slug") or offre.get("libelle_brut")
    with _verrou, connexion() as cx:
        jumelle = cx.execute(
            "SELECT id, prix FROM offres WHERE prospect_id = ? "
            "AND COALESCE(materiau_slug, libelle_brut) = ? LIMIT 1",
            (prospect_id, empreinte),
        ).fetchone()
        if jumelle:
            if offre.get("prix") and offre["prix"] != jumelle["prix"]:
                cx.execute(
                    "UPDATE offres SET prix = ?, vu_le = ?, publication_id = ? WHERE id = ?",
                    (offre["prix"], maintenant(), publication_id, jumelle["id"]),
                )
            return None
        donnees = {
            "prospect_id": prospect_id,
            "publication_id": publication_id,
            "vu_le": maintenant(),
            **offre,
        }
        colonnes = ", ".join(donnees)
        trous = ", ".join("?" for _ in donnees)
        curseur = cx.execute(
            f"INSERT INTO offres ({colonnes}) VALUES ({trous})", tuple(donnees.values())
        )
    return curseur.lastrowid


def modifier_offre(oid: int, **champs) -> None:
    autorises = {"materiau_slug", "materiau_nom", "type_slug", "type_nom",
                 "famille_slug", "unite", "prix", "quantite_min", "garder",
                 "certitude", "ambigu", "hors_catalogue"}
    champs = {c: v for c, v in champs.items() if c in autorises}
    if not champs:
        return
    assignations = ", ".join(f"{c} = ?" for c in champs)
    with _verrou, connexion() as cx:
        cx.execute(
            f"UPDATE offres SET {assignations} WHERE id = ?", (*champs.values(), oid)
        )


def supprimer_offre(oid: int) -> None:
    with _verrou, connexion() as cx:
        cx.execute("DELETE FROM offres WHERE id = ?", (oid,))


def offres_du_prospect(pid: str, gardees_seulement: bool = True) -> list[dict]:
    condition = " AND garder = 1" if gardees_seulement else ""
    with _verrou, connexion() as cx:
        return [dict(l) for l in cx.execute(
            f"SELECT * FROM offres WHERE prospect_id = ?{condition} "
            "ORDER BY famille_slug, materiau_nom", (pid,)
        ).fetchall()]


def toutes_les_offres_appariees() -> list[dict]:
    """Les offres exploitables pour l'observatoire des prix."""
    with _verrou, connexion() as cx:
        return [dict(l) for l in cx.execute(
            "SELECT o.materiau_slug, o.materiau_nom, o.type_slug, o.type_nom, "
            "       o.famille_slug, o.unite, o.prix, o.vu_le, "
            "       p.ville, p.quartier, p.id AS prospect_id, p.nom AS prospect_nom "
            "  FROM offres o JOIN prospects p ON p.id = o.prospect_id "
            " WHERE o.garder = 1 AND o.prix IS NOT NULL AND o.materiau_slug IS NOT NULL "
            "   AND p.statut NOT IN ('rejete', 'doublon')"
        ).fetchall()]


# ── Photos ─────────────────────────────────────────────────────────────────
def ajouter_photo(prospect_id: str, publication_id: str | None, fichier: str,
                  url_source: str, largeur: int, hauteur: int, ordre: int = 0) -> None:
    with _verrou, connexion() as cx:
        cx.execute(
            "INSERT INTO photos (prospect_id, publication_id, fichier, url_source, "
            "largeur, hauteur, ordre) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (prospect_id, publication_id, fichier, url_source, largeur, hauteur, ordre),
        )


def modifier_photo(photo_id: int, **champs) -> None:
    autorises = {"garder", "couverture", "url_o2", "ordre"}
    champs = {c: v for c, v in champs.items() if c in autorises}
    if not champs:
        return
    assignations = ", ".join(f"{c} = ?" for c in champs)
    with _verrou, connexion() as cx:
        cx.execute(
            f"UPDATE photos SET {assignations} WHERE id = ?", (*champs.values(), photo_id)
        )


def definir_couverture(prospect_id: str, photo_id: int) -> None:
    with _verrou, connexion() as cx:
        cx.execute("UPDATE photos SET couverture = 0 WHERE prospect_id = ?", (prospect_id,))
        cx.execute("UPDATE photos SET couverture = 1, garder = 1 WHERE id = ?", (photo_id,))


def photos_a_publier(prospect_id: str) -> list[dict]:
    with _verrou, connexion() as cx:
        return [dict(l) for l in cx.execute(
            "SELECT * FROM photos WHERE prospect_id = ? AND garder = 1 "
            "ORDER BY couverture DESC, ordre", (prospect_id,)
        ).fetchall()]


def compter_photos(prospect_id: str) -> int:
    with _verrou, connexion() as cx:
        return cx.execute(
            "SELECT COUNT(*) n FROM photos WHERE prospect_id = ? AND garder = 1",
            (prospect_id,),
        ).fetchone()["n"]


# ── Prospection ────────────────────────────────────────────────────────────
def evenement(prospect_id: str, genre: str, message: str) -> None:
    with _verrou, connexion() as cx:
        cx.execute(
            "INSERT INTO evenements (prospect_id, ts, genre, message) VALUES (?, ?, ?, ?)",
            (prospect_id, maintenant(), genre, message),
        )


def refuser_definitivement(cle: str, nom: str, motif: str) -> None:
    """Liste rouge. Un « ne me recontactez plus » ne se réapprend pas.

    Elle survit à la suppression du prospect : sans ça, une collecte ultérieure
    le ferait réapparaître et on le relancerait — la faute qu'aucun démarcheur
    ne se fait pardonner deux fois.
    """
    if not cle:
        return
    with _verrou, connexion() as cx:
        cx.execute(
            "INSERT INTO refuses (cle, nom, motif, ts) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(cle) DO UPDATE SET motif = excluded.motif, ts = excluded.ts",
            (cle, nom, motif, maintenant()),
        )


def est_refuse(cle: str) -> bool:
    if not cle:
        return False
    with _verrou, connexion() as cx:
        return cx.execute(
            "SELECT 1 FROM refuses WHERE cle = ?", (cle,)
        ).fetchone() is not None


def liste_rouge() -> list[dict]:
    with _verrou, connexion() as cx:
        return [dict(l) for l in cx.execute(
            "SELECT * FROM refuses ORDER BY ts DESC"
        ).fetchall()]


def a_relancer(delai_jours: int, relances_max: int) -> list[dict]:
    """Les prospects contactés depuis assez longtemps et jamais revenus."""
    limite = datetime.now(timezone.utc).timestamp() - delai_jours * 86400
    with _verrou, connexion() as cx:
        lignes = cx.execute(
            "SELECT * FROM prospects WHERE statut IN ('contacte', 'relance') "
            "AND nb_relances < ? ORDER BY score DESC", (relances_max,)
        ).fetchall()
    resultat = []
    for ligne in lignes:
        repere = ligne["derniere_relance"] or ligne["contacte_le"]
        if not repere:
            continue
        try:
            quand = datetime.fromisoformat(repere).timestamp()
        except ValueError:
            continue
        if quand <= limite:
            resultat.append(_sortir(ligne))
    return resultat


def signaler_materiau_absent(libelle: str, exemple: str) -> None:
    """Ce que le terrain vend et que le catalogue fermé d'Akora ignore."""
    with _verrou, connexion() as cx:
        cx.execute(
            "INSERT INTO materiaux_absents (libelle, exemple, derniere) VALUES (?, ?, ?) "
            "ON CONFLICT(libelle) DO UPDATE SET occurrences = occurrences + 1, "
            "derniere = excluded.derniere",
            (libelle.strip().lower()[:80], exemple[:200], maintenant()),
        )


# ── Véhicules ──────────────────────────────────────────────────────────────
def ajouter_vehicule(prospect_id: str, publication_id: str | None,
                     vehicule: dict) -> int | None:
    """Ajoute un véhicule, sauf si le même est déjà connu du prospect.

    Un transporteur reposte son annonce chaque semaine : on ne duplique pas
    « Camion benne 8 m³ », on complète ce qui manquait — un tarif appris au
    troisième passage vaut mieux qu'une quatrième ligne vide.
    """
    with _verrou, connexion() as cx:
        jumeau = cx.execute(
            "SELECT * FROM vehicules WHERE prospect_id = ? AND nom = ? LIMIT 1",
            (prospect_id, vehicule.get("nom")),
        ).fetchone()
        if jumeau:
            complements = {
                champ: vehicule[champ]
                for champ in ("capacite_m3", "capacite_kg", "prix_par_km",
                              "forfait_base", "prix_minimum")
                if vehicule.get(champ) and not jumeau[champ]
            }
            if complements:
                assignations = ", ".join(f"{c} = ?" for c in complements)
                cx.execute(
                    f"UPDATE vehicules SET {assignations}, vu_le = ? WHERE id = ?",
                    (*complements.values(), maintenant(), jumeau["id"]),
                )
            return None
        donnees = {
            "prospect_id": prospect_id,
            "publication_id": publication_id,
            "vu_le": maintenant(),
            **vehicule,
        }
        colonnes = ", ".join(donnees)
        trous = ", ".join("?" for _ in donnees)
        curseur = cx.execute(
            f"INSERT INTO vehicules ({colonnes}) VALUES ({trous})", tuple(donnees.values())
        )
    return curseur.lastrowid


def modifier_vehicule(vid: int, **champs) -> None:
    autorises = {"nom", "categorie", "capacite_m3", "capacite_kg", "prix_par_km",
                 "forfait_base", "km_inclus", "prix_minimum", "aller_retour", "garder"}
    champs = {c: v for c, v in champs.items() if c in autorises}
    if not champs:
        return
    assignations = ", ".join(f"{c} = ?" for c in champs)
    with _verrou, connexion() as cx:
        cx.execute(
            f"UPDATE vehicules SET {assignations} WHERE id = ?", (*champs.values(), vid)
        )


def supprimer_vehicule(vid: int) -> None:
    with _verrou, connexion() as cx:
        cx.execute("DELETE FROM vehicules WHERE id = ?", (vid,))


def vehicules_du_prospect(pid: str, gardes_seulement: bool = True) -> list[dict]:
    condition = " AND garder = 1" if gardes_seulement else ""
    with _verrou, connexion() as cx:
        return [dict(l) for l in cx.execute(
            f"SELECT * FROM vehicules WHERE prospect_id = ?{condition} "
            "ORDER BY capacite_m3", (pid,)
        ).fetchall()]


# ── Demandes d'acheteurs ───────────────────────────────────────────────────
def demande_existe(empreinte: str) -> bool:
    with _verrou, connexion() as cx:
        return cx.execute(
            "SELECT 1 FROM demandes WHERE empreinte = ?", (empreinte,)
        ).fetchone() is not None


def ajouter_demande(champs: dict) -> str | None:
    donnees = {"id": str(uuid.uuid4()), "collecte_le": maintenant(), **champs}
    colonnes = ", ".join(donnees)
    trous = ", ".join("?" for _ in donnees)
    try:
        with _verrou, connexion() as cx:
            cx.execute(
                f"INSERT INTO demandes ({colonnes}) VALUES ({trous})",
                tuple(donnees.values()),
            )
    except sqlite3.IntegrityError:
        return None
    return donnees["id"]


def demande(did: str) -> dict | None:
    with _verrou, connexion() as cx:
        return _sortir(
            cx.execute("SELECT * FROM demandes WHERE id = ?", (did,)).fetchone()
        )


def modifier_demande(did: str, champs: dict) -> None:
    if not champs:
        return
    assignations = ", ".join(f"{c} = ?" for c in champs)
    with _verrou, connexion() as cx:
        cx.execute(
            f"UPDATE demandes SET {assignations} WHERE id = ?", (*champs.values(), did)
        )


def lister_demandes(statut: str = "", famille: str = "", ville: str = "",
                    limite: int = 300) -> list[dict]:
    conditions, parametres = [], []
    if statut and statut != "tous":
        conditions.append("statut = ?")
        parametres.append(statut)
    if famille:
        conditions.append("famille_slug = ?")
        parametres.append(famille)
    if ville:
        conditions.append("ville = ?")
        parametres.append(ville)
    ou = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    with _verrou, connexion() as cx:
        return [dict(l) for l in cx.execute(
            f"SELECT * FROM demandes {ou} ORDER BY urgence DESC, collecte_le DESC LIMIT ?",
            (*parametres, limite),
        ).fetchall()]


def compter_demandes() -> dict:
    with _verrou, connexion() as cx:
        par_statut = {l["statut"]: l["n"] for l in cx.execute(
            "SELECT statut, COUNT(*) n FROM demandes GROUP BY statut"
        ).fetchall()}
        depuis = (datetime.now(timezone.utc).timestamp() - 7 * 86400)
        recentes = cx.execute(
            "SELECT COUNT(*) n FROM demandes WHERE collecte_le >= ?",
            (datetime.fromtimestamp(depuis, timezone.utc).isoformat(timespec="seconds"),),
        ).fetchone()["n"]
    return {
        "nouvelle": par_statut.get("nouvelle", 0),
        "traitee": par_statut.get("traitee", 0),
        "ignoree": par_statut.get("ignoree", 0),
        "total": sum(par_statut.values()),
        "sept_jours": recentes,
    }


def materiaux_absents(limite: int = 40) -> list[dict]:
    with _verrou, connexion() as cx:
        return [dict(l) for l in cx.execute(
            "SELECT * FROM materiaux_absents ORDER BY occurrences DESC, derniere DESC "
            "LIMIT ?", (limite,)
        ).fetchall()]


initialiser()
