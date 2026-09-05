"""Diagnostic des sources de genre « recherche » : que voit le bot sur la page ?

🔴 POURQUOI. Le 02/09/2026, les treize recherches en base (« Hourdis
Antananarivo », « location camion benne Antananarivo »…) ont rendu DEUX
publications en dix jours ; les sept recherches de transport, lancées pour la
première fois ce jour-là, ont chacune rendu « 0 publication(s) mise(s) en
file » en onze secondes. Les groupes, eux, donnent. La page de résultats de
Facebook n'a pas la structure du fil : ce script ouvre UNE recherche avec la
session du bot et dit ce que `JS_EXTRAIRE_FIL` y trouve, bloc par bloc.

Il ne collecte rien, n'écrit rien en base ; il imprime.

Usage :
    python outils/diagnostic_recherche.py "location camion benne Antananarivo"
    python outils/diagnostic_recherche.py "hourdis Antananarivo" --scrolls 4
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import collecteur as col  # noqa: E402
from bot import verrou_navigateur  # noqa: E402
from bot.config import charger  # noqa: E402

JS_COMPTER = """
() => ({
  articles: document.querySelectorAll('[role="article"]').length,
  feed: document.querySelectorAll('[role="feed"]').length,
  liens_posts: [...document.querySelectorAll('a[href]')]
    .map(a => a.href).filter(h => /\\/(posts|permalink\\.php|groups\\/[^/]+\\/posts|photo)/.test(h)).length,
  titre: document.title,
  texte: (document.body.innerText || '').slice(0, 400),
})
"""


def principal() -> int:
    analyseur = argparse.ArgumentParser()
    analyseur.add_argument("requete")
    analyseur.add_argument("--scrolls", type=int, default=3)
    options = analyseur.parse_args()

    cfg = charger()
    if not col._memoire_suffisante(cfg):
        return 2
    occupant = verrou_navigateur.qui()
    if occupant:
        print(f"Le navigateur est pris par « {occupant} » : réessayer plus tard.")
        return 2

    url = f"https://www.facebook.com/search/posts/?q={quote(options.requete)}"
    print("Ouverture :", url)
    c = col.Collecteur()
    with verrou_navigateur.verrou_navigateur("akora"), col._playwright_ouvert() as pw:
        ctx = c._contexte(pw, visible=bool(cfg.get("navigateur_visible", True)))
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(5000)
        for tour in range(options.scrolls + 1):
            try:
                page.evaluate(col.JS_DEPLIER)
            except Exception:
                pass
            compte = page.evaluate(JS_COMPTER)
            lot = page.evaluate(col.JS_EXTRAIRE_FIL, int(cfg.get("largeur_photo_min", 400)))
            print(f"\n— tour {tour} : {compte['articles']} bloc(s) role=article, "
                  f"{compte['feed']} feed, {compte['liens_posts']} lien(s) de publication, "
                  f"{len(lot)} extrait(s) par JS_EXTRAIRE_FIL")
            if tour == 0:
                print("  titre :", compte["titre"])
                print("  début du texte :", json.dumps(compte["texte"][:300], ensure_ascii=False))
            for p in lot[:5]:
                print("   ·", json.dumps({k: (str(v)[:90] if not isinstance(v, list) else len(v))
                                        for k, v in p.items()
                                        if k in ("auteur", "auteur_url", "permalien", "texte",
                                                 "heure", "heure_source", "images")},
                                       ensure_ascii=False))
            page.mouse.wheel(0, 2200)
            page.wait_for_timeout(2500)
        try:
            page.screenshot(path=str(Path("data") / "diagnostic-recherche.png"), full_page=False)
            print("\nCapture : data/diagnostic-recherche.png")
        except Exception:
            pass
        ctx.close()
    return 0


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.exit(principal())
