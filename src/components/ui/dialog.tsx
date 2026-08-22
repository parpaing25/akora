import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialogue = DialogPrimitive.Root;
export const DialogueDeclencheur = DialogPrimitive.Trigger;
export const DialogueFermeture = DialogPrimitive.Close;
export const DialogueTitre = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...reste }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-section", className)} {...reste} />
));
DialogueTitre.displayName = "DialogueTitre";

export const DialogueDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...reste }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-legende text-muted-foreground", className)} {...reste} />
));
DialogueDescription.displayName = "DialogueDescription";

export const DialogueContenu = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { sansFermeture?: boolean }
>(({ className, children, sansFermeture = false, ...reste }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-3",
        "carte p-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className,
      )}
      {...reste}
    >
      {children}
      {sansFermeture ? null : (
        <DialogPrimitive.Close
          className="absolute right-2 top-2 inline-flex cible-44 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Fermer"
        >
          <X className="size-5" aria-hidden="true" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogueContenu.displayName = "DialogueContenu";
