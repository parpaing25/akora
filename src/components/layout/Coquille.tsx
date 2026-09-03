import { Outlet, useLocation } from "react-router-dom";
import * as React from "react";
import { EnTete } from "./EnTete";
import { BandeauVerification } from "./BandeauVerification";
import { BarreMobile } from "./BarreMobile";
import { PiedDePage } from "./PiedDePage";

/**
 * Coquille de l'application : en-tête collant, contenu, pied de page, et la
 * barre inférieure fixe en mobile (AKORA-DESIGN §8).
 *
 * Le décalage du bas en mobile est géré par le calque global de densité dans
 * index.css (padding-bottom sur body) : aucune page n'a à s'en soucier.
 */
export function Coquille() {
  const { pathname } = useLocation();

  // À chaque changement de route, on remonte en haut et on annonce la page.
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow"
      >
        Aller au contenu
      </a>
      <EnTete />
      <BandeauVerification />
      <main id="contenu" tabIndex={-1} className="flex-1">
        {/* ⭐ La clé change avec l'adresse : React remonte le contenu, et
            `.page-entree` le fait glisser de 8 px en 220 ms. Assez pour
            sentir l'écran changer, trop peu pour attendre. Éteint sous
            prefers-reduced-motion (index.css). */}
        <div key={pathname} className="page-entree">
          <Outlet />
        </div>
      </main>
      <PiedDePage />
      <BarreMobile />
    </div>
  );
}
