import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

type ProprietesCurseur = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  /**
   * Nom lu par le lecteur d'écran sur le pouce (`role="slider"`). Obligatoire :
   * le `<label htmlFor>` vise la racine Radix, jamais le pouce, et axe relevait
   * `aria-input-field-name` sur le comparateur et les calculateurs (05/09/2026, A-02).
   */
  etiquette: string;
};

/** Curseur. Emploi principal : la quantite, en tete du comparateur (§7). */
export const Curseur = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, ProprietesCurseur>(
  ({ className, etiquette, ...reste }, ref) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center py-3", className)}
      {...reste}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-border">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={etiquette}
        className="block size-6 rounded-full border-2 border-primary bg-card shadow"
      />
    </SliderPrimitive.Root>
  ),
);
Curseur.displayName = "Curseur";
