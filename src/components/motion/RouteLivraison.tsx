import { cn } from "@/lib/utils";
import { formaterAriary } from "@/lib/format";

/**
 * Le trajet du dépôt au chantier — LE geste de la V2 (02/09/2026).
 *
 * Un prix rendu chantier n'est pas un chiffre de plus : c'est le matériau
 * qui voyage. Le camion part du dépôt, arrive au chantier, et le total
 * apparaît — l'acheteur VOIT ce qu'il paie. Deux formes :
 *   - « ligne »  : compacte, pour la carte du fil ;
 *   - « courbe » : la carte de la fiche produit, avec les deux lieux nommés.
 *
 * Rien n'est animé sans point de livraison connu : on n'invente pas de
 * trajet (B6). Sous prefers-reduced-motion, l'état final s'affiche d'emblée.
 */
export interface ProprietesRouteLivraison {
  variante?: "ligne" | "courbe";
  /** Nom du dépôt (« Sabotsy Namehana »). */
  depart: string;
  /** Nom du chantier (« Ankadindramamy », « mon chantier »). */
  arrivee: string;
  distanceKm: number | null;
  /** Le total rendu chantier. */
  montant: number;
  /** « 100 pièces, livrées ». */
  legende?: string;
  /** « camion benne 8 m³ · 1 voyage ». */
  sousTitre?: string;
  className?: string;
}

const CAMION = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <path d="M15 18H9" />
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <circle cx="17" cy="18" r="2" />
    <circle cx="7" cy="18" r="2" />
  </svg>
);

function km(distanceKm: number | null): string {
  return distanceKm == null ? "" : `${distanceKm.toFixed(1).replace(".", ",")} km`;
}

export function RouteLivraison({
  variante = "ligne",
  depart,
  arrivee,
  distanceKm,
  montant,
  legende,
  sousTitre,
  className,
}: ProprietesRouteLivraison) {
  if (variante === "courbe") {
    // Le tracé est en coordonnées du viewBox : le camion, un groupe SVG, suit
    // le même chemin — tout se met à l'échelle avec la largeur disponible.
    const trajet = "M 30 96 C 90 30, 190 150, 300 70";
    return (
      <div className={cn("nombres", className)}>
        <svg viewBox="0 0 358 170" className="h-auto w-full" aria-hidden="true">
          <path className="trace" d={trajet} fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
          <circle cx="30" cy="96" r="7" fill="hsl(var(--foreground))" />
          <text x="10" y="126" fontSize="11.5" fill="hsl(var(--muted-foreground))">{depart}</text>
          <circle cx="300" cy="70" r="9" fill="hsl(var(--primary))" />
          <circle cx="300" cy="70" r="16" fill="none" stroke="hsl(var(--primary))" strokeOpacity=".25" strokeWidth="2" />
          <text x="322" y="40" textAnchor="end" fontSize="11.5" fontWeight="600" fill="hsl(var(--primary))">{arrivee}</text>
          {sousTitre || distanceKm != null ? (
            <text x="179" y="164" textAnchor="middle" fontSize="12" fill="hsl(var(--muted-foreground))">
              {[km(distanceKm), sousTitre].filter(Boolean).join(" · ")}
            </text>
          ) : null}
          <g className="camion-trajet" style={{ ["--trajet" as string]: `path("${trajet}")` }}>
            <rect x="-16" y="-16" width="32" height="32" rx="10" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
            <g transform="translate(-10 -10) scale(0.85)" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
              <path d="M15 18H9" />
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
              <circle cx="17" cy="18" r="2" />
              <circle cx="7" cy="18" r="2" />
            </g>
          </g>
        </svg>
        <div className="prix-pop mt-1 border-t border-dashed border-border pt-3">
          <p className="text-[2rem] font-extrabold leading-none tracking-tight text-primary">{formaterAriary(montant)}</p>
          {legende ? <p className="mt-1 text-legende text-muted-foreground">{legende}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("nombres", className)}>
      <div className="relative h-[52px]">
        <span className="absolute left-0 top-0 text-[0.69rem] text-muted-foreground">
          dépôt{distanceKm != null ? ` · ${km(distanceKm)}` : ""}
        </span>
        <span className="absolute right-0 top-0 text-[0.69rem] font-semibold text-primary">{arrivee}</span>
        <span className="ligne-trace absolute left-[20px] right-[20px] top-[36px] border-t-2 border-dashed border-border" aria-hidden="true" />
        <span className="absolute left-[15px] top-[31px] size-2.5 rounded-full bg-foreground" aria-hidden="true" />
        <span className="absolute right-[14px] top-[30px] size-3 rounded-full bg-primary" aria-hidden="true" />
        <span
          className="camion-ligne absolute top-[14px] inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-primary"
          aria-hidden="true"
        >
          {CAMION}
        </span>
      </div>
      <div className="prix-pop flex items-baseline justify-between gap-2 pt-1">
        <p className="text-legende text-muted-foreground">{legende ?? `livré à ${arrivee}`}</p>
        <p className="text-[1.5rem] font-extrabold leading-none tracking-tight text-primary">{formaterAriary(montant)}</p>
      </div>
      <span className="sr-only">
        Du dépôt {depart} à {arrivee}{distanceKm != null ? `, ${km(distanceKm)}` : ""} : {formaterAriary(montant)} rendu chantier.
      </span>
    </div>
  );
}
