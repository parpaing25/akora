import { cn } from "@/lib/utils";

/**
 * Un camion dessiné, par catégorie — benne, plateau, semi, citerne, camion,
 * léger. Il tangue doucement et ses roues tournent : c'est le seul « décor »
 * de la page des transporteurs, et il dit en un regard de quel véhicule on
 * parle, là où « benne 10 roues » demande de lire.
 *
 * Aucune marque n'est dessinée : la silhouette est générique, exprès.
 */
export type CategorieCamion = "benne" | "plateau" | "semi" | "citerne" | "camion" | "fourgon" | "leger";

const ROUES: Record<CategorieCamion, number[]> = {
  benne: [18, 34, 66],
  plateau: [16, 34, 66],
  semi: [12, 26, 40, 66],
  citerne: [18, 34, 66],
  camion: [20, 66],
  fourgon: [20, 66],
  leger: [22, 62],
};

function Corps({ categorie, couleur }: { categorie: CategorieCamion; couleur: string }) {
  switch (categorie) {
    case "benne":
      return <rect x="2" y="14" width="46" height="24" rx="4" fill={couleur} />;
    case "plateau":
      return (
        <>
          <rect x="2" y="30" width="46" height="8" rx="2" fill="hsl(var(--foreground))" />
          <rect x="6" y="22" width="14" height="8" rx="1" fill="hsl(var(--border))" />
          <rect x="22" y="22" width="14" height="8" rx="1" fill="hsl(var(--border))" />
        </>
      );
    case "semi":
      return <rect x="0" y="10" width="48" height="28" rx="3" fill={couleur} />;
    case "citerne":
      return <rect x="2" y="16" width="46" height="20" rx="10" fill={couleur} />;
    case "leger":
      return <rect x="10" y="26" width="38" height="12" rx="3" fill={couleur} />;
    default:
      return <rect x="2" y="12" width="46" height="26" rx="4" fill={couleur} />;
  }
}

export function IllustrationCamion({
  categorie,
  couleur = "hsl(var(--primary))",
  anime = true,
  className,
}: {
  categorie: CategorieCamion | string | null | undefined;
  couleur?: string;
  anime?: boolean;
  className?: string;
}) {
  const cat: CategorieCamion = (Object.keys(ROUES) as CategorieCamion[]).includes(categorie as CategorieCamion)
    ? (categorie as CategorieCamion)
    : "camion";
  return (
    <svg
      width="84"
      height="52"
      viewBox="0 0 84 52"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", anime && "camion-tangue", className)}
    >
      <Corps categorie={cat} couleur={couleur} />
      <path d="M48 20h16l12 10v8H48V20Z" fill="hsl(var(--foreground))" />
      <rect x="52" y="23" width="9" height="7" rx="1.5" fill="hsl(var(--background))" />
      {ROUES[cat].map((cx) => (
        <g key={cx} className={anime ? "roue-tourne" : undefined}>
          <circle cx={cx} cy="40" r="7" fill="hsl(var(--foreground))" />
          <circle cx={cx} cy="40" r="2.5" fill="hsl(var(--background))" />
        </g>
      ))}
    </svg>
  );
}
