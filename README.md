# Akora — marketplace des matériaux de construction à Madagascar

**Le prix rendu chantier, pas le prix au dépôt.**

Akora compare les fournisseurs vérifiés de matériaux de **gros œuvre**, matériau par matériau,
livraison calculée au kilomètre depuis l'adresse du chantier, avec paiement mobile money et
séquestre jusqu'à la livraison.

- Production : https://akora.fonenako.mg
- Autorité visuelle : [`AKORA-DESIGN.md`](AKORA-DESIGN.md)
- Brancher la base : [`docs/SUPABASE-DEMARRAGE.md`](docs/SUPABASE-DEMARRAGE.md)

## Démarrer

```bash
npm install
node scripts/ecrire-env.mjs   # fabrique .env.local depuis ~/.akora-secrets
npm run dev
```

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement sur le port 8080 |
| `npm run build` | build de production (statique, pour o2switch) |
| `npm run typecheck` | `tsc --noEmit`, doit rester à 0 erreur |
| `npm test` | tests Vitest de la logique métier |
| `npm run db:push` | applique les migrations Supabase |
| `npm run types:gen` | régénère `src/integrations/supabase/types.ts` |
| `npm run deploy` | build + envoi FTP vers akora.fonenako.mg |
| `npm run fonctions:deploy` | déploie les 5 Edge Functions |
| `npm run test:a11y` | passe axe-core sur les écrans à formulaires |
| `npm run verif:recette` | contrôles statiques de la partie F |
| `npm run verif:securite` | contrôles joués contre la vraie base, à la clé anon |
| `npm run verifier` | les cinq d'un coup, avant de livrer |

## Règles qui ne se négocient pas

- Le navigateur n'utilise **que** la clé anon. Aucune clé `service_role`, nulle part.
- RLS activée sur 100 % des tables ; les rôles vivent dans `user_roles`, jamais dans `profiles`.
- Aucun montant de paiement ne vient du client : tout est recalculé en Edge Function.
- Les scans KYC vont dans un bucket Supabase **privé**, accessibles par URL signée de 60 s,
  aux administrateurs seuls, et chaque ouverture est journalisée.
- Un seul abonnement Realtime dans tout le produit : la table `notifications`.
- Les photos produits vont sur o2switch, jamais dans Supabase Storage.
- Aucune donnée inventée dans le code de production : les jeux d'essai vivent dans `supabase/seed`.

## Structure

```
src/
  components/ui/        primitives (boutons, champs, tableaux, tiroirs…)
  components/marque/    BadgeVerification, logo
  components/produit/   CarteProduit, Prix, ImageProduit
  components/layout/    coquille, en-tête, barre mobile, pied de page
  lib/                  logique métier PURE et testée (livraison, paliers, panier, formats)
  pages/                une page par route
supabase/
  migrations/           schéma, RLS, triggers, vues
  functions/            Edge Functions (paiement)
  seed/                 jeux d'essai, hors production
```

## État

Les dix étapes de la partie E sont livrées. Mesures de la dernière passe :

| Contrôle | Résultat |
|---|---|
| `tsc --noEmit` | 0 erreur |
| Tests de logique métier | 86 au vert |
| axe-core (9 écrans) | 0 violation critique ou sérieuse |
| Recette statique | 10/10 |
| Recette sécurité (base réelle) | 42/42 |
| Conseiller Supabase — performance | 0 signalement |
| **JS initial (accueil)** | **170,5 Ko gzip** (budget 200) |

Leaflet (43,6 Ko gzip), sonner, le menu du compte et les notifications sont
chargés à la demande : ils ne touchent jamais le premier rendu.
