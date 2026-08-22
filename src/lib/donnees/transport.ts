import { supabase } from "@/integrations/supabase/client";
import type { Vehicule, Zone } from "@/lib/livraison";

/**
 * Véhicules et zones : le barème de transport d'un fournisseur.
 *
 * Il est PUBLIC en lecture — le simulateur doit pouvoir calculer avant toute
 * connexion — et ne contient aucune donnée personnelle.
 */

const COLONNES_VEHICULE =
  "id, nom, capacite_m3, capacite_kg, prix_par_km, forfait_base, km_inclus, prix_minimum, facturer_aller_retour";
const COLONNES_ZONE = "id, nom, rayon_km, seuil_franco, rayon_franco_km, majoration_pct";

export async function listerVehicules(fournisseurId: string): Promise<Vehicule[]> {
  const { data, error } = await supabase
    .from("vehicules_livraison")
    .select(COLONNES_VEHICULE)
    .eq("fournisseur_id", fournisseurId)
    .eq("actif", true)
    .order("ordre")
    .order("capacite_m3");
  if (error) throw error;
  return (data ?? []) as unknown as Vehicule[];
}

export async function listerZones(fournisseurId: string): Promise<Zone[]> {
  const { data, error } = await supabase
    .from("zones_livraison")
    .select(COLONNES_ZONE)
    .eq("fournisseur_id", fournisseurId)
    .eq("actif", true)
    .order("rayon_km");
  if (error) throw error;
  return (data ?? []) as unknown as Zone[];
}

export type SaisieVehicule = Omit<Vehicule, "id"> & { fournisseur_id: string; ordre?: number };
export type SaisieZone = Omit<Zone, "id"> & { fournisseur_id: string };

export async function enregistrerVehicule(saisie: SaisieVehicule, id?: string): Promise<string> {
  if (id) {
    const { error } = await supabase.from("vehicules_livraison").update(saisie).eq("id", id).select("id");
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase.from("vehicules_livraison").insert(saisie).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function enregistrerZone(saisie: SaisieZone, id?: string): Promise<string> {
  if (id) {
    const { error } = await supabase.from("zones_livraison").update(saisie).eq("id", id).select("id");
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase.from("zones_livraison").insert(saisie).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Désactivation plutôt que suppression : les commandes passées citent le véhicule. */
export async function desactiverVehicule(id: string): Promise<void> {
  const { error } = await supabase
    .from("vehicules_livraison")
    .update({ actif: false })
    .eq("id", id)
    .select("id");
  if (error) throw error;
}

export async function desactiverZone(id: string): Promise<void> {
  const { error } = await supabase.from("zones_livraison").update({ actif: false }).eq("id", id).select("id");
  if (error) throw error;
}
