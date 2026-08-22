import * as React from "react";
import { Link, type LinkProps } from "react-router-dom";

/**
 * Lien qui déclenche le chargement du chunk de la route cible au survol ou au
 * premier contact tactile (A4). Sur une 3G à 185 ms de RTT, ces quelques
 * centaines de millisecondes gagnées se voient.
 */
export function LienPrecharge({
  precharger,
  onMouseEnter,
  onTouchStart,
  onFocus,
  ...reste
}: LinkProps & { precharger?: () => Promise<unknown> }) {
  const dejaFait = React.useRef(false);

  const declencher = React.useCallback(() => {
    if (dejaFait.current || !precharger) return;
    dejaFait.current = true;
    void precharger().catch(() => {
      // Un préchargement raté n'est pas une erreur : la navigation réessaiera.
      dejaFait.current = false;
    });
  }, [precharger]);

  return (
    <Link
      {...reste}
      onMouseEnter={(e) => {
        declencher();
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        declencher();
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        declencher();
        onFocus?.(e);
      }}
    />
  );
}
