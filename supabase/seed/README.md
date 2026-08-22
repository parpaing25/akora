# Jeux de donnees d'Akora

Ce dossier est **separe des migrations** (regle A2.8). Rien ici n'est applique
automatiquement : `npm run db:push` ne touche qu'à `supabase/migrations/`.

| Fichier | Contenu | A charger |
|---|---|---|
| `01_familles.sql` | les 8 familles de gros œuvre (spec B3) | **oui, en production** |
| `02_materiaux_ref.sql` | ~80 materiaux de reference, avec poids et volume unitaires | **oui, en production** |
| `03_localites.sql` | regions et villes de Madagascar | **oui, en production** |
| `04_ratios_metre.sql` | ratios des calculateurs de metre | **oui, en production** |
| `99_demo.sql` | fournisseurs et produits fictifs | **jamais en production** |

Chargement :

```bash
node scripts/charger-seed.mjs 01 02 03 04      # referentiels reels
node scripts/charger-seed.mjs 99               # demo, en local uniquement
```

## Coordonnees : ce qui est renseigne et ce qui ne l'est pas

Les coordonnees des **chefs-lieux** sont renseignees. Celles des **communes et
quartiers de l'agglomeration d'Antananarivo** sont volontairement laissees a
`NULL` : je ne dispose pas de valeurs verifiees pour chacune, et la regle A2.8
interdit d'en inventer. Consequence assumee et geree par l'interface :

- la recherche par localite renvoie la commune, mais le site affiche
  « distance non calculable » tant que la coordonnee manque ;
- l'acheteur garde deux autres moyens de fixer son point de livraison —
  « Ma position » et le clic sur la carte — qui, eux, fonctionnent partout ;
- l'ecran `/admin/referentiels` permet de poser chaque commune sur la carte,
  une fois, et la valeur devient definitive.

Les poids et volumes unitaires des materiaux sont des **valeurs de reference
courantes du batiment**, pas des mesures d'un produit particulier. C'est
exactement leur role : servir de valeur pre-remplie, que chaque fournisseur
ajuste ensuite pour SES produits (spec B4).
