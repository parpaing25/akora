# -*- coding: utf-8 -*-
"""axe-core sur le VRAI site (navigateur reel, contrastes calcules), 390 px.

Le banc a11y du depot tourne sous jsdom : il ne mesure pas les contrastes ni la
mise en page. Ici on injecte axe-core (node_modules du depot) dans Chromium.
"""
import sys, json, os
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

AXE = r"C:\Users\ANDRIANIRINA\Desktop\AKORA\akora\node_modules\axe-core\axe.min.js"
BASE = "https://akora.fonenako.mg"
PAGES = ["/", "/materiaux", "/fournisseurs/hourdis-mg", "/fournisseurs/hourdis-mg/hourdis-tc-20",
         "/prix", "/calculateurs/mur-parpaings", "/connexion", "/inscription", "/panier", "/contact"]
axe_src = open(AXE, encoding="utf-8").read()
sortie = {}
with sync_playwright() as pw:
    nav = pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, locale="fr-FR", bypass_csp=True, user_agent="Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 AkoraAudit/1")
    page = ctx.new_page()
    for chemin in PAGES:
        page.goto(BASE + chemin, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(800)
        page.add_script_tag(content=axe_src)
        res = page.evaluate("""async () => {
          const r = await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}});
          return r.violations.map(v => ({id: v.id, impact: v.impact, aide: v.help, n: v.nodes.length,
            ex: v.nodes.slice(0,2).map(nd => (nd.target[0]||'').slice(0,60) + ' :: ' + (nd.failureSummary||'').split('\\n')[1]?.slice(0,90))}));
        }""")
        sortie[chemin] = res
        grave = [v for v in res if v["impact"] in ("critical", "serious")]
        print(f"{chemin:<44} violations={len(res):>2}  critiques/serieuses={len(grave)}")
        for v in res:
            print(f"    [{v['impact']:<8}] {v['id']:<28} x{v['n']:<3} {v['aide'][:70]}")
            for e in v["ex"][:1]:
                print(f"               {e}")
    ctx.close(); nav.close()
json.dump(sortie, open(os.path.join(os.path.dirname(__file__), "axe_akora.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
