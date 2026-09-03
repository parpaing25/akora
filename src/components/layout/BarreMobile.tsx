import { NavLink } from "react-router-dom";
import { Home, Layers, Search, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanier, nombreProduits } from "@/lib/panier";

/**
 * Barre inférieure fixe, 5 entrées (AKORA-DESIGN §8).
 * Entrée active en latérite. Chaque cible fait au moins 44 × 44 px.
 *
 * « Recherche » a remplacé « Commandes » (audit 01/09) : le champ du header
 * est masqué sous 640 px, il n'existait AUCUN accès à la recherche sur
 * mobile. Les commandes restent à un geste, dans Compte.
 */
const ENTREES = [
  { to: "/", libelle: "Fil", Icone: Home, exact: true },
  { to: "/materiaux", libelle: "Matériaux", Icone: Layers, exact: false },
  { to: "/recherche", libelle: "Recherche", Icone: Search, exact: false },
  { to: "/panier", libelle: "Panier", Icone: ShoppingCart, exact: false },
  { to: "/compte", libelle: "Compte", Icone: User, exact: true },
] as const;

export function BarreMobile() {
  const lignes = usePanier((etat) => etat.lignes);
  // Le nombre de PRODUITS, pas la somme des quantites : 1 200 briques
  // saturaient la pastille des le premier ajout.
  const articles = nombreProduits(lignes);

  return (
    <nav
      aria-label="Navigation principale"
      /*
       * `md:hidden`, pas `sm:hidden` : la nav du header n'apparaît qu'à
       * partir de 768 px. Avec `sm:hidden`, la tranche 640-1023 px (tablettes)
       * n'avait AUCUNE navigation — ni barre, ni menu (audit 01/09).
       */
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ENTREES.map(({ to, libelle, Icone, exact }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 text-[0.75rem] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <span className="relative">
                <Icone className="size-5" aria-hidden="true" />
                {to === "/panier" && articles > 0 ? (
                  <span
                    className="nombres absolute -right-2.5 -top-1.5 min-w-[1.1rem] rounded-full bg-primary px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-primary-foreground"
                    aria-hidden="true"
                  >
                    {articles}
                  </span>
                ) : null}
              </span>
              {libelle}
              {to === "/panier" && articles > 0 ? (
                <span className="sr-only">{`, ${articles} produit${articles > 1 ? "s" : ""}`}</span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
