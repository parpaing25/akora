"""Classe les offres collectées : chiffrée, sans prix, ou pas une offre du tout.

🔴 POURQUOI CET OUTIL EXISTE. Le 24/08/2026, l'appariement au catalogue venait
   d'être assaini — 16 offres justes sur 128, aucune fausse — et le site restait
   quasi vide : 1 fournisseur public, 13 produits. Le plafond n'était pas
   l'appariement. Sur les 171 lignes de la table `offres`, **149 n'avaient aucun
   prix**, et une bonne part n'étaient pas des offres : des remerciements, des
   cotes de bâtiment, des questions d'acheteur, des articles de presse, et le
   nom d'une page qui contient un matériau (« MORA TÔLE » produisait une offre
   de tôle à chaque phrase de sa publicité).

   Compter les offres ne dit donc rien. Ce qu'il faut compter, c'est ce qui est
   PUBLIABLE : une référence du catalogue ET un prix. D'où ce thermomètre.

Deux mesures, et elles ne disent pas la même chose :

  1. **Ce que la base contient** — les lignes déjà écrites par les collectes
     passées, rejugées par le code d'aujourd'hui. C'est l'état du stock.
  2. **Ce que le code d'aujourd'hui tirerait des mêmes publications** — on
     rejoue `extraction.offres()` sur les textes bruts de `publications`. C'est
     la mesure qui bouge quand on change une règle, et donc la seule qui permet
     de dire si un changement sert à quelque chose.

Rien n'est écrit : la base est ouverte en `mode=ro`, exactement comme
`outils/rejouer_appariement.py`, dont cet outil est le frère.

Usage :
    python outils/diagnostic_offres.py         # les chiffres
    python outils/diagnostic_offres.py -v      # + les libellés bruts, par catégorie
"""
from __future__ import annotations

import sqlite3
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import extraction, referentiel  # noqa: E402
from bot.config import BASE, charger  # noqa: E402

# La console Windows est en cp1252 : les libellés collectés, eux, sont en
# malgache accentué et l'outil trace des filets. Sans ce réglage, le diagnostic
# meurt sur un UnicodeEncodeError avant d'avoir affiché un seul chiffre.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):       # sortie redirigée : rien à régler
    pass


def court(texte: str, taille: int = 86) -> str:
    plat = " ".join((texte or "").split())
    return plat[:taille] + ("…" if len(plat) > taille else "")


def classer(libelle: str, prix_en_base, cfg: dict) -> tuple[str, str]:
    """(catégorie, détail) pour une ligne déjà en base.

    Le prix est RELU par le code d'aujourd'hui, pas repris de la colonne : c'est
    ce qui fait apparaître les prix que la collecte n'avait pas su lire, et
    disparaître ceux qu'elle avait cru lire.
    """
    montant, _, _ = extraction.prix_dans(libelle, cfg)
    raison = extraction.raison_hors_offre(libelle, montant is not None)
    if raison:
        return "c_pas_une_offre", raison
    if montant is not None:
        ecart = "" if montant == prix_en_base else f"en base : {prix_en_base or '—'}"
        return "a_avec_prix", f"{montant} Ar {ecart}".strip()
    return "b_sans_prix", ""


def etat_de_la_base(cx, cfg: dict, bavard: bool) -> None:
    lignes = cx.execute(
        "SELECT id, libelle_brut, prix, materiau_slug FROM offres ORDER BY id"
    ).fetchall()
    if not lignes:
        print("Aucune offre en base.")
        return

    groupes: dict[str, list] = {"a_avec_prix": [], "b_sans_prix": [], "c_pas_une_offre": []}
    raisons = Counter()
    for offre in lignes:
        categorie, detail = classer(offre["libelle_brut"] or "", offre["prix"], cfg)
        groupes[categorie].append((offre, detail))
        if categorie == "c_pas_une_offre":
            raisons[detail] += 1

    total = len(lignes)
    print(f"── 1. CE QUE LA BASE CONTIENT — {total} offres " + "─" * 30)
    for cle, titre in (("a_avec_prix", "(a) offre avec un prix lisible"),
                       ("b_sans_prix", "(b) offre sans prix"),
                       ("c_pas_une_offre", "(c) ce n'est pas une offre")):
        part = len(groupes[cle])
        print(f"   {titre:<34} {part:>4}  ({part * 100 // total} %)")
    avec_reference = sum(1 for o in lignes if o["materiau_slug"])
    publiables = sum(1 for o in lignes if o["materiau_slug"] and o["prix"])
    print(f"   {'dont référencées au catalogue':<34} {avec_reference:>4}")
    print(f"   {'dont PUBLIABLES (référence + prix)':<34} {publiables:>4}")
    if raisons:
        print("   écartées parce que : "
              + ", ".join(f"{raison} ×{n}" for raison, n in raisons.most_common()))

    if not bavard:
        return
    for cle, titre in (("a_avec_prix", "(a) OFFRES AVEC UN PRIX LISIBLE"),
                       ("b_sans_prix", "(b) OFFRES SANS PRIX"),
                       ("c_pas_une_offre", "(c) CE N'EST PAS UNE OFFRE")):
        print(f"\n   {titre}")
        for offre, detail in groupes[cle]:
            marque = f"  [{detail}]" if detail else ""
            print(f"     #{offre['id']:>3} {court(offre['libelle_brut'])}{marque}")


def rejeu_sur_les_publications(cx, cfg: dict, bavard: bool) -> None:
    publications = cx.execute("SELECT id, texte FROM publications").fetchall()
    if not publications:
        print("\nAucune publication en base — rien à rejouer.")
        return

    total = avec_prix = referencees = publiables = 0
    raisons = Counter()
    heritees = []
    for publication in publications:
        texte = publication["texte"] or ""
        for offre in extraction.offres(texte, cfg):
            total += 1
            if offre.get("prix"):
                avec_prix += 1
            if offre.get("materiau_slug"):
                referencees += 1
                if offre.get("prix"):
                    publiables += 1
            if "›" in (offre.get("libelle_brut") or ""):
                heritees.append(offre)
        marques = extraction.marques_de_page(texte)
        for ligne in extraction.segments(texte):
            montant, _, _ = extraction.prix_dans(ligne, cfg)
            raison = extraction.raison_hors_offre(ligne, montant is not None, marques)
            if raison and raison != "vide":
                raisons[raison] += 1

    print(f"\n── 2. CE QUE LE CODE D'AUJOURD'HUI TIRE DES {len(publications)} "
          f"PUBLICATIONS " + "─" * 12)
    print(f"   {'offres lues':<34} {total:>4}")
    print(f"   {'dont AVEC UN PRIX':<34} {avec_prix:>4}  "
          f"({avec_prix * 100 // max(total, 1)} %)")
    print(f"   {'dont héritées d un en-tête':<34} {len(heritees):>4}")
    print(f"   {'dont référencées au catalogue':<34} {referencees:>4}")
    print(f"   {'dont PUBLIABLES (référence + prix)':<34} {publiables:>4}")
    print("   lignes écartées : "
          + (", ".join(f"{raison} ×{n}" for raison, n in raisons.most_common())
             or "aucune"))

    if bavard and heritees:
        print("\n   LIGNES SAUVÉES PAR L'HÉRITAGE D'EN-TÊTE "
              "(le matériau était dans le titre, le prix dans la ligne)")
        for offre in heritees:
            print(f"     {str(offre['prix'] or '—'):>9} "
                  f"{offre.get('type_slug') or '?':<20} {court(offre['libelle_brut'], 60)}")


def principal() -> None:
    bavard = "-v" in sys.argv
    cfg = charger()
    referentiel.charger()

    cx = sqlite3.connect(f"file:{BASE}?mode=ro", uri=True)
    cx.row_factory = sqlite3.Row
    try:
        etat_de_la_base(cx, cfg, bavard)
        rejeu_sur_les_publications(cx, cfg, bavard)
    finally:
        cx.close()

    if not bavard:
        print("\n(-v pour voir les libellés bruts, catégorie par catégorie)")


if __name__ == "__main__":
    principal()
