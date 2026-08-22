import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const FournisseurInfobulle = TooltipPrimitive.Provider;
export const Infobulle = TooltipPrimitive.Root;
export const InfobulleDeclencheur = TooltipPrimitive.Trigger;

export const InfobulleContenu = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...reste }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-[16rem] rounded-md border border-border bg-popover px-2.5 py-2 text-[0.78rem] leading-snug text-popover-foreground shadow",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...reste}
    />
  </TooltipPrimitive.Portal>
));
InfobulleContenu.displayName = "InfobulleContenu";
