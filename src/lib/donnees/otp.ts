import { supabase } from "@/integrations/supabase/client";

/**
 * Codes à six chiffres : inscription ET mot de passe oublié.
 *
 * Repris de Fonenako : le lien de confirmation natif de Supabase partait d'un
 * domaine inconnu du destinataire et finissait en indésirables — les comptes
 * restaient non confirmés. Un code qu'on recopie traverse tout.
 *
 * Les fonctions appelées ici sont publiques par nécessité : on les sollicite
 * juste après l'inscription, avant d'avoir une session utilisable, ou quand on
 * a justement perdu son mot de passe. Les garde-fous vivent donc en base : une
 * minute entre deux envois, dix codes par jour et par adresse, cinq tentatives
 * par code, et un plafond par IP.
 */

async function invoquer(fonction: string, corps: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(fonction, { body: corps });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error((detail as { erreur?: string } | null)?.erreur ?? error.message);
  }
  return data as Record<string, unknown>;
}

export async function envoyerCode(userId: string, email: string): Promise<void> {
  await invoquer("envoyer-code", { userId, email });
}

/** `true` si le code est bon. Une erreur seulement si l'appel a échoué. */
export async function verifierCode(email: string, code: string): Promise<boolean> {
  const resultat = await invoquer("verifier-code", { email, code });
  return resultat.valide === true;
}

/**
 * Demande un code de réinitialisation.
 *
 * Ne dit JAMAIS si l'adresse est inscrite : la réponse est identique dans les
 * deux cas, jusqu'au délai d'attente. Sans cela, ce formulaire deviendrait un
 * annuaire des comptes existants.
 */
export async function demanderCodeMotDePasse(email: string): Promise<void> {
  await invoquer("mot-de-passe-code", { email });
}

/** Échange le code contre un nouveau mot de passe. Lève si le code est faux. */
export async function reinitialiserMotDePasse(
  email: string,
  code: string,
  motDePasse: string,
): Promise<void> {
  await invoquer("mot-de-passe-reinitialiser", { email, code, motDePasse });
}
