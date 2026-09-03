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
       * `lg:hidden` (03/09/2026) : la nav de l'en-tête n'apparaît qu'à partir
       * de 1024 px — en dessous, l'en-tête n'a pas la place de six liens
       * (mesuré : 23 px de débordement à 768). La barre porte donc la
       * navigation jusqu'à 1023 px ; au-delà, l'en-tête et le rail gauche.
       * Aucune largeur ne reste sans navigation (audit 01/09, puis 03/09).
       */
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
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
                  isActive ? "onglet-actif text-primary" : "text-muted-foreground",
                )
              }
            >
              <span className="relative">
                <Icone className="size-5" aria-hidden="true" />
                {to === "/panier" && articles > 0 ? (
                  <span
                    /* ⭐ `key` = le nombre : à chaque changement React remonte la
                       pastille et l'animation rejoue. Sans retour visible, on
                       ajoutait deux fois. */
                    key={articles}
                    className="pop-compteur nombres absolute -right-2.5 -top-1.5 min-w-[1.1rem] rounded-full bg-primary px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-primary-foreground"
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
