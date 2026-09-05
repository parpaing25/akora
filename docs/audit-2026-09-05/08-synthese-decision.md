# 08 — Synthèse et décision (une page pour décider)

**Site** : akora.fonenako.mg — place de marché de matériaux de construction, Madagascar · **Audit** : 05/09/2026 · **Version** : bundle `index-Cq2-GWSl.js` (build du 03/09)


> **Mise à jour du 06/09/2026 — correctifs appliqués et déployés.** Sur ordre d'Andry (« remplis et fait tout par toi-même »), la session d'audit a appliqué les correctifs réalisables sans compte tiers, construit et mis en production les 5 pages, appliqué 5 migrations, déployé 6 fonctions Edge et le site (bundle vérifié en ligne). Vérifié en production : 0 requête en échec, 0 débordement, un `h1` par page, contrastes conformes (axe 0 violation sur 14 pages, Lighthouse accessibilité 100/100 sur 3 pages). **Il reste à Andry** ce qui exige ses comptes : secrets GitHub des sauvegardes, SMTP Brevo, Turnstile, DNS (DMARC, boîte contact), inscription de son second facteur puis activation de `mfa_admin_obligatoire`, recette manuelle J-3 — liste dans `docs/A-APPLIQUER.md`. Tant que la première sauvegarde n'existe pas et qu'une restauration n'a pas été testée, le P0 X-01 reste **ouvert** : la décision ci-dessous ne change pas.

## Décision : **NO-GO** aujourd'hui — **GO CONDITIONNEL atteignable en 3 jours de travail**

Le site est bien construit (design cohérent, sécurité de base solide : toutes les tables protégées, aucun secret exposé, 136 tests verts, aucune erreur de typage) mais il n'a **jamais vendu** : 0 commande, 0 paiement, et le dernier écran du parcours d'achat est cassé pour un client sans compte. Il n'a **aucune sauvegarde**, aucun second facteur pour l'administrateur qui manipule l'argent, et il déborde de l'écran sur la page qui compare les prix. Cinq points bloquants, tous corrigeables en heures, pas en semaines.

| Domaine | Poids | Note /100 | Bloquants P0 | Verdict |
|---|---|---|---|---|
| Performance & vitals | 12 | 35 | LCP 4,2–4,9 s et CLS 0,17 en laboratoire mobile (terrain non mesurable : pas de trafic) | ✗ |
| Sécurité | 15 | 55 | 0 sauvegarde ; pas de second facteur admin | ✗ |
| Design & UX | 10 | 87 | — | ✓ |
| Mobile | 12 | 57 | Débordement de 204 px sur la page comparateur | ✗ |
| Accessibilité | 8 | 55 | — (contraste 2,6:1 des boutons compacts : P1) | ✗ |
| SEO / GEO | 8 | 44 | — | ✗ |
| Pages nécessaires | 8 | 59 | — (FAQ, contact, mentions légales : construites) | ✗ |
| Fonctionnel | 12 | 38 | Commande invitée → « introuvable » ; tunnel jamais joué ; aucun courriel | ✗ |
| Qualité technique | 7 | 61 | — | ✗ |
| IA | 5 | 20 | — | ✗ |
| Amélioration continue | 6 | 0 | — | ✗ |
| Ops & lancement | 5 | 17 | Aucun retour arrière possible | ✗ |
| **Note pondérée** | 108 | **48 / 100** | **5 P0** | **NO-GO** (règle : GO ≥ 85 et 0 P0 ; GO conditionnel ≥ 75 et 0 P0) |

Ce que « 48 » veut dire : la moitié des points perdus vient de ce qui n'existe pas encore (sauvegardes, surveillance, courriels, CI), pas de ce qui est mal fait. Après les 16 correctifs livrés et les pages construites, la note attendue est **≈ 76–80** avec **0 P0** : **GO CONDITIONNEL**, avec les P1 restants sous 30 jours.

## Les 5 bloquants et leur coût

| # | Bloquant | Preuve | Correctif livré | Heures |
|---|---|---|---|---|
| 1 | **Aucune sauvegarde** de la base (plan gratuit), aucun retour arrière | API Supabase : 0 backup, PITR off | Sauvegarde nocturne chiffrée + test de restauration mensuel (GitHub, gratuit) | 2 |
| 2 | **Un client sans compte qui commande voit « Commande introuvable »** ; aucun courriel, rien | Code + base : la table des commandes n'est pas lisible sans compte ; 0 commande jamais passée | Jeton de suivi dans le lien (garde la commande sans compte) — ou compte obligatoire | 4 (ou 1) |
| 3 | **La page qui compare les prix déborde de l'écran** sur mobile (204 px) | Mesuré deux fois à 390 px ; cause isolée : un libellé masqué | Une classe CSS | 0,25 |
| 4 | **L'administrateur qui confirme les paiements et libère l'argent n'a pas de second facteur** | Aucun code d'inscription TOTP dans l'application | TOTP obligatoire pour le rôle admin | 4 |
| 5 | **Vitesse** : 4 à 5 s avant de voir le contenu sur mobile simulé ; décalage visuel sur la fiche produit | Lighthouse mobile, 3 pages | Vignettes au lieu des originaux, un appel au lieu de douze, logo dimensionné | 4 |

## Top 10 des actions (impact / effort)

| # | Action | Constat | Heures | Effet |
|---|---|---|---|---|
| 1 | Sauvegardes nocturnes + test de restauration | X-01 | 2 | Le seul risque irréversible disparaît |
| 2 | Débordement du comparateur (`relative`) | M-01 | 0,25 | Un P0 mobile pour une ligne |
| 3 | Couleur des boutons compacts (tailwind-merge) | A-01 | 1 | Contraste 2,6 → 5,1 sur toutes les pages |
| 4 | Prix rendu des pages type (uuid composé) | F-02 | 1 | 6 erreurs 400 par page → 0 ; la promesse « rendu chantier » enfin affichée |
| 5 | Commande invitée par jeton | F-01 | 4 | Le parcours d'achat se termine sur une confirmation |
| 6 | SMTP Brevo + courriels de commande | X-04, F-03 | 3 | Codes d'inscription fiables (2/h aujourd'hui) ; acheteur et fournisseur prévenus |
| 7 | Second facteur admin | X-11 | 4 | L'argent sous séquestre n'est plus à un mot de passe |
| 8 | Images : vignettes, `srcset`, un appel de barèmes | P-01/03/05 | 4 | LCP −1 à −1,5 s en 3G, −175 Ko sur l'accueil |
| 9 | `.htaccess` : www, vrai 404, `security.txt`, `llms.txt` ; JSON-LD identité ; sitemap daté | S-01/02/04/05/06 | 3 | Un seul hôte indexé, identité lisible par Google et les moteurs IA |
| 10 | Pages : FAQ, contact avec téléphone/WhatsApp, mentions légales complètes | C-01/03/04 | 3 (+ réponses Q1, Q5) | Confiance et conformité ; canal de contact réel |

Total des 10 : **≈ 25 h**. Le reste des P1 (suppression réelle du compte 3 h, données de test, cibles tactiles 2 h, CI 2 h, moniteurs 1 h) : **≈ 9 h**, sous 30 jours.

## Ce qui rendrait Akora réellement « 2026 » — 5 propositions chiffrées

| # | Proposition | Pourquoi ici | Coût récurrent | Effort |
|---|---|---|---|---|
| 1 | **Commander par WhatsApp en malgache** : « mila biriky 500 Itaosy » → 3 offres rendu chantier → commande créée → lien de suivi. Réutilise l'assistant Messenger de Fonenako (échos, répondeur unique, région déjà réglés) | L'audience vit sur WhatsApp ; 84 % des dépôts ne publient pas de prix parce que tout se règle en discussion | 0 → 10 €/mois | 3 semaines |
| 2 | **Recherche en langage naturel** : « 200 parpaings de 15 livrés à Itaosy » ouvre le comparateur pré-rempli ; repli sur la recherche classique ; jamais de prix inventé | La promesse du site en une phrase ; supprime trois écrans en 3G | 0 € (quotas gratuits) | 1 semaine |
| 3 | **Prix « rendu chantier » servi aux robots** : pré-rendu des 330 pages publiques au build + `llms.txt` + FAQ → les moteurs de réponse (Google AI, Perplexity, ChatGPT) citent Akora sur « prix du parpaing à Antananarivo » | Aujourd'hui le HTML est vide ; le SEO/GEO est le seul canal gratuit | 0 € | 8 h + contenu |
| 4 | **Photo → fiche produit** : le dépôt photographie son tas de bois ou son ardoise de prix ; la machine propose type, format, prix ; l'humain valide | Le goulot du catalogue est le tri des photos à la main (incident « sable fin / gravillon ») | 0 → 5 €/mois | 2 semaines |
| 5 | **Agent d'amélioration hebdomadaire** : chaque lundi, un rapport lit vitals terrain, entonnoir, erreurs, recherches sans résultat, retours, positions Google, et ouvre une PR avec 5 actions et les correctifs simples en diff — validés par Andry | Le site s'améliore sans que quelqu'un y pense ; c'est la définition de « 2026 » | ~0,10 €/mois | 3 h (socle en `06`) |

## Coûts récurrents après lancement

| Poste | Aujourd'hui | Recommandé | Quand |
|---|---|---|---|
| o2switch (mutualisé, déjà payé pour Fonenako) | inclus | inclus | — |
| Domaine `fonenako.mg` | existant | existant | — |
| Supabase | 0 € (Free) | **25 $/mois (Pro)** | dès le premier paiement réel encaissé |
| Brevo (courriels), Cloudflare, Better Stack, Sentry, GitHub Actions (dépôt privé), Turnstile | 0 € | 0 € | J-7 |
| LLM (recherche, agent hebdo) | 0 € | 0 → 15 €/mois | 2027 |

## Ce que la décision attend d'Andry (5 réponses, fiche d'identité §10)

1. Entité juridique, NIF, STAT, RCS, siège, directeur de publication (mentions légales).
2. Délai promis pour confirmer un paiement mobile money (proposé : 24 h ouvrées), et qui est de garde le week-end.
3. Garder la commande sans compte (4 h) ou exiger un compte (1 h).
4. Supabase Pro à 25 $/mois : quand.
5. Le numéro de téléphone / WhatsApp à publier.

**Recommandation** : appliquer les 16 correctifs et les 5 pages (3 jours), jouer la recette de la checklist J-3 avec un vrai paiement de 1 000 Ar, puis lancer en **GO CONDITIONNEL** avec les P1 restants sous 30 jours et Supabase Pro au premier encaissement. Ne pas lancer avant : la première commande réelle d'un client sans compte finirait sur un écran d'erreur, et la base n'a aucun filet.

---
Dossier complet : `00-fiche-identite.md` · `01-cartographie-routes.md` · `02-audit-detaille.md` (80 constats) · `03-corrections/` (16 correctifs) · `04-pages-construites/` (5 pages) · `05-plan-ia.md` · `06-amelioration-continue.md` · `07-checklist-lancement.md`.
