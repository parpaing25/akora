# -*- coding: utf-8 -*-
"""Controles cibles des correctifs, sur le build local (ou la prod via AKORA_BASE)."""
import os, sys, json
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

BASE = os.environ.get("AKORA_BASE", "http://localhost:4173")
UA = "Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 AkoraAudit/1"

with sync_playwright() as pw:
    nav = pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, locale="fr-FR", user_agent=UA)
    page = ctx.new_page()
    ko = []
    page.on("response", lambda r: ko.append((r.status, r.url[:120])) if r.status >= 400 else None)

    print("=== boutons compacts : couleur ===")
    page.goto(BASE + "/", wait_until="networkidle", timeout=60000); page.wait_for_timeout(800)
    for r in page.evaluate("""() => [...document.querySelectorAll('a[href="/inscription"], a[href="/connexion"]')].slice(0,3).map(e => ({txt: e.textContent.trim().slice(0,20), color: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor, cls: e.classList.contains('text-primary-foreground')}))"""):
        print("  ", r)
    print("  JSON-LD accueil :", page.evaluate("() => [...document.querySelectorAll('script[type=\"application/ld+json\"]')].map(s => JSON.parse(s.textContent)['@type'])"))
    print("  titre :", page.title())

    print("=== page type : colonne rendu ===")
    ko.clear()
    page.goto(BASE + "/materiaux/bois/madrier", wait_until="networkidle", timeout=60000); page.wait_for_timeout(2500)
    txt = page.evaluate("() => document.body.innerText")
    print("  requetes >= 400 :", [k for k in ko if "vehicules_livraison" in k[1] or "zones_livraison" in k[1]] or "aucune sur les barèmes")
    print("  mot 'rendu' présent :", "rendu" in txt.lower(), "| 'Ar' présent :", " Ar" in txt)

    print("=== page format : débordement + curseur ===")
    page.goto(BASE + "/materiaux/bois/madrier/madrier-70x150-4m", wait_until="networkidle", timeout=60000); page.wait_for_timeout(1500)
    print("  scrollWidth :", page.evaluate("() => document.documentElement.scrollWidth"), "| slider aria-label :", page.evaluate("() => document.querySelector('[role=slider]')?.getAttribute('aria-label')"))

    print("=== commande invitée : mauvais jeton ===")
    ko.clear()
    page.goto(BASE + "/commande/AK-000000?j=" + "0" * 32, wait_until="networkidle", timeout=60000); page.wait_for_timeout(1200)
    t = page.evaluate("() => document.body.innerText")
    print("  texte :", ("passée sans compte" in t), "| 401 :", [k for k in ko if k[0] == 401] or "aucun")

    print("=== nouvelles pages ===")
    for chemin in ("/faq", "/accessibilite", "/mentions-legales", "/contact", "/a-propos"):
        ko.clear()
        page.goto(BASE + chemin, wait_until="networkidle", timeout=60000); page.wait_for_timeout(600)
        d = page.evaluate("""() => ({h1: document.querySelectorAll('h1').length, mots: document.body.innerText.split(/\\s+/).length, jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)['@type']), completer: (document.body.innerText.match(/À COMPLÉTER/g)||[]).length, deb: document.documentElement.scrollWidth})""")
        print(f"  {chemin:<20} h1={d['h1']} mots={d['mots']} jsonld={d['jsonld']} 'À COMPLÉTER'={d['completer']} deb={d['deb']} ko={len(ko)}")

    print("=== panier vide : composant commandes invitées absent (rien en local) ===")
    page.goto(BASE + "/panier", wait_until="networkidle", timeout=60000); page.wait_for_timeout(500)
    print("  ", "Vos dernières commandes" in page.evaluate("() => document.body.innerText"), "(attendu False sans commande mémorisée)")

    print("=== bandeau incident : absent quand actif=false ===")
    print("  ", page.evaluate("() => !!document.querySelector('[role=status]')"), "(attendu False)")
    ctx.close(); nav.close()
