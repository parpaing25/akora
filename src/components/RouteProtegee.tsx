import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { RoleApplicatif } from "@/lib/types-metier";
import { Squelette } from "@/components/ui/skeleton";

/**
 * Garde de route. C'est un confort de navigation, PAS une sécurité :
 * l'autorité reste la RLS côté Postgres. Un utilisateur qui forcerait l'URL
 * verrait un écran vide, jamais des données.
 *
 * Elle exige aussi une adresse confirmée. Le 22/08/2026, on pouvait fermer la
 * fenêtre du code et continuer comme si de rien n'était : la vérification
 * n'était qu'un écran. Ici, elle devient un passage obligé — et côté serveur,
 * `paiement-initier` refuse de son côté, parce qu'une garde de route se
 * contourne avec un appel direct à l'API.
 */
export function RouteProtegee({
  children,
  role,
  exigeAdresseConfirmee = true,
}: {
  children: React.ReactNode;
  /** Rôle exigé. Absent = simple connexion requise. */
  role?: RoleApplicatif;
  /** À passer à `false` pour les rares écrans accessibles sans confirmation. */
  exigeAdresseConfirmee?: boolean;
}) {
  const { session, profil, roles, chargement, chargementProfil } = useAuth();
  const emplacement = useLocation();

  const attente = (
    <div className="container space-y-3 py-8" aria-busy="true">
      <Squelette className="h-8 w-2/3" />
      <Squelette className="h-40 w-full" />
    </div>
  );

  if (chargement) return attente;

  if (!session) {
    // On mémorise la destination pour y revenir après connexion.
    return <Navigate to="/connexion" replace state={{ retour: emplacement.pathname + emplacement.search }} />;
  }

  // Le profil n'est pas encore revenu : surtout ne pas conclure « non
  // confirmé » sur une absence de réponse — cela déclencherait l'envoi d'un
  // code à quelqu'un qui a déjà confirmé.
  if (chargementProfil) return attente;

  if (exigeAdresseConfirmee && profil && profil.email_verifie !== true) {
    return <Navigate to="/verification-email" replace state={{ email: session.user.email }} />;
  }

  if (role && !roles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
