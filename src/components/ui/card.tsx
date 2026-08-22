import * as React from "react";
import { cn } from "@/lib/utils";

/** Carte : blanc pur, bord net 1 px, l'unique ombre du produit (§4). */
export const Carte = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...reste }, ref) => <div ref={ref} className={cn("carte", className)} {...reste} />,
);
Carte.displayName = "Carte";

export const CarteEntete = ({ className, ...reste }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4 pb-2 space-y-1", className)} {...reste} />
);
export const CarteTitre = ({ className, ...reste }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-produit", className)} {...reste} />
);
export const CarteDescription = ({ className, ...reste }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-legende text-muted-foreground", className)} {...reste} />
);
export const CarteContenu = ({ className, ...reste }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4 pt-2", className)} {...reste} />
);
export const CartePied = ({ className, ...reste }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center gap-2 p-4 pt-0", className)} {...reste} />
);
