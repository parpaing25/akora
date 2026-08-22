import { supabase } from "@/integrations/supabase/client";

/**
 * Statistiques de prix par matériau et par localité.
 *
 * La vue `prix_marche` ne publie une ligne qu'à partir de TROIS offres actives
 * (spec D6). En dessous, un « prix du marché » calculé sur une ou deux annonces
 * n'est pas une statistique : c'est la vitrine d'un fournisseur déguisée en
 * référence. On préfère ne rien afficher.
 */
export interface PrixMarche {
  materiau_ref_id: string;
  localite_id: string;
  nb_offres: number;
  prix_min: number;
  prix_max: number;
  prix_median: number;
  dernier_releve: string;
}

export async function lirePrixMarche(materiauRefId: string, localiteId: string): Promise<PrixMarche | null> {
  const { data, error } = await supabase
    .from("prix_marche")
    .select("materiau_ref_id, localite_id, nb_offres, prix_min, prix_max, prix_median, dernier_releve")
    .eq("materiau_ref_id", materiauRefId)
    .eq("localite_id", localiteId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PrixMarche) ?? null;
}

/** Toutes les paires publiables, pour construire le sitemap. */
export async function listerPrixPublies(): Promise<PrixMarche[]> {
  const { data, error } = await supabase
    .from("prix_marche")
    .select("materiau_ref_id, localite_id, nb_offres, prix_min, prix_max, prix_median, dernier_releve")
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as unknown as PrixMarche[];
}
