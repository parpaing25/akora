# 03 — Correctifs prêts à appliquer

Un fichier par constat P0/P1 (et quelques P2 groupés). Chaque fichier porte : le constat avec sa preuve, la cause, le diff ou le fichier complet, le test, la commande de vérification, le message de commit. Les identifiants (F-01, X-02…) sont ceux de `02-audit-detaille.md`.

## Ordre d'application recommandé (≈ 26 h de travail, 3 jours)

| # | Fichier | Constats | Crit. | Effort | Dépend de |
|---|---|---|---|---|---|
| 1 | `15-sauvegardes-nocturnes.md` | X-01, O-01 | **P0** | 2 h | secrets GitHub |
| 2 | `04-commande-invite-jeton-suivi.md` | F-01 (+ F-07) | **P0** | 4 h (repli B : 1 h) | migration SQL |
| 3 | `03-comparateur-debordement-curseur.md` | M-01, A-02 | **P0** / P2 | 0,5 h | — |
| 4 | `02-boutons-contraste-tailwind-merge.md` | A-01, D-01 | P1 | 1 h | — |
| 5 | `01-livraison-cle-composite.md` | F-02 | P1 | 1 h | — |
| 6 | `11-auth-smtp-configuration.md` | X-04, X-11 | P1 (**P0** au sens strict du barème pour la MFA admin) | 1 h + 4 h | compte Brevo, Turnstile |
| 7 | `13-courriel-confirmation-commande.md` | F-03 | P1 | 2 h | 6 (SMTP), 2 (jeton dans le lien) |
| 8 | `14-compte-suppression-reelle.md` | F-06 | P1 | 3 h | — |
| 9 | `16-donnees-de-test.sql` | F-04 | P1 | 0,1 h | après la recette manuelle |
| 10 | `08-sql-durcissement-fonctions.sql` | X-02, X-10, Q-06 | P1 / P2 | 0,5 h | — |
| 11 | `09-quota-fail-closed.md` | X-03 | P2 | 0,5 h | 10 |
| 12 | `05-htaccess-www-404-fichiers-racine.md` | S-01, S-02, S-05, D-02 | P1 / P2 | 1 h | pages `04-pages-construites/` déployées (préfixes `faq`, `accessibilite`) |
| 13 | `10-perf-lcp-cls-images.md` | P-01…P-07 | P1 (lab **P0** barème) | 4 h | 5 |
| 14 | `06-sitemap-lastmod-produits.md` | S-04 | P2 | 1 h | — |
| 15 | `07-jsonld-organisation-site.md` | S-06, S-08 | P2 | 1 h | — |
| 16 | `12-dns-courriel-dmarc.md` | X-05, C-01 | P2 | 0,5 h + DNS | 6 |

Les pages manquantes (FAQ, accessibilité, mentions légales, contact, à propos) sont dans `../04-pages-construites/`.

## Règles de travail sur ce dépôt (rappel des incidents des 03-04/09)

- **Deux sessions travaillent sur ce dépôt.** Avant tout commit : `git branch --show-current` (le dépôt est aujourd'hui sur `feat/site-mobile-pro`, avec 12 fichiers non commités de `bot-fournisseurs/` qui appartiennent à une autre session), puis `git diff --stat -- <mes fichiers>` et commit **par pathspec** : `git commit -m "…" -- src/lib/utils.ts src/lib/utils.test.ts`. Jamais `git add -A`.
- **Migrations SQL** : `npx supabase db push` ou l'éditeur SQL du tableau de bord ; une écriture de production lancée depuis une session Claude peut être refusée par le classificateur — Andry applique.
- **Edge Functions** : `npx supabase functions deploy <nom> --use-api` (le bundle Docker local meurt quand la RAM manque).
- **Build et tests jamais en parallèle** (4 Go de tas chacun). Séquence : `npm run typecheck` → `npm test` → `npm run test:a11y` → `npm run build` → `node scripts/deployer.mjs` → **vérifier le hash en ligne** (`curl -s https://akora.fonenako.mg/ | grep -o 'index-[^"]*\.js'` = celui de `dist/index.html`).
- Les tournées du bot de collecte sont suspendues pendant qu'une session tourne ; ne pas toucher à `bot-fournisseurs/`.

## Vérification globale après le lot

```bash
# depuis le scratchpad de l'audit (voir 02 § Méthode pour récupérer les scripts)
python crawl_akora.py        # 0 requête ≥ 400, débordement 0 partout, h1 = 1 partout sauf états vides
python axe_akora.py          # 0 violation critique/sérieuse
python anomalies2_akora.py   # 0 HTTP 400
node scripts/verifier-securite.mjs   # 48/48
```
puis la checklist `07-checklist-lancement.md`.


## État d'application — 06/09/2026 (par la session d'audit, sur ordre d'Andry « remplis et fait tout par toi-même »)

| Fichier | État | Preuve |
|---|---|---|
| 01 livraison clé composite | **appliqué + déployé** | crawl prod : 0 requête 400 sur `/materiaux/bois/madrier` ; colonne « rendu » présente |
| 02 boutons contraste | **appliqué + déployé** | prod : `a[href="/inscription"]` → blanc `rgb(255,255,255)` sur latérite, classe présente ; axe 0 violation sur 14 pages ; Lighthouse accessibilité 100 |
| 03 comparateur débordement + curseur | **appliqué + déployé** | prod : `scrollWidth 390` sur la page format ; `aria-label="Quantité"` |
| 04 commande invitée (variante A, jeton) | **appliqué + déployé** (migration 20260906100000, fonction `commande-creer`, 4 écrans) | RPC `lire_commande_invitee` en base ; écran invité sans 401 ; commandes mémorisées dans `/panier` |
| 05 .htaccess, fichiers racine, index.html | **appliqué + déployé** | prod : www → 301 apex, `/page-inexistante-xyz` → 404, `security.txt`/`llms.txt` en `text/plain`, CSP Report-Only, cache `/uploads` 1 j |
| 06 sitemap | **appliqué + déployé** | prod : 339 URL, 55 `lastmod`, `/faq` et `/accessibilite` présents |
| 07 JSON-LD | **appliqué + déployé** | prod : `Organization` + `WebSite` (accueil), `ItemList` (`/fournisseurs`), `FAQPage`, `ContactPage`, `AboutPage` |
| 08 SQL durcissement | **appliqué** (migration 20260906101000) | `anon` ne peut plus exécuter `consommer_quota` ; `compter_vue_produit` sur un uuid inexistant → 0 ligne ; purge `rate_limits` planifiée ; l'index Q-06 était inutile (vue sur `publications`, déjà indexée) |
| 09 quota strict | **appliqué + déployé** (`_commun.ts`, 4 fonctions) ; `envoyer-code` reçoit en plus un plafond de 10/h par IP qu'il n'avait pas | `npm run fonctions:deploy` |
| 10 perf | **appliqué + déployé** : `srcset` fiche et fil, logo dimensionné, un seul appel de barèmes, preconnect, `min-height` du conteneur de page (cause réelle du CLS : pied de page poussé par les données) | Lighthouse après : accessibilité 100 partout ; perf inchangée en laboratoire (latence serveur dominante) |
| 11 auth / SMTP / MFA | **MFA appliqué + déployé** : inscription TOTP dans `/compte/securite`, défi à la connexion admin, garde SQL `exiger_second_facteur_admin()` dans les 5 fonctions sensibles, activable par `parametres.mfa_admin_obligatoire` (à false). **SMTP Brevo, Turnstile, URL autorisées, longueur de mot de passe : Andry** | `docs/A-APPLIQUER.md` |
| 12 DNS | **Andry** (cPanel : DMARC, MX du sous-domaine, boîte `contact@`) | `docs/A-APPLIQUER.md` |
| 13 courriel de commande | **appliqué + déployé** (`_courriel.ts` + `commande-creer`) ; inerte tant que les secrets `SMTP_*` manquent | fonction déployée |
| 14 suppression réelle du compte | **appliqué + déployé** (`compte-supprimer`, `Securite.tsx`, policy DELETE retirée) | migration 20260906102000 |
| 15 sauvegardes | **workflows écrits** ; **secrets GitHub à poser par Andry** (`SUPABASE_DB_URL`, `SAUVEGARDE_PASSPHRASE`) → P0 X-01 encore ouvert jusqu'au premier artefact | `docs/A-APPLIQUER.md` |
| 16 données de test | **volontairement non appliqué** : le compte de recette sert à la recette manuelle J-3 ; purge en J-1 | `07-checklist-lancement.md` |
| Pages (04) | **5 pages en production** avec l'éditeur réel (mentions légales de fonenako.mg), le téléphone public de Fonenako, la région Supabase vérifiée (Francfort) | prod `/faq`, `/accessibilite`, `/mentions-legales`, `/contact`, `/a-propos` |
| Observabilité (06) | tables `vitals`, `evenements`, `parametres` + RPC en base ; `web-vitals` et événements d'entonnoir dans le bundle ; bandeau d'incident ; frontière d'erreurs ; CI, Lighthouse hebdo, Dependabot écrits ; runbook `docs/RUNBOOK-INCIDENT.md` | migration 20260906103000 ; `.github/` |
