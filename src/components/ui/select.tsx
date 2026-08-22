import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Liste = SelectPrimitive.Root;
export const ListeGroupe = SelectPrimitive.Group;
export const ListeValeur = SelectPrimitive.Value;

export const ListeDeclencheur = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...reste }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-[0.9375rem]",
      "data-[placeholder]:text-muted-foreground disabled:bg-muted disabled:text-muted-foreground",
      "aria-[invalid=true]:border-destructive aria-[invalid=true]:border-[1.5px]",
      className,
    )}
    {...reste}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
ListeDeclencheur.displayName = "ListeDeclencheur";

export const ListeContenu = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...reste }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow",
        position === "popper" && "w-[var(--radix-select-trigger-width)]",
        className,
      )}
      {...reste}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
ListeContenu.displayName = "ListeContenu";

export const ListeEtiquette = ({
  className,
  ...reste
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>) => (
  <SelectPrimitive.Label
    className={cn("px-2 py-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground", className)}
    {...reste}
  />
);

export const ListeElement = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...reste }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex min-h-11 w-full cursor-default select-none items-center rounded-xs py-1.5 pl-8 pr-2 text-[0.9375rem]",
      "data-[highlighted]:bg-muted data-[highlighted]:outline-none data-[disabled]:text-muted-foreground",
      className,
    )}
    {...reste}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4 text-primary" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
ListeElement.displayName = "ListeElement";
