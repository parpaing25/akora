# -*- coding: utf-8 -*-
"""Crawl deterministe d'akora.fonenako.mg : une ligne de mesures par route.

Extraction pure (pas de jugement) : statut HTTP du shell, titre/canonique/robots
poses par le SPA, h1, landmarks, debordement horizontal, cibles < 44 px, images
sans alt, JSON-LD, erreurs console, requetes en echec, nombre de requetes et
octets transferes, FCP/TTFB. A 390 px puis 1280 px. Sortie JSON + captures
JPEG (390 seulement, 60 % de qualite) pour un sous-ensemble.
"""
import sys, json, time, os
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

BASE = "https://akora.fonenako.mg"
SORTIE = os.path.dirname(os.path.abspath(__file__))
ROUTES = [
    # (chemin, type, capture?)
    ("/", "public", True),
    ("/materiaux", "public", True),
    ("/materiaux/bois", "public", False),
    ("/materiaux/bois/madrier", "public", False),
    ("/materiaux/bois/madrier/madrier-70x150-4m", "public", True),
    ("/fournisseurs", "public", True),
    ("/fournisseurs/hourdis-mg", "public", True),
    ("/fournisseurs/hourdis-mg/hourdis-tc-20", "public", True),
    ("/fournisseurs/hourdis-mg/livraison", "public", False),
    ("/prix", "public", True),
    ("/prix/madrier-70x150-4m/madagascar", "public", False),
    ("/calculateurs", "public", False),
    ("/calculateurs/mur-parpaings", "public", True),
    ("/transporteurs", "public", False),
    ("/recherche?q=parpaing", "public", True),
    ("/panier", "public", True),
    ("/guides/combien-de-parpaings", "public", False),
    ("/devenir-fournisseur", "public", False),
    ("/verification", "public", False),
    ("/a-propos", "public", False),
    ("/contact", "public", True),
    ("/mentions-legales", "public", False),
    ("/politique-confidentialite", "public", False),
    ("/conditions-utilisation", "public", False),
    ("/connexion", "auth", True),
    ("/inscription", "auth", True),
    ("/mot-de-passe-oublie", "auth", False),
    ("/demandes/nouvelle", "auth?", False),
    ("/compte", "protege", False),
    ("/pro", "protege", False),
    ("/admin", "protege", False),
    ("/commander", "protege", False),
    ("/fournisseurs/slug-qui-n-existe-pas", "id-inexistant", True),
    ("/commande/AK-000000", "id-inexistant", False),
    ("/materiaux/famille-inconnue", "id-inexistant", False),
    ("/page-inexistante-xyz", "404", True),
]

JS_MESURES = """() => {
  const r = {};
  r.lang = document.documentElement.lang;
  r.title = document.title;
  r.description = document.querySelector('meta[name=description]')?.content || '';
  r.canonical = document.querySelector('link[rel=canonical]')?.href || '';
  r.robots = document.querySelector('meta[name=robots]')?.content || '';
  r.h1 = [...document.querySelectorAll('h1')].map(h => h.textContent.trim().slice(0,70));
  r.main = document.querySelectorAll('main').length;
  r.debordement = document.documentElement.scrollWidth - window.innerWidth;
  r.imgSansAlt = [...document.images].filter(i => !i.hasAttribute('alt')).length;
  const inter = [...document.querySelectorAll('a,button,[role=button],input,select,textarea')]
    .filter(e => { const b = e.getBoundingClientRect(); return b.width > 1 && b.height > 1; });
  const petites = inter.filter(e => { const b = e.getBoundingClientRect(); return b.width < 44 || b.height < 44; });
  r.cibles = inter.length; r.ciblesSous44 = petites.length;
  r.exemplesPetites = petites.slice(0,4).map(e => (e.getAttribute('aria-label') || e.textContent.trim() || e.tagName).slice(0,26)
     + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
  r.jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => {
    try { const j = JSON.parse(s.textContent); return Array.isArray(j) ? j.map(x=>x['@type']).join('+') : (j['@type']||'?'); } catch { return 'INVALIDE'; } });
  r.formsSansLabel = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(i =>
    !i.labels?.length && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')).length;
  r.textesSous12 = [...document.querySelectorAll('body *')].filter(e => e.children.length===0 && e.textContent.trim()
     && parseFloat(getComputedStyle(e).fontSize) < 12).length;
  const nav = performance.getEntriesByType('navigation')[0];
  r.ttfb = nav ? Math.round(nav.responseStart) : null;
  const fcp = performance.getEntriesByName('first-contentful-paint'); r.fcp = fcp.length ? Math.round(fcp[0].startTime) : null;
  let cls = 0; for (const e of performance.getEntriesByType('layout-shift')) if (!e.hadRecentInput) cls += e.value; r.cls = Math.round(cls*1000)/1000;
  r.motsVisibles = (document.querySelector('main')?.innerText || document.body.innerText || '').split(/\\s+/).filter(Boolean).length;
  r.etatVide = /introuvable|n'existe pas|aucun/i.test(document.body.innerText) ;
  return r;
}"""

def mesurer(page, chemin, largeur, hauteur, capture):
    console, echecs, reqs, octets = [], [], [0], [0]
    def on_console(m):
        if m.type in ("error", "warning"): console.append(f"{m.type}: {m.text[:140]}")
    def on_resp(resp):
        reqs[0] += 1
        try:
            octets[0] += int(resp.headers.get("content-length") or 0)
        except Exception: pass
        if resp.status >= 400: echecs.append(f"{resp.status} {resp.url[:110]}")
    page.on("console", on_console); page.on("response", on_resp)
    page.set_viewport_size({"width": largeur, "height": hauteur})
    t0 = time.time()
    resp = page.goto(BASE + chemin, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1200)
    m = page.evaluate(JS_MESURES)
    m.update({"chemin": chemin, "largeur": largeur, "httpShell": resp.status if resp else None,
              "urlFinale": page.url.replace(BASE, ""), "requetes": reqs[0], "octetsDeclares": octets[0],
              "console": console[:6], "echecs": echecs[:6], "dureeS": round(time.time()-t0, 1)})
    if capture and largeur == 390:
        nom = "capture-390" + chemin.replace("/", "_").replace("?", "_").replace("=", "-")[:40] + ".jpeg"
        page.screenshot(path=os.path.join(SORTIE, nom), type="jpeg", quality=60)
        m["capture"] = nom
    page.remove_listener("console", on_console); page.remove_listener("response", on_resp)
    return m

def main():
    resultats = []
    with sync_playwright() as pw:
        nav = pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        ctx = nav.new_context(locale="fr-FR", timezone_id="Indian/Antananarivo",
                              user_agent="Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 AkoraAudit/1")
        page = ctx.new_page()
        for chemin, genre, capture in ROUTES:
            for (l, h) in ((390, 844), (1280, 800)):
                if l == 1280 and genre in ("protege", "id-inexistant", "404", "auth"):
                    continue  # le desktop ne change rien a ces cas
                try:
                    m = mesurer(page, chemin, l, h, capture); m["genre"] = genre
                except Exception as e:
                    m = {"chemin": chemin, "largeur": l, "genre": genre, "erreur": str(e)[:160]}
                resultats.append(m)
                print(f"{l:>4} {chemin:<44} h1={len(m.get('h1',[]))} req={m.get('requetes','?'):>3} "
                      f"err={len(m.get('console',[]))} ko={len(m.get('echecs',[]))} deb={m.get('debordement','?')} "
                      f"<44={m.get('ciblesSous44','?')} jsonld={m.get('jsonld','?')} -> {m.get('urlFinale','')[:30]}")
        ctx.close(); nav.close()
    with open(os.path.join(SORTIE, "crawl_akora.json"), "w", encoding="utf-8") as f:
        json.dump(resultats, f, ensure_ascii=False, indent=1)
    print(f"\n{len(resultats)} mesures -> crawl_akora.json")

if __name__ == "__main__":
    main()
