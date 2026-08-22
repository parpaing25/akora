import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

export const GroupeRadio = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...reste }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...reste} />
));
GroupeRadio.displayName = "GroupeRadio";

export const Radio = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...reste }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "size-5 shrink-0 rounded-full border border-input bg-card",
      "data-[state=checked]:border-[6px] data-[state=checked]:border-primary",
      "disabled:cursor-not-allowed disabled:bg-muted",
      className,
    )}
    {...reste}
  />
));
Radio.displayName = "Radio";

/** Option de choix pleine largeur : toute la carte est cliquable. */
export function OptionRadio({
  id,
  valeur,
  titre,
  detail,
  desactive,
}: {
  id: string;
  valeur: string;
  titre: React.ReactNode;
  detail?: React.ReactNode;
  desactive?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3",
        "has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary-soft",
        desactive ? "cursor-not-allowed opacity-60" : "",
      )}
    >
      <Radio id={id} value={valeur} disabled={desactive} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold text-foreground">{titre}</span>
        {detail ? <span className="mt-0.5 block text-legende text-muted-foreground">{detail}</span> : null}
      </span>
    </label>
  );
}
