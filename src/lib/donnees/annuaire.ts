import { supabase } from "@/integrations/supabase/client";
import type { NiveauVerification } from "@/lib/types-metier";

/**
 * L'annuaire des depots.
 *
 * Chercher un fournisseur par son nom suppose de le connaitre deja. On cherche
 * « qui vend des hourdis a moins de 25 km de mon chantier » — donc par famille,
 * par type de materiau, par distance et par verification. Tout se decide en
 * SQL, en un appel : filtrer 200 depots dans le navigateur reviendrait a les
 * telecharger tous d'abord.
 */

export interface DepotAnnuaire {
  id: string;
  raison_sociale: string;
  slug: string;
  metier: string | null;
  localite_nom: string | null;
  distance_km: number | null;
  niveau_verification: NiveauVerification;
  note_moyenne: number | null;
  nb_avis: number;
  rayon_max_km: number;
  nb_produits: number;
  photo_depot: string | null;
  logo_url: string | null;
  familles: string[];
  types: string[];
  produit_phare: { nom: string; slug: string; prix: number; unite: string } | null;
}

export type TriAnnuaire = "distance" | "note" | "offres" | "nom";

export interface FiltresAnnuaire {
  lat?: number | null;
  lng?: number | null;
  famille?: string | null;
  type?: string | null;
  verifiesSeulement?: boolean;
  livreChezMoi?: boolean;
  tri?: TriAnnuaire;
}

export async function listerDepots(filtres: FiltresAnnuaire = {}): Promise<DepotAnnuaire[]> {
  const { data, error } = await supabase.rpc("annuaire_fournisseurs", {
    _lat: filtres.lat ?? undefined,
    _lng: filtres.lng ?? undefined,
    _famille: filtres.famille ?? undefined,
    _type: filtres.type ?? undefined,
    _verifies_seulement: filtres.verifiesSeulement ?? false,
    _livre_chez_moi: filtres.livreChezMoi ?? false,
    _tri: filtres.tri ?? "distance",
  });
  if (error) throw error;
  return (data ?? []) as unknown as DepotAnnuaire[];
}

/** Les initiales servent d'avatar quand le depot n'a pas de logo. */
export function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? "")
    .join("");
}
