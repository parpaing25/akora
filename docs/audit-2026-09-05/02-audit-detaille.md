# 02 — Audit détaillé par domaine

**Site** : https://akora.fonenako.mg · **Date** : 05/09/2026 · **Code** : HEAD `d840c25` (le `dist/` local du 03/09 19:29 porte le même bundle `index-Cq2-GWSl.js` que la production : code et prod sont cohérents).

## Méthode et preuves

| Outil | Ce qu'il a mesuré | Fichier de preuve (dossier `preuves/`) |
|---|---|---|
| `crawl_akora.py` (Playwright, Chromium, agent Android, 390×844 et 1280×800) | 36 routes : titre, canonique, robots, h1, débordement, cibles < 44 px, images sans alt, JSON-LD, formulaires sans étiquette, requêtes et échecs, FCP/TTFB/CLS | `crawl_akora.json` (61 mesures), `capture-390*.jpeg` |
| Lighthouse 12.8.2 (`npx`, Chrome de Playwright, mobile simulé « moto g power », 4G lent) | Performance, accessibilité, bonnes pratiques, SEO sur 3 pages | `lh-home.json`, `lh-fournisseurs-…json`, `lh-materiaux-…json` |
| axe-core 4 injecté dans le vrai navigateur (contrastes calculés) | 10 pages à 390 px | `axe_akora.json` |
| `anomalies_akora.py`, `anomalies2_akora.py`, scripts ad hoc | Causes exactes : corps des 400, bissection du débordement, styles calculés, `classList` | sorties dans la transcription |
| SQL lecture seule sur la base de production (API Management) | RLS, grants, policies, fonctions SECURITY DEFINER, triggers, cron, index, volumes, comptes | requêtes citées en ligne |
| `curl`, `openssl s_client`, `nslookup`, sonde SMTP | Hôtes, en-têtes, TLS, DNS mail, fichiers racine | citées en ligne |
| `npm run typecheck`, `npm test` | 0 erreur ; **136 tests / 14 fichiers verts** (682 ms) | — |
| Lecture du code | `src/`, `supabase/functions/`, `public/`, `scripts/` | `fichier:ligne` |

**Convention de notation** (le barème retire un nombre fixe de points par ligne de contrôle non conforme) : retenue **entière** si la ligne échoue sur son point principal ; **moitié** si elle échoue sur un point secondaire ; une ligne **NON VÉRIFIÉE** compte comme non conforme (retenue entière) — un audit qui note ce qu'il n'a pas vu n'est pas un audit. Une ligne **[P0]** non conforme rend le domaine **bloquant** quelle que soit sa note. Chaque constat : `ID · criticité · localisation · preuve · action · correctif · effort`.

Deux artefacts écartés : (1) l'avertissement console « Deprecated API for given entry type » venait de ma propre mesure `performance.getEntriesByType` ; (2) Chromium **headless par défaut** reçoit d'o2switch une page de blocage (HTTP 429, illustration « tigre ») — toutes les mesures ont été refaites avec un agent utilisateur mobile qui passe (constat O-02).

---

## 2.1 Performance & Core Web Vitals — **35/100** · poids 12 · **[P0] non conforme en laboratoire**

| Contrôle (barème) | État | Preuve | Retenue |
|---|---|---|---|
| **[P0]** LCP < 2,5 s | **Non** : 4,2 s (accueil), 4,9 s (fiche produit), 4,3 s (page format), mobile simulé | `lh-*.json` › `largest-contentful-paint` | −15 |
| **[P0]** INP < 200 ms | Non mesurable en laboratoire ; TBT 30–50 ms (bon signe) ; terrain **NON VÉRIFIÉ** (aucun trafic, PSI en 429) | `lh-*.json` › `total-blocking-time` | 0 (signal favorable, à confirmer en RUM) |
| **[P0]** CLS < 0,1 | **Non** sur la fiche produit : **0,167** ; 0 sur accueil et page format | `lh-fournisseurs-…json` › `cumulative-layout-shift`, `layout-shifts` | −15 |
| TTFB < 800 ms | Limite : 640 ms (audit serveur, score 0 chez Lighthouse) ; 1 000 ms dans la décomposition LCP ; **3 230 ms** au premier chargement à froid du crawl | `lh-home.json` › `server-response-time`, `crawl_akora.json` `/`@390 | −8 |
| FCP < 1,8 s | Non : 3,1–3,3 s | `lh-*.json` | −5 |
| Poids accueil < 1,5 Mo, JS initial < 300 Ko compressé | Oui : 603 KiB transférés ; coquille JS 218 Ko brotli (79 + 73 + 66) + CSS 17 Ko | `curl -H "Accept-Encoding: br"` | 0 |
| Images : WebP, dimensions, `srcset`, lazy, priorité LCP | **Non** : vignettes WebP existent mais l'accueil sert les JPEG (175 KiB gaspillés), la fiche produit sert l'original 1280 px pour 324 px, aucun `srcset`, aucun `fetchpriority`, logo pied de page non dimensionné | `lh-home.json` › `uses-responsive-images` ; `naturalWidth` lu en prod ; `LogoAkora.tsx:43` | −10 |
| Polices ≤ 2, swap, préchargées, sous-ensemble | Oui : Inter latin variable 48 Ko, `font-display: swap`, `preload` | `index.html:19`, `index.css` | 0 |
| Cache, Brotli, CDN, HTTP/2-3 | Cache immuable ✓, Brotli ✓, HTTP/2 + TLS 1.3 ✓, **pas de CDN** (serveur en France, clients à Madagascar) | `.htaccess:40-46`, `openssl s_client -alpn h2` | −5 |
| Code splitting, tree-shaking | Oui : 67 routes lazy, `manualChunks` react/supabase, 109 fichiers | `vite.config.ts`, `App.tsx` | 0 |
| Tiers : différés, < 5 domaines | Oui : aucun tiers hors Supabase et tuiles OSM (cartes) | CSP `connect-src`, `img-src` | 0 |
| Test « 3G lent / mobile milieu de gamme » | Simulation 4G lent seulement ; 3G réelle **NON VÉRIFIÉE** | — | −7 |

**Constats**

| ID | Crit. | Localisation | Preuve | Action | Correctif | Effort |
|---|---|---|---|---|---|---|
| P-01 | **P0** (barème) / P1 | `ImageProduit.tsx:45-60`, fiche produit | LCP 4,9 s ; image `naturalWidth 1280` affichée 324 px, pas de `srcset` | `srcset` vignette 480 + original, `fetchpriority=high` | `03/10` | 1 h |
| P-02 | P1 | `LogoAkora.tsx:43` (`h-9 w-auto`, `lazy`) | CLS 0,161 attribué au pied de page, cause « media lacking explicit size » | `aspect-[33/10]` ; logo d'en-tête `prioritaire` | `03/10` | 0,25 h |
| P-03 | P1 | `CartePublication.tsx:138` | JPEG 80 Ko servi là où `.thumb.webp` 44 Ko existe ; 175 KiB gaspillés sur l'accueil | `getThumbUrl` + `srcset` | `03/10` | 0,5 h |
| P-04 | P2 | `/recherche?q=parpaing` | TTFB 911 ms, FCP 1,2 s (recherche côté base au chargement) | Index `pg_trgm` sur `produits.nom_affiche` / vue de recherche matérialisée ; débounce | — | 2 h |
| P-05 | P1 | `useLivraison.ts:29-38`, accueil | 14 requêtes REST + 14 préflights ; 6 + 6 appels de barème (un par carte) | Un seul `listerBaremes(ids)` (`in`) | `03/10` | 2 h |
| P-06 | P2 | hébergement | TTFB 640–1 000 ms depuis Madagascar, serveur en France | Cloudflare gratuit devant o2switch (décision) | `03/10 §P-06` | 1 h |
| P-07 | P3 | `index.html` | Aucun `preconnect` vers Supabase | 2 balises | `03/10` | 0,1 h |
| P-08 | P2 | méthode | Vitals terrain inexistants (site sans trafic) | RUM `web-vitals` → table Supabase (`06`) | `06` | 2 h |

Après P-01/02/03/05/07 : LCP attendu ≤ 3,0 s en laboratoire, CLS < 0,05. Sous 2,5 s en 3G réelle : P-06 **ou** pré-rendu des pages publiques (S-03).

---

## 2.2 Sécurité — **55/100** · poids 15 · **[P0] ouvert (second facteur admin absent)**

| Contrôle | État | Preuve | Retenue |
|---|---|---|---|
| **[P0]** HTTPS partout, HSTS + preload, pas de contenu mixte | HTTPS 301 ✓, HSTS 1 an + sous-domaines ✓, 0 contenu mixte ✓ ; `preload` non applicable à un sous-domaine (il se soumet pour `fonenako.mg` entier) | `.htaccess:9-10,29` ; en-têtes curl | 0 (réserve documentée) |
| **[P0]** Aucun secret dans le client / dépôt | ✓ : seules `VITE_SUPABASE_URL/ANON_KEY/SITE_URL/UPLOAD_ENDPOINT/DELETE_ENDPOINT/VAPID_PUBLIC_KEY` (publiques par nature) ; `.env` absent, secrets dans `~/.fonenako-secrets` via `scripts/secrets.mjs` ; grep `service_role|sbp_` → 0 dans `src/`, `public/` | grep 05/09 | 0 |
| **[P0]** Authentification | bcrypt (GoTrue) ✓ ; JWT 1 h + rafraîchissement ✓ ; réinitialisation par code, 60/h par IP, 5 essais ✓ ; brute-force : quotas GoTrue **sans captcha** ; sessions en `localStorage` (pas de cookie HttpOnly — inévitable en SPA statique, compensé par `script-src 'self'`) ; **MFA indisponible pour l'admin** qui confirme les paiements et libère le séquestre | `client.ts` (`persistSession`, `akora-auth`) ; `config/auth` lu le 05/09 matin ; aucun `mfa.enroll` dans `src/` | **P0 ouvert** (ligne partiellement non conforme) |
| **[P0]** Autorisation serveur (IDOR) | RLS **48/48** tables ; `anon` : 0 droit d'écriture ; `commandes` : `authenticated` seul, policy acheteur/fournisseur/admin ; Edge Functions recalculent les prix côté serveur ; `/commande/AK-000000` en anonyme → 401 ✓ ; test croisé entre deux comptes **NON VÉRIFIÉ** | `verifier-securite.mjs` (48/48) ; SQL `pg_policies` ; `commande-creer/index.ts:100-160` | 0 (procédure en 07) |
| **[P0]** Injection SQL/XSS/SSRF | PostgREST paramétré ✓ ; React échappe ✓ ; **0** `dangerouslySetInnerHTML` (le seul résultat du grep est le commentaire de `Seo.tsx:12` qui l'interdit) ; JSON-LD injecté par `textContent` ✓ ; fonctions SQL paramétrées ✓ ; Edge Functions n'appellent que des hôtes fixes ✓ ; tests d'injection sur les champs (nom, message, recherche) **NON VÉRIFIÉS** en boîte noire | grep 05/09, `Seo.tsx:92-99` | 0 (procédure en 07) |
| En-têtes : CSP stricte, XCTO, XFO, Referrer, Permissions | Tous présents ; `script-src 'self'` strict ✓ ; **`style-src 'unsafe-inline'`** | `.htaccess:21-37` | −5 |
| CSRF sur les mutations | Pas de cookie de session → pas de surface CSRF ; Edge Functions exigent `Authorization` | `_commun.ts` | 0 |
| Upload : type, taille, renommage, hors webroot, scan | Type par contenu (`getimagesizefromstring`), extension, 10 Mo ✓ ; stockage **dans** le webroot `/uploads` (servi statiquement, exécution PHP non testée) ; pas d'antivirus | `serveur/api/o2upload.php:171-192` | −4 |
| Rate limiting login / formulaires / API / recherche | Login (GoTrue), codes, commandes ✓ ; REST PostgREST et recherche : aucun plafond par IP | `_commun.ts:60-73` | −4 |
| Dépendances : 0 haute/critique | `react-router` 6.30 : 1 modérée (mitigée) ; `vite` : 1 haute **dev-only** ; `@supabase/supabase-js` 2.112.3 ≥ 2.108.2 ✓ | `npm audit` (matin 05/09), `node_modules/@supabase/supabase-js/package.json` | −4 |
| Clés Supabase : RLS partout, anon restreint | 48/48 ✓, grants revus le 03/09 ✓ ; **`consommer_quota` exécutable par `anon` sans garde** (déni de service ciblé) ; `compter_vue_produit` sans garde | SQL `has_function_privilege` + corps | −5 |
| Bots / spam : Turnstile, honeypot | Honeypot `useAntiAbus` ✓ (aria-hidden, tabindex −1) ; **pas de captcha** | `useAntiAbus.ts:34-37` | −2 |
| Logs sans données sensibles, erreurs génériques | Erreurs Edge : messages métier ✓ mais `erreurLignes.message` brut renvoyé ; `journaliser` enregistre l'IP (légitime, à mentionner dans la politique) | `commande-creer/index.ts:203-208` | −2 |
| **Backups testés, plan de rollback** | **Aucune sauvegarde**, PITR off, plan Free ; aucun tag git, aucun rollback écrit | API Management `database/backups` (05/09) | −8 |
| E-mails : SPF, DKIM, DMARC | SPF ✓ (apex et sous-domaine), DKIM ✓ (`default._domainkey`), **DMARC `p=none` sans `rua`** | `nslookup` 05/09 | −3 |
| Conformité données : consentement, politique exacte, effacement, registre | Pas de traceur → pas de bannière ✓ ; politique détaillée ✓ ; **effacement non implémenté** (le bouton supprime le profil, pas l'utilisateur) ; registre CMIL **NON VÉRIFIÉ** | `Securite.tsx:81-93` ; FK `profiles → auth.users` ; `Confidentialite.tsx:84` | −8 |

**Constats**

| ID | Crit. | Localisation | Preuve | Action | Correctif | Effort |
|---|---|---|---|---|---|---|
| X-01 | **P0** | Supabase plan Free | 0 sauvegarde, PITR off ; 21 Mo de données, 6 fournisseurs, 40 produits, futur séquestre d'argent | `pg_dump` nocturne chiffré + test de restauration mensuel ; Pro dès le premier paiement | `03/15` | 2 h |
| X-02 | P1 | `consommer_quota(text,text,int)` | `EXECUTE` accordé à `anon`, corps sans garde : n'importe qui épuise le quota d'un tiers (IP, e-mail) | `revoke` anon/authenticated, `grant service_role` | `03/08` | 0,2 h |
| X-03 | P2 | `_commun.ts:71` | `if (error) return true` : toute panne du compteur ouvre tous les plafonds, codes compris | paramètre `strict` pour les codes | `03/09` | 0,5 h |
| X-04 | P1 | GoTrue | Pas de SMTP : **2 courriels/heure** pour tout le site ; `uri_allow_list` contient `localhost` ; captcha off ; HIBP off (Pro) | SMTP Brevo, Turnstile, nettoyage des URL | `03/11` | 1 h |
| X-05 | P2 | DNS `_dmarc.fonenako.mg` | `v=DMARC1; p=none;` sans rapport | `p=quarantine` + `rua` après lecture d'une semaine de rapports | `03/12` | 0,5 h |
| X-06 | P3 | `.htaccess:37` | `style-src 'unsafe-inline'` | En-tête Report-Only avec hash du `<style>` d'amorçage, puis bascule | `03/05` | 0,5 h + 2 sem. d'observation |
| X-07 | P3 | HSTS | Pas de `preload` (non applicable au sous-domaine) | Décision au niveau `fonenako.mg` | — | — |
| X-08 | P3 | `package.json` | `react-router` modéré (mitigé), `vite` haute dev-only | Monter `vite` à la mineure corrigée à la prochaine fenêtre | — | 0,5 h |
| X-09 | P3 | `client.ts` | Jeton en `localStorage` (SPA) | Accepté ; CSP script stricte est la compensation ; documenter | — | — |
| X-10 | P2 | `compter_vue_produit(uuid)` | Incrémente n'importe quel uuid, sans plafond | Garde « produit actif » + plafond 100 000/j | `03/08` | 0,2 h |
| X-11 | **P0** (barème) / P1 | rôle admin | Aucun second facteur ; l'admin confirme les paiements et libère le séquestre | TOTP obligatoire pour `admin` (`mfa.enroll`, garde `aal2` + `auth.jwt()->>'aal'` en SQL) | `03/11 §4` | 4 h |
| X-12 | P2 | `serveur/api/o2upload.php` | Stockage dans le webroot ; exécution PHP dans `/uploads` **NON VÉRIFIÉE** | `.htaccess` dans `/uploads` : `php_flag engine off`, `RemoveHandler .php .phtml`, `Options -ExecCGI` ; test : déposer `x.php` renommé | — | 0,3 h |
| X-13 | P3 | champs libres (`nom_contact`, `message`, `texte` des publications, `description` fournisseur, `q` de la recherche) | Aucun rendu HTML brut dans le code ; l'injection en boîte noire n'a pas été jouée | Jouer les 10 charges classiques (`<script>`, `"><img onerror`, `'; drop`, `{{7*7}}`, emoji, 10 000 caractères) sur chaque champ et vérifier l'affichage et la base | `07` (J-3) | 1 h |
| X-14 | P2 | `commande-creer`, `journaliser` | Adresse IP journalisée avec la commande | Mentionner dans la politique (finalité anti-fraude, durée) | `04/…` | 0,2 h |

---

## 2.3 Design & UX — **87/100** · poids 10

| Contrôle | État | Preuve | Retenue |
|---|---|---|---|
| Design system documenté en tokens | ✓ `AKORA-DESIGN.md`, jetons HSL (`index.css:25-51`), échelle typo (`tailwind.config.ts:96-103`) | — | 0 |
| Hiérarchie visuelle, 1 CTA primaire, 45–75 c./ligne | ✓ (`max-w-3xl` sur les pages texte) | crawl | 0 |
| Cohérence des composants | Radix + `cva` ✓ ; **mais** les boutons compacts perdent leur couleur (voir A-01) : incohérence visible sur chaque page | styles calculés 05/09 | −4 |
| États : chargement, vide, erreur, succès, désactivé | ✓ `Squelette`, `EtatVide`, `EtatErreur`, toasts, `disabled:` | `Comparateur.tsx:196-225` | 0 |
| Micro-interactions, 150–300 ms, reduced-motion | ✓ `page-entree` 220 ms, `prefers-reduced-motion` | `index.css` | 0 |
| Mode sombre non cassé | Pas de `color-scheme` : champs natifs sombres sur site clair | `index.html` | −2 |
| Formulaires : labels, validation en ligne, `inputmode`, autocomplete | Labels ✓, `inputMode`/`autoComplete` ✓ (5 dans `Commander.tsx`) ; validation **par toast à la soumission**, pas en ligne | `Commander.tsx:106-114` | −5 |
| Copywriting : ton, orthographe, pas de contenu de test | ✓ Français soigné, ton direct ; aucun lorem ; 1 compte de recette (voir F-04) | — | 0 |
| « 2026 ou 2018 ? » | 2026 : rails collants, PWA, fil, comparateur ; rien de daté | captures | 0 |
| Identité : logo, favicon SVG + PNG, OG, splash | Logo ✓, favicon `.ico` + PNG 32 + Apple ✓, OG 1200×630 ✓, icônes PWA + maskable ✓ ; **pas de favicon SVG** | `public/` | −2 |

**Constats** : D-01 (= A-01, boutons compacts) · D-02 P3 `color-scheme` (`03/05 §6`) · D-03 P3 validation en ligne des formulaires (afficher l'erreur sous le champ via `Champ` `erreur=` ; 2 h) · D-04 P3 favicon SVG (`public/favicon.svg` + `<link rel="icon" type="image/svg+xml">` ; 0,3 h).

---

## 2.4 Mobile & responsive — **57/100** · poids 12 · **[P0] non conforme (débordement)**

| Contrôle | État | Preuve | Retenue |
|---|---|---|---|
| Breakpoints 360/390/414/768/1024/1280/1536 + paysage | 390 et 1280 mesurés ; les autres **NON VÉRIFIÉS** | crawl | −5 |
| **[P0]** Aucun débordement, élément coupé, superposition | **Non** : page format déborde de **204 px** à 390 px | `scrollWidth 594` ×2 ; bissection → `span.sr-only` | **P0** |
| Cibles ≥ 44 px, espacement ≥ 8 px | Fiche fournisseur : **30/87** cibles < 44 px (puces 73×19) ; inscription 6/8 (20×20) ; recherche 6/49 ; la règle globale `.min-h-9 → 44 px` ne couvre pas les liens texte | `crawl_akora.json` › `ciblesSous44` | −10 |
| Navigation mobile : pouce, fermeture, pas de piège | Menu non testé au geste ; **NON VÉRIFIÉ** | — | −5 |
| Zones sûres, `viewport-fit=cover` | ✓ | `index.html:5` | 0 |
| Zoom non bloqué | ✓ (aucun `maximum-scale`) | `index.html:5` (la page « tigre » d'o2switch, elle, le bloque) | 0 |
| Tableaux : scroll explicite ou cartes | Comparateur et page type défilent, **sans indice visuel** | `Comparateur.tsx:227` | −3 |
| Fixes/sticky ≤ 20 % de l'écran | En-tête ~56 px / 844 ✓ | captures | 0 |
| Performance réseau faible | Voir 2.1 : LCP 4,2–4,9 s | — | −10 |
| PWA : manifest, icônes, installable, hors-ligne | ✓ manifest complet, 3 icônes, SW précache la coquille | `manifest.webmanifest`, `sw.js` | 0 |
| Test réel Android d'entrée de gamme + iPhone | **Non fait** | — | −10 |

**Constats** : M-01 **P0** débordement (`03/03`, 0,25 h) · M-02 P1 cibles < 44 px : puces produit de la fiche fournisseur (`min-h-11` ou padding vertical ; les liens texte de `Connexion.tsx` en `min-h-11 inline-flex items-center`) 2 h · M-03 P2 indice de défilement des tableaux (`03/03`) · M-04 P1 **NON VÉRIFIÉ — à tester manuellement** : Chrome DevTools mode appareil 360/414/768/1024/1536 + paysage sur `/`, page format, fiche fournisseur, `/commander`, `/inscription` ; puis un vrai Android (Telma 4G puis 3G forcée) et un iPhone (Safari : `100svh`, `viewport-fit`) · M-05 P3 hors-ligne : la coquille se charge mais aucune page « vous êtes hors ligne » n'explique l'absence de données (30 min).

---

## 2.5 Accessibilité WCAG 2.2 AA — **55/100** · poids 8

| Contrôle | État | Preuve | Retenue |
|---|---|---|---|
| Contraste ≥ 4,5:1 (UI ≥ 3:1) | **Non** : boutons compacts **2,56:1** sur toutes les pages ; opacités sur latérite 4,14 et 3,56:1 | axe réel + styles calculés | −10 |
| Clavier complet, ordre, focus visible (2.4.11), pas de piège | Focus visible ✓, lien d'évitement ✓ ; liste défilante de l'inscription **non focalisable** ; parcours complet **NON VÉRIFIÉ** | axe `scrollable-region-focusable` ; `index.css:82` | −5 |
| Sémantique : 1 h1, hiérarchie, landmarks, listes | ✓ sur 31/36 pages ; **0 h1** sur `/commander` (panier vide) et les états « introuvable » (`EtatVide` rend un h2) | crawl `h1` | −3 |
| Alternatives : alt pertinents, décoratives vides | 0 image sans `alt` ✓ ; 1 alt redondant (logo « Akora » + texte) | axe `image-redundant-alt` | −2 |
| Formulaires : labels, erreurs annoncées | Étiquettes par `Champ` ✓ ; erreurs en toast (annoncées via `sonner` `aria-live`) ; 2 contrôles 20×20 de l'inscription à recouper | crawl `formsSansLabel` (inclut le honeypot, légitime) | −3 |
| ARIA correct, patterns APG | Radix ✓ ; **curseur sans nom** (`aria-input-field-name`) | axe, Lighthouse | −5 |
| Langue déclarée, changements marqués | `lang="fr"` ✓ ; noms malgaches non marqués `lang="mg"` | crawl | −2 |
| Cibles ≥ 24×24 (2.5.8) | Cases 20×20 à l'inscription | crawl `exemplesPetites` | −5 |
| Test lecteur d'écran | **Non fait** | — | −10 |
| Déclaration d'accessibilité | Pas d'obligation à Madagascar ; page **construite** quand même | `04/Accessibilite.tsx` | 0 |

**Constats** : A-01 P1 contraste (`03/02`, 1 h) · A-02 P2 curseur (`03/03`) · A-03 P3 à recouper : les 2 `BUTTON/INPUT 20x20` de `/inscription` (cases à cocher Radix ?) → `size-6` minimum, 0,3 h · A-04 P2 `ul` défilant du panneau d'inscription → `tabIndex={0}` + `aria-label` ou retirer l'`overflow` (0,2 h) · A-05 P3 alt du logo à côté du mot « Akora » → `alt=""` quand le texte est présent (0,1 h) · A-06 déclaration construite · A-07 P1 **NON VÉRIFIÉ — à tester manuellement** : TalkBack (Android) et NVDA (Windows) sur : accueil → fiche produit → ajouter au panier → commander → confirmation ; noter chaque contrôle non annoncé · A-08 P3 `EtatVide` : prop `niveauTitre` pour rendre un `h1` quand il est le seul titre de la page (0,3 h) · A-09 P3 `lang="mg"` sur les raisons sociales malgaches (`FournisseurFiche`, `CartePublication`) 0,5 h.

---

## 2.6 SEO, GEO / AEO et découvrabilité — **44/100** · poids 8

| Contrôle | État | Preuve | Retenue |
|---|---|---|---|
| Title 50–60 c., description 140–160 c., uniques | Uniques ✓ ; **accueil : « Akora » (5 c.)** ; description de l'accueil ≠ celle d'`index.html` (Google peut lire l'une ou l'autre) | crawl `title`, `index.html:7` | −5 |
| Canonical, robots, sitemap, noindex privés | ✓ canonique par page, `noindex` sur privé et introuvable, `robots.txt` cohérent ; sitemap **sans `lastmod`**, sans les 40 fiches produit, figé au build | `sitemap.xml` (289 URL) | −5 |
| URLs propres | ✓ `/materiaux/bois/madrier/madrier-70x150-4m` | — | 0 |
| Données structurées adaptées, valides | `BreadcrumbList`, `ItemList` (matériaux), `Store`, `Product`, `FAQPage` (vérification) ✓ ; **aucune `Organization`, `WebSite`**, rien sur `/fournisseurs`, `/prix`, accueil | crawl `jsonld` | −5 |
| OG / Twitter 1200×630 | ✓ `og-akora.png` 1200×630, 22 Ko | `index.html:9-11`, `Seo.tsx` | 0 |
| Contenu dans le HTML initial (SSR/SSG) | **Non** : `<div id="racine">` vide ; tout dépend du JS ; Googlebot rend le JS mais avec délai et budget ; les moteurs IA lisent souvent le HTML brut | `index.html:33` | −10 |
| Multilingue : hreflang, sélecteur | Mono-français ; public bilingue fr/mg ; colonnes `nom_mg` en base | grep `nom_mg` (3 usages) | 0 (opportunité S-10) |
| GEO : réponses directes, FAQ, `llms.txt`, robots IA explicites | FAQ **absente** (sauf vérification), `llms.txt` **absent**, robots IA non explicités ; données factuelles ✓ | curl `/llms.txt` → HTML | −6 |
| Search Console + Bing prêts, sitemap soumis | **NON VÉRIFIÉ** (TXT `google-site-verification` sur `fonenako.mg`, pas de preuve pour la propriété `akora.`) | `nslookup TXT fonenako.mg` | −5 |
| Vitesse et mobile-first (report 2.1/2.4) | LCP > 4 s, débordement | — | −10 |
| ≥ 300 mots utiles par page cible, pas de doublon | Guides ~105 mots visibles, contact/à propos courts, pages de référentiel = données (peu de texte) ; description dupliquée sur 2 pages | crawl `motsVisibles`, `description` | −10 |

**Constats** : S-01 P2 soft-404 au premier segment (`03/05`) · S-02 P1 hôte `www` dupliqué (`03/05`) · S-03 P2 rendu client seul → pré-rendu des ~330 URL publiques au build (`vite-plugin-prerender`/Puppeteer, ou `react-snap`) : HTML complet pour Googlebot et moteurs IA, hydratation ensuite ; **8 h**, décrit en `06` · S-04 P2 sitemap (`03/06`) · S-05 P2 `security.txt`, `llms.txt`, robots IA (`03/05`) · S-06 P2 JSON-LD identité (`03/07`) · S-07 P2 contenu : étoffer les 4 guides à ≥ 400 mots avec photos et tableau de quantités (4 h), FAQ construite (`04`) · S-08 P3 titre et description de l'accueil (`03/07 §2`) · S-09 P1 **NON VÉRIFIÉ — à faire** : Search Console propriété `https://akora.fonenako.mg/` (balise HTML ou DNS), soumettre le sitemap, inspecter `/`, une fiche produit et une page prix en « test en direct » (vérifie aussi que Googlebot n'est pas bloqué par o2switch) ; Bing Webmaster par import Search Console · S-10 P3 version malgache des titres de matériaux (`nom_mg` déjà en base) : `hreflang` non pertinent tant qu'il n'y a pas deux URL ; commencer par afficher `nom_mg` en sous-titre (2 h).

---

## 2.7 Pages nécessaires & contenu — **59/100** · poids 8

| Page attendue (socle + place de marché) | Présente ? | Qualité | Retenue |
|---|---|---|---|
| Accueil : proposition de valeur < 5 s, preuve sociale, CTA | ✓ fil + colonnes ; preuve sociale faible (0 avis, 0 commande) | — | 0 |
| À propos / équipe / confiance | ✓ mais sans entité, équipe, date, chiffres | **reconstruite** `04/APropos.tsx` | −3 |
| Contact : formulaire fonctionnel + téléphone, WhatsApp, adresse | `mailto:` seul vers une boîte **NON VÉRIFIÉE** ; ni téléphone, ni WhatsApp, ni adresse | **reconstruite** `04/Contact.tsx` | −6 |
| Mentions légales | Sans forme juridique, NIF, STAT, RCS, siège, directeur | **reconstruite** `04/MentionsLegales.tsx` | −6 |
| Confidentialité · cookies · CGU | ✓ ✓ (pas de cookie : dit) ✓ | ajouter CMIL, IP journalisée, suppression réelle | 0 |
| FAQ | **Absente** | **construite** `04/FAQ.tsx` (13 Q/R + FAQPage) | −8 |
| 404 / 500 / maintenance designées | 404 ✓ (`NonTrouve`) ; 500 : `EtatErreur` par requête mais **aucun ErrorBoundary global** (une exception de rendu = page blanche) ; maintenance : aucune | `06` (ErrorBoundary + `maintenance.html`) | −4 |
| Confirmation après chaque action | Commande : **cassée pour l'invité** (F-01) ; inscription/contact : toast | `03/04` | −6 |
| Page statut / bandeau d'incident | Aucun | moniteur public + bandeau (`06`) | −8 |
| Catégories, fiche produit riche, panier, tunnel ≤ 3, suivi, retours/litiges, compte, avis, comparateur | ✓ tous présents (`/materiaux`, `ProduitFiche`, `/panier`, panier → commander → suivi, `/commande/:n`, litiges dans CGU + espace, `/compte/*`, avis, `Comparateur`) | — | 0 |

**Constats** : C-01 P1 contact · C-02 P2 à propos · C-03 P1 mentions légales · C-04 P2 FAQ · C-05 P2 statut/incident · C-06 P3 confidentialité : ajouter autorité (CMIL), IP journalisée, conservation des commandes, suppression réelle (0,5 h) · C-07 P2 ErrorBoundary global (`06`, 1 h).

---

## 2.8 Fonctionnel & parcours critiques — **38/100** · poids 12 · **[P0] non conforme**

| Contrôle | État | Preuve | Retenue |
|---|---|---|---|
| **[P0]** Chemin nominal bout en bout, 0 erreur console, confirmation reçue | **Non** : parcours A (acheter) jamais joué en prod (0 commande) ; en invité, l'écran de confirmation dit « introuvable » ; aucun courriel ; pages type : 6 requêtes 400 | F-01, F-02, F-03 | **P0** |
| Cas limites (vides, emoji, extrêmes, double clic, retour, session expirée, refresh, réseau coupé) | Validation zod/format téléphone ✓ ; reste **NON VÉRIFIÉ** | `Commander.tsx:106-114` | −8 |
| Paiement : test → prod, webhooks idempotents, échec/annulation/remboursement, reçus, TVA | Référence manuelle, **0 paiement jamais traité** ; webhook signé ✓, réconciliation cron ✓ ; **aucun reçu** ; TVA : drapeau `assujetti_tva` non exploité dans le total (à vérifier) | `paiement-*`, `docs/PAIEMENT-MOBILE-MONEY.md` | −15 |
| Courriels transactionnels listés, responsives, délivrabilité | Seuls les codes ; **aucun** pour commande, paiement, livraison, litige, vérification ; SMTP absent | `_courriel.ts`, grep `envoyer(` | −10 |
| Recherche : pertinence, 0 résultat géré, < 500 ms | Fonctionne ; TTFB 911 ms | crawl | −4 |
| Upload : progression, erreurs, formats, taille, aperçu | PHP robuste ✓ ; progression **NON VÉRIFIÉE** | `o2upload.php` | −2 |
| Compte : inscription, connexion, sociaux, oubli, modification, **suppression** | ✓ ✓ Google ✓ ✓ ✓ ; **suppression factice** | `Securite.tsx:81-93` | −5 |
| Données de test supprimées | **Compte de recette en prod** (`recette.akora.1787421700@example.com`) | SQL `auth.users` | −10 |
| Console propre : 0 erreur, 0 4xx/5xx en navigation normale | **6 × 400** par page type, **2 × 401** sur commande invitée | crawl `echecs` | −8 |

**Constats**

| ID | Crit. | Localisation | Preuve | Action | Correctif | Effort |
|---|---|---|---|---|---|---|
| F-01 | **P0** | `Commander.tsx:222-235`, `CommandeSuivi.tsx:38-77`, grants `commandes` | Invité → commande créée → écran « Commande introuvable » (401 anon) | Jeton de suivi + RPC invitée (ou compte obligatoire) | `03/04` | 4 h (ou 1 h) |
| F-02 | P1 | `TypeMateriau.tsx:49`, `useLivraison.ts:27-34` | `fournisseur_id=eq.<uuid>::<uuid>` → 22P02, 6 × 400, prix rendu jamais affiché | Séparer clé et identifiant | `03/01` | 1 h |
| F-03 | P1 | `commande-creer/index.ts:217-231` | Notification en base seulement (0 abonné push) ; aucun courriel | Courriels acheteur + fournisseur | `03/13` | 2 h |
| F-04 | P1 | `auth.users` | Compte `@example.com` de recette | Purge après la recette manuelle | `03/16` | 0,1 h |
| F-05 | P3 | `envoyer-push/index.ts:6-7` vs base | Le commentaire annonce un trigger pg_net sur `notifications` ; **aucun trigger** en base ; le cron par minute compense (43 000 invocations/mois pour 0 abonné) | Créer le trigger ou passer le cron à 2 min ; documenter | `03/08` (option) | 0,3 h |
| F-06 | P1 | `Securite.tsx:81-93` | `profiles.delete()` ne supprime pas `auth.users` | Edge Function `compte-supprimer` | `03/14` | 3 h |
| F-07 | **P0** (même ligne que F-01) | tunnel paiement | Jamais exercé en production ; confirmation manuelle sans délai annoncé | Recette réelle avec 1 000 Ar (checklist J-3), délai écrit sur la page paiement | `07` | 2 h |
| F-08 | P2 | `paiements`, `commandes.montant_commission` (= 0 à la création) | Reçu de paiement et facture de commission inexistants | Reçu PDF imprimable (la page commande est déjà `@media print`) + courriel « paiement confirmé » | `03/13 §3` | 3 h |
| F-09 | P2 | cas limites | Double clic « Commander », refresh pendant l'appel, réseau coupé | `disabled` pendant `envoi`, idempotence par `clé_client` dans `commande-creer` (uuid généré côté client, unique en base) | — | 2 h |

---

## 2.9 Qualité technique & code — **61/100** · poids 7

| Contrôle | État | Preuve | Retenue |
|---|---|---|---|
| Architecture lisible, pas de code mort, 0 TODO bloquant | ✓ 0 `TODO/FIXME` ; découpage `lib/donnees`, `hooks`, `components/ui` ; commentaires datés et motivés | grep | 0 |
| Env : `.env.example`, aucune valeur prod, séparation dev/staging/prod | `.env.example` ✓, secrets hors dépôt ✓ ; **aucun projet de préproduction** (une seule base, une seule prod) | `scripts/secrets.mjs` | −5 |
| Erreurs centralisées, API cohérente, timeouts | `invoquer()` centralise les erreurs Edge ✓ ; **pas d'ErrorBoundary React** ; timeouts : sitemap ✓, client Supabase par défaut | grep `ErrorBoundary` → 0 | −4 |
| Tests : E2E parcours critiques + unitaires métier | **136 tests unitaires verts** (livraison, calepinage, formats…), banc a11y jsdom ; **aucun E2E** | `npm test` 05/09 | −6 |
| CI/CD : lint, typecheck, tests, build, audit à chaque PR ; preview | **Aucune CI**, pas de `.github/`, 0 tag ; déploiement par script local (`deployer.mjs`, refuse un `dist/` incomplet ✓, **ne vérifie pas le hash en ligne**) | `ls .github` | −12 |
| BDD : index, migrations versionnées, contraintes, pas de N+1 | Index sur 11/12 colonnes filtrées ✓ (manque `fil_publications.publie_le`) ; migrations versionnées ✓ ; triggers de cohérence (`figer_montants_commande`, `controler_transition_commande`) ✓ ; **N+1** barèmes | SQL `pg_indexes` | −5 |
| API versionnée, documentée, paginée, limitée | Edge Functions non documentées (OpenAPI) ; PostgREST pagine par défaut (1000) | — | −4 |
| i18n propre | Mono-langue, textes en dur (acceptable tant que mono) | — | 0 |
| Documentation : README, runbook déploiement et incident | README ✓, `docs/DEMARRAGE-A-Z.md` ✓, `docs/SECURITE-…` ✓ ; **runbook d'incident absent** | `docs/` | −3 |
| Dette et risques listés | `docs/A-APPLIQUER.md`, journaux datés ✓ | — | 0 |

**Constats** : Q-01 P1 CI GitHub Actions (typecheck, tests, a11y, build, `npm audit`, sitemap) — `06` (2 h) · Q-02 P2 E2E Playwright des parcours A/B/D contre la préprod (`06`, 6 h) · Q-03 P2 projet Supabase de préproduction (Free, second projet) + `VITE_SITE_URL` (2 h) · Q-04 P1 N+1 barèmes (= P-05) · Q-05 P2 vérification du hash après déploiement dans `deployer.mjs` (0,5 h) · Q-06 P3 index `fil_publications.publie_le` (`03/08`) · Q-07 P3 documentation OpenAPI minimale des 8 Edge Functions (2 h) · Q-08 P2 runbook d'incident (`06`, 1 h) · Q-09 P2 `ErrorBoundary` global avec écran « quelque chose a cassé, recharger » + envoi Sentry (`06`, 1 h).

---

## 2.10 Intégrations IA — **20/100** · poids 5

Sur le site : **aucune** (grep `groq|gemini|openai|mistral|llm` dans `src/` et `supabase/functions/` → 0). En amont, le bot de collecte (`bot-fournisseurs`, hors périmètre du site) extrait déjà matériaux, cotes et prix des publications Facebook avec un LLM et alimente le catalogue : c'est la seule IA de la chaîne, et elle explique les 6 fournisseurs et 40 produits présents. Les 20 points reflètent cette chaîne d'alimentation ; le site lui-même est de 2018 sur ce plan : recherche par mots exacts, aucune aide à la décision, aucune langue locale.

Constat I-01 P2 : voir `05-plan-ia.md` — cinq intégrations évaluées avec cas d'usage, gain, coût mensuel, effort, risques et code de démarrage ; deux sont recommandées avant fin 2026 (recherche en langage naturel vers le comparateur ; assistant WhatsApp de commande en malgache, réutilisant le webhook Messenger de Fonenako).

---

## 2.11 Amélioration continue automatique — **0/100** · poids 6

| Contrôle | État | Retenue |
|---|---|---|
| Observabilité : erreurs front/back, uptime 1 min, RUM | **Rien** : pas de Sentry, pas de moniteur, pas de `web-vitals` | −15 |
| Analytics respectueux : événements des parcours, entonnoirs, rapport hebdo | **Rien** (grep `analytics|plausible|umami|gtag` → 0) | −10 |
| Qualité en continu : Lighthouse CI budgets, E2E nocturnes, liens cassés, Dependabot | **Rien** | −15 |
| Feedback utilisateur : widget, enquête, analyse IA | **Rien** | −10 |
| Expérimentation : A/B, feature flags | **Rien** | −10 |
| Agent d'amélioration IA hebdomadaire | **Rien** | −15 |
| SEO/GEO continu : positions, sitemap auto, alertes | Sitemap figé au build | −10 |
| Sauvegardes testées mensuellement | **Rien** | −15 |

Constats R-01 → R-08 : tout est à construire ; `06-amelioration-continue.md` livre les fichiers (workflows GitHub, Sentry, UptimeRobot, RUM vers Supabase, agent hebdo). Effort total du socle : ~12 h ; coût récurrent : 0 € en offres gratuites.

---

## 2.12 Ops, lancement & résilience — **17/100** · poids 5

| Contrôle | État | Preuve | Retenue |
|---|---|---|---|
| Domaine : DNS propre, TTL, renouvellement, registrar sécurisé | DNS o2switch ✓ ; TTL 86 400 s (une bascule DNS prendrait un jour) ; renouvellement et 2FA registrar **NON VÉRIFIÉS** | `nslookup` SOA | −5 |
| Certificats auto-renouvelés, testés | Let's Encrypt via o2switch (AutoSSL), couvre `www` ✓ ; date d'expiration et renouvellement **NON VÉRIFIÉS** | `openssl x509` | −5 |
| Prod isolée, variables, quotas vérifiés pour la charge | Une seule base (pas de préprod) ; quotas Free : 500 Mo BDD (21 Mo utilisés), 500 000 invocations Edge/mois (**43 000** consommées par le seul cron push), 50 000 MAU, 5 Go egress, **pause après 7 jours d'inactivité** ; o2switch : anti-flood non paramétrable | API Management, `cron.job` | −8 |
| Test de charge ≥ 5× le trafic attendu | **Aucun** | — | −15 |
| Plan de bascule : checklist, fenêtre, rollback < 15 min, responsable | **Aucun** ; 0 tag git, `deployer.mjs` sans vérification du hash | `git tag` | −15 |
| Plan d'incident : qui, page statut, communication | **Aucun** | — | −10 |
| J+1 / J+7 / J+30 planifiés | **Aucun** | — | −10 |
| Coûts récurrents listés, alertes de dépassement | Non listés (o2switch, domaine, Supabase Free, Brevo) | — | −10 |
| Propriété : accès admin, dépôts, DNS, hébergeur, tiers documentés, pas une seule personne | Tout repose sur **une personne** ; les secrets sont dans `~/.fonenako-secrets` d'un seul PC | — | −5 |

**Constats**

| ID | Crit. | Constat | Action | Correctif | Effort |
|---|---|---|---|---|---|
| O-01 | **P0** | Aucune sauvegarde ni retour arrière | Sauvegardes + tags + procédure | `03/15` | 2 h |
| O-02 | P2 | **o2switch sert une page de blocage HTTP 429 (« tigre ») à tout Chromium headless par défaut** (Sec-CH-UA `HeadlessChrome`), et a renvoyé 429 sur `sw.js` pendant Lighthouse. Conséquences : (a) tout moniteur/Lighthouse CI/test E2E doit poser un agent utilisateur réaliste ; (b) le seuil anti-flood par IP est inconnu — derrière les NAT des opérateurs mobiles malgaches, des milliers de clients partagent une IP : **NON VÉRIFIÉ — à tester** (20 onglets simultanés depuis un mobile Telma, puis question au support o2switch sur les seuils « Tiger Protect » et la liste blanche) | Demander les seuils ; mettre Cloudflare devant (P-06) qui remplace cette protection par une politique connue | `06` | 1 h |
| O-03 | P2 | Quotas Free et pause d'inactivité | Alerte à 70 % (Dashboard › Usage) ; le cron maintient l'activité ; passer Pro au premier paiement | `06` | 0,3 h |
| O-04 | P1 | Aucun test de charge | `k6` gratuit : 50 utilisateurs virtuels × 10 min sur `/`, page type, fiche produit, `commande-creer` (préprod) ; seuil p95 < 2 s, 0 erreur | `06` | 2 h |
| O-05 | P1 | Ni plan de bascule ni rollback | `07-checklist-lancement.md` + tags `v2026.09.xx` + `deployer.mjs` vérifiant le hash | `07` | 1 h |
| O-06 | P2 | Ni statut ni plan d'incident | UptimeRobot page publique + bandeau `parametres.bandeau_incident` + runbook | `06` | 2 h |
| O-07 | P2 | Coûts non listés | Tableau dans `08` : o2switch (offre unique, déjà payée pour Fonenako), domaine `.mg`, Supabase 0 → 25 $, Brevo 0, Cloudflare 0, UptimeRobot 0, Sentry 0 | `08` | — |
| O-08 | P2 | Une seule personne | Second administrateur (avec MFA) ; secrets dans un coffre partagé (Bitwarden gratuit) ; accès o2switch/DNS/Supabase/GitHub documentés | `07` | 1 h |
| O-09 | P3 | TTL DNS 86 400 s | Abaisser à 300 s une semaine avant toute bascule (CDN) | `07` | 0,1 h |

---

## Index des constats par criticité

| Crit. | IDs | Nombre |
|---|---|---|
| **P0** | X-01/O-01 (sauvegardes) · F-01 + F-07 (commande invitée / tunnel jamais joué) · M-01 (débordement) · P-01 + CLS (vitals labo) · X-11 (MFA admin, ligne [P0] du barème) | **5** |
| P1 | F-02, F-03, F-04, F-06, A-01/D-01, M-02, M-04, A-07, S-02, S-09, C-01, C-03, X-02, X-04, P-02, P-03, P-05/Q-04, Q-01, O-04, O-05 | 20 |
| P2 | X-03, X-05, X-10, X-12, X-13, X-14, A-02, A-04, M-03, S-01, S-03, S-04, S-05, S-06, S-07, C-02, C-04, C-05, C-07, F-08, F-09, P-04, P-06, P-08, Q-02, Q-03, Q-05, Q-08, Q-09, I-01, O-02, O-03, O-06, O-07, O-08 | 35 |
| P3 | X-06, X-07, X-08, X-09, D-02, D-03, D-04, A-03, A-05, A-08, A-09, M-05, S-08, S-10, C-06, F-05, P-07, Q-06, Q-07, O-09 | 20 |

Suite : `03-corrections/` (un fichier par P0/P1), `04-pages-construites/`, puis la synthèse `08-synthese-decision.md`.
