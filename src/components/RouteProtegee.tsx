import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useParametre } from "@/hooks/useParametre";
import { supabase } from "@/integrations/supabase/client";
import type { RoleApplicatif } from "@/lib/types-metier";
import { Squelette } from "@/components/ui/skeleton";
import { DefiTotp, InscriptionTotp } from "@/components/auth/SecondFacteur";
import { Carte } from "@/components/ui/card";

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

  // Second facteur des administrateurs (audit X-11, 06/09/2026). Deux règles :
  //   · un admin qui a inscrit un facteur doit le passer à chaque session (aal2) ;
  //   · l'inscription devient obligatoire quand parametres.mfa_admin_obligatoire est actif
  //     (à false au départ : Andry inscrit son facteur avant que la porte se ferme).
  // Côté base, exiger_admin() applique la même règle aux fonctions sensibles.
  const exigence = useParametre<{ actif: boolean }>("mfa_admin_obligatoire", { actif: false });
  const niveau = useQuery({
    queryKey: ["aal", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(session) && role === "admin",
    staleTime: 60_000,
  });

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

  if (role === "admin") {
    if (niveau.isLoading) return attente;
    const d = niveau.data;
    if (d && d.currentLevel !== "aal2") {
      if (d.nextLevel === "aal2") return <DefiTotp onValide={() => void niveau.refetch()} />;
      if (exigence.actif) {
        return (
          <div className="container max-w-md py-10">
            <Carte className="p-5">
              <h1 className="text-section">Second facteur obligatoire</h1>
              <p className="mt-2 text-legende text-muted-foreground">
                L'espace d'administration confirme des paiements et libère des séquestres : il exige
                une application d'authentification en plus du mot de passe.
              </p>
              <div className="mt-4">
                <InscriptionTotp onValide={() => void niveau.refetch()} />
              </div>
            </Carte>
          </div>
        );
      }
    }
  }

  return <>{children}</>;
}
