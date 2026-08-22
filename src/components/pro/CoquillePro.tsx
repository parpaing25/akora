import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useMaFiche } from "@/hooks/useMaFiche";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur } from "@/components/ui/etats";
import { CreerFiche } from "./CreerFiche";

const ENTREES = [
  { to: "/pro", libelle: "Tableau de bord", exact: true },
  { to: "/pro/verification", libelle: "Vérification" },
  { to: "/pro/catalogue", libelle: "Catalogue" },
  { to: "/pro/livraison", libelle: "Livraison" },
  { to: "/pro/commandes", libelle: "Commandes" },
  { to: "/pro/portefeuille", libelle: "Portefeuille" },
  { to: "/pro/vitrine", libelle: "Vitrine" },
  { to: "/pro/avis", libelle: "Avis" },
  { to: "/pro/statistiques", libelle: "Statistiques" },
];

/**
 * Coquille de l'espace fournisseur : une barre d'onglets qui défile en mobile,
 * une colonne fixe en desktop (AKORA-DESIGN §9).
 *
 * Tant que la fiche n'existe pas, tout l'espace est remplacé par sa création :
 * il n'y a rien à gérer avant d'avoir un dépôt.
 */
export function CoquillePro() {
  const fiche = useMaFiche();

  if (fiche.isPending) {
    return (
      <div className="container space-y-3 py-8" aria-busy="true">
        <Squelette className="h-8 w-1/2" />
        <Squelette className="h-64 w-full" />
      </div>
    );
  }
  if (fiche.isError) {
    return (
      <div className="container py-8">
        <EtatErreur onReessayer={() => void fiche.refetch()} />
      </div>
    );
  }
  if (!fiche.data) return <CreerFiche />;

  return (
    <div className="container py-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-section">{fiche.data.raison_sociale}</h1>
        </div>
        <div className="mt-1.5">
          <BadgeVerification niveau={fiche.data.niveau_verification} verifieLe={fiche.data.verifie_le} />
        </div>

        <nav aria-label="Espace fournisseur" className="mt-4">
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
        <Outlet context={fiche.data} />
      </div>
    </div>
  );
}
