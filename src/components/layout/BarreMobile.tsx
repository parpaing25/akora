import { NavLink } from "react-router-dom";
import { Home, Layers, ShoppingCart, ClipboardList, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanier, nombreArticles } from "@/lib/panier";

/**
 * Barre inférieure fixe, 5 entrées (AKORA-DESIGN §8).
 * Entrée active en latérite. Chaque cible fait au moins 44 × 44 px.
 */
const ENTREES = [
  { to: "/", libelle: "Fil", Icone: Home, exact: true },
  { to: "/materiaux", libelle: "Matériaux", Icone: Layers, exact: false },
  { to: "/panier", libelle: "Panier", Icone: ShoppingCart, exact: false },
  { to: "/compte/commandes", libelle: "Commandes", Icone: ClipboardList, exact: false },
  { to: "/compte", libelle: "Compte", Icone: User, exact: true },
] as const;

export function BarreMobile() {
  const lignes = usePanier((etat) => etat.lignes);
  const articles = nombreArticles(lignes);

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="grid grid-cols-5">
        {ENTREES.map(({ to, libelle, Icone, exact }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium",
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
                    {articles > 99 ? "99+" : articles}
                  </span>
                ) : null}
              </span>
              {libelle}
              {to === "/panier" && articles > 0 ? (
                <span className="sr-only">{`, ${articles} article${articles > 1 ? "s" : ""}`}</span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
