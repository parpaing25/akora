# 00 — Fiche d'identité du site audité

**Site** : https://akora.fonenako.mg · **Audit** : 05/09/2026 (auditeur pré-lancement, mission Go/No-Go)
**Version auditée** : bundle en ligne `assets/index-Cq2-GWSl.js` ; dépôt local `C:\Users\ANDRIANIRINA\Desktop\AKORA\akora`, HEAD `d840c25` (03/09/2026, branche `feat/site-mobile-pro`). L'égalité « dépôt = production » n'est **pas vérifiée** (procédure : `npm run build` puis comparer le hash de `dist/index.html` à celui servi).

Convention de ce dossier : chaque constat porte sa preuve (URL, `fichier:ligne`, requête SQL, fichier de mesure du scratchpad). Ce qui n'a pas pu être mesuré est écrit **NON VÉRIFIÉ — à tester manuellement : [procédure]**. Jamais « confirmé » sans mesure.

---

## 1. Ce qu'est Akora

| Champ | Constat | Source |
|---|---|---|
| Nature | **Place de marché** de matériaux de **gros œuvre** à Madagascar : elle met en relation acheteurs et fournisseurs indépendants, ne vend rien elle-même | `src/pages/contenu/MentionsLegales.tsx:19-24`, `APropos.tsx:26-41` |
| Promesse | « Le prix **rendu chantier**, pas le prix au dépôt » : matériau + transport calculé depuis l'adresse de l'acheteur, formule affichée | `manifest.webmanifest` (description), `APropos.tsx:19-24` |
| Périmètre produit | 8 familles, 37 types, 112 formats de référence ; agglomérés, briques, granulats, liants, bois, couverture, acier, béton prêt à l'emploi. Ni quincaillerie ni finitions | SQL `types_vitrine` / `formats_vitrine` (05/09) ; `APropos.tsx:33-35` |
| Éditeur déclaré | « l'équipe de Fonenako, à Antananarivo » — **sans forme juridique, NIF, STAT ni RCS** | `MentionsLegales.tsx:6-11` |
| Langue | Français seul (`<html lang="fr">`) ; colonnes `nom_mg` en base, 3 usages dans l'interface | `index.html:2`, grep `nom_mg` dans `src/` |

## 2. Modèle économique

| Règle | Détail | Source |
|---|---|---|
| Commission | **3 % du montant des matériaux**, prélevée à la libération du séquestre ; **0 %** sur la livraison | `Conditions.tsx:46-49`, `DevenirFournisseur.tsx:61` |
| Séquestre | Paiement mobile money bloqué jusqu'à confirmation de réception ; litige possible avant libération, arbitré par Akora | `Conditions.tsx:31-58` |
| Paiement | Mobile money (MVola, Orange Money, Airtel Money) par **référence saisie** par l'acheteur, **vérifiée à la main par un administrateur** ; aucun compte marchand opérateur | `Paiement.tsx:208-222`, `docs/PAIEMENT-MOBILE-MONEY.md` |
| Paiement à la livraison | Autorisé **sans compte** ; le paiement en ligne exige un compte et un fournisseur vérifié | `Commander.tsx:85-95, 222-235` |
| Vérification fournisseur | Gratuite, 6 pièces, 4 niveaux (dont « vérifié » qui débloque le paiement en ligne, « partenaire » après 10 commandes et note ≥ 4,2) | `Verification.tsx:35-40`, `DevenirFournisseur.tsx:103-105` |

## 3. Audiences et terminal cible

| Audience | Besoin | Écran |
|---|---|---|
| Acheteur particulier (autoconstruction) | Comparer, se faire livrer, payer sans se faire avoir | Android d'entrée de gamme, **3G**, écran ~390 px (`APropos.tsx:47`, `docs/DESIGN-MOBILE.md`) |
| Maçon / chef de chantier / petite entreprise BTP | Métré rapide (calculateurs), prix rendu, devis imprimable | Idem + bureau |
| Fournisseur (dépôt, briqueterie, carrière, scierie) | Être trouvé, publier son stock, recevoir des commandes, être payé | Téléphone, souvent via Facebook (les fiches sont pré-remplies par le bot de collecte) |
| Transporteur sans dépôt | Déclarer ses camions et zones | `/transporteurs`, `DevenirFournisseur.tsx:94-97` |
| Administrateur Akora | Vérifier les pièces, **confirmer les paiements**, arbitrer les litiges, modérer | `/admin/*` (11 écrans) |

## 4. Parcours critiques (ceux qui décident du Go)

| # | Parcours | Routes | État constaté le 05/09 |
|---|---|---|---|
| A | **Acheter** : fil → matériau → comparateur → fiche → panier → commander → suivi (→ paiement) | `/`, `/materiaux/…`, `/fournisseurs/:slug/:produit`, `/panier`, `/commander`, `/commande/:numero`, `/paiement/:numero` | **Jamais exercé en production** : 0 commande, 0 paiement en base. Un invité qui commande arrive sur « Commande introuvable » (voir 02, F-01) |
| B | **Vendre** : devenir-fournisseur → inscription → /pro (vérification 6 pièces) → catalogue → commandes → portefeuille | `/devenir-fournisseur`, `/inscription`, `/pro/*` | 6 fournisseurs publics, 40 produits actifs, tous créés par le bot de collecte ; 0 vérification passée par un vrai dépôt (NON VÉRIFIÉ : lire `verifications` en base) |
| C | **Demander un matériau** | `/demandes/nouvelle` → `/pro/demandes` | 0 demande |
| D | **Métrer puis acheter** : calculateur → matériau | `/calculateurs/:type` → `/materiaux/…` | Fonctionnel (crawl) |
| E | **Revendiquer sa fiche** créée par le bot | `/depot-reserve/:jeton` | Non testé (jeton confidentiel) |

## 5. Pile technique et exploitation

| Couche | Constat | Source |
|---|---|---|
| Front | SPA React 18 + Vite 5 + TypeScript, Tailwind, Radix, react-router 6.30, TanStack Query, Leaflet ; PWA (`vite-plugin-pwa`, précache de la coquille seule) ; **pas de SSR/SSG** | `package.json`, `vite.config.ts` |
| Poids | Coquille : 236 Ko transférés (brotli) = JS 79 + 73 + 66 Ko, CSS 17 Ko ; 109 fichiers dans `dist/assets` ; 67 routes, pages chargées à la demande | mesure `curl -H "Accept-Encoding: br"` 05/09 ; `src/App.tsx` |
| Hébergement | o2switch mutualisé (Apache, `.htaccess` : HTTPS 301, repli SPA, CSP stricte, HSTS 1 an, cache immuable), IP 109.234.166.169, HTTP/2, TLS 1.3, certificat couvrant `www.` | `public/.htaccess`, `openssl s_client` |
| Photos | Sur o2switch via `o2upload.php` / `o2delete.php`, vignettes `.thumb.webp` 480 px | `src/components/produit/ImageProduit.tsx`, curl `/uploads/…` |
| Base | Supabase `lvhnqrnmkajhlohympcs`, **plan Free**, 48 tables toutes sous RLS, anon sans droit d'écriture, 23 fonctions SECURITY DEFINER exécutables par anon | `scripts/verifier-securite.mjs` (48/48), SQL 05/09 |
| Fonctions | Edge Functions Deno : `commande-creer`, `paiement-initier`, `paiement-webhook`, `paiement-reconciliation`, `envoyer-push`, `envoyer-code`, `verifier-code`, `mot-de-passe-code` | `supabase/functions/` |
| Tâches | pg_cron : `akora-push` (chaque minute, 0 abonné), `akora-reconciliation` (3 h), `akora-purge-codes` (dim. 4 h) | SQL `cron.job` 05/09 |
| Courriel | GoTrue sans SMTP personnalisé (mailer intégré, **2 courriels/heure**), confirmation d'e-mail désactivée (`mailer_autoconfirm`) ; `_courriel.ts` prêt mais dépend d'une config SMTP absente | Management API `config/auth` (04-05/09) |
| Observabilité | **Aucune** : pas de Sentry, pas d'analytics, pas de RUM, pas de moniteur de disponibilité, pas de CI, 0 tag git | grep `src/`, `.github` absent |
| Sauvegardes | **0 sauvegarde**, PITR désactivé (plan Free) | Management API `database/backups` (05/09) |

## 6. Volumes réels au 05/09/2026 (SQL, recomptés)

| Objet | Nombre |
|---|---|
| Comptes (`auth.users`) | 7, dont 1 compte de recette `recette.akora.1787421700@example.com` |
| Fournisseurs publics / produits actifs | 6 / 40 |
| Publications du fil | 10 |
| Commandes / paiements / demandes | **0 / 0 / 0** |
| Notifications / abonnés push | 0 / 0 |

Lecture : le site est **en pré-lancement réel** — le catalogue existe, aucun parcours transactionnel n'a jamais été joué en production.

## 7. Cadre réglementaire à respecter (à faire confirmer par un juriste malgache)

- **Loi n° 2014-038** sur la protection des données à caractère personnel (autorité : CMIL) : finalités, durée de conservation, droits d'accès et de suppression, déclaration des traitements. La politique de confidentialité existe (`Confidentialite.tsx`) ; la déclaration CMIL est **NON VÉRIFIÉE**.
- **Loi n° 2014-024** sur les transactions électroniques : information précontractuelle, confirmation de commande, conservation de la preuve. Aucun courriel de confirmation n'est envoyé aujourd'hui.
- **Mentions légales** : dénomination, forme juridique, NIF, STAT, RCS, siège, directeur de publication, hébergeur — les quatre premiers **manquent** (`MentionsLegales.tsx:6-11`).
- **Fiscalité** : la commission de 3 % est une prestation de service ; le drapeau `assujetti_tva` existe côté fournisseurs. Facturation de la commission : NON VÉRIFIÉ (aucun paiement n'a eu lieu).
- **Mobile money** : l'encaissement pour compte de tiers (séquestre) suppose à terme un compte marchand opérateur ; aujourd'hui c'est un compte personnel + saisie de référence (`docs/PAIEMENT-MOBILE-MONEY.md`).

## 8. Références du secteur retenues pour juger

- Comparateurs et places de marché matériaux (type ManoMano / Leroy Merlin pour la fiche produit et le comparateur ; Jumia MG pour le mobile-first malgache et le paiement à la livraison) : fiche produit avec prix rendu, disponibilité, photos réelles, avis ; tunnel en 3 écrans ; confirmation multi-canal (écran + SMS/e-mail).
- Standards : Core Web Vitals (LCP ≤ 2,5 s, CLS ≤ 0,1, INP ≤ 200 ms), WCAG 2.2 AA, OWASP ASVS niveau 1 pour une place de marché sans carte bancaire.

## 9. Hypothèses déclarées (raisonnables, l'audit continue sans attendre)

| # | Hypothèse | Si fausse |
|---|---|---|
| H1 | Le lancement visé est **public et grand public** (publication Facebook prête), pas une bêta fermée | Une bêta fermée sur invitation abaisserait plusieurs P0 en P1 |
| H2 | Andry est **seul administrateur** et confirme les paiements à la main | Le délai de confirmation devient une promesse à écrire sur la page paiement |
| H3 | La commande **sans compte** (paiement à la livraison) est un choix produit voulu, à conserver | Sinon la correction F-01 se réduit à exiger la connexion (1 h au lieu de 4 h) |
| H4 | Budget mensuel d'exploitation **proche de zéro** (plan Free, mutualisé) ; 25 $/mois pour Supabase Pro est envisageable mais pas acquis | Les propositions donnent toujours une variante gratuite |
| H5 | L'adresse `contact@akora.fonenako.mg` **existe** sur o2switch | NON VÉRIFIÉ (port 25 sortant bloqué depuis ce PC) ; si elle n'existe pas, le seul canal de contact du site est un trou noir |
| H6 | Le bot de collecte reste la source principale de fournisseurs pendant les premiers mois ; les dépôts revendiquent ensuite leur fiche | Rien ne change pour le Go/No-Go |
| H7 | Le trafic de lancement est **modeste** (< 500 visites/jour) | Au-delà, la protection anti-flood d'o2switch (voir 02, O-02) devient un risque réel derrière les NAT des opérateurs mobiles |
| H8 | Le dépôt `d840c25` correspond au bundle en ligne | Sinon certains correctifs ne s'appliquent pas tels quels |

## 10. Questions bloquantes (5 au plus) — l'audit livre des réponses par défaut

| # | Question | Réponse par défaut retenue |
|---|---|---|
| Q1 | **Quelle entité juridique** édite Akora (nom, forme, NIF, STAT, RCS, siège) ? | Mentions légales livrées avec des champs `[À COMPLÉTER]` visibles, à remplir avant mise en ligne |
| Q2 | **Délai promis** pour confirmer une référence mobile money (2 h ? 24 h ?) et qui est de garde le week-end ? | 24 h ouvrées, écrit sur la page paiement (page livrée) |
| Q3 | Garde-t-on la **commande sans compte** ? | Oui (H3) : correctif complet par jeton de suivi livré ; variante « connexion obligatoire » décrite |
| Q4 | Accepte-t-on **25 $/mois** pour Supabase Pro (sauvegardes quotidiennes 7 jours) ? | Non par défaut : sauvegarde nocturne `pg_dump` par GitHub Actions livrée (gratuite) ; Pro recommandé dès le premier paiement réel |
| Q5 | Quel **numéro de téléphone / WhatsApp** publier sur Contact et dans le pied de page ? | Champ `[À COMPLÉTER]` ; sans numéro, l'audience cible (téléphone-first) n'a aucun recours rapide |

---

Suite : `01-cartographie-routes.md` (Phase 1).
