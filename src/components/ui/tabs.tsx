import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Onglets = TabsPrimitive.Root;

/** Onglets-pills à compteur (admin, espace pro) — §11. */
export const OngletsListe = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...reste }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex flex-wrap items-center gap-2 overflow-x-auto", className)}
    {...reste}
  />
));
OngletsListe.displayName = "OngletsListe";

export const OngletDeclencheur = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { compteur?: number }
>(({ className, children, compteur, ...reste }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-border px-3.5 text-legende font-semibold",
      "text-muted-foreground hover:bg-muted",
      "data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background",
      className,
    )}
    {...reste}
  >
    {children}
    {compteur !== undefined && (
      <span
        className={cn(
          "nombres rounded-full px-1.5 text-[0.72rem] font-bold",
          "bg-muted text-muted-foreground",
          "group-data-[state=active]:bg-accent group-data-[state=active]:text-accent-foreground",
        )}
        data-compteur=""
      >
        {compteur}
      </span>
    )}
  </TabsPrimitive.Trigger>
));
OngletDeclencheur.displayName = "OngletDeclencheur";

export const OngletContenu = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...reste }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-4", className)} {...reste} />
));
OngletContenu.displayName = "OngletContenu";
