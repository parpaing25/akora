import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

/** Étiquette 13 px / 600, au-dessus du champ (AKORA-DESIGN §5). */
export const Etiquette = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...reste }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("block text-legende font-semibold text-foreground", className)}
    {...reste}
  />
));
Etiquette.displayName = "Etiquette";
