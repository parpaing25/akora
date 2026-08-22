import { cn } from "@/lib/utils";

/**
 * Squelette à la forme du contenu. Jamais de spinner plein écran (§5).
 * La pulsation d'opacité 0,55 → 1 sur 1,4 s est définie dans tailwind.config.
 */
export function Squelette({ className, ...reste }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("squelette", className)} {...reste} />;
}

/** Squelette d'une carte produit : bloc image 4:3 + trois lignes. */
export function SqueletteCarteProduit() {
  return (
    <div className="carte overflow-hidden">
      <Squelette className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Squelette className="h-4 w-4/5" />
        <Squelette className="h-3 w-3/5" />
        <Squelette className="h-5 w-2/5" />
      </div>
    </div>
  );
}

/** Grille de squelettes, 2 colonnes dès 360 px comme la vraie grille (§8). */
export function GrilleSquelettes({ nombre = 6 }: { nombre?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: nombre }, (_, i) => (
        <SqueletteCarteProduit key={i} />
      ))}
    </div>
  );
}
