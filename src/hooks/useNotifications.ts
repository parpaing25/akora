import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Notifications.
 *
 * C'EST LE SEUL ABONNEMENT REALTIME DE TOUT LE PRODUIT (règle A2.7). Sur
 * Fonenako, dix-neuf canaux Realtime pesaient 70 à 80 % de l'egress et ont
 * fait exploser le quota. Ici : une table, un canal, filtré sur le seul
 * destinataire — et rien d'autre n'a le droit d'en ouvrir un.
 */
export interface Notification {
  id: string;
  titre: string;
  corps: string | null;
  lien: string | null;
  categorie: string;
  lue: boolean;
  created_at: string;
}

export function useNotifications() {
  const { utilisateur } = useAuth();
  const client = useQueryClient();
  const id = utilisateur?.id ?? null;

  const requete = useQuery({
    queryKey: ["notifications", id],
    enabled: Boolean(id),
    staleTime: 60_000,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, titre, corps, lien, categorie, lue, created_at")
        .eq("user_id", id as string)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as Notification[];
    },
  });

  React.useEffect(() => {
    if (!id) return;
    const canal = supabase
      .channel("notifications-" + id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + id },
        () => {
          void client.invalidateQueries({ queryKey: ["notifications", id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [id, client]);

  const marquerLue = React.useCallback(
    async (notificationId: string) => {
      await supabase.from("notifications").update({ lue: true }).eq("id", notificationId).select("id");
      await client.invalidateQueries({ queryKey: ["notifications", id] });
    },
    [client, id],
  );

  const marquerToutesLues = React.useCallback(async () => {
    if (!id) return;
    await supabase
      .from("notifications")
      .update({ lue: true })
      .eq("user_id", id)
      .eq("lue", false)
      .select("id");
    await client.invalidateQueries({ queryKey: ["notifications", id] });
  }, [client, id]);

  const nonLues = (requete.data ?? []).filter((n) => !n.lue).length;

  return { ...requete, nonLues, marquerLue, marquerToutesLues };
}
