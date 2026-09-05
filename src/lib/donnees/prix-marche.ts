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

/**
 * L'observatoire des prix : produits actifs du site + relevés anonymisés de
 * la collecte, fusionnés par la RPC `observatoire_prix` (migration
 * 20260902091000). Médiane, jamais moyenne. `fiable` = au moins 3 dépôts
 * distincts — en dessous, le chiffre s'affiche « indicatif », il ne sert
 * pas d'argument.
 */
export interface LigneObservatoire {
  materiau_ref_id: string;
  materiau_slug: string;
  materiau_nom: string;
  famille_slug: string;
  unite: string;
  nb_sources: number;
  nb_depots: number;
  prix_min: number;
  prix_median: number;
  prix_max: number;
  dernier_releve: string;
  fiable: boolean;
}

export async function lireObservatoire(
  famille?: string | null,
  localiteSlug?: string | null,
): Promise<LigneObservatoire[]> {
  // `types.ts` n'est pas régénéré depuis la migration : cast local, à retirer
  // à la prochaine régénération du schéma.
  const client = supabase as unknown as {
    rpc(nom: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("observatoire_prix", {
    _famille: famille ?? null,
    _localite_slug: localiteSlug ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as LigneObservatoire[];
}
