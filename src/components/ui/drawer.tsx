import * as React from "react";
import { Drawer as Vaul } from "vaul";
import { cn } from "@/lib/utils";

/**
 * Tiroir mobile (vaul). Les filtres et les tris passent PAR ICI, jamais par une
 * colonne écrasée sur 360 px (§8).
 */
export const Tiroir = Vaul.Root;
export const TiroirDeclencheur = Vaul.Trigger;
export const TiroirFermeture = Vaul.Close;
export const TiroirTitre = React.forwardRef<
  React.ElementRef<typeof Vaul.Title>,
  React.ComponentPropsWithoutRef<typeof Vaul.Title>
>(({ className, ...reste }, ref) => (
  <Vaul.Title ref={ref} className={cn("text-section", className)} {...reste} />
));
TiroirTitre.displayName = "TiroirTitre";

export const TiroirDescription = Vaul.Description;

export const TiroirContenu = React.forwardRef<
  React.ElementRef<typeof Vaul.Content>,
  React.ComponentPropsWithoutRef<typeof Vaul.Content>
>(({ className, children, ...reste }, ref) => (
  <Vaul.Portal>
    <Vaul.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
    <Vaul.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[88svh] flex-col rounded-t-lg border border-border bg-card",
        className,
      )}
      {...reste}
    >
      <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border" />
      <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </Vaul.Content>
  </Vaul.Portal>
));
TiroirContenu.displayName = "TiroirContenu";
