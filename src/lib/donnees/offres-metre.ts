import { supabase } from "@/integrations/supabase/client";
import type { NiveauVerification } from "@/lib/types-metier";

/**
 * Les offres qui chiffrent un metre.
 *
 * On rend TOUTES les offres d'une reference, pas seulement la moins chere.
 * Akora retient la moins chere rendue par defaut, mais c'est l'acheteur qui
 * decide : le moins cher n'est pas toujours celui qu'on veut — on connait le
 * voisin, il livre le samedi, on lui doit un service. Cacher les autres
 * offres, ce serait choisir a sa place.
 */

export interface OffreMateriau {
  materiau_slug: string;
  materiau_nom: string;
  produit_id: string;
  produit_slug: string;
  produit_nom: string;
  unite: string;
  prix_unitaire: number;
  quantite_min: number;
  stock_statut: "en_stock" | "sur_commande" | "rupture";
  poids_kg_unite: number;
  volume_m3_unite: number;
  fournisseur_id: string;
  fournisseur_slug: string;
  fournisseur_nom: string;
  fournisseur_niveau: NiveauVerification;
  fournisseur_lat: number | null;
  fournisseur_lng: number | null;
  rayon_max_km: number;
  coef_sinuosite: number | null;
  distance_km: number | null;
}

export async function listerOffres(
  slugs: readonly string[],
  point: { lat: number; lng: number } | null,
): Promise<OffreMateriau[]> {
  const utiles = slugs.filter(Boolean);
  if (utiles.length === 0) return [];
  const { data, error } = await supabase.rpc("offres_pour_materiaux", {
    _slugs: utiles as string[],
    _lat: point?.lat ?? undefined,
    _lng: point?.lng ?? undefined,
  });
  if (error) throw error;
  return (data ?? []) as unknown as OffreMateriau[];
}

/** Les offres d'une reference, la moins chere en tete. */
export function offresDe(offres: readonly OffreMateriau[], slug: string | null): OffreMateriau[] {
  if (!slug) return [];
  return offres.filter((o) => o.materiau_slug === slug);
}
