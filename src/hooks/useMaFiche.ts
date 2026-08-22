import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { lireMaFiche, type LigneFournisseur } from "@/lib/donnees/fournisseurs";

/**
 * La fiche fournisseur de l'utilisateur courant.
 * Rafraîchie par react-query, jamais par un abonnement Realtime (règle A2.7).
 */
export function useMaFiche() {
  const { utilisateur } = useAuth();
  const id = utilisateur?.id ?? null;

  const requete = useQuery<LigneFournisseur | null>({
    queryKey: ["ma-fiche", id],
    enabled: Boolean(id),
    staleTime: 2 * 60_000,
    queryFn: () => lireMaFiche(id as string),
  });

  return requete;
}

export function useInvaliderMaFiche() {
  const client = useQueryClient();
  const { utilisateur } = useAuth();
  return () => client.invalidateQueries({ queryKey: ["ma-fiche", utilisateur?.id ?? null] });
}
