import { supabase } from "@/integrations/supabase/client";
import type { TypeLocalite } from "@/lib/types-metier";

/**
 * Recherche de lieu dans la table `localites` — jamais un géocodeur externe
 * (règle A2.3). Une localité sans coordonnées ressort quand même : le site
 * affiche alors « distance non calculable » plutôt que d'inventer un point.
 */
export interface Localite {
  id: string;
  nom: string;
  type: TypeLocalite;
  lat: number | null;
  lng: number | null;
  slug: string;
}

const COLONNES = "id, nom, type, lat, lng, slug";

export async function chercherLocalites(terme: string, limite = 20): Promise<Localite[]> {
  const nettoye = terme.trim();
  let requete = supabase.from("localites").select(COLONNES);
  if (nettoye.length >= 2) requete = requete.ilike("nom", `%${nettoye}%`);
  const { data, error } = await requete.order("type").order("nom").limit(limite);
  if (error) throw error;
  return (data ?? []) as unknown as Localite[];
}

export async function lireLocalite(id: string): Promise<Localite | null> {
  const { data, error } = await supabase.from("localites").select(COLONNES).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as Localite) ?? null;
}
