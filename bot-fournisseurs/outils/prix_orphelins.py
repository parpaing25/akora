# -*- coding: utf-8 -*-
"""Les offres dont le prix ne se lit pas dans leur propre libellé.

🔴 CE QU'IL RÉPARE, MESURÉ LE 01/09/2026 SUR DEUX PRODUITS DÉJÀ EN LIGNE.

Le dépôt « Fournisseur en Matériaux de construction » publie :

    Moellon lehibe 700ar/pcs
    Moellon ordinaire 550ar/pcs

Le bot a retenu le **libellé du premier** et le **prix du second** : « Moellon
lehibe 700ar/pcs » à 550 Ar. Le dépôt « Fivarotan-kazo Mirary » publie un tarif
dont la dernière ligne est « #planche **de rive** 4m = 28 000 ar » ; ce prix
s'est collé à l'en-tête « #PLANCHE **coffrage** 4m », dont les vraies lignes
sont 4 700, 5 300 et 8 500 Ar. Une planche de coffrage à 28 000 Ar, soit quatre
à six fois le marché, prête à être publiée sous le nom d'un vrai dépôt.

La règle qui les attrape est simple et ne demande aucun jugement : **un prix
doit être écrit dans le libellé de son offre**. S'il n'y est pas, c'est qu'il
vient d'ailleurs — et on ne sait pas de quoi il est le prix.

Ce qu'elle n'attrape PAS, et qu'il faut savoir : « Moellon 20 *20 450 ar »,
lu 20 450 Ar au lieu de 450 Ar pour un moellon 20×20. Les chiffres du prix
sont bien dans le libellé — ils y sont juste mal découpés. Celui-là se voit à
l'invraisemblance du montant, pas à sa présence.

    python -m outils.prix_orphelins            # liste, n'écrit RIEN
    python -m outils.prix_orphelins --ecrire   # met les offres en quarantaine
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import base  # noqa: E402

CHIFFRES = re.compile(r"\d+")


def _suite_de_chiffres(texte: str) -> str:
    """Tous les chiffres du texte, collés. « 45.000 ar » -> « 45000 »."""
    return "".join(CHIFFRES.findall(texte or ""))


def orphelines() -> list[dict]:
    """Les offres gardées dont le montant n'apparaît pas dans leur libellé."""
    retenues = []
    for offre in base.offres_gardees_vivantes():
        if offre.get("prix") is None:
            continue
        montant = str(int(offre["prix"]))
        libelle = offre.get("libelle_brut") or ""
        # Le libellé écrit le prix comme un humain : « 8 500 Ar », « 45.000ar »,
        # « 4700ar ». On compare donc des suites de chiffres, séparateurs
        # retirés — sinon la moitié des prix justes seraient déclarés faux.
        if montant not in _suite_de_chiffres(libelle):
            retenues.append(offre)
    return retenues


def main() -> int:
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--ecrire", action="store_true",
                           help="met les offres trouvées en quarantaine")
    args = analyseur.parse_args()

    trouvees = orphelines()
    if not trouvees:
        print("Aucun prix orphelin : tous les montants se lisent dans leur libellé.")
        return 0

    print(f"{len(trouvees)} offre(s) dont le prix ne vient pas de leur libellé :\n")
    publiables = 0
    for offre in trouvees:
        marque = ""
        if offre.get("materiau_slug"):
            publiables += 1
            marque = f"  ⚠ PUBLIABLE en « {offre['materiau_slug']} »"
        print(f"   [{offre['id']:>5}] {offre['prix']:>9} Ar | "
              f"{offre['prospect_nom'][:22]:<24} | "
              f"{(offre.get('libelle_brut') or '')[:52]}{marque}")

    print(f"\n{publiables} d'entre elles sont appariées, donc prêtes à devenir "
          f"un produit avec ce prix.")

    if not args.ecrire:
        print("\nRien n'a été écrit. Relancer avec --ecrire pour appliquer.")
        return 0

    for offre in trouvees:
        # On efface le PRIX, pas l'offre : le libellé reste, et l'offre
        # retourne dans la file de celles qui attendent qu'on lise leur tarif.
        # Effacer l'offre entière ferait disparaître un produit que le dépôt
        # vend réellement.
        base.modifier_offre(offre["id"], prix=None)
    base.logguer(
        f"{len(trouvees)} prix orphelin(s) effacé(s) : le montant ne figurait "
        f"pas dans le libellé de l'offre (dont {publiables} déjà appariée(s)).",
        "avert")
    print(f"\n{len(trouvees)} prix effacé(s). Les libellés sont conservés.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
