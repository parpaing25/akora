# -*- coding: utf-8 -*-
"""01-cartographie-routes.md : tableau genere depuis crawl_akora.json (extraction),
jugements (Probleme / Action) poses dans JUGEMENTS (redaction humaine)."""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ICI = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(ICI, "crawl_akora.json"), encoding="utf-8"))
par = {}
for x in d:
    par.setdefault(x["chemin"], {})[x["largeur"]] = x

# Jugements par route (ID de constat -> voir 02-audit-detaille.md)
JUGEMENTS = {
    "/": ("Publique", "OK avec réserves", "LCP 4,2 s (mobile simulé), 14 requêtes Supabase + 14 préflights, 6+6 appels de barème en 400 (F-02) ; texte des boutons compacts 2,56:1 (A-01) ; photos du fil servies en JPEG plein format (P-03)", "F-02, A-01, P-03, S-06 (JSON-LD Organization)"),
    "/materiaux": ("Publique", "OK", "—", "—"),
    "/materiaux/bois": ("Publique", "OK", "1 cible < 44 px", "M-02"),
    "/materiaux/bois/madrier": ("Publique", "Défaut", "6 requêtes `vehicules_livraison` en HTTP 400 (uuid composite) : le prix rendu n'est jamais affiché sur la page type", "F-02"),
    "/materiaux/bois/madrier/madrier-70x150-4m": ("Publique", "Défaut", "Débordement horizontal de 204 px à 390 px (`sr-only` hors conteneur défilant) ; curseur sans nom accessible ; 4 cibles < 44 px", "M-01, A-02"),
    "/fournisseurs": ("Publique", "OK", "Pas de JSON-LD ItemList", "S-06"),
    "/fournisseurs/hourdis-mg": ("Publique", "OK avec réserves", "30 cibles < 44 px sur 87 (puces produits 73×19) ; CLS 0,167 mesuré sur la fiche produit voisine", "M-02, P-02"),
    "/fournisseurs/hourdis-mg/hourdis-tc-20": ("Publique", "OK avec réserves", "LCP 4,9 s : image produit chargée en `loading=lazy` ; CLS 0,167 (logo du pied de page) ; Lighthouse perf 67", "P-01, P-02"),
    "/fournisseurs/hourdis-mg/livraison": ("Publique", "OK", "2 cibles < 44 px", "M-02"),
    "/prix": ("Publique", "OK", "Pas de JSON-LD (Dataset/ItemList) ; 46 cibles < 44 px à 1280 px (souris : toléré)", "S-06"),
    "/prix/madrier-70x150-4m/madagascar": ("Publique", "OK", "—", "—"),
    "/calculateurs": ("Publique", "OK", "—", "—"),
    "/calculateurs/mur-parpaings": ("Publique", "OK", "Curseur Radix sans `aria-label` (axe : aria-input-field-name)", "A-02"),
    "/transporteurs": ("Publique", "OK", "—", "—"),
    "/recherche?q=parpaing": ("Publique (noindex par robots.txt)", "OK avec réserves", "TTFB 911 ms / FCP 1,2 s (recherche côté base) ; 6 cibles < 44 px", "P-04, M-02"),
    "/panier": ("Publique", "OK", "—", "—"),
    "/guides/combien-de-parpaings": ("Publique", "OK", "Contenu court (~105 mots visibles) pour une page qui vise le SEO", "S-07"),
    "/devenir-fournisseur": ("Publique", "OK", "—", "—"),
    "/verification": ("Publique", "OK", "3 cibles < 44 px", "M-02"),
    "/a-propos": ("Publique", "OK avec réserves", "Sans nom d'entité, sans équipe, sans date ; page reconstruite", "C-02"),
    "/contact": ("Publique", "Défaut", "Seul canal = `mailto:` vers une boîte NON VÉRIFIÉE ; pas de téléphone/WhatsApp ; 2 champs sans étiquette programmatique selon le crawl (à recouper : `Champ` pose l'étiquette par rendu différé)", "C-01, A-03"),
    "/mentions-legales": ("Publique", "Défaut", "Éditeur sans forme juridique, NIF, STAT, RCS, siège, directeur de publication", "C-03"),
    "/politique-confidentialite": ("Publique", "OK", "—", "—"),
    "/conditions-utilisation": ("Publique", "OK", "—", "—"),
    "/connexion": ("Auth", "OK avec réserves", "3 cibles < 44 px (liens texte)", "M-02"),
    "/inscription": ("Auth", "OK avec réserves", "Contraste 3,56:1 sur le panneau latérite ; liste défilante non focalisable ; alt redondant ; 3 champs sans étiquette selon le crawl (à recouper)", "A-01, A-03"),
    "/mot-de-passe-oublie": ("Auth", "OK avec réserves", "Dépend du mailer GoTrue intégré : 2 courriels/heure pour tout le site", "S-03"),
    "/demandes/nouvelle": ("Publique (formulaire)", "OK", "—", "—"),
    "/compte": ("Protégée", "OK", "Redirection vers /connexion", "—"),
    "/pro": ("Protégée", "OK", "Redirection vers /connexion", "—"),
    "/admin": ("Protégée", "OK", "Redirection vers /connexion", "—"),
    "/commander": ("Publique (noindex)", "OK avec réserves", "Sans h1 (panier vide) ; un invité peut commander puis n'a aucun accès à sa commande", "F-01"),
    "/fournisseurs/slug-qui-n-existe-pas": ("Id inexistant", "OK", "Page « introuvable » dessinée, `noindex`, mais **HTTP 200** (soft-404 inévitable en SPA ; noindex = mitigation acceptée)", "S-01"),
    "/commande/AK-000000": ("Id inexistant", "Défaut", "401 sur `commandes` pour un invité → « Commande introuvable » même pour une commande réelle", "F-01"),
    "/materiaux/famille-inconnue": ("Id inexistant", "OK", "Page « introuvable », `noindex`, HTTP 200", "S-01"),
    "/page-inexistante-xyz": ("404", "Défaut", "HTTP **200** : le premier segment n'est pas une route connue, Apache pourrait répondre 404", "S-01"),
}

lignes = []
for chemin, jug in JUGEMENTS.items():
    m = par.get(chemin, {}).get(390, {})
    m2 = par.get(chemin, {}).get(1280, {})
    type_, statut, probleme, action = jug
    h1 = len(m.get("h1", [])) if m else "?"
    titre = (m.get("title") or "").replace(" — Akora", "")[:34]
    robots = "noindex" if "noindex" in (m.get("robots") or "") else "index"
    deb = m.get("debordement", "?")
    cibles = f"{m.get('ciblesSous44','?')}/{m.get('cibles','?')}"
    req = m.get("requetes", "?"); ko = len(m.get("echecs", []))
    fcp = m.get("fcp", "?")
    jsonld = "+".join(m.get("jsonld", [])) or "—"
    lignes.append(f"| `{chemin}` | {type_} | **{statut}** | {titre} | {h1} | {robots} | {deb} | {cibles} | {req}{f' ({ko} KO)' if ko else ''} | {fcp} | {jsonld} | {probleme} | {action} |")

NON_CRAWLEES = [
    ("/fournisseurs/:slug/:produitSlug (autres)", "Publique", "40 fiches produit ; une seule mesurée"),
    ("/paiement/:numero", "Protégée (acheteur)", "Tunnel de paiement : jamais joué en prod (0 paiement). NON VÉRIFIÉ — à tester : commande réelle + référence + confirmation admin"),
    ("/depot-reserve/:jeton", "Semi-publique (jeton)", "Revendication d'une fiche créée par le bot. NON VÉRIFIÉ — à tester avec un jeton réel"),
    ("/verification-email, /auth/retour", "Auth", "Retour OAuth Google et confirmation e-mail. NON VÉRIFIÉ — à tester avec un compte neuf"),
    ("/compte/{commandes,paiements,favoris,adresses,securite}", "Protégée", "6 écrans. NON VÉRIFIÉ connecté — à tester avec le compte de recette"),
    ("/pro/{verification,publier,demandes,clients,catalogue,catalogue/nouveau,catalogue/:id,livraison,vitrine,commandes,commandes/:id,portefeuille,avis,statistiques}", "Protégée (fournisseur)", "15 écrans. NON VÉRIFIÉ — à tester : créer un dépôt de test, déposer 6 pièces, publier un produit, recevoir une commande"),
    ("/admin/{utilisateurs,statistiques,verifications,materiaux,paiements,litiges,versements,referentiels,moderation,audit}", "Protégée (admin)", "11 écrans. NON VÉRIFIÉ — à tester : confirmer un paiement, arbitrer un litige, valider une vérification"),
    ("/guides/{choisir-son-sable,reception-livraison,payer-mobile-money}", "Publique", "3 guides non mesurés (même composant que celui mesuré)"),
    ("/calculateurs/{dalle-hourdis,beton,chape-enduit,toiture}", "Publique", "4 calculateurs non mesurés (même composant)"),
]

entete = """# 01 — Cartographie des routes

**Méthode** : 67 routes déclarées dans `src/App.tsx` (extraction par script, 05/09). 36 routes chargées en navigateur réel (Chromium headless, agent Android, 390×844 puis 1280×800 pour les publiques) par `scratchpad/crawl_akora.py` → 61 mesures dans `crawl_akora.json`. Colonnes mesurées à **390 px** : nombre de `h1`, directive robots posée par le SPA, débordement horizontal (px), cibles tactiles < 44 px / total, requêtes réseau (dont échecs ≥ 400), FCP (ms, réseau réel de ce PC, pas de simulation 3G), JSON-LD présent. Les colonnes *Problème* et *Action* renvoient aux identifiants de `02-audit-detaille.md`.

⚠ Deux artefacts écartés avant lecture : (1) l'avertissement console « Deprecated API for given entry type » sur chaque page venait de **ma** mesure `performance.getEntriesByType`, pas du site ; (2) toute session Chromium **headless par défaut** reçoit une page de blocage o2switch (HTTP 429, « tigre ») — les mesures ci-dessous ont été refaites avec un agent utilisateur mobile qui passe (voir 02, O-02).

Statuts : **OK** · **OK avec réserves** (P2/P3) · **Défaut** (P0/P1).

## Routes mesurées (36)

| Route | Type | Statut | Titre | h1 | robots | Déb. px | Cibles <44 | Req. | FCP ms | JSON-LD | Problème | Action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
"""
pied = """

Lecture rapide : 0 page blanche, 0 erreur JavaScript propre au site, titres et canoniques uniques sur toutes les pages publiques, `noindex` correct sur les états « introuvable » et les espaces privés. Les défauts sont concentrés sur **quatre points** : le prix rendu cassé sur les pages type (F-02), l'accès invité à sa commande (F-01), le débordement du comparateur (M-01) et le contraste des boutons compacts (A-01).

## Routes non mesurées (31) — ce qu'il reste à jouer à la main

| Route(s) | Type | État / procédure |
|---|---|---|
""" + "\n".join(f"| `{r}` | {t} | {p} |" for r, t, p in NON_CRAWLEES) + """

## Hôtes, fichiers et redirections (curl, 05/09)

| Requête | Réponse | Verdict |
|---|---|---|
| `http://akora.fonenako.mg/materiaux` | 301 → `https://akora.fonenako.mg/materiaux` | OK |
| `https://www.akora.fonenako.mg/` | **200**, même contenu, certificat valide pour `www` | **Hôte dupliqué** sans redirection ni canonique serveur (S-02) |
| `/sitemap.xml` | 200 `application/xml`, 45,7 Ko, 289 URL, **0 `lastmod`**, 0 URL produit | S-04 |
| `/robots.txt` | 200 `text/plain`, Disallow des espaces privés et de `/recherche`, Sitemap déclaré | OK |
| `/sw.js` | 200 `application/javascript`, 18 Ko, `Cache-Control: no-cache` | OK |
| `/manifest.webmanifest` | 200 `application/manifest+json`, 3 icônes dont maskable | OK (lien dupliqué dans `index.html`, P3) |
| `/security.txt`, `/.well-known/security.txt`, `/llms.txt` | **200 `text/html`** (repli SPA) | Fichiers absents, faux positifs pour les robots (S-05, S-01) |
| `/page-inexistante-xyz` | **200** | Soft-404 corrigeable au premier segment (S-01) |
| `/uploads/prospects/d16a1964_p133.jpg` et `.thumb.webp` | 200 (80 Ko) / 200 (44 Ko) | La vignette existe mais la home sert le JPEG (P-03) |

Suite : `02-audit-detaille.md` (Phase 2).
"""
sortie = entete + "\n".join(lignes) + pied
dest = r"C:\Users\ANDRIANIRINA\Desktop\AKORA\akora\docs\audit-2026-09-05\01-cartographie-routes.md"
open(dest, "w", encoding="utf-8").write(sortie)
print(f"{dest} : {len(lignes)} routes mesurées, {len(NON_CRAWLEES)} groupes non mesurés, {len(sortie)} caractères")
