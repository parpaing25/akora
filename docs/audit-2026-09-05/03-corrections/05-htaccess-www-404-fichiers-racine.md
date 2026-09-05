# Correctifs S-01, S-02, S-05, D-02 — `.htaccess`, fichiers racine, `index.html`

Quatre constats du 05/09/2026, tous réglés côté hébergeur et fichiers statiques, **sans toucher au code React** :

| ID | Constat | Preuve |
|---|---|---|
| S-02 (P1) | `https://www.akora.fonenako.mg/` répond **200** avec le même contenu : deux hôtes indexables, la canonique posée par le SPA arrive après le HTML | `curl -sI https://www.akora.fonenako.mg/` → 200 ; certificat valide pour `www` |
| S-01 (P2) | `/page-inexistante-xyz` répond **200** ; `ErrorDocument 404 /index.html` est mort parce que la règle `RewriteRule ^ index.html [L]` attrape tout avant | `public/.htaccess:17,61` ; `crawl_akora.json` (`httpShell: 200`) |
| S-05 (P2) | `/security.txt`, `/.well-known/security.txt`, `/llms.txt` renvoient le HTML de l'appli en 200 : faux positifs pour les robots, aucun canal de signalement de faille, aucune consigne aux moteurs IA | curl 05/09 |
| D-02 (P3) | Pas de `<meta name="color-scheme">` : sous `prefers-color-scheme: dark`, les champs de formulaire natifs et la barre de défilement passent en sombre sur un site clair ; `<link rel="manifest">` présent **deux fois** (index.html + injection vite-plugin-pwa) | `index.html:15`, HTML servi |

**Effort total** : 1 h + 15 min de vérification après déploiement.

---

## 1. `public/.htaccess` — fichier complet de remplacement

```apache
# ── Akora — SPA statique sur mutualisé Apache (o2switch) ─────────────────
# Pas de SSR : toute route CONNUE inconnue du disque retombe sur index.html.
# Une route dont le premier segment n'existe pas rend un VRAI 404 (S-01).

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Un seul hôte (S-02, 05/09/2026) : www → apex, en une redirection, déjà en https.
  RewriteCond %{HTTP_HOST} ^www\.akora\.fonenako\.mg$ [NC]
  RewriteRule ^(.*)$ https://akora.fonenako.mg/$1 [R=301,L]

  # HTTPS obligatoire.
  RewriteCond %{HTTPS} !=on
  RewriteRule ^(.*)$ https://akora.fonenako.mg/$1 [R=301,L]

  # Les fichiers, dossiers et l'API PHP réels sont servis tels quels.
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Vrai 404 quand le PREMIER segment n'est aucune route de src/App.tsx (S-01).
  # Les identifiants inexistants SOUS une route connue (/fournisseurs/xyz)
  # restent en 200 : le SPA affiche « introuvable » avec noindex, c'est la
  # mitigation acceptée pour une SPA. Tenir cette liste à jour avec App.tsx
  # (scripts/verifier-htaccess.mjs ci-dessous le contrôle au build).
  RewriteCond %{REQUEST_URI} !^/$
  RewriteCond %{REQUEST_URI} !^/(materiaux|fournisseurs|recherche|panier|commander|commande|paiement|demandes|calculateurs|prix|transporteurs|guides|verification|verification-email|devenir-fournisseur|depot-reserve|a-propos|contact|faq|accessibilite|conditions-utilisation|politique-confidentialite|mentions-legales|connexion|inscription|mot-de-passe-oublie|auth|compte|pro|admin)(/|$)
  RewriteRule ^ - [R=404,L]

  RewriteRule ^ index.html [L]
</IfModule>

# Le corps du 404 est l'application : elle dessine sa page « introuvable ».
ErrorDocument 404 /index.html

<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "geolocation=(self), camera=(), microphone=(), payment=()"

  # ── HSTS et CSP (03/09/2026) ─────────────────────────────────────────────
  # `preload` volontairement absent : il ne se soumet que pour le domaine
  # enregistrable (fonenako.mg) entier, décision hors périmètre d'Akora.
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://lvhnqrnmkajhlohympcs.supabase.co https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://lh3.googleusercontent.com; font-src 'self'; connect-src 'self' https://lvhnqrnmkajhlohympcs.supabase.co wss://lvhnqrnmkajhlohympcs.supabase.co; worker-src 'self'; manifest-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"
  # Essai SANS 'unsafe-inline' sur les styles, en observation seule (X-06) :
  # si la console ne rapporte aucune violation pendant deux semaines, basculer
  # la vraie CSP sur cette valeur (le hash est celui du <style> d'index.html ;
  # le recalculer à chaque modification : openssl dgst -sha256 -binary | base64).
  Header always set Content-Security-Policy-Report-Only "style-src 'self' 'sha256-wk8Je9L0UdT5M+i8fY1Tn4ZyouvLXMn58+7IypRwoME='; style-src-attr 'unsafe-inline'"

  # Empreintes de contenu dans le nom : cache long et immuable.
  <FilesMatch "\.(js|css|woff2|webp|avif|png|jpg|jpeg|svg)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  # Les photos téléversées n'ont PAS d'empreinte dans le nom : un jour, pas un an.
  <If "%{REQUEST_URI} =~ m#^/uploads/#">
    Header set Cache-Control "public, max-age=86400, stale-while-revalidate=604800"
  </If>
  # L'enveloppe HTML, le service worker, les fichiers de politique : jamais en cache long.
  <FilesMatch "^(index\.html|sw\.js|manifest\.webmanifest|robots\.txt|sitemap\.xml|security\.txt|llms\.txt)$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
</IfModule>

<IfModule mod_mime.c>
  AddType application/manifest+json .webmanifest
  AddType image/x-icon .ico
  AddType font/woff2 .woff2
  AddType text/plain .txt
  AddCharset utf-8 .txt .xml .webmanifest
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml text/plain application/xml
</IfModule>
```

Points d'attention :
- La liste du premier segment inclut `faq` et `accessibilite`, les deux pages construites dans `04-pages-construites/`. **Oublier un préfixe = vrai 404 sur une vraie page** : d'où le contrôle au build ci-dessous.
- `R=404` termine la réécriture et Apache sert `ErrorDocument 404` (index.html, corps identique) **avec le statut 404**. Vérifié sur la sémantique mod_rewrite ; **à confirmer sur o2switch** après déploiement : `curl -sI https://akora.fonenako.mg/page-inexistante-xyz | head -1` → `HTTP/2 404`.
- La photo `/uploads/…` gardait un `immutable` d'un an alors que son nom ne change pas quand le fournisseur la remplace : réduit à un jour.

## 2. `scripts/verifier-htaccess.mjs` (nouveau) — la liste des préfixes suit App.tsx

```js
// Casse le build si un préfixe de premier niveau de src/App.tsx manque dans
// la RewriteCond du vrai 404 de public/.htaccess (sinon une vraie page rend 404).
import { readFileSync } from "node:fs";
const app = readFileSync("src/App.tsx", "utf8");
const htaccess = readFileSync("public/.htaccess", "utf8");
const declares = new Set(
  [...app.matchAll(/path="([a-z0-9-]+)(?:\/|")/g)].map((m) => m[1]).filter((p) => p !== "*"),
);
const bloc = htaccess.match(/!\^\/\(([^)]+)\)\(\/\|\$\)/)?.[1] ?? "";
const autorises = new Set(bloc.split("|"));
const manquants = [...declares].filter((p) => !autorises.has(p));
if (manquants.length) {
  console.error(`htaccess : préfixes de App.tsx absents du vrai 404 → ${manquants.join(", ")}`);
  process.exit(1);
}
console.log(`htaccess : ${declares.size} préfixes de App.tsx tous autorisés.`);
```
`package.json` › `"prebuild": "node scripts/generer-sitemap.mjs && node scripts/verifier-htaccess.mjs"`.

## 3. `public/.well-known/security.txt` et `public/security.txt` (RFC 9116, contenu identique)

```
Contact: mailto:contact@akora.fonenako.mg
Expires: 2027-09-05T00:00:00.000Z
Preferred-Languages: fr, mg, en
Canonical: https://akora.fonenako.mg/.well-known/security.txt
Policy: https://akora.fonenako.mg/mentions-legales
Acknowledgments: https://akora.fonenako.mg/a-propos
```
`[À COMPLÉTER]` : remplacer `contact@` par une boîte dédiée (`securite@`) dès qu'elle existe sur o2switch (voir H5 : la boîte `contact@akora.fonenako.mg` est **NON VÉRIFIÉE**). Le champ `Expires` doit être renouvelé chaque année : ligne ajoutée dans `07-checklist-lancement.md` (J+365).

Vérifier après déploiement que le dossier `.well-known` est bien copié : `curl -sI https://akora.fonenako.mg/.well-known/security.txt | grep -i "content-type"` → `text/plain`. Si `scripts/deployer.mjs` ignore les dossiers cachés, l'ajouter explicitement.

## 4. `public/llms.txt` — consigne aux moteurs de réponse IA (GEO)

```
# Akora — matériaux de construction à Madagascar

> Akora compare les fournisseurs de matériaux de gros œuvre (parpaings, briques, sable, gravillon, ciment, bois, tôles, fer) au prix rendu chantier à Madagascar : prix du dépôt + livraison calculée depuis l'adresse de l'acheteur. Place de marché : Akora ne vend pas, il met en relation. Paiement mobile money (MVola, Orange Money, Airtel Money) sous séquestre, ou à la livraison. Commission de 3 % sur les matériaux, 0 % sur la livraison.

## Pages de référence
- [Matériaux (8 familles, 37 types, 112 formats)](https://akora.fonenako.mg/materiaux)
- [Prix du marché par matériau et par ville](https://akora.fonenako.mg/prix)
- [Fournisseurs vérifiés](https://akora.fonenako.mg/fournisseurs)
- [Calculateurs de métré (mur, dalle, béton, chape, toiture)](https://akora.fonenako.mg/calculateurs)
- [FAQ](https://akora.fonenako.mg/faq)
- [Que veut dire « vérifié »](https://akora.fonenako.mg/verification)
- [Devenir fournisseur](https://akora.fonenako.mg/devenir-fournisseur)

## Règles
- Les prix sont ceux déclarés par les fournisseurs, en ariary (Ar), TTC sauf mention ; date de mise à jour sur chaque fiche.
- Citer la page source ; ne pas inventer de prix ni de disponibilité.
- Langue du site : français ; public : Madagascar.

## Optional
- [Conditions d'utilisation](https://akora.fonenako.mg/conditions-utilisation)
- [Politique de confidentialité](https://akora.fonenako.mg/politique-confidentialite)
- [Plan du site XML](https://akora.fonenako.mg/sitemap.xml)
```

## 5. `public/robots.txt` — position explicite sur les robots IA (stratégie : **autoriser**, le site vit de sa découvrabilité)

```
User-agent: *
Allow: /

# Espaces prives : rien a indexer.
Disallow: /compte
Disallow: /pro
Disallow: /admin
Disallow: /panier
Disallow: /commander
Disallow: /paiement
Disallow: /recherche

# Moteurs de reponse IA : autorises sur les pages publiques (GEO, 05/09/2026).
User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: anthropic-ai
User-agent: PerplexityBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
Allow: /
Disallow: /compte
Disallow: /pro
Disallow: /admin
Disallow: /panier
Disallow: /commander
Disallow: /paiement
Disallow: /recherche

Sitemap: https://akora.fonenako.mg/sitemap.xml
```

## 6. `index.html`

```diff
     <meta name="theme-color" content="#BB4A18" />
+    <!-- Le site n'a qu'un thème clair : sans cette ligne, les champs natifs et la
+         barre de défilement passent en sombre chez qui a réglé son téléphone en sombre. -->
+    <meta name="color-scheme" content="light" />
     <meta property="og:image" content="https://akora.fonenako.mg/og-akora.png" />
@@
     <meta name="apple-mobile-web-app-title" content="Akora" />
-    <link rel="manifest" href="/manifest.webmanifest" />
+    <!-- Le manifeste est injecté par vite-plugin-pwa : ne pas le déclarer deux fois. -->
```

## 7. Vérification après déploiement

```bash
for u in https://www.akora.fonenako.mg/ https://akora.fonenako.mg/page-inexistante-xyz https://akora.fonenako.mg/.well-known/security.txt https://akora.fonenako.mg/llms.txt https://akora.fonenako.mg/faq; do
  curl -s -o /dev/null -A "Mozilla/5.0 Chrome/128" -w "%{http_code} %{content_type} %{redirect_url} $u\n" "$u"; done
# attendu : 301 → apex · 404 text/html · 200 text/plain · 200 text/plain · 200 text/html
```

## Commit

```
fix(hebergement): www redirige vers l'apex, vrai 404 sur les préfixes inconnus, security.txt et llms.txt, color-scheme
```
Fichiers : `public/.htaccess`, `public/.well-known/security.txt`, `public/security.txt`, `public/llms.txt`, `public/robots.txt`, `index.html`, `scripts/verifier-htaccess.mjs`, `package.json`.
