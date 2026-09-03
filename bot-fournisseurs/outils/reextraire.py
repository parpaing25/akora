"""Relit les publications DÉJÀ collectées et réécrit leurs offres.

Troisième frère des outils de rejeu : `diagnostic_offres.py` classe,
`rejouer_appariement.py` mesure, `reapparier.py` recolle une référence sur des
offres existantes. Celui-ci va plus loin — il **refait l'extraction** depuis le
texte brut de la publication, donc il crée et supprime des offres.

🔴 POURQUOI IL EXISTE. Le 24/08/2026, `extraction.offres()` a été refondu :
sur le même corpus, les offres PORTANT UN PRIX passent de 21 à 133, parce que
le matériau est souvent dans l'en-tête et le prix dans la ligne (« ALU ZINC »
puis « -014 : 8 500 Ar ») — un découpage ligne à ligne perdait tout. Mais
corriger le code ne corrige pas le passé : les offres en base ont été figées
au moment de la collecte. Sans ce passage, il faudrait attendre qu'une
nouvelle collecte revoie chaque publication, ce que rien ne garantit.

⚠ IL SUPPRIME. Une publication qui ne produit plus d'offre (phrase de
remerciement, nom de page pris pour un matériau) voit ses offres retirées.
C'est le but : ces lignes alimentaient l'observatoire des prix.

⚠⚠ CE QUE `garder` VEUT DIRE — piège vérifié le 24/08/2026. `garder` vaut
**1 par défaut** (`base.py:131`) : ce n'est PAS « validé par un humain », c'est
« cette offre compte ». Une première version de cet outil préservait tout ce
qui avait `garder=1`, donc les 178 offres, et ajoutait les 288 nouvelles
par-dessus : 466 lignes, doublons compris. La seule trace d'un geste humain
est `garder=0` — quelqu'un a explicitement écarté cette offre. Ce sont donc
les `garder=0` qu'on protège : on ne les recrée pas, sinon elles
réapparaîtraient à chaque passage, exactement comme le piège du doublon
effacé qui revient (motif `empreintes` du bot d'annonces).

Usage :
    python outils/reextraire.py            # à blanc : montre, n'écrit rien
    python outils/reextraire.py --ecrire   # écrit, après sauvegarde
"""
from __future__ import annotations

import shutil
import sqlite3
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import extraction  # noqa: E402
from bot.config import BASE, charger  # noqa: E402


def principal() -> None:
    ecrire = "--ecrire" in sys.argv
    cfg = charger()
    from bot import referentiel
    referentiel.charger()   # le catalogue sert a extraction.offres() elle-meme

    cx = sqlite3.connect(f"file:{BASE}?mode=ro", uri=True)
    cx.row_factory = sqlite3.Row
    publications = cx.execute(
        "SELECT id, prospect_id, texte FROM publications ORDER BY id").fetchall()
    anciennes = cx.execute("SELECT * FROM offres").fetchall()
    cx.close()

    par_publication: dict = {}
    for o in anciennes:
        par_publication.setdefault(o["publication_id"], []).append(o)

    a_creer, a_supprimer = [], []
    compte = Counter()
    for pub in publications:
        texte = pub["texte"] or ""
        # 🔴 ON N'APPARIE PAS ICI, et c'est la leçon du 24/08/2026.
        # La première version rappelait `referentiel.apparier()` sur chaque
        # libellé produit. Résultat mesuré en base : « Grillage ST galva ›
        # Prix : 380.000ar » publié comme *tôle ondulée galvanisée 0,25*, et
        # « TANY MORA BE » (une annonce de TERRAIN) comme *brique de terre
        # comprimée* à 70 000 Ar — dans l'observatoire des prix public.
        # Or `extraction.offres()` répond déjà `materiau_slug = None` sur ces
        # deux textes : il SAIT qu'il ne sait pas. C'est le second appel,
        # sans le contexte de la ligne, qui inventait une référence.
        # Cet outil doit refaire ce que fait le collecteur — pas mieux.
        neuves = extraction.offres(texte, cfg)
        vieilles = par_publication.get(pub["id"], [])
        # `garder=0` = écartée à la main. On la laisse en base ET on ne
        # recrée pas son équivalent, sinon le refus serait effacé à chaque
        # passage. Tout le reste est remplacé par le fruit du code d'aujourd'hui.
        ecartees = {(o["libelle_brut"] or "").strip() for o in vieilles
                    if not o["garder"]}
        a_supprimer.extend(o["id"] for o in vieilles if o["garder"])
        a_creer.extend((pub["prospect_id"], pub["id"], o) for o in neuves
                       if (o.get("libelle_brut") or "").strip() not in ecartees)
        compte["publications"] += 1
        compte["ecartees_a_la_main"] += len(ecartees)

    # ⭐ LES ATTRIBUTIONS DE PHOTOS SURVIVENT AU REJEU. Cet outil supprime les
    #   offres et les recrée, et `offres.id` est AUTOINCREMENT : les
    #   identifiants ne reviennent jamais (deux renumérotations le 03/09/2026,
    #   1..336 puis 682..1026). Le lien photo↔produit portant l'identifiant de
    #   l'offre, il partait avec elle par la cascade : UNE SEULE EXÉCUTION
    #   EFFAÇAIT 100 % DU TRAVAIL HUMAIN D'ATTRIBUTION — la seule chose
    #   qu'aucune machine ne sait refaire. On relève donc, avant de supprimer,
    #   quelle photo montrait quelle offre, par sa clé naturelle
    #   (publication, libellé), et on recolle après la recréation.
    from bot import base as socle
    liens_anciens: dict = {}
    for o in anciennes:
        if not o["garder"]:
            continue
        photos = socle.photos_de_l_offre(o["id"])
        if photos:
            liens_anciens[(o["publication_id"], (o["libelle_brut"] or "").strip())] = photos
    a_reporter = sum(len(v) for v in liens_anciens.values())

    avec_prix_avant = sum(1 for o in anciennes if o["prix"])
    avec_prix_apres = sum(1 for _, _, o in a_creer if o.get("prix"))
    ref_apres = sum(1 for _, _, o in a_creer if o.get("materiau_slug"))
    pub_apres = sum(1 for _, _, o in a_creer
                    if o.get("materiau_slug") and o.get("prix"))
    ref_avant = sum(1 for o in anciennes if o["materiau_slug"])
    pub_avant = sum(1 for o in anciennes if o["materiau_slug"] and o["prix"])

    print(f"{compte['publications']} publications relues\n")
    print(f"  {'':22} {'avant':>7} {'après':>7}")
    print(f"  {'offres':22} {len(anciennes):>7} {len(a_creer):>7}")
    print(f"  {'avec un prix':22} {avec_prix_avant:>7} {avec_prix_apres:>7}")
    print(f"  {'référencées':22} {ref_avant:>7} {ref_apres:>7}")
    print(f"  {'PUBLIABLES (réf + prix)':22} {pub_avant:>7} {pub_apres:>7}")
    print(f"\n  offres remplacées : {len(a_supprimer)}"
          f" · écartées à la main, respectées : {compte['ecartees_a_la_main']}")
    print(f"  attributions de photos à reporter : {a_reporter} "
          f"(sur {len(liens_anciens)} offre(s))")

    if not ecrire:
        print("\nÀ blanc : rien n'a été écrit. Relancer avec --ecrire.")
        return

    sauvegarde = Path(f"{BASE}.avant-reextraction-"
                      f"{datetime.now().strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(BASE, sauvegarde)
    print(f"\nSauvegarde : {sauvegarde.name}")

    n, recollees = 0, 0
    for oid in a_supprimer:
        socle.supprimer_offre(oid)
    for prospect_id, publication_id, offre in a_creer:
        nid = socle.ajouter_offre(prospect_id, publication_id, offre)
        if nid:
            n += 1
        photos = liens_anciens.get((publication_id, (offre.get("libelle_brut") or "").strip()))
        if not photos:
            continue
        # `ajouter_offre` rend None quand une jumelle existe déjà chez ce
        # dépôt : le lien va alors sur la jumelle, pas dans le vide.
        if nid is None:
            nid = _jumelle(socle, prospect_id, offre)
        for photo_id in photos:
            if nid and socle.attacher_photo(photo_id, nid):
                recollees += 1
    print(f"{len(a_supprimer)} offre(s) supprimée(s), {n} créée(s), "
          f"{recollees}/{a_reporter} attribution(s) de photo reportée(s).")
    if recollees < a_reporter:
        print(f"⚠ {a_reporter - recollees} attribution(s) NON reportée(s) : le libellé "
              "de leur offre a changé avec l'extraction. À refaire à la main dans "
              "le panneau du dépôt — la sauvegarde ci-dessus dit lesquelles.")


def _jumelle(socle, prospect_id: str, offre: dict) -> int | None:
    """L'offre déjà en base que `ajouter_offre` a jugée identique (même règle)."""
    empreinte = offre.get("materiau_slug") or offre.get("libelle_brut")
    with socle._verrou, socle.connexion() as cx:
        ligne = cx.execute(
            "SELECT id FROM offres WHERE prospect_id = ? "
            "AND COALESCE(materiau_slug, libelle_brut) = ? LIMIT 1",
            (prospect_id, empreinte)).fetchone()
        return ligne["id"] if ligne else None


if __name__ == "__main__":
    principal()
