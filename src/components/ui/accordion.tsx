import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pliant. Sert notamment au « Comment ce prix est calcule ? » du simulateur. */
export const Pliant = AccordionPrimitive.Root;

export const PliantSection = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...reste }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b border-border last:border-0", className)} {...reste} />
));
PliantSection.displayName = "PliantSection";

export const PliantDeclencheur = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...reste }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "group flex min-h-11 flex-1 items-center justify-between gap-2 py-2 text-left text-[0.9375rem] font-semibold",
        className,
      )}
      {...reste}
    >
      {children}
      <ChevronDown
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
PliantDeclencheur.displayName = "PliantDeclencheur";

export const PliantContenu = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...reste }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...reste}
  >
    <div className={cn("pb-3 text-legende text-muted-foreground", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
PliantContenu.displayName = "PliantContenu";
