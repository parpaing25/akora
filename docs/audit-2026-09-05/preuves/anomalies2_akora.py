# -*- coding: utf-8 -*-
"""Rejeu avec le MEME agent utilisateur mobile que le crawl (le 1er rejeu, en UA
bureau, n'a montre ni les 400 ni le debordement, mais trois 429).
- toutes les reponses >= 400 : URL complete + corps
- debordement mesure a 300 / 1200 / 3000 ms apres networkidle
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

BASE = "https://akora.fonenako.mg"
UA = "Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 AkoraAudit/1"
JS_DEB = """() => {
  const vw = window.innerWidth, out = [];
  for (const e of document.querySelectorAll('body *')) {
    const b = e.getBoundingClientRect();
    if (b.right > vw + 1 && b.width > 0) out.push({tag: e.tagName.toLowerCase(), cls: (e.className||'').toString().slice(0,80),
        right: Math.round(b.right), w: Math.round(b.width), txt: (e.textContent||'').trim().slice(0,50)});
  }
  return {scrollW: document.documentElement.scrollWidth, n: out.length, pires: out.sort((a,b)=>b.right-a.right).slice(0,5)};
}"""
with sync_playwright() as pw:
    nav = pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, locale="fr-FR", user_agent=UA,
                          timezone_id="Indian/Antananarivo")
    page = ctx.new_page()
    echecs = []
    def on_resp(r):
        if r.status >= 400:
            try: corps = r.text()[:260].replace("\n", " ")
            except Exception as e: corps = f"(illisible {e})"
            echecs.append((r.status, r.url, corps))
    page.on("response", on_resp)
    for chemin in ("/materiaux/bois/madrier", "/materiaux/bois/madrier/madrier-70x150-4m", "/"):
        echecs.clear()
        page.goto(BASE + chemin, wait_until="networkidle", timeout=60000)
        print(f"\n=== {chemin} ===")
        for t in (300, 900, 1800):
            page.wait_for_timeout(t)
            d = page.evaluate(JS_DEB)
            print(f"  +{t} ms : scrollWidth={d['scrollW']} depassent={d['n']}", *[f"\n      <{p['tag']}> right={p['right']} w={p['w']} cls={p['cls']!r} txt={p['txt']!r}" for p in d["pires"]])
        vus = set()
        for st, url, corps in echecs:
            cle = (st, url.split("?")[0])
            if cle in vus: continue
            vus.add(cle)
            n = sum(1 for e in echecs if (e[0], e[1].split("?")[0]) == cle)
            print(f"  HTTP {st} x{n}\n    {url[:400]}\n    corps: {corps}")
    ctx.close(); nav.close()
