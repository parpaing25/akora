# AKORA — Instructions de design (à respecter à la lettre)

Ce document est **l'autorité visuelle** du projet. La maquette de référence est le fichier
`Akora Design.dc.html` (à ouvrir dans un navigateur) : elle montre les fondations, les composants,
les écrans mobile 360 px et les écrans desktop. Ce fichier `.md` en est la version textuelle,
suffisante pour coder sans regarder la maquette.

> Les fournisseurs « A / B / C / D », les prix et les distances de la maquette sont des **exemples**.
> Ils ne doivent **jamais** apparaître dans le code de production (règle A2.8 de la spec).

---

## 1. Tokens — `src/index.css`, thème clair unique

```css
:root {
  --background: 40 33% 98%;      /* sable clair */
  --foreground: 215 20% 20%;     /* béton */
  --primary: 18 74% 42%;         /* latérite #BB4A18 */
  --primary-foreground: 0 0% 100%;
  --secondary: 199 64% 46%;      /* bleu Fonenako #2994C0 */
  --accent: 38 92% 50%;          /* jaune chantier */
  --muted: 40 20% 94%;
  --border: 40 15% 88%;
  --destructive: 0 72% 45%;
  --success: 152 55% 36%;
  --radius: 0.75rem;
}
```

Emploi strict :
- **latérite** = actions principales, prix rendu chantier, filet latéral des cartes de famille, anneau de focus.
- **bleu Fonenako** = badge « vérifié », liens, rappel de famille Fonenako. Jamais un bouton d'action principale.
- **jaune chantier** = badge or « Partenaire », alertes douces. Jamais du texte jaune sur fond clair.
- **success / destructive** = uniquement des statuts (commande, paiement, document).
- Fond de page en `background`, **cartes en blanc pur** pour se détacher. Max 2 fonds par écran.
- Aucun dégradé, sauf le bandeau d'accueil (latérite → latérite plus sombre). Aucune illustration générique.

Toujours via les classes Tailwind sémantiques (`bg-primary`, `text-muted-foreground`…), jamais de couleur en dur.

## 2. Typographie

- **Inter** auto-hébergée en woff2 dans `/public/fonts`, déclarée dans `tailwind.config.ts` sous
  `fontFamily.sans` (sinon `font-sans` retombe sur la pile Tailwind qui ne contient pas Inter).
- Échelle : page 34/700/-2,5 % · section 22/600 · nom de produit 17/600 · courant 15/400 ·
  légende 13/400 en `text-muted-foreground`.
- Titres en 600/700, `tracking-tight`.
- **`tabular-nums` sur tout chiffre** : prix, distances, quantités, dates, notes.
- Étiquettes techniques et références (numéro de commande, formule de calcul, référence de
  transaction) en monospace.

## 3. Le prix est le seul vrai objet graphique

- Format : `1 250 000 Ar`, entier, séparateur = **espace fine insécable `\u202F`**, jamais de décimale.
- Sur une carte : **prix en gros, unité en petit** — `1 400 Ar` puis `/ pièce` en 12-13 px.
- Le **prix rendu chantier** est toujours en latérite, toujours accompagné du **prix par unité rendue**.
  Le prix au dépôt reste en noir.
- « HT » ou « TTC » explicite à côté du montant. Jamais les deux dans un même total.

## 4. Formes

- Rayons : 6 px (petits éléments), 12 px = `--radius` (cartes, champs, boutons), pill (badges, puces).
- **Une seule ombre** dans tout le produit :
  `0 1px 2px hsl(215 20% 20% / .05), 0 6px 16px hsl(215 20% 20% / .06)`.
- Bords nets, bordure 1 px `border`. Filet latéral latérite 3-4 px sur les cartes de famille et les
  encadrés pédagogiques.
- Icônes : **lucide-react uniquement**, 20 px en barre, 16 px en ligne de texte.

## 5. Composants imposés (un fichier, réutilisé partout)

### `<BadgeVerification niveau />`
| niveau | rendu | infobulle |
|---|---|---|
| `partenaire` | pill jaune, puce `accent`, « Partenaire Akora » | ce qui a été vérifié + date |
| `verifie` | pill bleu clair, puce `secondary`, « Fournisseur vérifié » | idem |
| `en_cours` | pill grise, puce grise, « Vérification en cours » | — |
| `non_verifie` | pill à bordure **pointillée**, texte discret, « Non vérifié » | — |

L'infobulle dit **ce qui** a été vérifié et **quand** (« Identité légale vérifiée le 12/09/2026 :
NIF, STAT, RCS »). **Jamais** un document, jamais un lien vers un scan.
Sur une carte produit, le badge est réduit à sa **puce colorée** à côté du nom du fournisseur.

### `<CarteProduit />`
Vignette 4:3 (`aspect-ratio` figé, `loading="lazy"`, `decoding="async"`) → nom 15/600 → fournisseur +
puce de badge → prix gros / unité petit → ligne basse : pastille de stock, distance (**seulement si un
point de livraison est fixé**), bouton « + » de **44 × 44 px** en latérite.

### Boutons
Principal = latérite plein, blanc, `rounded-[10px]`, `min-height: 44px`.
Secondaire = fond blanc, bordure `foreground` 1 px.
Tertiaire = fond `muted`, bordure `border`.
Désactivé = `muted` + texte `muted-foreground`, sans ombre.

### Champs
`min-height: 44px`, bordure `border`, rayon 10 px, `<label>` 13/600 au-dessus, aide 12,5 px en dessous.
Erreur : bordure `destructive` 1,5 px + message `role="alert"` en `destructive`.
Focus : anneau latérite 2 px, `outline-offset: 2px`.

### États
- **Chargement** : squelettes à la forme du contenu (bloc image + 3 lignes), pulsation d'opacité
  0,55 → 1 sur 1,4 s. **Jamais de spinner plein écran.**
- **Vide** : cadre pointillé, titre 15/600, une phrase, **une** action concrète (« Élargir à 40 km »).
- **Avertissement métier** (hors zone, fournisseur non vérifié) : bloc `accent` très clair, filet
  gauche `accent`, titre + explication. Pas d'icône d'alerte criarde.

### `<Seo />`
Titre, description, **canonique propre à chaque page**, og:*, twitter:*, JSON-LD selon D6.

## 6. Le simulateur de livraison — obligation d'affichage

Ne jamais afficher un coût de livraison nu. Le bloc montre toujours, ligne par ligne :
distance route retenue · véhicule choisi · nombre de rotations · **coût**, puis un pliant
« Comment ce prix est calculé ? » qui déroule la formule en monospace, et enfin la mention
« Estimation — le prix final est confirmé par le fournisseur. »

Cas particuliers, rendus tels quels :
- franco atteint → « Livraison offerte » en `success`, avec la condition remplie ;
- hors rayon → bloc `accent`, « Hors zone de livraison — à négocier avec le fournisseur » +
  bouton d'appel, **et le paiement en ligne disparaît de l'écran** ;
- aucun véhicule → « Retrait sur place uniquement » ;
- pas de coordonnées → « distance non calculable ». **Jamais de prix inventé.**

Le point de livraison se fixe par : recherche `localites`, « Ma position », clic sur la carte Leaflet
(tuiles OSM, hauteur ~96 px en mobile, cadre rayon 10 px). Il est mémorisé et rappelé en tête
d'écran (« Livrer à Ambohidratrimo · modifier »).

## 7. Comparateur « prix rendu chantier » — l'écran signature

Ordre imposé : en-tête (famille › matériau, nombre de fournisseurs, point de livraison modifiable) →
barre de contrôle sur fond `muted` (curseur de quantité + puces de filtre/tri) → **tableau**
(en-tête sombre `foreground`, colonne fournisseur figée en `sticky left`) → encadré pédagogique.

Colonnes : Fournisseur (nom + puce badge + lieu · distance) · Prix dépôt · Distance ·
Véhicule · rotations · Livraison · **Rendu chantier** (gros, latérite, + prix par unité rendue) · Ajouter.

La **première ligne** (meilleur prix rendu) a un fond latérite très clair `hsl(18 74% 97%)`.
Le curseur recalcule tout en direct, paliers dégressifs appliqués. Tri par défaut : rendu croissant.
L'encadré pédagogique du bas est **généré depuis les deux lignes réelles** du tableau, jamais un texte figé.

## 8. Mobile — recette à 360 px

- Barre inférieure fixe, 5 entrées : Accueil · Matériaux · Panier (badge compteur latérite) ·
  Commandes · Compte. Entrée active en latérite.
- Grille produits **2 colonnes dès 360 px**.
- Filtres et tris dans un **drawer vaul**, jamais une colonne écrasée.
- Fiche produit : barre d'action **collante en bas** = sélecteur de quantité (− 44 px / valeur / + 44 px)
  + bouton plein largeur « Ajouter · <total> ».
- Tunnel de paiement **plein écran, une étape par écran**, en-tête `foreground` sombre qui garde le
  montant et le numéro de commande visibles + barre de progression `accent`.
- Densité compacte gérée par **un calque global** dans `index.css`, jamais page par page.
- Toute cible ≥ 44 × 44 px.

## 9. Desktop ≥ 1024 px — pas un étirement

Largeur max **1400 px**. Recherche en trois colonnes : filtres sticky à gauche (220 px), grille 3-4
colonnes au centre, panier + simulateur sticky à droite (300 px). Espace pro et admin en **vrais
tableaux** : en-tête `muted` (pro) ou `foreground` (comparateur), lignes alternées très légères,
édition du prix en ligne, sélection par cases pour les actions groupées, actions à droite.

## 10. Espace fournisseur

- **Dossier de vérification** : barre de progression « 4 pièces sur 6 validées » + liste pièce par
  pièce avec puce de statut (vert validé / rouge refusé avec le motif en clair / gris pointillé
  manquant) et une action par ligne. Phrase de réassurance en pied :
  « Vos scans partent dans un stockage privé. Seuls les administrateurs y accèdent, par lien
  temporaire, et chaque consultation est journalisée. »
- **Catalogue / nouveau produit** : le champ de recherche du référentiel d'abord, la liste de
  résultats, la référence choisie surlignée en latérite clair avec ses valeurs préremplies
  (unité · poids · volume). Poids et volume éditables ; **nom normalisé et famille en lecture seule**,
  avec la raison affichée : « c'est ce qui rend votre offre comparable ».
  Bouton secondaire « Demander l'ajout d'un matériau » dans l'encadré `muted` du bas.
  Produit en `en_attente_materiau` : pill grise « en attente de référence », jamais publiable.

## 11. Admin

Files de traitement en onglets-pills avec compteur (l'onglet actif est `foreground` plein, son
compteur en `accent`). Tableau + cases de sélection + actions groupées. Le bouton d'ouverture d'un
document KYC est libellé **« Ouvrir (lien 60 s) »**. Pied de tableau :
« Chaque ouverture de document écrit une ligne dans le journal d'audit. »

## 12. Accessibilité — vérifiable

Zéro champ sans `<label>` associé. Contraste AA. Focus visible partout. `aria-live="polite"` sur le
total du panier, les résultats de recherche et l'état d'un paiement. Cibles ≥ 44 px. Objectif :
0 violation axe-core critique.

## 13. Ton éditorial

Matière et franchise, français simple, pas de jargon marketing. Promesse d'accueil :
**« Le prix rendu chantier, pas le prix au dépôt. »** On explique toujours le mécanisme au moment où
il coûte quelque chose à l'utilisateur (séquestre, commission, vérification, estimation).
Pas de superlatif, pas d'emoji.

## 14. Interdits de design

Dégradés criards · illustrations génériques · spinner plein écran · icône hors lucide-react ·
seconde ombre · couleur en dur hors tokens · chiffre de prix sans `tabular-nums` · prix de livraison
sans son détail · badge de vérification redessiné localement · image sans `aspect-ratio` ·
bouton d'action en bleu · données de la maquette reprises en production.
