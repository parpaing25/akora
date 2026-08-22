import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { RoleApplicatif } from "@/lib/types-metier";
import { Squelette } from "@/components/ui/skeleton";

/**
 * Garde de route. C'est un confort de navigation, PAS une sécurité :
 * l'autorité reste la RLS côté Postgres. Un utilisateur qui forcerait l'URL
 * verrait un écran vide, jamais des données.
 */
export function RouteProtegee({
  children,
  role,
}: {
  children: React.ReactNode;
  /** Rôle exigé. Absent = simple connexion requise. */
  role?: RoleApplicatif;
}) {
  const { session, roles, chargement } = useAuth();
  const emplacement = useLocation();

  if (chargement) {
    return (
      <div className="container space-y-3 py-8" aria-busy="true">
        <Squelette className="h-8 w-2/3" />
        <Squelette className="h-40 w-full" />
      </div>
    );
  }

  if (!session) {
    // On mémorise la destination pour y revenir après connexion.
    return <Navigate to="/connexion" replace state={{ retour: emplacement.pathname + emplacement.search }} />;
  }

  if (role && !roles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
