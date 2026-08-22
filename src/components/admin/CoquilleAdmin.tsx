import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Seo } from "@/components/Seo";

const ENTREES = [
  { to: "/admin", libelle: "Vérifications", exact: true },
  { to: "/admin/materiaux", libelle: "Matériaux demandés" },
  { to: "/admin/paiements", libelle: "Paiements" },
  { to: "/admin/litiges", libelle: "Litiges" },
  { to: "/admin/versements", libelle: "Versements" },
  { to: "/admin/referentiels", libelle: "Référentiels" },
  { to: "/admin/moderation", libelle: "Modération" },
  { to: "/admin/audit", libelle: "Journal d'audit" },
];

/** Administration. Files de traitement en onglets-pills, tableaux, actions (§11). */
export function CoquilleAdmin() {
  return (
    <div className="container py-6">
      <Seo titre="Administration" chemin="/admin" indexable={false} />
      <h1 className="text-page">Administration</h1>

      <nav aria-label="Administration" className="mt-3">
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {ENTREES.map((entree) => (
            <li key={entree.to} className="shrink-0">
              <NavLink
                to={entree.to}
                end={entree.exact}
                className={({ isActive }) =>
                  cn(
                    "inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-3.5 text-legende font-semibold",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )
                }
              >
                {entree.libelle}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-5">
        <Outlet />
      </div>
    </div>
  );
}
