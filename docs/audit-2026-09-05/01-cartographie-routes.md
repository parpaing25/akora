# 01 — Cartographie des routes

**Méthode** : 67 routes déclarées dans `src/App.tsx` (extraction par script, 05/09). 36 routes chargées en navigateur réel (Chromium headless, agent Android, 390×844 puis 1280×800 pour les publiques) par `scratchpad/crawl_akora.py` → 61 mesures dans `crawl_akora.json`. Colonnes mesurées à **390 px** : nombre de `h1`, directive robots posée par le SPA, débordement horizontal (px), cibles tactiles < 44 px / total, requêtes réseau (dont échecs ≥ 400), FCP (ms, réseau réel de ce PC, pas de simulation 3G), JSON-LD présent. Les colonnes *Problème* et *Action* renvoient aux identifiants de `02-audit-detaille.md`.

⚠ Deux artefacts écartés avant lecture : (1) l'avertissement console « Deprecated API for given entry type » sur chaque page venait de **ma** mesure `performance.getEntriesByType`, pas du site ; (2) toute session Chromium **headless par défaut** reçoit une page de blocage o2switch (HTTP 429, « tigre ») — les mesures ci-dessous ont été refaites avec un agent utilisateur mobile qui passe (voir 02, O-02).

Statuts : **OK** · **OK avec réserves** (P2/P3) · **Défaut** (P0/P1).

## Routes mesurées (36)

| Route | Type | Statut | Titre | h1 | robots | Déb. px | Cibles <44 | Req. | FCP ms | JSON-LD | Problème | Action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Publique | **OK avec réserves** | Akora | 1 | index | 0 | 0/121 | 44 | 4628 | — | LCP 4,2 s (mobile simulé), 14 requêtes Supabase + 14 préflights, 6+6 appels de barème en 400 (F-02) ; texte des boutons compacts 2,56:1 (A-01) ; photos du fil servies en JPEG plein format (P-03) | F-02, A-01, P-03, S-06 (JSON-LD Organization) |
| `/materiaux` | Publique | **OK** | Matériaux de construction | 1 | index | 0 | 0/34 | 19 | 492 | BreadcrumbList+ItemList | — | — |
| `/materiaux/bois` | Publique | **OK** | Bois | 1 | index | 0 | 1/35 | 15 | 432 | BreadcrumbList | 1 cible < 44 px | M-02 |
| `/materiaux/bois/madrier` | Publique | **Défaut** | Madrier — prix et fournisseurs | 1 | index | 0 | 2/34 | 19 (6 KO) | 408 | BreadcrumbList | 6 requêtes `vehicules_livraison` en HTTP 400 (uuid composite) : le prix rendu n'est jamais affiché sur la page type | F-02 |
| `/materiaux/bois/madrier/madrier-70x150-4m` | Publique | **Défaut** | Madrier 7 x 15 cm, 4 m | 1 | index | 204 | 4/37 | 27 | 464 | BreadcrumbList | Débordement horizontal de 204 px à 390 px (`sr-only` hors conteneur défilant) ; curseur sans nom accessible ; 4 cibles < 44 px | M-01, A-02 |
| `/fournisseurs` | Publique | **OK** | Fournisseurs de matériaux | 1 | index | 0 | 1/46 | 25 | 448 | — | Pas de JSON-LD ItemList | S-06 |
| `/fournisseurs/hourdis-mg` | Publique | **OK avec réserves** | Hourdis MG | 1 | index | 0 | 30/87 | 36 | 432 | BreadcrumbList+Store | 30 cibles < 44 px sur 87 (puces produits 73×19) ; CLS 0,167 mesuré sur la fiche produit voisine | M-02, P-02 |
| `/fournisseurs/hourdis-mg/hourdis-tc-20` | Publique | **OK avec réserves** | Hourdis 20x33x33 | 1 | index | 0 | 3/40 | 34 | 456 | BreadcrumbList+Product | LCP 4,9 s : l'image principale est l'original 1280 px pour 324 px affichés (pas de `srcset`) ; CLS 0,167 (logo du pied de page en `w-auto` + `lazy`) ; Lighthouse perf 67 | P-01, P-02 |
| `/fournisseurs/hourdis-mg/livraison` | Publique | **OK** | Simuler une livraison — Hourdis MG | 1 | noindex | 0 | 2/33 | 28 | 412 | BreadcrumbList | 2 cibles < 44 px | M-02 |
| `/prix` | Publique | **OK** | Prix des matériaux de construction | 1 | index | 0 | 0/70 | 12 | 412 | — | Pas de JSON-LD (Dataset/ItemList) ; 46 cibles < 44 px à 1280 px (souris : toléré) | S-06 |
| `/prix/madrier-70x150-4m/madagascar` | Publique | **OK** | Prix du madrier 7 x 15 cm, 4 m à M | 1 | index | 0 | 0/25 | 15 | 412 | BreadcrumbList | — | — |
| `/calculateurs` | Publique | **OK** | Calculateurs de métré | 1 | index | 0 | 0/29 | 10 | 420 | BreadcrumbList | — | — |
| `/calculateurs/mur-parpaings` | Publique | **OK** | Mur en parpaings | 1 | index | 0 | 1/29 | 27 | 476 | BreadcrumbList | Curseur Radix sans `aria-label` (axe : aria-input-field-name) | A-02 |
| `/transporteurs` | Publique | **OK** | Transporteurs de matériaux à Madag | 1 | index | 0 | 0/28 | 18 | 420 | — | — | — |
| `/recherche?q=parpaing` | Publique (noindex par robots.txt) | **OK avec réserves** | Recherche : parpaing | 1 | noindex | 0 | 6/49 | 26 | 1176 | — | TTFB 911 ms / FCP 1,2 s (recherche côté base) ; 6 cibles < 44 px | P-04, M-02 |
| `/panier` | Publique | **OK** | Panier | 1 | noindex | 0 | 0/25 | 25 | 424 | — | — | — |
| `/guides/combien-de-parpaings` | Publique | **OK** | Combien de parpaings pour mon mur  | 1 | index | 0 | 1/25 | 10 | 416 | BreadcrumbList | Contenu court (~105 mots visibles) pour une page qui vise le SEO | S-07 |
| `/devenir-fournisseur` | Publique | **OK** | Devenir fournisseur | 1 | index | 0 | 2/28 | 10 | 408 | — | — | — |
| `/verification` | Publique | **OK** | Que veut dire « vérifié » ? | 1 | index | 0 | 3/27 | 10 | 420 | FAQPage | 3 cibles < 44 px | M-02 |
| `/a-propos` | Publique | **OK avec réserves** | À propos d'Akora | 1 | index | 0 | 1/25 | 10 | 224 | — | Sans nom d'entité, sans équipe, sans date ; page reconstruite | C-02 |
| `/contact` | Publique | **Défaut** | Contact | 1 | index | 0 | 1/28 | 13 | 416 | — | Seul canal = `mailto:` vers une boîte NON VÉRIFIÉE ; pas de téléphone/WhatsApp ; 2 champs sans étiquette programmatique selon le crawl (à recouper : `Champ` pose l'étiquette par rendu différé) | C-01, A-03 |
| `/mentions-legales` | Publique | **Défaut** | Mentions légales | 1 | index | 0 | 0/24 | 9 | 220 | — | Éditeur sans forme juridique, NIF, STAT, RCS, siège, directeur de publication | C-03 |
| `/politique-confidentialite` | Publique | **OK** | Politique de confidentialité | 1 | index | 0 | 2/26 | 10 | 400 | — | — | — |
| `/conditions-utilisation` | Publique | **OK** | Conditions d'utilisation | 1 | index | 0 | 2/26 | 10 | 420 | — | — | — |
| `/connexion` | Auth | **OK avec réserves** | Se connecter | 1 | noindex | 0 | 3/7 | 16 | 492 | — | 3 cibles < 44 px (liens texte) | M-02 |
| `/inscription` | Auth | **OK avec réserves** | Créer un compte | 1 | noindex | 0 | 6/8 | 26 | 472 | — | Contraste 3,56:1 sur le panneau latérite ; liste défilante non focalisable ; alt redondant ; 3 champs sans étiquette selon le crawl (à recouper) | A-01, A-03 |
| `/mot-de-passe-oublie` | Auth | **OK avec réserves** | Mot de passe oublié | 1 | noindex | 0 | 2/4 | 16 | 444 | — | Dépend du mailer GoTrue intégré : 2 courriels/heure pour tout le site | X-04 |
| `/demandes/nouvelle` | Publique (formulaire) | **OK** | Je cherche un matériau | 1 | noindex | 0 | 0/25 | 25 | 448 | — | — | — |
| `/compte` | Protégée | **OK** | Se connecter | 1 | noindex | 0 | 3/7 | 14 | 248 | — | Redirection vers /connexion | — |
| `/pro` | Protégée | **OK** | Se connecter | 1 | noindex | 0 | 3/7 | 14 | 244 | — | Redirection vers /connexion | — |
| `/admin` | Protégée | **OK** | Se connecter | 1 | noindex | 0 | 3/7 | 14 | 248 | — | Redirection vers /connexion | — |
| `/commander` | Publique (noindex) | **OK avec réserves** | Commander | 0 | noindex | 0 | 0/25 | 21 | 436 | — | Sans h1 (panier vide) ; un invité peut commander puis n'a aucun accès à sa commande | F-01 |
| `/fournisseurs/slug-qui-n-existe-pas` | Id inexistant | **OK** | Page introuvable | 0 | noindex | 0 | 0/26 | 23 | 264 | — | Page « introuvable » dessinée, `noindex`, mais **HTTP 200** (soft-404 inévitable en SPA ; noindex = mitigation acceptée) | S-01 |
| `/commande/AK-000000` | Id inexistant | **Défaut** | Commande introuvable | 0 | noindex | 0 | 0/25 | 23 (2 KO) | 460 | — | 401 sur `commandes` pour un invité → « Commande introuvable » même pour une commande réelle | F-01 |
| `/materiaux/famille-inconnue` | Id inexistant | **OK** | Page introuvable | 0 | noindex | 0 | 0/26 | 15 | 268 | — | Page « introuvable », `noindex`, HTTP 200 | S-01 |
| `/page-inexistante-xyz` | 404 | **Défaut** | Page introuvable | 0 | noindex | 0 | 0/26 | 8 | 268 | — | HTTP **200** : le premier segment n'est pas une route connue, Apache pourrait répondre 404 | S-01 |

Lecture rapide : 0 page blanche, 0 erreur JavaScript propre au site, titres et canoniques uniques sur toutes les pages publiques, `noindex` correct sur les états « introuvable » et les espaces privés. Les défauts sont concentrés sur **quatre points** : le prix rendu cassé sur les pages type (F-02), l'accès invité à sa commande (F-01), le débordement du comparateur (M-01) et le contraste des boutons compacts (A-01).

## Routes non mesurées (31) — ce qu'il reste à jouer à la main

| Route(s) | Type | État / procédure |
|---|---|---|
| `/fournisseurs/:slug/:produitSlug (autres)` | Publique | 40 fiches produit ; une seule mesurée |
| `/paiement/:numero` | Protégée (acheteur) | Tunnel de paiement : jamais joué en prod (0 paiement). NON VÉRIFIÉ — à tester : commande réelle + référence + confirmation admin |
| `/depot-reserve/:jeton` | Semi-publique (jeton) | Revendication d'une fiche créée par le bot. NON VÉRIFIÉ — à tester avec un jeton réel |
| `/verification-email, /auth/retour` | Auth | Retour OAuth Google et confirmation e-mail. NON VÉRIFIÉ — à tester avec un compte neuf |
| `/compte/{commandes,paiements,favoris,adresses,securite}` | Protégée | 6 écrans. NON VÉRIFIÉ connecté — à tester avec le compte de recette |
| `/pro/{verification,publier,demandes,clients,catalogue,catalogue/nouveau,catalogue/:id,livraison,vitrine,commandes,commandes/:id,portefeuille,avis,statistiques}` | Protégée (fournisseur) | 15 écrans. NON VÉRIFIÉ — à tester : créer un dépôt de test, déposer 6 pièces, publier un produit, recevoir une commande |
| `/admin/{utilisateurs,statistiques,verifications,materiaux,paiements,litiges,versements,referentiels,moderation,audit}` | Protégée (admin) | 11 écrans. NON VÉRIFIÉ — à tester : confirmer un paiement, arbitrer un litige, valider une vérification |
| `/guides/{choisir-son-sable,reception-livraison,payer-mobile-money}` | Publique | 3 guides non mesurés (même composant que celui mesuré) |
| `/calculateurs/{dalle-hourdis,beton,chape-enduit,toiture}` | Publique | 4 calculateurs non mesurés (même composant) |

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
