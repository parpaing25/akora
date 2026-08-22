import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Bulle = PopoverPrimitive.Root;
export const BulleDeclencheur = PopoverPrimitive.Trigger;
export const BulleAncre = PopoverPrimitive.Anchor;

export const BulleContenu = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 6, ...reste }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow",
        "animate-in fade-in-0 zoom-in-95",
        className,
      )}
      {...reste}
    />
  </PopoverPrimitive.Portal>
));
BulleContenu.displayName = "BulleContenu";
