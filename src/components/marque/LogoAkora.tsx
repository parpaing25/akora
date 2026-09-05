import { cn } from "@/lib/utils";

/**
 * Marque Akora — les fichiers du kit, jamais une redite dessinée à la main.
 *
 * Deux formes, deux usages :
 *   `mark` — le « A » seul, pour les petites surfaces (barre, pied de page).
 *   `logo` — le « A » et le mot, pour l'identification franche.
 *
 * Les images sont servies au double de leur taille d'affichage, avec `width`
 * et `height` posés : pas de flou sur écran dense, pas de saut de mise en page
 * pendant le chargement (règle A4, anti-CLS).
 */
export function LogoAkora({
  variante = "mark",
  sombre = false,
  className,
  prioritaire = false,
  alt = "Akora",
}: {
  variante?: "mark" | "logo";
  /** `""` quand le mot « AKORA » est écrit juste à côté (axe : image-redundant-alt). */
  alt?: string;
  /** `true` sur fond latérite ou béton : la version blanche prend le relais. */
  sombre?: boolean;
  className?: string;
  prioritaire?: boolean;
}) {
  const estLogo = variante === "logo";
  const fichier = estLogo
    ? sombre
      ? "/akora-logo-blanc.png"
      : "/akora-logo.png"
    : sombre
      ? "/akora-mark-blanc.png"
      : "/akora-mark.png";

  return (
    <img
      src={fichier}
      alt={alt}
      width={estLogo ? 132 : 32}
      height={estLogo ? 40 : 32}
      loading={prioritaire ? "eager" : "lazy"}
      decoding={prioritaire ? "sync" : "async"}
      // Ratio explicite : avec `w-auto` seul, Lighthouse comptait l'image comme non
      // dimensionnée et lui attribuait le décalage du pied de page (CLS 0,161, 05/09/2026).
      className={cn(estLogo ? "aspect-[33/10] h-10 w-auto" : "size-8", className)}
    />
  );
}
