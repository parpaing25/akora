import { supabase } from "@/integrations/supabase/client";

/**
 * Code de vérification à six chiffres.
 *
 * Repris de Fonenako : le lien de confirmation natif de Supabase partait d'un
 * domaine inconnu du destinataire et finissait en indésirables — les comptes
 * restaient non confirmés. Un code qu'on recopie traverse tout.
 *
 * Les deux fonctions appelées ici sont publiques par nécessité : on les
 * sollicite juste après l'inscription, avant d'avoir une session utilisable.
 * Les garde-fous vivent donc en base : une minute entre deux envois, dix codes
 * par jour et par adresse, cinq tentatives par code, et un plafond par IP.
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
