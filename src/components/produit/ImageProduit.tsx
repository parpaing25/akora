import * as React from "react";

/**
 * Vignettes o2switch. Le serveur génère un `.thumb.webp` 480 px à côté de
 * l'original ; les listes affichent la vignette, la fiche l'original (A4).
 *
 * `getThumbUrl` ne transforme QUE les URL qui contiennent `/uploads/` : une
 * URL externe ou un chemin local ressort inchangé.
 */
export function getThumbUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes("/uploads/")) return url;
  return url.replace(/\.(jpe?g|png|webp)(\?.*)?$/i, ".thumb.webp$2");
}

export interface ProprietesImageProduit {
  src: string | null | undefined;
  alt: string;
  /** `vignette` en liste, `original` sur la fiche. */
  variante?: "vignette" | "original";
  className?: string;
  /** L'image du bandeau d'accueil n'est JAMAIS en lazy (A4). */
  prioritaire?: boolean;
}

export function ImageProduit({
  src,
  alt,
  variante = "vignette",
  className,
  prioritaire = false,
}: ProprietesImageProduit) {
  const original = src ?? null;
  const [source, setSource] = React.useState(() =>
    variante === "vignette" ? getThumbUrl(original) : original,
  );

  React.useEffect(() => {
    setSource(variante === "vignette" ? getThumbUrl(original) : original);
  }, [original, variante]);

  if (!source) {
    // Placeholder neutre : aspect-ratio figé pour ne rien décaler (anti-CLS).
    return <div className={className} aria-hidden="true" style={{ backgroundColor: "hsl(var(--muted))" }} />;
  }

  return (
    <img
      src={source}
      alt={alt}
      className={className}
      loading={prioritaire ? "eager" : "lazy"}
      decoding={prioritaire ? "sync" : "async"}
      // La vignette peut ne pas encore exister (génération serveur asynchrone) :
      // on retombe alors sur l'original plutôt que d'afficher un trou.
      onError={() => {
        if (original && source !== original) setSource(original);
      }}
    />
  );
}
