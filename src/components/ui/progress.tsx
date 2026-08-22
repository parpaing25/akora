import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

/**
 * Barre de progression. Deux emplois : le dossier de verification (« 4 pieces
 * sur 6 validees ») et le tunnel de paiement, ou elle est en `accent`.
 */
export const Progression = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { ton?: "primaire" | "accent" }
>(({ className, value, ton = "primaire", ...reste }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    value={value}
    {...reste}
  >
    <ProgressPrimitive.Indicator
      className={cn("h-full transition-all", ton === "accent" ? "bg-accent" : "bg-primary")}
      style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
    />
  </ProgressPrimitive.Root>
));
Progression.displayName = "Progression";
