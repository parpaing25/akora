import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Pastilles d'état. Les couleurs success/destructive ne servent QU'à des statuts (§1). */
const stylePastille = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.78rem] font-semibold leading-5",
  {
    variants: {
      ton: {
        neutre: "bg-muted text-muted-foreground",
        primaire: "bg-primary-soft text-primary-strong",
        info: "bg-secondary-soft text-secondary-strong",
        attention: "bg-accent-soft text-accent-strong",
        succes: "bg-success-soft text-success-strong",
        danger: "bg-destructive-soft text-destructive-strong",
        contour: "border border-dashed border-border text-muted-foreground",
      },
    },
    defaultVariants: { ton: "neutre" },
  },
);

export interface ProprietesPastille
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof stylePastille> {}

export function Pastille({ className, ton, ...reste }: ProprietesPastille) {
  return <span className={cn(stylePastille({ ton }), className)} {...reste} />;
}

export { stylePastille };
