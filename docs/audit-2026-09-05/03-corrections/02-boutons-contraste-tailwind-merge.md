# Correctif A-01 / D-01 — texte béton sur latérite : les boutons compacts perdent leur couleur (P1)

**Constat** (05/09/2026, navigateur réel à 390 px, `axe-core` + styles calculés) :

| Élément | Page | `color` calculée | Fond | Contraste | Classe `text-primary-foreground` présente ? |
|---|---|---|---|---|---|
| `a[href="/inscription"]` « Créer un compte » (en-tête) | toutes | `rgb(41,49,61)` | `rgb(186,75,28)` | **2,56:1** | **non** — seules `text-legende` |
| `a[href="/connexion"]` « Se connecter » (en-tête) | toutes | idem | idem | 2,56:1 | non |
| `button` « Choisir le lieu » (fiche produit) | `/fournisseurs/…/hourdis-tc-20` | idem | idem | 2,56:1 | non |
| `button` « Ajouter au panier » (taille normale) | même page | `rgb(255,255,255)` | idem | 5,11:1 ✔ | oui |

Seuil WCAG 2.2 AA : 4,5:1 (texte < 24 px). Les boutons **compacts** échouent, les boutons normaux passent.

**Cause** : `src/components/ui/button.tsx:29` — la taille `compact` est `"min-h-11 px-3 text-legende"`. `text-legende` est une **taille** maison (`tailwind.config.ts:102`). Mais `cn()` (`src/lib/utils.ts`) appelle `twMerge` **sans configuration** : `tailwind-merge` 2.6.1 ne connaît pas `legende`, range `text-legende` dans le groupe *couleur de texte*, et **supprime** `text-primary-foreground` comme « doublon ». Le lien hérite alors de la couleur du corps (`--foreground`, béton). Même mécanique pour `text-page`, `text-section`, `text-produit`, `text-courant` partout où ils cohabitent avec une couleur.

**Effort** : 0,5 h (un fichier + test) + 0,5 h pour les opacités ci-dessous.

---

## 1. `src/lib/utils.ts` — apprendre l'échelle maison à tailwind-merge

```ts
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `twMerge` ne connaît pas l'échelle typographique d'AKORA-DESIGN §2
 * (`text-page`, `text-section`, `text-produit`, `text-courant`, `text-legende`,
 * déclarée dans tailwind.config.ts › fontSize). Sans cette liste, il prenait
 * `text-legende` pour une COULEUR et retirait `text-primary-foreground` des
 * boutons compacts : texte béton sur latérite, 2,56:1 au lieu de 5,11:1
 * (mesuré le 05/09/2026 sur « Créer un compte »).
 *
 * Toute nouvelle taille ajoutée dans tailwind.config.ts doit être ajoutée ICI.
 */
const TAILLES_MAISON = ["page", "section", "produit", "courant", "legende"];

const fusionner = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: TAILLES_MAISON }],
    },
  },
});

export function cn(...entrees: ClassValue[]) {
  return fusionner(clsx(entrees));
}
```

## 2. `src/lib/utils.test.ts` (nouveau) — le test qui aurait vu le bug

```ts
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn — tailles maison et couleurs ne se battent pas", () => {
  it("garde la couleur quand une taille maison suit (bouton compact, 05/09/2026)", () => {
    const r = cn("bg-primary text-primary-foreground", "min-h-11 px-3 text-legende");
    expect(r).toContain("text-primary-foreground");
    expect(r).toContain("text-legende");
  });
  it("deux tailles : la dernière gagne, comme pour text-sm/text-lg", () => {
    expect(cn("text-legende", "text-courant")).toBe("text-courant");
    expect(cn("text-sm", "text-page")).toBe("text-page");
  });
  it("deux couleurs : la dernière gagne toujours", () => {
    expect(cn("text-foreground", "text-primary-foreground")).toBe("text-primary-foreground");
  });
});
```

## 3. Opacités sur latérite — trois autres contrastes sous le seuil

axe (navigateur réel) : `.opacity-85` → **4,14:1** (accueil, « Choisir ») ; `text-primary-foreground/85` → 4,14:1 ; `.mb-1.5` (`#eed2c6`) → **3,56:1** (inscription). Calcul : blanc à 85 % sur `#BB4A18` ≈ `#F5E4DD` = 4,15:1 ; à 80 % ≈ 3,8:1 ; à 75 % ≈ 3,5:1. **Aucune opacité < 100 % ne passe 4,5:1 sur la latérite** pour du texte courant. La hiérarchie se fait par la graisse ou la taille, pas par la transparence.

| Fichier:ligne | Avant | Après |
|---|---|---|
| `src/pages/Accueil.tsx:140` | `className="shrink-0 text-legende font-semibold opacity-85"` | `className="shrink-0 text-legende font-semibold"` |
| `src/components/auth/PanneauMarque.tsx:46` | `text-primary-foreground/85` | `text-primary-foreground` |
| `PanneauMarque.tsx:66` | `text-primary-foreground/80` | `text-primary-foreground` |
| `PanneauMarque.tsx:77` | `text-primary-foreground/80` | `text-primary-foreground` |
| `PanneauMarque.tsx:106` | `text-primary-foreground/75` (12 px, majuscules) | `text-primary-foreground` |
| `PanneauMarque.tsx:111` | `text-primary-foreground/85` | `text-primary-foreground` |

Garde-fou : `grep -rn "primary-foreground/[0-9]" src --include=*.tsx` doit rendre **0** ligne après correction.

## 4. Vérification

```bash
npm run test -- utils          # 3 tests verts
npm run test:a11y              # banc jsdom
python scratchpad/axe_akora.py # navigateur réel : 0 « color-contrast » sur les 10 pages
```
Et à l'œil : les boutons « Créer un compte » / « Se connecter » de l'en-tête ont un texte **blanc** sur latérite.

## Commit

```
fix(ui): tailwind-merge prenait text-legende pour une couleur et retirait le blanc des boutons compacts (2,56:1)
```
Fichiers : `src/lib/utils.ts`, `src/lib/utils.test.ts`, `src/pages/Accueil.tsx`, `src/components/auth/PanneauMarque.tsx`.
