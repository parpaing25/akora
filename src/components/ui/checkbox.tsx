import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const CaseACocher = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...reste }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer size-5 shrink-0 rounded-xs border border-input bg-card",
      "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      "disabled:cursor-not-allowed disabled:bg-muted",
      className,
    )}
    {...reste}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      <Check className="size-3.5" aria-hidden="true" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
CaseACocher.displayName = "CaseACocher";

/** Case + etiquette cliquable ; la ligne entiere fait 44 px de haut. */
export function LigneCase({
  id,
  etiquette,
  aide,
  ...reste
}: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
  id: string;
  etiquette: React.ReactNode;
  aide?: string;
}) {
  return (
    <div className="flex min-h-11 items-start gap-2.5 py-1.5">
      <CaseACocher id={id} className="mt-0.5" {...reste} />
      <label htmlFor={id} className="cursor-pointer select-none">
        <span className="block text-[0.9375rem] text-foreground">{etiquette}</span>
        {aide ? <span className="block text-[0.78rem] text-muted-foreground">{aide}</span> : null}
      </label>
    </div>
  );
}
