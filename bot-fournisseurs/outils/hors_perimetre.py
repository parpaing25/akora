# -*- coding: utf-8 -*-
"""Écarter les offres qui ne sont pas des matériaux de gros œuvre.

Akora vend du gros œuvre : parpaings, hourdis, sable, gravillons, briques,
planches, bois, tôles, ciment, fers à béton. **Quincaillerie, outillage,
plomberie et électricité sont hors périmètre** — le formulaire du site les
refuse, mais la collecte, elle, les ramasse.

Ce que la mesure du 01/09/2026 a montré, en regardant les libellés en face :

  * les 16 offres rangées en « Bordure de trottoir » sont des **tableaux
    blancs** — « Tableau blanc double face, bordure noire, 90×120 cm :
    150 000 Ar » ;
  * les 7 offres rangées en « Brique de terre comprimée » sont des **terrains
    à vendre** — « TANY MORA BE… 70 000 Ar par m² » ;
  * les 5 « Buse béton » sont des **tuyaux souples** ;
  * 4 « Gravillon » sont un **essayeur d'or** (« misera volamena, 0,001-20 g :
    110 000 Ar ») ;
  * et parmi les offres DÉJÀ appariées — celles qui deviennent des produits —
    on trouve une location de villa en pavé autobloquant, des boulons en tuile
    mécanique, et des annonces en **FCFA** d'Afrique de l'Ouest.

C'est le même mécanisme que le téléviseur « >32 pouces sans bordure :
410 000 ar » rangé en bordure de trottoir T2 le 24/08 : un mot du catalogue
suffit à accrocher une annonce qui n'a rien à y faire. Corriger l'appariement
ne répare pas les lignes déjà écrites — d'où cet outil.

    python -m outils.hors_perimetre            # liste, n'écrit RIEN
    python -m outils.hors_perimetre --ecrire   # applique
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import base  # noqa: E402

# Chaque motif porte SON libellé : un écartement sans raison lisible ne se
# relit pas, et c'est ce qui rend une correction impossible à contester.
MOTIFS: list[tuple[str, str, re.Pattern]] = [
    ("terrain", "terrain à vendre, pas un matériau", re.compile(
        r"terrain\s+de|tany\s+(mora|amidy|sy\s+trano)|lots?\s+disponibles?"
        r"|par\s*m2\s*miady|ataka?lo\s+tany", re.I)),
    ("bureau", "fourniture de bureau", re.compile(
        r"tableau\s+blanc|flip\s*chart|paperboard"
        # Les 16 lignes de ce vendeur héritent d'un en-tête qui ne dit pas
        # « tableau » : « Certains modèles avec bordure noire › 90×120 cm :
        # 125.000 Ar ». C'est le mot « bordure » qui les a accrochées.
        r"|certains\s+mod[èe]les\s+avec\s+bordure", re.I)),
    ("quincaillerie", "quincaillerie, hors périmètre Akora", re.compile(
        r"\bboulons?\b|\b[ée]crous?\b|tige\s+filet|\bclous\b|vis\s+tir"
        r"|rondelles?\b|cavalier|cale\s+(bois|plastique)", re.I)),
    # ⚠ « grillage » n'est PAS de la quincaillerie : le catalogue Akora le
    # donne comme synonyme de **treillis soudé**, un vrai matériau de gros
    # œuvre. Mais sa seule référence est un Ø6 maille 150, et ces annonces
    # vendent du galva de 1,5 à 3 mm : aucune ne lui correspond. On les écarte
    # donc des produits en gardant leur libellé dans « matériaux absents »,
    # pour que la référence soit ajoutée au site — pas parce qu'elles sont
    # hors sujet, mais parce que le catalogue est incomplet.
    ("reference_absente", "matériau réel, absent du catalogue Akora", re.compile(
        r"grillage\s+st\b|grillage\s+galva", re.I)),
    ("plomberie", "plomberie et tuyauterie, hors périmètre", re.compile(
        r"tuyau\s+(souple|de\s+gonflage)|embouts?\s+multiples", re.I)),
    ("service", "prestation de service, pas une vente de matériau", re.compile(
        r"plaquiste|placo\s*pl[aâ]tre|posse\s+placo|mametaka\s+plafon"
        r"|d[ée]coration\s+placo|location\s+d[\'’]une|mpanefy|misera\s+volamena"
        r"|vulca|pneumatique|autoservice", re.I)),
    ("devise", "prix en FCFA : annonce hors Madagascar", re.compile(
        r"\bfcfa\b|\d\s*f\s+(la\s+feuille|unit[ée])|prix\s+\d+f\b", re.I)),
]


def candidats() -> list[dict]:
    """Les offres gardées dont le libellé sort du périmètre. Lecture seule."""
    retenues = []
    for offre in base.offres_gardees_vivantes():
        libelle = offre.get("libelle_brut") or ""
        for cle, raison, motif in MOTIFS:
            if motif.search(libelle):
                retenues.append({**offre, "motif": cle, "raison": raison})
                break
    return retenues


def main() -> int:
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--ecrire", action="store_true",
                           help="applique (par défaut : liste seulement)")
    args = analyseur.parse_args()

    trouvees = candidats()
    if not trouvees:
        print("Aucune offre hors périmètre.")
        return 0

    par_motif: dict[str, list[dict]] = {}
    for offre in trouvees:
        par_motif.setdefault(offre["motif"], []).append(offre)

    appariees = 0
    for motif, offres in sorted(par_motif.items(), key=lambda x: -len(x[1])):
        print(f"\n── {motif.upper()} — {offres[0]['raison']} ({len(offres)}) ──")
        for offre in offres:
            marque = ""
            if offre.get("materiau_slug"):
                appariees += 1
                marque = f"  ⚠ APPARIÉE À « {offre['materiau_slug']} »"
            prix = f"{offre['prix']} Ar" if offre.get("prix") else "sans prix"
            print(f"   [{offre['id']:>5}] {prix:>12} | "
                  f"{(offre.get('libelle_brut') or '')[:70]}{marque}")

    print(f"\n{len(trouvees)} offre(s) hors périmètre, dont {appariees} "
          f"déjà appariée(s) à une référence du catalogue.")

    if not args.ecrire:
        print("\nRien n'a été écrit. Relancer avec --ecrire pour appliquer.")
        return 0

    for offre in trouvees:
        # `garder = 0` la sort de la fiche du dépôt ; `hors_catalogue = 1` et
        # la référence effacée l'empêchent de redevenir un produit. On ne
        # SUPPRIME pas : le libellé reste lisible pour comprendre pourquoi il
        # avait été ramassé.
        base.modifier_offre(offre["id"], garder=0, hors_catalogue=1,
                            ambigu=0, materiau_slug=None, materiau_nom=None)
        # Un matériau réel que le catalogue ignore n'est pas un déchet : c'est
        # une référence à ajouter au site. Sans cette ligne, l'information
        # disparaissait avec l'offre — et on redécouvrirait le manque à la
        # prochaine collecte.
        if offre["motif"] == "reference_absente":
            base.signaler_materiau_absent(
                (offre.get("libelle_brut") or "").split("›")[0].strip(),
                offre.get("libelle_brut") or "")
    base.logguer(
        f"{len(trouvees)} offre(s) hors périmètre écartée(s) "
        f"(dont {appariees} qui étaient appariées).", "avert")
    print(f"\n{len(trouvees)} offre(s) écartée(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
