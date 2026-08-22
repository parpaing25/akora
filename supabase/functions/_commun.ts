import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Socle commun aux Edge Functions d'Akora.
 *
 * La clé `service_role` ne vit QUE dans l'environnement de la plateforme :
 * jamais dans le dépôt, jamais dans le navigateur (règle A2.4). Ces fonctions
 * sont le seul endroit du produit qui peut écrire un montant, un statut de
 * paiement ou une ligne de ledger.
 */

// `x-application-name` n'est pas decoratif dans cette liste : le client
// Supabase du site le pose sur CHAQUE requete (cf. `global.headers`), donc le
// navigateur le declare dans sa requete prealable. Un en-tete demande et non
// autorise fait echouer le preflight, et l'appel n'est jamais emis — d'ou
// « Failed to send a request to the Edge Function », qui ressemble a une panne
// serveur alors que rien n'est parti. Vecu le 22/08/2026 sur l'envoi du code :
// invisible en test, parce qu'un appel depuis Node ne declenche aucun CORS.
export const enTetesCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-application-name, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // Sans cela, chaque appel coute un aller-retour de plus. Sur une 3G, cela se
  // sent.
  "Access-Control-Max-Age": "86400",
};

export function reponse(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...enTetesCors, "Content-Type": "application/json" },
  });
}

export function clientAdmin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const cle = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !cle) throw new Error("Environnement Supabase incomplet dans la fonction.");
  return createClient(url, cle, { auth: { persistSession: false } });
}

/** Identifie l'appelant à partir de son jeton, ou renvoie null (invité). */
export async function utilisateurAppelant(requete: Request): Promise<string | null> {
  const entete = requete.headers.get("Authorization") ?? "";
  const jeton = /^Bearer\s+(.+)$/i.exec(entete)?.[1];
  if (!jeton) return null;
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return null;
  const client = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jeton}` } },
  });
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

/** Plafond horaire, appliqué en base et non dans le navigateur. */
export async function quotaOk(
  client: SupabaseClient,
  cle: string,
  sujet: string,
  plafond: number,
): Promise<boolean> {
  const { data, error } = await client.rpc("consommer_quota", {
    _cle: cle,
    _sujet: sujet,
    _plafond: plafond,
  });
  if (error) return true; // Un quota indisponible ne doit pas bloquer une vente.
  return data !== false;
}

/** Adresse IP de l'appelant, pour le plafond et le journal. */
export function adresse(requete: Request): string {
  return (
    requete.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requete.headers.get("cf-connecting-ip") ??
    "inconnue"
  );
}

export const MOTIF_TELEPHONE = /^\+2613[2-9]\d{7}$/;
