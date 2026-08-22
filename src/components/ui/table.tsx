import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tableaux (§9). Deux tetes possibles : `muted` pour l'espace pro,
 * `foreground` (sombre) pour le comparateur et les files admin.
 * Le conteneur defile horizontalement : le corps de page ne defile JAMAIS.
 */
export function Tableau({
  className,
  conteneurClassName,
  ...reste
}: React.TableHTMLAttributes<HTMLTableElement> & { conteneurClassName?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-lg border border-border bg-card", conteneurClassName)}>
      <table className={cn("w-full caption-bottom border-collapse text-legende", className)} {...reste} />
    </div>
  );
}

export const TableauTete = ({
  sombre = false,
  className,
  ...reste
}: React.HTMLAttributes<HTMLTableSectionElement> & { sombre?: boolean }) => (
  <thead
    className={cn(
      sombre ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
      "[&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold",
      className,
    )}
    {...reste}
  />
);

export const TableauCorps = ({ className, ...reste }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody
    className={cn(
      "[&_tr]:border-t [&_tr]:border-border [&_tr:nth-child(even)]:bg-muted/40",
      "[&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle",
      className,
    )}
    {...reste}
  />
);

export const TableauPied = ({ className, ...reste }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tfoot className={cn("border-t border-border bg-muted/40 [&_td]:px-3 [&_td]:py-2", className)} {...reste} />
);
