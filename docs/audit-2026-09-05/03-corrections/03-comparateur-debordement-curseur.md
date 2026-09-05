# Correctif M-01 + A-02 — débordement horizontal du comparateur (P0 mobile) et curseur sans nom

## M-01 · La page format déborde de 204 px à 390 px

**Constat** : `/materiaux/bois/madrier/madrier-70x150-4m` à 390 px → `document.documentElement.scrollWidth = 594` (mesuré deux fois, `crawl_akora.json` puis `anomalies2_akora.py`). La page entière glisse horizontalement au doigt. Le barème 2.4 classe tout débordement en **[P0]**.

**Cause, prouvée par bissection** (masquer l'élément ramène la largeur à 390) : le `<span className="sr-only">Ajouter</span>` du dernier `<th>` du tableau (`src/pages/public/Comparateur.tsx:240`). `sr-only` = `position: absolute; width: 1px`. Son **bloc conteneur** est l'ancêtre positionné le plus proche : aucun entre lui et la racine (le conteneur défilant `div.overflow-x-auto` est `position: static`), donc il est positionné par rapport au **document**, à l'abscisse de sa colonne (x = 593), hors du conteneur qui défile. Le tableau, lui, défile correctement dans son cadre (326 px de large).

**Correctif** — `src/pages/public/Comparateur.tsx:227` :

```diff
-          <div className="mt-4 w-full overflow-x-auto rounded-lg border border-border bg-card">
+          {/* `relative` : les libellés `sr-only` (position absolue) des en-têtes
+              restent dans CE cadre. Sans lui, le « Ajouter » de la dernière
+              colonne se posait à x = 593 par rapport au document et faisait
+              déborder toute la page de 204 px à 390 px (05/09/2026). */}
+          <div className="relative mt-4 w-full overflow-x-auto rounded-lg border border-border bg-card">
```

**Indice de défilement** (barème 2.4 « scroll horizontal explicite »), juste après le tableau, dans le même bloc :

```tsx
<p className="mt-1 text-legende text-muted-foreground sm:hidden" aria-hidden="true">
  ← Glissez le tableau pour voir la livraison et le prix rendu →
</p>
```

**Chasse aux jumeaux** (règle : un garde-fou se pose à chaque bout du chemin) — 21 conteneurs `overflow-x-auto` dans `src/`. Commande pour trouver ceux qui contiennent un `sr-only` sans `relative` :

```bash
grep -rn -A14 "overflow-x-auto" src --include=*.tsx | grep -B14 "sr-only" | grep "overflow-x-auto" | grep -v "relative"
```
Chaque ligne rendue = même correctif (`relative` sur le conteneur).

**Vérification** : `anomalies2_akora.py` → `scrollWidth=390 depassent=0` sur la page format ; puis à l'œil à 360, 390 et 414 px (le crawl n'a testé que 390 et 1280 : les autres largeurs restent **NON VÉRIFIÉES — à tester** dans les outils de développement, mode appareil, sur `/`, `/materiaux/bois/madrier/madrier-70x150-4m`, `/fournisseurs/hourdis-mg`, `/commander`).

---

## A-02 · Le curseur de quantité n'a pas de nom accessible

**Constat** : axe (navigateur réel, 05/09) → `aria-input-field-name` sur `span[role=slider].size-6` sur `/calculateurs/mur-parpaings` ; Lighthouse le relève aussi sur la page format (`aria-input-field-name`, a11y 93). Le `<label htmlFor="quantite-comparateur">` de `Comparateur.tsx:147` vise la racine Radix, pas le pouce (`role="slider"`), qui est l'élément lu par le lecteur d'écran.

**Correctif** — `src/components/ui/slider.tsx` :

```diff
+type ProprietesCurseur = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
+  /** Nom lu par le lecteur d'écran sur le pouce (`role="slider"`). Obligatoire :
+      le label HTML vise la racine, jamais le pouce (axe aria-input-field-name, 05/09/2026). */
+  etiquette: string;
+};
+
 export const Curseur = React.forwardRef<
   React.ElementRef<typeof SliderPrimitive.Root>,
-  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
->(({ className, ...reste }, ref) => (
+  ProprietesCurseur
+>(({ className, etiquette, ...reste }, ref) => (
   <SliderPrimitive.Root
     ref={ref}
     className={cn("relative flex w-full touch-none select-none items-center py-3", className)}
     {...reste}
   >
     <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-border">
       <SliderPrimitive.Range className="absolute h-full bg-primary" />
     </SliderPrimitive.Track>
-    <SliderPrimitive.Thumb className="block size-6 rounded-full border-2 border-primary bg-card shadow" />
+    <SliderPrimitive.Thumb
+      aria-label={etiquette}
+      className="block size-6 rounded-full border-2 border-primary bg-card shadow"
+    />
   </SliderPrimitive.Root>
 ));
```

Puis, à chaque usage (`grep -rn "<Curseur" src`) : `etiquette="Quantité"` dans `Comparateur.tsx`, et le nom de la grandeur réglée dans `CalculateurDetail.tsx` (« Longueur du mur », « Hauteur »…). Le typage rend l'oubli impossible : `npm run typecheck` échoue tant qu'un `<Curseur>` n'a pas d'étiquette.

**Vérification** : `npm run test:a11y` (banc jsdom) puis `python axe_akora.py` (navigateur réel) → 0 `aria-input-field-name`.

## Commit

```
fix(comparateur): le libellé sr-only de la colonne « Ajouter » faisait déborder la page de 204 px ; le curseur porte un nom
```
Fichiers : `src/pages/public/Comparateur.tsx`, `src/components/ui/slider.tsx`, `src/pages/public/CalculateurDetail.tsx`.
