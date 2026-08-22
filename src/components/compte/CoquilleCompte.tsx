import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const ENTREES = [
  { to: "/compte", libelle: "Profil", exact: true },
  { to: "/compte/commandes", libelle: "Mes commandes" },
  { to: "/compte/paiements", libelle: "Mes paiements" },
  { to: "/compte/favoris", libelle: "Favoris" },
  { to: "/compte/adresses", libelle: "Adresses de chantier" },
  { to: "/compte/securite", libelle: "Sécurité" },
];

/** Espace acheteur : onglets défilants en mobile, colonne fixe en desktop. */
export function CoquilleCompte() {
  const { profil, utilisateur } = useAuth();

  return (
    <div className="container py-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <h1 className="truncate text-section">{profil?.nom_complet ?? "Mon compte"}</h1>
        <p className="truncate text-[0.78rem] text-muted-foreground">{utilisateur?.email}</p>

        <nav aria-label="Mon compte" className="mt-4">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
            {ENTREES.map((entree) => (
              <li key={entree.to} className="shrink-0">
                <NavLink
                  to={entree.to}
                  end={entree.exact}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex min-h-11 w-full items-center whitespace-nowrap rounded-md px-3 text-legende font-semibold",
                      isActive ? "bg-primary-soft text-primary-strong" : "text-muted-foreground hover:bg-muted",
                    )
                  }
                >
                  {entree.libelle}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mt-6 min-w-0 lg:mt-0">
        <Outlet />
      </div>
    </div>
  );
}
