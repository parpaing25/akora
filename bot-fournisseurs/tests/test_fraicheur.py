"""Garde-fous sur la DATE d'une publication et sur la règle « année en cours ».

Chaque forme relative de ce fichier a été recopiée depuis `data/bot.db`
(`SELECT publie_le FROM publications WHERE publie_le <> ''`, lecture seule, le
24/08/2026). Aucune n'est inventée — et ça compte : les 20 dates réellement
présentes portent TOUTES une espace insécable U+00A0, invisible à la
relecture. Une forme imaginée à la table produit un test qui passe et un bot
qui rate. Même règle que `tests/test_extraction_offres.py`.

Ce qui se joue ici : la règle métier est « on ne collecte QUE les publications
de l'année en cours ». Elle repose entièrement sur la capacité à LIRE une
date. Avant le 24/08/2026 :

  - `publications.publie_le` n'était renseigné que 20 fois sur 181 (11 %) ;
  - la date inconnue laissait passer la publication ;
  - et pire, « 12 juin 2019 » se lisait « 12 jours » — une date de 2019
    entrait en se faisant passer pour une publication de la semaine.

Et ici l'enjeu va plus loin que chez Fonenako : un tarif relevé sur une
publication de 2019 devient une ligne de l'observatoire des prix, puis une
phrase du bulletin public signé Akora.

    python -m pytest tests/test_fraicheur.py -q
"""
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import collecteur, fraicheur  # noqa: E402
from bot.config import DEFAUTS  # noqa: E402

# Le jour de référence de tous les tests. Fixe : un test dont le résultat
# change avec le calendrier ne prouve rien.
AUJ = date(2026, 8, 24)


# ── Les formes relatives réellement collectées ─────────────────────────────
def test_les_formes_de_la_base_se_lisent_toutes():
    """Les 20 dates de `data/bot.db`, avec leur espace insécable U+00A0."""
    attendus = {
        "1\xa0h": 0,        # 5 occurrences — la plus fréquente
        "6\xa0h": 0,        # 3
        "2\xa0sem.": 14,    # 2
        "21\xa0min": 0,     # 2
        "46\xa0min": 0, "58\xa0min": 0, "38\xa0min": 0, "47\xa0min": 0,
        "12\xa0min": 0, "1\xa0sem.": 7, "3\xa0h": 0, "2\xa0h": 0,
    }
    for forme, jours in attendus.items():
        assert fraicheur.age_en_jours(forme, AUJ) == jours, repr(forme)


def test_l_espace_insecable_ne_change_rien():
    """U+00A0 ou espace ordinaire : la même date."""
    assert (fraicheur.date_de_publication("2\xa0sem.", AUJ)
            == fraicheur.date_de_publication("2 sem.", AUJ))


def test_hier_et_l_instant():
    assert fraicheur.age_en_jours("Hier", AUJ) == 1
    assert fraicheur.age_en_jours("yesterday", AUJ) == 1
    assert fraicheur.age_en_jours("il y a un instant", AUJ) == 0


# ── Dates absolues : ce que l'ancienne version ne savait pas lire ──────────
def test_dates_absolues_francaises():
    assert fraicheur.date_de_publication("12 août 2019", AUJ) == date(2019, 8, 12)
    assert fraicheur.date_de_publication("23 mars 2020 à 14:05", AUJ) == date(2020, 3, 23)
    assert fraicheur.date_de_publication("1er mars 2020", AUJ) == date(2020, 3, 1)
    assert fraicheur.date_de_publication("5 déc. 2019", AUJ) == date(2019, 12, 5)


def test_dates_absolues_anglaises():
    assert fraicheur.date_de_publication("August 12, 2019", AUJ) == date(2019, 8, 12)
    assert fraicheur.date_de_publication("Dec. 3, 2020", AUJ) == date(2020, 12, 3)


def test_dates_numeriques():
    """Facebook en français écrit JJ/MM/AAAA ; l'anglais MM/JJ se reconnaît seul."""
    assert fraicheur.date_de_publication("12/08/2019", AUJ) == date(2019, 8, 12)
    assert fraicheur.date_de_publication("12.08.19", AUJ) == date(2019, 8, 12)
    # Pas de 23e mois : c'est forcément MM/JJ.
    assert fraicheur.date_de_publication("08/23/2019", AUJ) == date(2019, 8, 23)


def test_sans_annee_le_mois_futur_designe_l_an_dernier():
    """Convention Facebook : il n'écrit l'année que passé douze mois.

    Un « 12 décembre » lu un 24 août 2026 ne peut pas être dans le futur : il
    désigne le 12 décembre 2025.
    """
    assert fraicheur.date_de_publication("12 août", AUJ) == date(2026, 8, 12)
    assert fraicheur.date_de_publication("12 décembre", AUJ) == date(2025, 12, 12)
    assert fraicheur.date_de_publication("Aug 12", AUJ) == date(2026, 8, 12)


# ── LA régression : une date absolue lue comme un âge relatif ──────────────
def test_douze_juin_2019_n_est_pas_douze_jours():
    """L'ancien motif n'avait pas de `\\b` : « 12 juin » y matchait « 12 j ».

    Résultat mesuré : trois vraies dates de 2019 passaient le filtre des 30
    jours EN SE FAISANT PASSER pour des publications de la semaine.
    """
    for texte, attendue in (
        ("12 juin 2019", date(2019, 6, 12)),
        ("12 juillet 2019", date(2019, 7, 12)),
        ("5 décembre 2019", date(2019, 12, 5)),
    ):
        assert fraicheur.date_de_publication(texte, AUJ) == attendue, texte
        assert fraicheur.age_en_jours(texte, AUJ) > 2000, texte


def test_le_collecteur_delegue_bien():
    """`collecteur._age_en_jours` garde sa signature et le nouveau comportement."""
    assert collecteur._age_en_jours("6\xa0j") is not None
    assert collecteur._age_en_jours("") is None
    assert collecteur._age_en_jours("12 juin 2019") > 2000


# ── Ce qui ne se lit PAS ne doit PAS être inventé ──────────────────────────
def test_l_inconnu_reste_inconnu():
    """`None`, jamais aujourd'hui : c'est tout l'objet de la correction.

    L'ancien comportement datait d'aujourd'hui ce qu'il n'avait pas su lire —
    et un prix « relevé aujourd'hui » qui vient d'un post de 2019 est un
    chiffre faux, publié, que personne ne pourra plus recouper.
    """
    for texte in ("", "Voir plus", "Rakoto Jean", "3 m", "Sponsorisé", None):
        assert fraicheur.date_de_publication(texte or "", AUJ) is None, repr(texte)
        assert fraicheur.annee_de_publication(texte or "", AUJ) is None
    assert fraicheur.en_texte(None) == ""


# ── La règle d'année ───────────────────────────────────────────────────────
def test_une_publication_de_2019_est_ecartee():
    for texte in ("12 août 2019", "August 12, 2019", "12/08/2019",
                  "23 mars 2020 à 14:05", "2019-08-12T14:05:00+00:00"):
        v = fraicheur.verdict(texte, 2026, 30, AUJ)
        assert v["garder"] is False, texte
        assert v["motif"] == "annee", texte
        assert v["annee"] < 2026, texte


def test_une_publication_de_2026_passe():
    for texte in ("1\xa0sem.", "6\xa0h", "21\xa0min", "Hier", "12 août"):
        v = fraicheur.verdict(texte, 2026, 60, AUJ)
        assert v["garder"] is True, texte
        assert v["annee"] == 2026, texte


def test_annee_indeterminable_on_garde():
    """DÉCISION ASSUMÉE : 89 % des publications n'ont aucune date lisible.

    Refuser l'inconnu ne nettoierait pas la collecte, il la supprimerait.
    """
    v = fraicheur.verdict("Rakoto Jean", 2026, 30, AUJ)
    assert v["garder"] is True
    assert v["annee"] is None
    assert v["date"] is None
    assert v["motif"] == ""


def test_jours_max_coupe_toujours_dans_l_annee_en_cours():
    """La règle d'année ne remplace pas `jours_max`, elle s'ajoute.

    Ici `jours_max` vaut 60 : « un dépôt qui a publié il y a 2 mois vend
    encore ». Une publication de 2026 vieille de quatre mois reste écartée,
    mais sur l'ÂGE, pas sur l'année — et le bilan de collecte le dit.
    """
    v = fraicheur.verdict("4\xa0mois", 2026, 60, AUJ)
    assert v["garder"] is False and v["motif"] == "age" and v["annee"] == 2026
    assert fraicheur.verdict("1\xa0mois", 2026, 60, AUJ)["garder"] is True


def test_le_reglage_existe_et_vaut_2026():
    assert DEFAUTS["annee_minimum"] == 2026


# La légende EXACTE relevée dans le journal du 02/09/2026 (collecte de 14 h 35,
# groupe « Quincaillerie En Ligne Outillage ») : une publication de 2026
# écartée comme datant de 2016, parce que « 10ans » se lit « il y a dix ans ».
LEGENDE_REELLE = ("Peut être une image de texte qui dit ’034 0348932323 89 323 23 "
                  "Garantie 10ans 10")


def test_une_legende_d_image_n_est_pas_une_date():
    v = fraicheur.verdict(LEGENDE_REELLE, 2026, 60, AUJ)
    assert v["date"] is None and v["annee"] is None
    assert v["garder"] is True, "une garantie décennale n'est pas un horodatage"
    # Et la forme anglaise des légendes générées par Facebook.
    assert fraicheur.date_de_publication("May be an image of text that says 2 ans", AUJ) is None


def test_une_vraie_date_relative_en_annees_se_lit_toujours():
    """Le garde-fou porte sur la longueur et la légende, pas sur l'unité."""
    v = fraicheur.verdict("10\xa0ans", 2026, 60, AUJ)
    assert v["annee"] == 2016 and v["garder"] is False and v["motif"] == "annee"


# ── Le JS de lecture de date ───────────────────────────────────────────────
# On ne peut pas vérifier le DOM RÉEL de Facebook depuis un test. Ce qu'on
# peut vérifier, c'est que les cinq pistes sont là, qu'aucune ne peut faire
# tomber les quatre autres, et que l'absence de réponse rend '' — pas une
# exception qui viderait tout le lot de publications.
def test_les_cinq_pistes_sont_dans_le_js():
    js = collecteur.JS_EXTRAIRE_FIL
    for piste in ("data-utime", "aria-label", "title", "data-tooltip-content",
                  'role="link"', "entete"):
        assert piste in js, piste
    assert js.count("catch (e)") >= 5, "chaque piste doit avoir son propre try"
    assert "return { heure: '', iso: '', source: '' };" in js
    assert "heure_iso" in js and "heure_source" in js


FAUX_DOM = r"""
function creer(tag, attrs = {}, texte = "", enfants = []) {
  const n = {
    tag, attrs, _texte: texte, enfants, _parent: null,
    get innerText() {
      return [n._texte, ...n.enfants.map((e) => e.innerText)]
        .filter(Boolean).join("\n");
    },
    get href() { return attrs.href || ""; },
    get src() { return attrs.src || ""; },
    get currentSrc() { return attrs.src || ""; },
    get srcset() { return attrs.srcset || ""; },
    get naturalWidth() { return Number(attrs.width || 0); },
    get width() { return Number(attrs.width || 0); },
    get naturalHeight() { return Number(attrs.height || 0); },
    get height() { return Number(attrs.height || 0); },
    getAttribute: (nom) => (nom in attrs ? attrs[nom] : null),
    querySelectorAll: (sel) => tous(n).filter((e) => correspond(e, sel)),
    querySelector: (sel) => tous(n).find((e) => correspond(e, sel)) || null,
    get parentElement() { return n._parent; },
    closest: (sel) => {
      let c = n;
      while (c) { if (correspond(c, sel)) return c; c = c._parent; }
      return null;
    },
  };
  for (const e of enfants) e._parent = n;
  return n;
}
function tous(racine) {
  const s = [];
  const marcher = (n) => { for (const e of n.enfants) { s.push(e); marcher(e); } };
  marcher(racine);
  return s;
}
function correspond(el, sel) {
  return String(sel).split(",").map((x) => x.trim()).filter(Boolean)
    .some((simple) => simpleOk(el, simple.split(/\s+/).pop()));
}
function simpleOk(el, s) {
  const m = s.match(/^([a-z0-9]*)(?:\[([a-z-]+)(?:([*^$]?=)"([^"]*)")?\])?$/i);
  if (!m) return false;
  const [, tag, attr, op, val] = m;
  if (tag && el.tag !== tag) return false;
  if (!attr) return !!tag;
  const v = el.getAttribute(attr);
  if (v === null) return false;
  if (!op) return true;
  if (op === "=") return v === val;
  if (op === "*=") return v.includes(val);
  if (op === "^=") return v.startsWith(val);
  if (op === "$=") return v.endsWith(val);
  return false;
}
function poserDocument(blocs) {
  const racine = creer("body", {}, "", blocs);
  globalThis.document = {
    querySelectorAll: (sel) => tous(racine).filter((e) => correspond(e, sel)),
  };
}
"""

CAS_DOM = r"""
const cas = {};
// 1. La piste EXACTE.
cas.utime = [creer("div", {"aria-posinset": "1"}, "Fasika 250 000 Ar ny camion, Ivato", [
  creer("abbr", {"data-utime": "1565618700", "title": "12 aout 2019"}, "12 aout 2019"),
  creer("img", {src: "https://scontent.xx.fbcdn.net/a.jpg", width: "800", height: "600"}),
])];
// 2. La date ABSOLUE dans l'aria-label, alors que le texte visible est relatif.
//    C'est LE cas qui distingue 2019 de 2026.
cas.aria = [creer("div", {"aria-posinset": "2"}, "Parpaing 15 : 1 400 Ar, livraison Tana", [
  creer("a", {href: "/groups/1/posts/2/", "aria-label": "12 aout 2019 a 14:05"}, "", [
    creer("span", {}, "1 sem."),
  ]),
  creer("img", {src: "https://scontent.xx.fbcdn.net/b.jpg", width: "800", height: "600"}),
])];
// 3. Le relatif, imbriqué dans un span du lien — invisible pour l'ancien
//    `querySelector('a span')`, qui prenait le premier span (le nom de l'auteur).
cas.span = [creer("div", {"aria-posinset": "3"}, "Gravillon 75 000 Ar/m3, Talatamaty", [
  creer("a", {href: "/permalink/9/"}, "", [
    creer("span", {}, "Rakoto Jean"),
    creer("span", {}, "6 j"),
  ]),
  creer("img", {src: "https://scontent.xx.fbcdn.net/c.jpg", width: "800", height: "600"}),
])];
// 4. L'horodatage en span[role="link"] SANS href.
cas.roleLink = [creer("div", {"aria-posinset": "4"}, "Biriky vita amin'ny tanety, 350 Ar", [
  creer("span", {role: "link"}, "2 sem."),
  creer("img", {src: "https://scontent.xx.fbcdn.net/d.jpg", width: "800", height: "600"}),
])];
// 5. Aucune piste : '' attendu, et surtout pas d'exception.
cas.rien = [creer("div", {"aria-posinset": "5"}, "Ciment Holcim disponible, appelez-nous", [
  creer("img", {src: "https://scontent.xx.fbcdn.net/e.jpg", width: "800", height: "600"}),
])];
// 6. La légende d'une image porte un aria-label qui RESSEMBLE à une date
//    (« Garantie 10ans ») : cas réel du 02/09/2026. Elle ne doit pas être lue.
cas.legende = [creer("div", {"aria-posinset": "6"}, "Tôle galva 0,45 mm, prix imbattable", [
  creer("img", {src: "https://scontent.xx.fbcdn.net/f.jpg", width: "800", height: "600",
                "aria-label": "Peut être une image de texte qui dit ’034 0348932323 89 323 23 Garantie 10ans 10"}),
])];

const sortie = {};
for (const [nom, blocs] of Object.entries(cas)) {
  poserDocument(blocs);
  sortie[nom] = extraire(400).map((p) => [p.heure, p.heure_iso, p.heure_source]);
}
console.log(JSON.stringify(sortie));
"""


@pytest.mark.skipif(shutil.which("node") is None,
                    reason="Node absent — la relecture du JS est sautée.")
def test_le_js_lit_la_date_sur_cinq_pistes():
    """Fait tourner JS_EXTRAIRE_FIL contre un faux DOM.

    Le DOM réel de Facebook n'a pas pu être vérifié le jour de la correction :
    ce test ne prouve donc PAS que Facebook rend ces attributs-là. Il prouve
    que si l'un d'eux répond, il est lu ; que la piste la plus fiable gagne ;
    et qu'aucune piste ne peut faire tomber les autres.
    """
    import json

    programme = (FAUX_DOM + "\nconst extraire = "
                 + collecteur.JS_EXTRAIRE_FIL + ";\n" + CAS_DOM)
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False,
                                     encoding="utf-8") as f:
        f.write(programme)
        chemin = f.name
    fini = subprocess.run(["node", chemin], capture_output=True, text=True,
                          encoding="utf-8")
    assert fini.returncode == 0, fini.stderr[:800]
    lot = json.loads(fini.stdout)

    heure, iso, piste = lot["utime"][0]
    assert piste == "data-utime" and iso.startswith("2019-08-12")
    assert fraicheur.annee_de_publication(iso, AUJ) == 2019

    heure, _, piste = lot["aria"][0]
    assert piste == "aria-label"
    # La date absolue de l'infobulle l'emporte sur le « 1 sem. » visible :
    # sans elle, cette publication de 2019 passerait pour vieille d'une semaine.
    assert fraicheur.annee_de_publication(heure, AUJ) == 2019

    heure, _, piste = lot["span"][0]
    assert piste == "span-lien" and fraicheur.age_en_jours(heure, AUJ) == 6

    heure, _, piste = lot["roleLink"][0]
    assert piste == "role-link" and fraicheur.age_en_jours(heure, AUJ) == 14

    # Aucune piste : '' et rien d'autre. La publication est GARDÉE en aval.
    assert lot["rien"][0] == ["", "", ""]
    assert fraicheur.verdict("", 2026, 30, AUJ)["garder"] is True

    # La légende d'image n'est pas une date : rien n'est lu, la publication
    # reste — au lieu d'être écartée « publiée en 2016 ».
    assert lot["legende"][0] == ["", "", ""]
