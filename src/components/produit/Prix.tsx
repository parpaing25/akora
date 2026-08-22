import { cn } from "@/lib/utils";
import { formaterAriary, ESPACE_FINE } from "@/lib/format";
import { LIBELLE_UNITE, type Unite } from "@/lib/types-metier";

/**
 * Le prix est le seul vrai objet graphique du produit (AKORA-DESIGN §3).
 * Prix en gros, unité en petit. `tabular-nums` obligatoire — c'est un interdit
 * de design d'afficher un prix sans (§14).
 *
 * Le prix AU DÉPÔT reste en noir ; seul le prix RENDU CHANTIER est en latérite.
 */
export function Prix({
  montant,
  unite,
  taille = "normal",
  rendu = false,
  fiscalite,
  className,
}: {
  montant: number;
  unite?: Unite | null;
  taille?: "compact" | "normal" | "grand";
  /** `true` = prix rendu chantier : latérite. */
  rendu?: boolean;
  /** « HT » ou « TTC ». Jamais les deux dans un même total (§3). */
  fiscalite?: "HT" | "TTC" | null;
  className?: string;
}) {
  const tailles = {
    compact: "text-[0.9375rem]",
    normal: "text-[1.125rem]",
    grand: "text-[1.375rem]",
  } as const;

  return (
    <span className={cn("nombres inline-flex items-baseline gap-1", className)}>
      <span className={cn("font-bold tracking-tight", tailles[taille], rendu ? "text-primary" : "text-foreground")}>
        {formaterAriary(montant)}
      </span>
      {fiscalite ? <span className="text-[0.78rem] font-semibold text-muted-foreground">{fiscalite}</span> : null}
      {unite ? (
        <span className="text-[0.8125rem] text-muted-foreground">{`/${ESPACE_FINE}${LIBELLE_UNITE[unite]}`}</span>
      ) : null}
    </span>
  );
}
