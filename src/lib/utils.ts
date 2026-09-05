import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `twMerge` ne connaît pas l'échelle typographique d'AKORA-DESIGN §2
 * (`text-page`, `text-section`, `text-produit`, `text-courant`, `text-legende`,
 * déclarée dans tailwind.config.ts › fontSize). Sans cette liste, il prenait
 * `text-legende` pour une COULEUR et retirait `text-primary-foreground` des
 * boutons compacts : texte béton sur latérite, 2,56:1 au lieu de 5,11:1
 * (mesuré le 05/09/2026 sur « Créer un compte », audit A-01).
 *
 * Toute nouvelle taille ajoutée dans tailwind.config.ts doit être ajoutée ICI
 * (le test utils.test.ts casse sinon).
 */
export const TAILLES_MAISON = ["page", "section", "produit", "courant", "legende"];

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
