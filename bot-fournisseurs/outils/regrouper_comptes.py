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
    python outils/regrouper_comptes.py            # à blanc : montre, n'écrit rien
    python outils/regrouper_comptes.py --ecrire   # écrit, après sauvegarde
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


def plan_de_fusion(fiches: list[dict]) -> tuple[list[tuple[dict, list[dict]]], list[list[dict]]]:
    """(fusions sûres, groupes à trancher à la main)."""
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
        if len(numeros) > 1:
            a_trancher.append(lot)
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
    cx = sqlite3.connect(f"file:{BASE}?mode=ro", uri=True)
    cx.row_factory = sqlite3.Row
    fiches = [dict(l) for l in cx.execute("SELECT * FROM prospects").fetchall()]
    cx.close()

    sures, a_trancher = plan_de_fusion(fiches)
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
            fusion.absorber(f["id"], cible["id"])
            faites += 1
        with base._verrou, base.connexion() as cx:
            cx.execute(
                "UPDATE prospects SET nb_publications = "
                "(SELECT COUNT(*) FROM publications WHERE prospect_id = ?) WHERE id = ?",
                (cible["id"], cible["id"]),
            )
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
