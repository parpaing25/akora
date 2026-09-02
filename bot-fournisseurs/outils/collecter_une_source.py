"""Collecte UNE source, désignée par son identifiant, et rend compte.

Le bouton « Lancer la collecte » parcourt toutes les sources actives — plus
d'une centaine, plus d'une heure. Pour vérifier qu'un GENRE de source marche
vraiment (les recherches de transport ajoutées le 02/09/2026 n'avaient jamais
tourné), ou pour observer une source précise, il faut pouvoir n'en parcourir
qu'une. C'est le « premier passage sur UN seul » que recommande LISEZ-MOI.md.

Même chemin que la tournée : même navigateur, même verrou (un seul bot ouvre
Chromium à la fois), même appariement, mêmes fiches. Rien n'est écrit sur
akora.fonenako.mg.

Usage :
    python outils/collecter_une_source.py            # liste les sources et leur id
    python outils/collecter_une_source.py 166        # parcourt la source 166
    python outils/collecter_une_source.py 166 --scrolls 8 --posts 15
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import base  # noqa: E402


def principal() -> int:
    analyseur = argparse.ArgumentParser(description="Collecte une seule source")
    analyseur.add_argument("source_id", nargs="?", type=int)
    analyseur.add_argument("--scrolls", type=int, help="défilements max (défaut : réglage)")
    analyseur.add_argument("--posts", type=int, help="publications max (défaut : réglage)")
    options = analyseur.parse_args()

    sources = base.sources()
    if options.source_id is None:
        for s in sources:
            print(f"{s['id']:>4}  {'actif ' if s['actif'] else 'éteint'}  {s['genre']:<9} "
                  f"{s['nom']}  (dernière : {s.get('derniere_collecte') or 'jamais'}, "
                  f"{s.get('nb_trouves') or 0} trouvée(s))")
        return 0

    source = next((s for s in sources if s["id"] == options.source_id), None)
    if not source:
        print(f"Aucune source n'a l'identifiant {options.source_id}.")
        return 1

    from bot.collecteur import Collecteur, session_enregistree

    if not session_enregistree():
        print("Aucune session Facebook enregistrée : connectez le compte depuis l'interface.")
        return 1

    reglages = {}
    if options.scrolls:
        reglages["scrolls_max_par_source"] = options.scrolls
    if options.posts:
        reglages["posts_max_par_source"] = options.posts

    print(f"Collecte de « {source['nom']} » ({source['genre']}) — {source['url']}")
    resultat = Collecteur().collecter(sources=[source], reglages=reglages or None)
    print(json.dumps(resultat, ensure_ascii=False, indent=2))
    print("\nDernières lignes du journal :")
    for ligne in reversed(base.lire_journal(25)):
        print(f"  {ligne['ts'][11:19]} [{ligne['niveau']}] {ligne['message'][:160]}")
    return 0 if not resultat.get("erreur") else 2


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.exit(principal())
