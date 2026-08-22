import { createClient } from "@supabase/supabase-js";
import { ENV } from "@/lib/env";
import type { Database } from "./types";

/**
 * Client Supabase unique de l'application, typé par le schéma GÉNÉRÉ.
 *
 * Realtime : volontairement bridé. Sur Fonenako, 19 canaux Realtime pesaient
 * 70-80 % de l'egress et ont fait exploser le quota. Ici, un seul abonnement
 * est autorisé dans tout le produit : la table `notifications` (règle A2.7).
 * Tout le reste se rafraîchit avec react-query (staleTime + refetch au focus).
 */
export const supabase = createClient<Database>(ENV.supabaseUrl, ENV.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "akora-auth",
  },
  realtime: { params: { eventsPerSecond: 2 } },
  global: { headers: { "x-application-name": "akora-web" } },
});
