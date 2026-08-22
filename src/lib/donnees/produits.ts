import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Palier } from "@/lib/paliers";
import { slugifier } from "@/lib/format";
import type { StatutProduit, StatutStock, Unite } from "@/lib/types-metier";

type Tables = Database["public"]["Tables"];
export type LigneProduit = Tables["produits"]["Row"];

const COLONNES =
  "id, fournisseur_id, materiau_ref_id, demande_materiau_id, categorie_id, nom_affiche, slug, description, unite, prix_unitaire, prix_promo, prix_maj_le, tva_taux, quantite_min, poids_kg_unite, volume_m3_unite, stock_statut, delai_preparation_jours, photos, caracteristiques, statut, created_at, updated_at";

/** Le catalogue du fournisseur, brouillons et produits en attente compris. */
export async function listerMesProduits(fournisseurId: string): Promise<LigneProduit[]> {
  const { data, error } = await supabase
    .from("produits")
    .select(COLONNES)
    .eq("fournisseur_id", fournisseurId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LigneProduit[];
}

export async function lireMonProduit(id: string): Promise<LigneProduit | null> {
  const { data, error } = await supabase.from("produits").select(COLONNES).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as LigneProduit) ?? null;
}

export interface SaisieProduit {
  fournisseur_id: string;
  materiau_ref_id: string | null;
  demande_materiau_id: string | null;
  categorie_id: string;
  nom_affiche: string;
  description: string | null;
  unite: Unite;
  prix_unitaire: number;
  prix_promo: number | null;
  tva_taux: number;
  quantite_min: number;
  poids_kg_unite: number;
  volume_m3_unite: number;
  stock_statut: StatutStock;
  delai_preparation_jours: number;
  photos: string[];
  statut: StatutProduit;
}

async function slugDisponible(fournisseurId: string, base: string, produitId?: string): Promise<string> {
  const racine = slugifier(base).slice(0, 70) || "produit";
  for (let essai = 0; essai < 20; essai++) {
    const candidat = essai === 0 ? racine : `${racine}-${essai + 1}`;
    let requete = supabase
      .from("produits")
      .select("id")
      .eq("fournisseur_id", fournisseurId)
      .eq("slug", candidat);
    if (produitId) requete = requete.neq("id", produitId);
    const { data, error } = await requete.maybeSingle();
    if (error) throw error;
    if (!data) return candidat;
  }
  return `${racine}-${Date.now().toString(36)}`;
}

export async function creerProduit(saisie: SaisieProduit): Promise<string> {
  const slug = await slugDisponible(saisie.fournisseur_id, saisie.nom_affiche);
  const { data, error } = await supabase
    .from("produits")
    .insert({ ...saisie, slug })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function majProduit(id: string, saisie: Partial<SaisieProduit>): Promise<void> {
  const { error } = await supabase.from("produits").update(saisie).eq("id", id).select("id");
  if (error) throw error;
}

export async function supprimerProduit(id: string): Promise<void> {
  const { error } = await supabase.from("produits").delete().eq("id", id).select("id");
  if (error) throw error;
}

/**
 * Publication. La base refusera un produit sans référence validée : la
 * contrainte `produits_publiable_avec_reference` est la vraie garantie, ce
 * contrôle-ci n'est qu'un message d'erreur plus lisible (recette F11).
 */
export async function publierProduit(produit: LigneProduit): Promise<void> {
  if (!produit.materiau_ref_id) {
    throw new Error(
      "Ce produit attend encore sa référence dans le catalogue commun. Il sera publiable dès que la demande sera acceptée.",
    );
  }
  await majProduit(produit.id, { statut: "actif" });
}

/* ── Paliers dégressifs ─────────────────────────────────────────────────── */

export async function listerPaliers(produitId: string): Promise<(Palier & { id: string })[]> {
  const { data, error } = await supabase
    .from("produits_paliers")
    .select("id, quantite_min, prix_unitaire")
    .eq("produit_id", produitId)
    .order("quantite_min");
  if (error) throw error;
  return (data ?? []) as unknown as (Palier & { id: string })[];
}

export async function ajouterPalier(produitId: string, palier: Palier): Promise<void> {
  const { error } = await supabase
    .from("produits_paliers")
    .upsert({ produit_id: produitId, ...palier }, { onConflict: "produit_id,quantite_min" })
    .select("id");
  if (error) throw error;
}

export async function supprimerPalier(id: string): Promise<void> {
  const { error } = await supabase.from("produits_paliers").delete().eq("id", id).select("id");
  if (error) throw error;
}
