import * as React from "react";
import * as AlertPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { styleBouton } from "./button";

export const Confirmation = AlertPrimitive.Root;
export const ConfirmationDeclencheur = AlertPrimitive.Trigger;

export const ConfirmationContenu = React.forwardRef<
  React.ElementRef<typeof AlertPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertPrimitive.Content>
>(({ className, ...reste }, ref) => (
  <AlertPrimitive.Portal>
    <AlertPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
    <AlertPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-3 carte p-4",
        className,
      )}
      {...reste}
    />
  </AlertPrimitive.Portal>
));
ConfirmationContenu.displayName = "ConfirmationContenu";

export const ConfirmationTitre = ({ className, ...reste }: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Title>) => (
  <AlertPrimitive.Title className={cn("text-section", className)} {...reste} />
);
export const ConfirmationTexte = ({ className, ...reste }: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Description>) => (
  <AlertPrimitive.Description className={cn("text-legende text-muted-foreground", className)} {...reste} />
);
export const ConfirmationValider = ({ className, ...reste }: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Action>) => (
  <AlertPrimitive.Action className={cn(styleBouton({ variante: "principal" }), className)} {...reste} />
);
export const ConfirmationAnnuler = ({ className, ...reste }: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Cancel>) => (
  <AlertPrimitive.Cancel className={cn(styleBouton({ variante: "secondaire" }), className)} {...reste} />
);
