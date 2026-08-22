import * as React from "react";
import { cn } from "@/lib/utils";

/** Champ de saisie : 44 px de haut, rayon 10 px, bordure `border` (§5). */
export const Saisie = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...reste }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-[0.9375rem] text-foreground",
        "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:border-[1.5px]",
        "file:border-0 file:bg-transparent file:text-legende file:font-medium",
        className,
      )}
      {...reste}
    />
  ),
);
Saisie.displayName = "Saisie";

export const ZoneTexte = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 4, ...reste }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "flex w-full rounded-md border border-input bg-card px-3 py-2 text-[0.9375rem] text-foreground",
        "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:border-[1.5px]",
        className,
      )}
      {...reste}
    />
  ),
);
ZoneTexte.displayName = "ZoneTexte";
