# AKORA — Brief mobile pour Claude Design (03/09/2026)

Ce document est le **prompt** à donner à Claude Design pour le projet design system
« Akora » (`721d690b-713e-40ee-8295-533ddca3c84c`), et la **feuille de route** que le
code suit. Rien n'y est un goût : chaque valeur vient d'une mesure faite le 03/09/2026
sur seize pages du site, à 390 × 844 px (Playwright, `scratchpad/akora/mesure390.py`).

---

## Le prompt, à coller tel quel dans Claude Design

> Tu es le directeur artistique d'**Akora**, la marketplace des matériaux de gros œuvre à
> Madagascar (parpaings, hourdis, sable, gravillons, briques, bois, tôles, ciment, fer).
> Le site existe et fonctionne (akora.fonenako.mg) ; le design system « Akora » est chargé
> dans ce projet (latérite `#BB4A18`, béton `#333F4D`, sable `#FBF9F5`, Inter, rayon 12 px,
> une seule ombre). Ton travail : **les écrans téléphone**, à 390 px de large, pour un
> public qui achète du matériau depuis un chantier, souvent sur un Android d'entrée de
> gamme et une connexion 3G.
>
> Règles, non négociables, toutes mesurées sur le site actuel :
> 1. **Une question par écran.** L'acheteur se demande d'abord *où livrer*, puis *combien
>    ça coûte rendu chantier*, puis *qui livre*. Chaque écran répond à une seule de ces
>    questions ; tout le reste est à un geste, jamais sur le même écran.
> 2. **Moins de mots.** Un titre, une ligne, un geste. Toute phrase d'explication de plus
>    de deux lignes part dans une page d'aide, derrière un lien.
> 3. **Le prix est le seul objet graphique** : en gros, tabulaire, latérite quand il est
>    rendu chantier, noir au dépôt, toujours avec son unité en petit (`/ pièce`).
> 4. **Cibles de 44 × 44 px minimum**, y compris les puces de filtre et les liens de nom.
>    Zone du pouce : les actions principales vivent dans le tiers bas de l'écran.
> 5. **12 px est la plus petite taille de texte** ; 15 px le courant ; 13 px la légende.
>    Chiffres toujours en `tabular-nums`.
> 6. **Grille de 390 px** : marges de 16 px, contenu de 358 px, gouttières de 8 px.
>    Quatre tuiles par rangée font 81 px chacune : un mot de onze caractères au plus.
> 7. **Barre basse de 60 px** (Fil · Matériaux · Recherche · Panier · Compte) et en-tête
>    de 56 px : 116 px de chrome, le reste à l'écran.
> 8. **Aucun tableau sur téléphone** : une carte par ligne, l'information dans le même
>    ordre d'importance (le nom, le chiffre en gros, le reste en légende).
> 9. **Mouvement** : une courbe (`cubic-bezier(.22,.61,.36,1)`), deux durées (140 ms,
>    220 ms), tout neutralisé sous `prefers-reduced-motion`. Un seul moment orchestré par
>    écran (l'arrivée du contenu), jamais une animation par carte.
> 10. **Accessibilité** : un `h1` par page, un repère `main`, chaque bouton nommé, focus
>     visible latérite, contraste AA (muted-foreground = 5,4:1 sur le fond).
>
> Dessine, dans cet ordre : **Accueil** (le fil, le point de livraison en tête),
> **Famille → Type → Comparateur** (deux gestes des tuiles au prix rendu), **Fiche
> produit** (prix rendu, livraison, dépôt, ajouter au panier collé en bas), **Fiche
> dépôt**, **Panier → Commander → Paiement mobile money**, **Inscription** (deux étapes,
> une question par écran), **Espace pro** (tableau de bord, catalogue, commandes,
> demandes). Chaque écran en trois états : chargé, vide, erreur.

---

## Ce que la mesure a dit (avant → après, 03/09/2026, seize pages à 390 px)

| Mesure à 390 px | Avant | Après |
|---|---|---|
| Cibles sous 44 px sur l'accueil | 19 | 1 (le lien d'évitement, 1 × 1 px, invisible par construction) |
| Cibles sous 44 px sur /prix | 36 | 1 (idem) |
| Cibles sous 44 px sur /fournisseurs | 14 | 2 |
| Cibles sous 44 px, seize pages | — | 32, dont 16 liens d'évitement et des liens en ligne dans du texte |
| Erreurs JavaScript, seize pages | 0 | 0 |
| Textes sous 12 px (16 pages) | 71 occurrences | 0 |
| Pages qui débordent horizontalement | /prix (tableau de 640 px) | 0 |
| Pages sans `h1` | /recherche | 0 |
| Pages sans repère `main` | 4 (authentification) | 0 |
| Écrans axe sans violation critique ni sérieuse | 22 | 27 (admin et espace pro audités CHARGÉS, cache react-query pré-rempli) |

Ce qui a été fait, et pourquoi c'est calculé et non choisi :

- **Tuiles de familles** : quatre par rangée = 81 px ; à 12 px semi-gras, onze caractères
  tiennent sur une ligne. « Agglomérés et préfabriqués béton » s'affichait « Agglomérés
  et… » à 11,5 px. Un mot par tuile, le nom complet reste le nom accessible.
- **Puces de filtre** : `min-h-9` (36 px) partout, dessinées pour une souris. Une règle
  hors `@layer` porte 44 px quand le pointeur est un doigt ou l'écran étroit ; à la souris,
  36 px restent justes.
- **Observatoire des prix** : le tableau imposait 640 px. Sous `sm`, une carte par
  matériau — le nom, la médiane en gros, min–max / dépôts / date en légende.
- **Accueil** : cinq raccourcis dont deux doublaient la barre basse et le bouton « Je
  cherche… » — trois.

## La grille, en chiffres

| Élément | Valeur | Origine |
|---|---|---|
| Largeur de référence | 390 px | l'écran le plus courant du parc Android |
| Marges latérales | 16 px | `container` padding |
| Contenu | 358 px | 390 − 32 |
| Gouttière | 8 px | `gap-2` |
| Tuile (4 par rangée) | 81 px | (358 − 3 × 8) / 4 |
| Carte (2 par rangée) | 175 px | (358 − 8) / 2 |
| En-tête | 56 px | `min-h-[3.5rem]` |
| Barre basse | 60 px + zone sûre, jusqu'à 1023 px | `--barre-mobile` |
| Rail gauche (navigation, devenir fournisseur) | 260 px dès 1024, 300 px dès 1536 | `Rails.tsx`, collant |
| Rail droit (panier, point de livraison, badge) | 340 px dès 1280, 380 px dès 1536 | à 1024 il ne resterait que 372 px au contenu |
| Liens de section dans l'en-tête | dès 1024 ; les secondaires dès 1280 | l'en-tête débordait de 23 à 178 px entre 768 et 1279 |
| Cible minimale | 44 × 44 px | `.cible-44`, règle 44 px sous 768 px |
| Texte courant / légende / minimum | 15 / 13 / 12 px | échelle AKORA-DESIGN §2 |
| Titre de page (mobile) | 26 px | `text-[1.625rem]` de l'accueil |

## Fait le 03/09, après le brief

- **Les deux colonnes latérales suivent le visiteur** sur toutes les pages (demande d'Andry) :
  elles vivent dans la coquille, collantes au défilement, et l'accueil ne garde que le fil.
  Mesuré de 390 à 1920 px : zéro débordement, une navigation à chaque largeur.
- **Inscription** : vitrine animée en trois cartes (camion, badge, anneau du séquestre),
  sans un seul prix d'exemple (règle A2.8) ; le camion roule dans le panneau latérite.
- **Espace pro** : cockpit du dépôt (`/pro` — commandes à traiter, vendu sur 30 jours,
  demandes dans le rayon avec la distance, vues et abonnés) et page **Clients**
  (`/pro/clients` — qui cherche près de vous, qui vous a déjà commandé, appel et WhatsApp).
- **Mouvement** : la page qui arrive, le compteur du panier qui pop, la barre de la fiche
  produit qui monte, l'onglet actif qui se souligne.

## Ce qui reste à dessiner puis à coder (dans l'ordre)

1. **Commander → Paiement** : un écran par étape, récapitulatif toujours visible.
2. **Catalogue pro sur téléphone** : une carte par produit (photo, prix, statut, bascule),
   le tableau seulement au-dessus de `sm`.
3. **États** : chaque écran a son état vide utile (une action) et son état d'erreur (une
   sortie), jamais une page blanche.

## Comment vérifier

```
cd C:\Users\ANDRIANIRINA\Desktop\AKORA\akora
npm run build && npx vite preview --port 4180
python <scratchpad>/akora/mesure390.py     # 16 pages, cibles, polices, débordements
npx vitest run -c vitest.a11y.config.ts    # 27 écrans axe
```
