# 07 — Checklist de lancement, J-7 → J+30

À cocher dans l'ordre. **J0 = jour de la publication Facebook.** Une case non cochée dans « J-1 » ou « J0 » repousse J0. Responsable par défaut : Andry ; « dev » = la personne qui applique les correctifs (peut être Andry).

## Déjà fait le 06/09/2026 par la session d'audit

Correctifs 01 → 11 (partie code), 13 et 14 appliqués et **déployés** ; 5 migrations en base ; 6 fonctions Edge déployées ; 5 pages en production ; workflows CI, sauvegarde, restauration, Lighthouse, Dependabot écrits (secrets à poser) ; runbook d'incident écrit. Les cases correspondantes ci-dessous sont à cocher après relecture ; les autres restent à faire.

## Décision préalable — les 5 réponses (fiche d'identité §10)

- [ ] Q1 Entité juridique, NIF, STAT, RCS, siège, directeur de publication → remplir `MentionsLegales.tsx` (bloc `EDITEUR`)
- [ ] Q2 Délai de confirmation d'une référence mobile money (proposé : 24 h ouvrées) → `FAQ.tsx`, page paiement
- [ ] Q3 Commande sans compte : **garder** (correctif 04-A, 4 h) ou **exiger un compte** (04-B, 1 h)
- [ ] Q4 Supabase Pro (25 $/mois) : non avant le premier paiement réel ; sauvegardes GitHub obligatoires dans tous les cas
- [ ] Q5 Numéro de téléphone / WhatsApp public → `Contact.tsx`, `FAQ.tsx`, JSON-LD `Organization`

## J-7 — corriger les bloquants (≈ 3 jours de travail)

**P0**
- [ ] Sauvegardes nocturnes + test de restauration lancé une fois à la main, vert (`03/15`) — dev
- [ ] Commande invitée : jeton de suivi (`03/04-A`) ou compte obligatoire (`03/04-B`) — dev
- [ ] Débordement du comparateur : `relative` + indice de défilement (`03/03`) — dev
- [ ] Second facteur TOTP pour le rôle admin, activé sur le compte d'Andry (`03/11 §4`) — dev + Andry
- [ ] Images : `srcset`/vignettes, logo dimensionné, barèmes en un appel, preconnect (`03/10`) — dev

**P1**
- [ ] Boutons compacts : `extendTailwindMerge` + suppression des opacités (`03/02`) — dev
- [ ] Prix rendu des pages type : `cle` ≠ `fournisseurId` (`03/01`) — dev
- [ ] SMTP Brevo (GoTrue + secrets Edge), Turnstile, `uri_allow_list` sans localhost, longueur de mot de passe 10 (`03/11`) — Andry (comptes) + dev
- [ ] Courriels de confirmation de commande (`03/13`) — dev
- [ ] Suppression réelle du compte (`03/14`) — dev
- [ ] SQL : `consommer_quota` réservée, `compter_vue_produit` gardée, index du fil (`03/08`) — Andry (éditeur SQL)
- [ ] Quotas stricts sur les codes (`03/09`) — dev
- [ ] `.htaccess` : www → apex, vrai 404, `security.txt`, `llms.txt`, robots IA, `color-scheme` (`03/05`) — dev
- [ ] Pages : FAQ, Accessibilité, Mentions légales, Contact, À propos branchées, liens du pied de page (`04/README.md`) — dev
- [ ] Cibles < 44 px : puces produits de la fiche fournisseur, liens texte de connexion, cases 20 px de l'inscription (M-02, A-03) — dev
- [ ] `verifier-htaccess.mjs` en `prebuild` ; sitemap avec `lastmod` et fiches produit (`03/06`) — dev
- [ ] CI GitHub (`06 §5`), Dependabot (`06 §8`), Sentry + ErrorBoundary (`06 §1`), moniteurs (`06 §2`), RUM (`06 §3`) — dev
- [ ] DNS : TTL de `akora.fonenako.mg` abaissé à 300 s (si CDN envisagé) ; DMARC `p=none; rua=` posé pour lire une semaine de rapports (`03/12`) — Andry (cPanel)

## J-5 — recette technique (navigateur fermé pendant les bancs, un seul à la fois)

- [ ] `npm run typecheck` → 0 erreur · `npm test` → 136+ verts · `npm run test:a11y` → vert · `npm run lint`
- [ ] `npm run build` → `dist/index.html` présent, > 50 fichiers dans `dist/assets`
- [ ] `python crawl_akora.py` (agent mobile) → 0 requête ≥ 400, débordement 0 partout, 1 `h1` partout, titres uniques
- [ ] `python axe_akora.py` → 0 violation critique/sérieuse sur les 10 pages
- [ ] Lighthouse mobile sur `/`, page format, fiche produit → LCP ≤ 3,0 s, CLS ≤ 0,1, perf ≥ 80, a11y ≥ 95, SEO 100
- [ ] `node scripts/verifier-securite.mjs` → 48/48 ; `select has_function_privilege('anon','public.consommer_quota(text,text,integer)','execute')` → false
- [ ] Test de restauration GitHub relancé à la main → vert ; date notée ici : ________

## J-3 — recette fonctionnelle à la main (les « NON VÉRIFIÉ » de l'audit)

Sur un **vrai Android d'entrée de gamme en 4G Telma, puis 3G forcée**, et sur un iPhone :
- [ ] Parcours A complet en **invité** : accueil → matériau → comparateur → fiche → panier → commander (à la livraison) → écran de suivi avec numéro et total ; lien de suivi rouvert dans un autre navigateur ; courriel reçu si e-mail saisi
- [ ] Parcours A **connecté** avec le compte de recette : idem + `/compte/commandes` liste la commande
- [ ] Parcours B : créer un dépôt de test → 6 pièces → `/admin/verifications` valider → publier un produit avec photo → visible sur sa fiche → recevoir une commande → `/pro/commandes` → marquer livrée → l'acheteur confirme
- [ ] **Paiement réel de 1 000 Ar** par MVola sur une commande de test : référence saisie → `/admin/paiements` confirme → statut « séquestre » → confirmation de réception → libération → `montant_commission` = 3 % ; puis annulation/remboursement d'un second paiement de 1 000 Ar (procédure documentée ? sinon l'écrire)
- [ ] Parcours C (demande) et D (calculateur → comparateur) ; parcours E (revendiquer une fiche réservée avec un jeton réel)
- [ ] Inscription avec un Gmail, un Outlook.com et un Yahoo : code reçu < 1 min, pas en spam ; 6e demande de code refusée (429) ; mot de passe oublié ; connexion Google ; **suppression du compte** puis reconnexion impossible
- [ ] Injection en boîte noire (X-13) : 10 charges sur nom, message, recherche, texte de publication, description de dépôt → affichage inerte, base propre
- [ ] IDOR : avec deux comptes, tenter de lire `/commande/<numéro de l'autre>`, `/pro/commandes/<id de l'autre>`, un document KYC de l'autre → refus partout
- [ ] Cas limites de la commande : double clic « Commander », rafraîchir pendant l'envoi, couper le réseau puis réessayer, session expirée (attendre 1 h) → aucune commande en double, message clair
- [ ] Lecteur d'écran (TalkBack et NVDA) sur le parcours A : chaque bouton annoncé, le curseur a un nom, le tableau se lit ; clavier seul sur `/commander` et `/paiement`
- [ ] Largeurs 360 / 414 / 768 / 1024 / 1536 + paysage sur `/`, page format, fiche fournisseur, `/commander`, `/inscription` → 0 débordement
- [ ] Boîte `contact@akora.fonenako.mg` : envoyer un test depuis Gmail → reçu dans cPanel/webmail ; répondre → arrive, pas en spam (mail-tester ≥ 8/10)
- [ ] o2switch : ouvrir 20 onglets du site depuis le même mobile en 30 s → pas de page « tigre » ; demander au support les seuils anti-flood et une liste blanche pour les moniteurs
- [ ] Search Console : propriété `https://akora.fonenako.mg/` vérifiée, sitemap soumis, « test en direct » de `/`, d'une fiche produit et d'une page prix → rendu complet, pas de blocage ; Bing Webmaster importé
- [ ] Rich Results Test sur `/`, `/faq`, `/contact`, une fiche fournisseur → 0 erreur
- [ ] Facebook Sharing Debugger sur `/` et une fiche produit → image 1200×630, titre, description
- [ ] Test de charge k6 sur la préprod (ou à 06 h sur la prod) : 50 VU × 10 min sur `/`, page type, fiche produit, `commande-creer` → p95 < 2 s, 0 erreur, aucun 429 o2switch

## J-1 — geler

- [ ] Purger les données de test (`03/16`) **après** la recette ; vérifier `auth.users` = comptes réels seulement ; retirer le dépôt de test
- [ ] Remplir tous les `[À COMPLÉTER]` (`grep -rn "À COMPLÉTER" src public` → 0)
- [ ] `git tag v2026.09.xx` sur le commit déployé ; `npm run build` ; `node scripts/deployer.mjs` ; **hash en ligne = hash de `dist/index.html`** (`curl -s https://akora.fonenako.mg/ | grep -o 'index-[^"]*\.js'`)
- [ ] `curl -sI https://www.akora.fonenako.mg/` → 301 ; `/page-inexistante-xyz` → 404 ; `/.well-known/security.txt` → 200 text/plain ; `/faq` → 200
- [ ] Moniteurs verts depuis 24 h ; Sentry reçoit un événement de test ; bandeau d'incident testé (activer 5 min, désactiver)
- [ ] Coffre partagé (Bitwarden) : accès o2switch, DNS, Supabase, GitHub, Brevo, Sentry, Better Stack ; second administrateur créé avec TOTP
- [ ] Runbook d'incident imprimé ; numéro d'Andry et du second admin dedans
- [ ] Publication Facebook prête (texte + image), heure choisie (semaine, 8 h – 10 h), **aucun chiffre non recompté** dans le texte (règle du 03/09 : 1 878 ≠ 2 000)

## J0

- [ ] 07 h : moniteurs verts, Sentry vide, sauvegarde de la nuit présente
- [ ] 08 h : publication ; Andry joignable toute la journée ; onglet Sentry + Better Stack + `/admin` ouverts
- [ ] Toutes les 2 h : `select count(*) from commandes`, `from paiements where statut='en_verification'` → confirmer les références **dans le délai promis**
- [ ] Répondre aux commentaires et messages Facebook (un seul répondeur sur la page, règle Fonenako)

## J+1

- [ ] Rapport express : visites (evenements), commandes, paiements, erreurs Sentry (top 3), vitals p75 (LCP/INP/CLS) sur la journée, recherches sans résultat
- [ ] Toute erreur Sentry vue par > 3 utilisateurs → correctif ou bandeau le jour même
- [ ] Vérifier que le cron `akora-push` et la sauvegarde de la nuit ont tourné

## J+7

- [ ] Premier rapport de l'agent hebdo lu ; 1 à 3 actions choisies
- [ ] DMARC : lire les rapports `rua` ; si propre → `p=quarantine`
- [ ] Search Console : couverture (pages indexées vs 330 du sitemap), erreurs, Core Web Vitals (encore vide : normal)
- [ ] Appeler 5 acheteurs et 3 fournisseurs : qu'est-ce qui a coincé ? → `retours` et backlog
- [ ] Décider Cloudflare (P-06) sur les vitals p75 réels

## J+30

- [ ] Test de restauration mensuel vert ; revue des coûts (o2switch, domaine, Supabase, Brevo : total attendu 0 € hors existant)
- [ ] Décision Supabase Pro si ≥ 1 paiement réel encaissé
- [ ] Revue des P2 restants de `02` : prioriser 5 pour le mois suivant (pré-rendu S-03, E2E Q-02, préprod Q-03, recherche IA `05-A`, guides étoffés S-07)
- [ ] Mettre à jour `Accessibilite.tsx` (défauts corrigés), `security.txt` (`Expires` à J+365), cette checklist (ce qui a manqué)
