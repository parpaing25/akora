"""Rejoue le regroupement par COMPTE Facebook sur les fiches DÉJÀ en base.

🔴 POURQUOI IL EXISTE. Le 02/09/2026, `fusion.cle_de_regroupement` a été
corrigé : la clé se réduit à l'identifiant du compte, et une publication
sans numéro rejoint la fiche du même compte. Mais corriger le code ne
corrige pas le passé (règle apprise le 24/08 avec `reapparier.py`) : les
fiches ouvertes en double restent en double tant que personne ne les verse.
Mesuré ce jour-là : 26 comptes tenaient 62 fiches.

Ce qu'il fait, et ce qu'il refuse :

  - il verse dans la fiche du compte les fiches SANS numéro, à condition
    qu'elles n'engagent rien côté site (ni réservée, ni inscrite, ni
    contactée, ni revendiquée) — exactement ce que le collecteur aurait fait
    aujourd'hui en les voyant ;
  - il ne fusionne JAMAIS deux fiches qui portent deux numéros différents :
    deux lignes pour un dépôt, ou deux dépôts derrière un compte partagé ?
    Il les liste, `doublons_probables` les signale, un humain tranche.

Usage :
    python outils/regrouper_comptes.py                  # à blanc : montre, n'écrit rien
    python outils/regrouper_comptes.py --ecrire         # écrit, après sauvegarde
    python outils/regrouper_comptes.py --ecrire --tout  # verse AUSSI les comptes à
                                                        # plusieurs numéros (demande
                                                        # d'Andry du 02/09 au soir)

`--tout` : un même compte Facebook avec deux numéros est, à Madagascar, un
dépôt avec une SIM par opérateur. La fiche gardée est celle qui engage le
plus (inscrite > réservée > validée > à trier > écartée), puis la plus
remplie ; `fusion.absorber` reporte les autres numéros, la page, le quartier
et la fiche réservée. Seul refus : deux fiches liées à DEUX fournisseurs
différents sur le site — ça ne se fusionne pas depuis ici.
"""
from __future__ import annotations

import io
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import base, fusion  # noqa: E402
from bot.config import BASE, charger  # noqa: E402

# Une fiche qui a déjà une existence côté site ou côté prospection n'est pas
# versée : elle porte un jeton envoyé, une fiche réservée, un fournisseur
# créé. La perdre casserait un lien qu'on a donné à quelqu'un.
CHAMPS_ENGAGEANTS = ("fournisseur_id", "reserve_le", "contacte_le",
                     "revendique_le", "prospect_distant")
STATUTS_LIBRES = ("a_trier", "incomplet", "valide", "rejete")


def _libre(fiche: dict) -> bool:
    return (fiche.get("statut") in STATUTS_LIBRES
            and not any(fiche.get(c) for c in CHAMPS_ENGAGEANTS))


def _telephone(fiche: dict) -> str:
    return (fiche.get("telephone_cle") or "").strip()


PRIORITE = {"inscrit": 0, "deja_client": 0, "revendique": 0, "reserve": 1,
            "contacte": 1, "relance": 1, "a_contacter": 1, "valide": 2,
            "a_trier": 3, "incomplet": 4, "rejete": 5, "doublon": 6, "refuse": 7}


def _cible_du_lot(lot: list[dict]) -> dict:
    """La fiche à garder : celle qui engage le plus, puis la mieux remplie."""
    return min(lot, key=lambda f: (
        PRIORITE.get(f.get("statut") or "", 9),
        0 if _telephone(f) else 1,
        -int(f.get("nb_publications") or 0),
        -int(f.get("score") or 0),
    ))


def plan_de_fusion(fiches: list[dict], tout: bool = False
                   ) -> tuple[list[tuple[dict, list[dict]]], list[list[dict]]]:
    """(fusions à faire, groupes à trancher à la main).

    `tout` : verse aussi les comptes à plusieurs numéros — voir l'en-tête.
    """
    par_compte: dict[str, list[dict]] = {}
    for fiche in fiches:
        compte = fusion._identifiant_facebook(fiche)
        if compte:
            par_compte.setdefault(compte, []).append(fiche)

    sures, a_trancher = [], []
    for lot in par_compte.values():
        if len(lot) < 2:
            continue
        numeros = {_telephone(f) for f in lot if _telephone(f)}
        sans_numero = [f for f in lot if not _telephone(f)]
        if len(numeros) > 1 or (tout and sans_numero and any(not _libre(f) for f in sans_numero)):
            if not tout:
                a_trancher.append(lot)
                continue
            # Deux fournisseurs DIFFÉRENTS sur le site : impossible d'ici.
            distants = {f.get("fournisseur_id") for f in lot if f.get("fournisseur_id")}
            if len(distants) > 1:
                a_trancher.append(lot)
                continue
            cible = _cible_du_lot(lot)
            sures.append((cible, [f for f in lot if f["id"] != cible["id"]]))
            continue
        if not sans_numero:
            continue
        # La cible : celle qui a le numéro ; sinon la mieux remplie.
        avec_numero = [f for f in lot if _telephone(f)]
        cible = avec_numero[0] if avec_numero else max(
            sans_numero, key=lambda f: (int(f.get("nb_publications") or 0),
                                        int(f.get("score") or 0)))
        absorbees = [f for f in sans_numero if f["id"] != cible["id"] and _libre(f)]
        retenues = [f for f in sans_numero if f["id"] != cible["id"] and not _libre(f)]
        if retenues:
            a_trancher.append([cible, *retenues])
        if absorbees:
            sures.append((cible, absorbees))
    return sures, a_trancher


def principal() -> None:
    ecrire = "--ecrire" in sys.argv
    tout = "--tout" in sys.argv
    cx = sqlite3.connect(f"file:{BASE}?mode=ro", uri=True)
    cx.row_factory = sqlite3.Row
    fiches = [dict(l) for l in cx.execute("SELECT * FROM prospects").fetchall()]
    cx.close()

    sures, a_trancher = plan_de_fusion(fiches, tout=tout)
    print(f"{len(fiches)} fiches ; {sum(len(a) for _, a in sures)} à verser dans "
          f"{len(sures)} fiche(s) de compte ; {len(a_trancher)} groupe(s) à trancher à la main.")
    for cible, absorbees in sures:
        print(f"\n  → « {cible.get('nom')} » ({cible.get('statut')}, "
              f"{_telephone(cible) or 'sans numéro'}) reçoit :")
        for f in absorbees:
            print(f"      - « {f.get('nom')} » ({f.get('statut')}, "
                  f"{f.get('nb_publications')} publication(s), id {f['id'][:8]})")
    if a_trancher:
        print("\n  À trancher à la main (onglet Fournisseurs → Doublons probables) :")
        for lot in a_trancher:
            print("   · " + " | ".join(
                f"{f.get('nom')} [{_telephone(f) or 'sans numéro'}, {f.get('statut')}]"
                for f in lot))

    if not sures:
        return
    if not ecrire:
        print("\nÀ blanc. Relancer avec --ecrire pour verser.")
        return

    horodatage = datetime.now().strftime("%Y%m%d-%H%M%S")
    sauvegarde = BASE.with_name(f"{BASE.name}.avant-regroupement-{horodatage}")
    shutil.copy2(BASE, sauvegarde)
    print(f"\nSauvegarde : {sauvegarde.name}")

    cfg = charger()
    faites = 0
    for cible, absorbees in sures:
        for f in absorbees:
            fusion.absorber(f["id"], cible["id"])       # reporte numéros, page, réservation
            faites += 1
        fusion.evaluer(cible["id"], cfg)
        base.evenement(cible["id"], "statut",
                       f"{len(absorbees)} fiche(s) du même compte Facebook versée(s) ici "
                       "(regroupement du 02/09/2026).")
    base.logguer(f"Regroupement par compte Facebook : {faites} fiche(s) versée(s) "
                 f"dans {len(sures)} fiche(s).", "succes")
    print(f"{faites} fiche(s) versée(s).")


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    principal()
