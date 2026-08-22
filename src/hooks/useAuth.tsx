import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RoleApplicatif } from "@/lib/types-metier";

/**
 * Session, profil et rôles.
 *
 * Les rôles NE VIVENT PAS dans `profiles` : ils sont lus dans `user_roles`
 * (règle A3). Un rôle stocké dans une ligne que l'utilisateur peut modifier,
 * c'est une escalade de privilèges en une requête. Côté base, l'autorité reste
 * `has_role(auth.uid(), role)` : ce que renvoie ce hook n'est qu'un confort
 * d'affichage, jamais une garantie de sécurité.
 */

export interface Profil {
  id: string;
  nom_complet: string | null;
  telephone: string | null;
  ville: string | null;
  avatar_url: string | null;
  type_client: "particulier" | "entreprise" | null;
  raison_sociale: string | null;
}

interface ContexteAuth {
  session: Session | null;
  utilisateur: User | null;
  profil: Profil | null;
  roles: RoleApplicatif[];
  /** Vrai tant que la session initiale n'est pas résolue. */
  chargement: boolean;
  aRole: (role: RoleApplicatif) => boolean;
  deconnexion: () => Promise<void>;
}

const Contexte = React.createContext<ContexteAuth | null>(null);

export function FournisseurAuth({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [chargement, setChargement] = React.useState(true);
  const client = useQueryClient();

  React.useEffect(() => {
    // On pose l'écouteur AVANT de lire la session : sinon un rafraîchissement
    // de jeton qui arrive entre les deux passe inaperçu.
    const { data } = supabase.auth.onAuthStateChange((_evenement, nouvelle) => {
      setSession(nouvelle);
      setChargement(false);
      if (!nouvelle) client.clear();
    });
    void supabase.auth.getSession().then(({ data: { session: initiale } }) => {
      setSession(initiale);
      setChargement(false);
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  const idUtilisateur = session?.user.id ?? null;

  const requeteProfil = useQuery({
    queryKey: ["profil", idUtilisateur],
    enabled: Boolean(idUtilisateur),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Profil | null> => {
      // profiles.id EST auth.uid() : on filtre par `id`, jamais par `user_id`.
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nom_complet, telephone, ville, avatar_url, type_client, raison_sociale")
        .eq("id", idUtilisateur as string)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Profil) ?? null;
    },
  });

  const requeteRoles = useQuery({
    queryKey: ["roles", idUtilisateur],
    enabled: Boolean(idUtilisateur),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RoleApplicatif[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", idUtilisateur as string);
      if (error) throw error;
      return ((data ?? []) as unknown as { role: RoleApplicatif }[]).map((l) => l.role);
    },
  });

  const roles = React.useMemo(() => requeteRoles.data ?? [], [requeteRoles.data]);

  const valeur = React.useMemo<ContexteAuth>(
    () => ({
      session,
      utilisateur: session?.user ?? null,
      profil: requeteProfil.data ?? null,
      roles,
      chargement,
      aRole: (role) => roles.includes(role),
      deconnexion: async () => {
        await supabase.auth.signOut();
        client.clear();
      },
    }),
    [session, requeteProfil.data, roles, chargement, client],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useAuth(): ContexteAuth {
  const contexte = React.useContext(Contexte);
  if (!contexte) throw new Error("useAuth doit être utilisé dans <FournisseurAuth>.");
  return contexte;
}
