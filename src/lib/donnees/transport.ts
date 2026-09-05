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

const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Le 05/09/2026, la page type envoyait « uuid::format » comme fournisseur_id :
 * Postgres répondait 22P02 six fois par page, en silence côté écran. Mieux vaut
 * une erreur nommée en développement qu'un 400 muet en production.
 */
function exigerUuid(valeur: string): string {
  if (!MOTIF_UUID.test(valeur)) {
    throw new Error(`barème de transport : identifiant fournisseur invalide « ${String(valeur).slice(0, 60)} »`);
  }
  return valeur;
}

export async function listerVehicules(fournisseurId: string): Promise<Vehicule[]> {
  const { data, error } = await supabase
    .from("vehicules_livraison")
    .select(COLONNES_VEHICULE)
    .eq("fournisseur_id", exigerUuid(fournisseurId))
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
    .eq("fournisseur_id", exigerUuid(fournisseurId))
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

/**
 * Tous les barèmes d'une page en DEUX requêtes (véhicules, zones) quel que
 * soit le nombre de fournisseurs — l'accueil en faisait 2 par carte (P-05).
 */
export async function listerBaremes(
  fournisseurIds: readonly string[],
): Promise<Map<string, { vehicules: Vehicule[]; zones: Zone[] }>> {
  const ids = [...new Set(fournisseurIds.map((id) => exigerUuid(id)))];
  const par = new Map<string, { vehicules: Vehicule[]; zones: Zone[] }>();
  if (ids.length === 0) return par;
  const [v, z] = await Promise.all([
    supabase
      .from("vehicules_livraison")
      .select(COLONNES_VEHICULE + ", fournisseur_id")
      .in("fournisseur_id", ids)
      .eq("actif", true)
      .order("ordre")
      .order("capacite_m3"),
    supabase.from("zones_livraison").select(COLONNES_ZONE + ", fournisseur_id").in("fournisseur_id", ids).order("rayon_km"),
  ]);
  if (v.error) throw v.error;
  if (z.error) throw z.error;
  for (const id of ids) par.set(id, { vehicules: [], zones: [] });
  for (const ligne of (v.data ?? []) as unknown as (Vehicule & { fournisseur_id: string })[]) par.get(ligne.fournisseur_id)?.vehicules.push(ligne);
  for (const ligne of (z.data ?? []) as unknown as (Zone & { fournisseur_id: string })[]) par.get(ligne.fournisseur_id)?.zones.push(ligne);
  return par;
}
