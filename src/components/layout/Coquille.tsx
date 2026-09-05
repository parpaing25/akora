import { Outlet, useLocation } from "react-router-dom";
import * as React from "react";
import { EnTete } from "./EnTete";
import { BandeauVerification } from "./BandeauVerification";
import { BandeauIncident } from "./BandeauIncident";
import { BarreMobile } from "./BarreMobile";
import { PiedDePage } from "./PiedDePage";
import { RailGauche, RailDroit } from "./Rails";

/**
 * Coquille de l'application : en-tête collant, contenu, pied de page, et la
 * barre inférieure fixe en mobile (AKORA-DESIGN §8).
 *
 * Le décalage du bas en mobile est géré par le calque global de densité dans
 * index.css (padding-bottom sur body) : aucune page n'a à s'en soucier.
 */
export function Coquille() {
  const { pathname } = useLocation();
  // Les espaces pro et admin ont leur propre navigation en onglets : deux
  // navigations côte à côte se contrediraient.
  const avecRails = !pathname.startsWith("/pro") && !pathname.startsWith("/admin");

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
      <BandeauIncident />
      <main id="contenu" tabIndex={-1} className="flex-1">
        {/* ⭐ LES DEUX RAILS SUR TOUTES LES PAGES (03/09/2026, demande d'Andry).
            Ils vivaient dans l'accueil seul : un clic sur une famille les
            faisait disparaître. Ils sont ici, collants au défilement, rail
            gauche dès 1024 px, rail droit dès 1280 px (voir Rails.tsx pour le
            calcul). Les espaces pro et admin gardent leur propre navigation.
            ⭐ La clé change avec l'adresse : React remonte le contenu, et
              `.page-entree` le fait glisser de 8 px en 220 ms. Éteint sous
              prefers-reduced-motion (index.css). */}
        {avecRails ? (
          <div className="mx-auto grid w-full max-w-[2100px] items-start gap-5 px-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-6 xl:grid-cols-[260px_minmax(0,1fr)_340px] 2xl:grid-cols-[300px_minmax(0,1fr)_380px] 2xl:gap-6 2xl:px-8">
            <RailGauche className="hidden lg:sticky lg:top-[4.5rem] lg:flex lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto" />
            <div key={pathname} className="page-entree colonne-centrale min-w-0">
              <Outlet />
            </div>
            <RailDroit className="hidden xl:sticky xl:top-[4.5rem] xl:flex xl:max-h-[calc(100dvh-5rem)] xl:overflow-y-auto" />
          </div>
        ) : (
          <div key={pathname} className="page-entree">
            <Outlet />
          </div>
        )}
      </main>
      <PiedDePage />
      <BarreMobile />
    </div>
  );
}
