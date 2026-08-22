import { supabase } from "@/integrations/supabase/client";
import { ENV } from "@/lib/env";

/**
 * Connexion par compte Google.
 *
 * Le bouton ne s'affiche que si le fournisseur est REELLEMENT actif sur le
 * projet Supabase. Un bouton « Continuer avec Google » qui renvoie une page
 * d'erreur coûte plus cher en confiance qu'il ne rapporte en confort — et
 * l'activation dépend d'identifiants Google que seul le propriétaire du compte
 * peut créer. On interroge donc le serveur, on ne suppose rien.
 *
 * La réponse est mise en cache pour la session : c'est une configuration, elle
 * ne change pas entre deux clics.
 */

const CLE_CACHE = "akora-fournisseurs-auth";

interface Reglages {
  external?: Record<string, boolean>;
}

let enMemoire: Record<string, boolean> | null = null;

async function fournisseursActifs(): Promise<Record<string, boolean>> {
  if (enMemoire) return enMemoire;

  try {
    const enCache = sessionStorage.getItem(CLE_CACHE);
    if (enCache) {
      enMemoire = JSON.parse(enCache) as Record<string, boolean>;
      return enMemoire;
    }
  } catch {
    // sessionStorage indisponible (navigation privée stricte) : on interroge.
  }

  try {
    const reponse = await fetch(ENV.supabaseUrl + "/auth/v1/settings", {
      headers: { apikey: ENV.supabaseAnonKey },
    });
    if (!reponse.ok) return {};
    const reglages = (await reponse.json()) as Reglages;
    enMemoire = reglages.external ?? {};
    try {
      sessionStorage.setItem(CLE_CACHE, JSON.stringify(enMemoire));
    } catch {
      // Sans cache, on redemandera : ce n'est qu'une requête.
    }
    return enMemoire;
  } catch {
    return {};
  }
}

export async function googleDisponible(): Promise<boolean> {
  return (await fournisseursActifs()).google === true;
}

/**
 * Part chez Google, revient sur `/auth/retour`.
 *
 * La destination finale voyage dans l'URL plutôt qu'en mémoire : l'aller-retour
 * passe par un autre domaine, et rien de ce qui est en mémoire ne survit.
 */
export async function connexionGoogle(retour = "/compte"): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: ENV.siteUrl + "/auth/retour?vers=" + encodeURIComponent(retour),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw new Error(error.message);
}

/**
 * Au retour : Google a déjà vérifié l'adresse, on enregistre ce fait.
 *
 * La fonction en base ne prend aucun paramètre et ne croit que le jeton, signé
 * par GoTrue — le navigateur ne peut donc pas se déclarer « venu de Google ».
 */
export async function confirmerEmailOAuth(): Promise<void> {
  await supabase.rpc("confirmer_email_oauth");
}
