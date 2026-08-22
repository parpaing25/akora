import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { basculerAbonnement } from "@/lib/donnees/fil";
import { useAuth } from "@/hooks/useAuth";

/**
 * « Suivre » un depot.
 *
 * Ecrit une fois, pose a deux endroits : la carte du fil et la fiche du
 * fournisseur. La fiche compte au moins autant que le fil — au lancement, le
 * fil est vide, et si on ne pouvait suivre que depuis lui, personne ne
 * pourrait jamais suivre personne.
 *
 * Suivre declenche une notification a chaque publication du depot (trigger
 * `prevenir_abonnes_publication`) : ce n'est pas un bouton decoratif.
 */
export function BoutonSuivre({
  fournisseurId,
  suiviInitial,
  className,
}: {
  fournisseurId: string;
  /** Connu d'avance dans le fil ; interroge sinon. */
  suiviInitial?: boolean;
  className?: string;
}) {
  const { session, utilisateur } = useAuth();
  const naviguer = useNavigate();
  const client = useQueryClient();
  const [enCours, setEnCours] = React.useState(false);

  const requete = useQuery({
    queryKey: ["abonnement", fournisseurId, utilisateur?.id],
    enabled: suiviInitial === undefined && Boolean(utilisateur),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abonnements")
        .select("fournisseur_id")
        .eq("user_id", utilisateur?.id as string)
        .eq("fournisseur_id", fournisseurId)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });

  const [suivi, setSuivi] = React.useState(suiviInitial ?? false);
  React.useEffect(() => {
    if (suiviInitial === undefined && requete.data !== undefined) setSuivi(requete.data);
  }, [requete.data, suiviInitial]);

  const basculer = async () => {
    if (!session) {
      toast.error("Connectez-vous pour suivre ce fournisseur");
      naviguer("/connexion", { state: { retour: window.location.pathname } });
      return;
    }
    setEnCours(true);
    try {
      const nouvel = await basculerAbonnement(fournisseurId, suivi);
      setSuivi(nouvel);
      await client.invalidateQueries({ queryKey: ["fil"] });
    } catch (erreur) {
      toast.error("Impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void basculer()}
      disabled={enCours}
      aria-pressed={suivi}
      className={
        "min-h-9 shrink-0 rounded-md border px-3 text-legende font-semibold disabled:opacity-60 " +
        (suivi ? "border-border bg-muted text-muted-foreground" : "border-foreground") +
        (className ? " " + className : "")
      }
    >
      {suivi ? "Suivi" : "Suivre"}
    </button>
  );
}
