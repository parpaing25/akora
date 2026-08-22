import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Boutons (AKORA-DESIGN §5).
 * Principal = latérite plein. Secondaire = blanc bordé. Tertiaire = muted.
 * Hauteur minimale 44 px partout : c'est aussi la cible tactile imposée.
 * Le bleu n'est JAMAIS un bouton d'action principale (§1).
 */
const styleBouton = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variante: {
        principal: "bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
        secondaire: "bg-card text-foreground border border-foreground hover:bg-muted disabled:border-border disabled:text-muted-foreground",
        tertiaire: "bg-muted text-foreground border border-border hover:bg-muted/70 disabled:text-muted-foreground",
        fantome: "text-foreground hover:bg-muted disabled:text-muted-foreground",
        lien: "text-secondary-strong underline underline-offset-4 hover:decoration-2",
        destructif: "bg-destructive text-destructive-foreground shadow hover:bg-destructive/90",
      },
      taille: {
        // Toute cible tactile fait au moins 44 x 44 px (§8, §12).
        normal: "min-h-11 px-4 text-[0.9375rem]",
        large: "min-h-12 px-6 text-base",
        compact: "min-h-11 px-3 text-legende",
        icone: "min-h-11 min-w-11 p-0",
      },
      pleineLargeur: { true: "w-full", false: "" },
    },
    defaultVariants: { variante: "principal", taille: "normal", pleineLargeur: false },
  },
);

export interface ProprietesBouton
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof styleBouton> {
  asChild?: boolean;
}

export const Bouton = React.forwardRef<HTMLButtonElement, ProprietesBouton>(
  ({ className, variante, taille, pleineLargeur, asChild = false, type, ...reste }, ref) => {
    const Composant = asChild ? Slot : "button";
    return (
      <Composant
        ref={ref}
        // Un bouton dans un formulaire vaut « submit » par défaut en HTML :
        // on force « button » sauf demande explicite, pour éviter les envois
        // accidentels de formulaire.
        type={asChild ? undefined : (type ?? "button")}
        className={cn(styleBouton({ variante, taille, pleineLargeur }), className)}
        {...reste}
      />
    );
  },
);
Bouton.displayName = "Bouton";

export { styleBouton };
