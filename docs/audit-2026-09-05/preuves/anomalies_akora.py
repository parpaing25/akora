# -*- coding: utf-8 -*-
"""Trois anomalies du crawl, remontees a la source :
1. /materiaux/bois/madrier : 6 requetes 400 sur vehicules_livraison -> URL complete + corps de la reponse
2. /materiaux/bois/madrier/madrier-70x150-4m @390 : quel element deborde de 204 px
3. console : les avertissements « Deprecated API » viennent-ils du site ou de ma mesure ?
"""
import sys, json
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

BASE = "https://akora.fonenako.mg"
with sync_playwright() as pw:
    nav = pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, locale="fr-FR")
    page = ctx.new_page()

    # 3. console SANS ma mesure de performance
    console = []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text[:120]}") if m.type in ("error", "warning") else None)
    echecs = {}
    def on_resp(r):
        if r.status >= 400 and "vehicules_livraison" in r.url and r.url not in echecs:
            try: corps = r.text()[:300]
            except Exception as e: corps = f"(illisible {e})"
            echecs[r.url] = (r.status, corps)
    page.on("response", on_resp)

    page.goto(BASE + "/materiaux/bois/madrier", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1500)
    print("=== 1. vehicules_livraison sur /materiaux/bois/madrier ===")
    for url, (st, corps) in echecs.items():
        print(f"  HTTP {st}\n  URL  {url}\n  CORPS {corps}\n")
    print("=== 3. console de la page (sans ma mesure) :", console or "aucun message", "\n")

    # 2. debordement
    page.goto(BASE + "/materiaux/bois/madrier/madrier-70x150-4m", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1500)
    res = page.evaluate("""() => {
      const vw = window.innerWidth, out = [];
      for (const e of document.querySelectorAll('body *')) {
        const b = e.getBoundingClientRect();
        if (b.right > vw + 1 && b.width > 0) {
          const cs = getComputedStyle(e);
          out.push({tag: e.tagName.toLowerCase(), cls: (e.className||'').toString().slice(0,90), right: Math.round(b.right), w: Math.round(b.width),
                    ws: cs.whiteSpace, ov: cs.overflowX, txt: (e.textContent||'').trim().slice(0,60)});
        }
      }
      return {scrollW: document.documentElement.scrollWidth, vw, n: out.length, pires: out.sort((a,b)=>b.right-a.right).slice(0,8)};
    }""")
    print("=== 2. debordement /materiaux/bois/madrier/madrier-70x150-4m @390 ===")
    print(f"  scrollWidth={res['scrollW']} innerWidth={res['vw']} elements qui depassent={res['n']}")
    for p in res["pires"]:
        print(f"  <{p['tag']}> right={p['right']} w={p['w']} ws={p['ws']} ovx={p['ov']} cls={p['cls']!r} txt={p['txt']!r}")
    page.screenshot(path=__file__.replace("anomalies_akora.py", "capture-390-format-debordement.jpeg"), type="jpeg", quality=55, full_page=False)
    ctx.close(); nav.close()
