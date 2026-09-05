# 04 — Pages construites

Pages que le type de site (place de marché, Madagascar, paiement sous séquestre) **doit** avoir et qui manquaient ou étaient insuffisantes le 05/09/2026. Chaque fichier est un composant complet, dans le style des pages existantes (`PageTexte`, `Champ`, `Carte`, `Bouton`, classes de la charte), avec titre, description, `majLe`, et JSON-LD quand il apporte quelque chose.

| Fichier | Route | Remplace / nouveau | Constat | À compléter avant publication |
|---|---|---|---|---|
| `FAQ.tsx` | `/faq` | **nouveau** | C-04 (FAQ absente ; GEO) | délai de confirmation des paiements (Q2), numéro de téléphone (Q5) |
| `Accessibilite.tsx` | `/accessibilite` | **nouveau** | A-06 | mettre à jour la liste « défauts connus » après chaque correctif |
| `MentionsLegales.tsx` | `/mentions-legales` | remplace `src/pages/contenu/MentionsLegales.tsx` | C-03 (éditeur sans forme juridique, NIF, STAT, RCS, siège, directeur) | **tout le bloc `EDITEUR`** (Q1), région Supabase, récépissé CMIL |
| `Contact.tsx` | `/contact` | remplace `src/pages/contenu/Contact.tsx` | C-01 (mailto seul, boîte non vérifiée, ni téléphone ni WhatsApp) | numéro (Q5), adresse ; **vérifier que la boîte `contact@` existe** (12-dns-courriel-dmarc.md) |
| `APropos.tsx` | `/a-propos` | remplace `src/pages/contenu/APropos.tsx` | C-02 (pas d'entité, pas d'équipe, pas de date, pas de chiffres) | nom de l'équipe/fondateur, année, photo éventuelle |

Non construites, volontairement :
- **Page « statut »** (C-05) : une page statique qui dit « tout va bien » ment dès la première panne. La bonne réponse est un moniteur externe avec page publique (UptimeRobot / Better Stack, gratuit) lié depuis le pied de page : `06-amelioration-continue.md` § disponibilité. Un **bandeau d'incident** piloté par une ligne de table `parametres` (clé `bandeau_incident`) est décrit au même endroit (1 h).
- **Page 500 / maintenance** : le SPA affiche `EtatErreur` par requête ; une page `maintenance.html` statique à basculer dans `.htaccess` (`RewriteRule ^ /maintenance.html [R=503,L]` + `Retry-After`) est fournie dans `06` (15 min).
- **Confirmation de commande** : c'est la page `/commande/:numero` existante, réparée pour les invités par `03-corrections/04-…`. Pas de page supplémentaire.
- **Politique cookies** : le site ne dépose aucun cookie ni traceur (auth en `localStorage`, panier local, pas d'analytics) ; la politique de confidentialité le dit. Une bannière serait un mensonge de conformité.

## Brancher les pages

1. Copier `FAQ.tsx` et `Accessibilite.tsx` dans `src/pages/contenu/` ; remplacer les trois autres.
2. `src/App.tsx` (routes publiques, à côté de `a-propos`) :
   ```tsx
   const FAQ = lazy(() => import("@/pages/contenu/FAQ"));
   const Accessibilite = lazy(() => import("@/pages/contenu/Accessibilite"));
   …
   <Route path="faq" element={<FAQ />} />
   <Route path="accessibilite" element={<Accessibilite />} />
   ```
3. Pied de page (`src/components/layout/PiedDePage.tsx`) : ajouter « FAQ » dans la colonne d'aide et « Accessibilité » à côté de « Mentions légales ».
4. `scripts/generer-sitemap.mjs` : les deux entrées sont dans le diff de `03-corrections/06-…`.
5. `public/.htaccess` : les préfixes `faq` et `accessibilite` sont dans la liste du vrai 404 (`03-corrections/05-…`) — **déployer les pages avant ou avec le `.htaccess`**, jamais après.
6. `npm run typecheck && npm run test:a11y` (le banc jsdom couvre les pages de contenu si `src/qualite/contenu.a11y.ts` les liste : ajouter les deux routes).
7. Vérifier à 390 px et 1280 px, puis Rich Results Test sur `/faq` et `/contact`.

## Ce que ces pages ne font pas

Elles n'inventent aucune règle métier : chaque affirmation de la FAQ reprend une phrase déjà présente dans `Conditions.tsx`, `Verification.tsx`, `DevenirFournisseur.tsx`, `Paiement.tsx` ou `Confidentialite.tsx` (références dans les commentaires). Si une de ces pages change, la FAQ change avec.
