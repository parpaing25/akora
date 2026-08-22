import { supabase } from "@/integrations/supabase/client";
import type { Unite } from "@/lib/types-metier";

/**
 * Le référentiel est une LISTE FERMÉE (spec B4).
 *
 * Ce module sait le LIRE et sait déposer une DEMANDE d'ajout. Il ne sait pas
 * créer un matériau : la politique RLS de `materiaux_ref` n'ouvre l'écriture
 * qu'à un administrateur, et aucune fonction ici ne tente de la contourner.
 * C'est ce qui garantit que deux fournisseurs vendant le même parpaing soient
 * comparables, et que le périmètre gros œuvre tienne sans contrôle de saisie.
 */

export interface MateriauRef {
  id: string;
  nom: string;
  slug: string;
  unite_defaut: Unite;
  poids_kg_unite_defaut: number;
  volume_m3_unite_defaut: number;
  categorie_id: string;
}

const COLONNES =
  "id, nom, slug, unite_defaut, poids_kg_unite_defaut, volume_m3_unite_defaut, categorie_id";

/** Recherche instantanée dans le référentiel, éventuellement bornée à une famille. */
export async function chercherMateriaux(
  terme: string,
  categorieId?: string | null,
  limite = 30,
): Promise<MateriauRef[]> {
  let requete = supabase.from("materiaux_ref").select(COLONNES).eq("actif", true);
  if (categorieId) requete = requete.eq("categorie_id", categorieId);
  const nettoye = terme.trim();
  if (nettoye.length >= 2) requete = requete.ilike("nom", `%${nettoye}%`);
  const { data, error } = await requete.order("nom").limit(limite);
  if (error) throw error;
  return (data ?? []) as unknown as MateriauRef[];
}

export async function lireMateriauParSlug(slug: string): Promise<MateriauRef | null> {
  const { data, error } = await supabase
    .from("materiaux_ref")
    .select(COLONNES)
    .eq("slug", slug)
    .eq("actif", true)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as MateriauRef) ?? null;
}

export interface NouvelleDemandeMateriau {
  fournisseur_id: string;
  nom_propose: string;
  categorie_id: string;
  unite: Unite;
  poids_kg_unite: number;
  volume_m3_unite: number;
  description?: string | null;
  photo_url?: string | null;
}

/**
 * Dépose une demande d'ajout. Le produit qui l'accompagne reste en
 * `en_attente_materiau` : visible dans l'espace pro, jamais publié, jamais
 * dans le comparateur, jamais dans un panier.
 */
export async function demanderAjoutMateriau(demande: NouvelleDemandeMateriau): Promise<string> {
  const { data, error } = await supabase
    .from("demandes_materiau")
    .insert(demande)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export interface DemandeMateriau {
  id: string;
  nom_propose: string;
  statut: "en_attente" | "acceptee" | "refusee";
  motif_refus: string | null;
  materiau_ref_cree_id: string | null;
  created_at: string;
}

export async function listerMesDemandes(fournisseurId: string): Promise<DemandeMateriau[]> {
  const { data, error } = await supabase
    .from("demandes_materiau")
    .select("id, nom_propose, statut, motif_refus, materiau_ref_cree_id, created_at")
    .eq("fournisseur_id", fournisseurId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DemandeMateriau[];
}
