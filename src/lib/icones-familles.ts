import {
  BrickWall,
  Blocks,
  Mountain,
  Package,
  TreePine,
  Home,
  Grid3x3,
  Truck,
  Boxes,
  type LucideIcon,
} from "lucide-react";

/**
 * Correspondance entre la colonne `categories.icone` (une chaîne stockée en
 * base) et l'icône lucide affichée. Aucune autre bibliothèque d'icônes n'est
 * autorisée (interdit de design §14).
 */
const TABLE: Record<string, LucideIcon> = {
  blocks: Blocks,
  brick: BrickWall,
  mountain: Mountain,
  package: Package,
  tree: TreePine,
  home: Home,
  grid: Grid3x3,
  truck: Truck,
};

export function iconeFamille(nom: string | null | undefined): LucideIcon {
  if (!nom) return Boxes;
  return TABLE[nom] ?? Boxes;
}
