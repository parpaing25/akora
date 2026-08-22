import * as React from "react";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Menu = MenuPrimitive.Root;
export const MenuDeclencheur = MenuPrimitive.Trigger;
export const MenuGroupe = MenuPrimitive.Group;

export const MenuContenu = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content>
>(({ className, sideOffset = 6, align = "end", ...reste }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[12rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow",
        className,
      )}
      {...reste}
    />
  </MenuPrimitive.Portal>
));
MenuContenu.displayName = "MenuContenu";

export const MenuElement = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item>
>(({ className, ...reste }, ref) => (
  <MenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-xs px-2 text-[0.9375rem]",
      "data-[highlighted]:bg-muted data-[highlighted]:outline-none",
      className,
    )}
    {...reste}
  />
));
MenuElement.displayName = "MenuElement";

export const MenuSeparateur = ({ className, ...reste }: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>) => (
  <MenuPrimitive.Separator className={cn("my-1 h-px bg-border", className)} {...reste} />
);

export const MenuEtiquette = ({ className, ...reste }: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Label>) => (
  <MenuPrimitive.Label className={cn("px-2 py-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground", className)} {...reste} />
);
