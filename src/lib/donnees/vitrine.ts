import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Toute la lecture publique passe par les VUES (règle A3).
 *
 * `fournisseurs` et `produits` sont révoquées pour anon : une requête directe
 * échoue au niveau des GRANT, avant même la RLS. Les vues, elles, exposent une
 * projection sans téléphone, sans e-mail, sans adresse exacte.
 *
 * Aucun `select('*')` non plus : les colonnes sont énumérées, pour qu'une
 * colonne ajoutée demain ne parte pas sur le réseau sans décision.
 */

type Vues = Database["public"]["Views"];
export type FournisseurPublic = Vues["fournisseurs_publics"]["Row"];
export type ProduitPublic = Vues["produits_publics"]["Row"];

export const PAR_PAGE = 20;

const COLONNES_FOURNISSEUR =
  "id, slug, raison_sociale, description, logo_url, couverture_url, nif, stat, rcs, localite_id, lat, lng, horaires, rayon_max_km, coef_sinuosite, assujetti_tva, niveau_verification, verifie_le, note_moyenne, nb_avis, nb_commandes_cloturees, modes_paiement_acceptes, taux_acompte";

const COLONNES_PRODUIT =
  "id, slug, nom_affiche, description, unite, prix_unitaire, prix_promo, prix_maj_le, tva_taux, quantite_min, poids_kg_unite, volume_m3_unite, stock_statut, delai_preparation_jours, photos, caracteristiques, materiau_ref_id, categorie_id, fournisseur_id, fournisseur_slug, fournisseur_nom, fournisseur_niveau, fournisseur_verifie_le, fournisseur_note, fournisseur_nb_avis, fournisseur_localite_id, fournisseur_lat, fournisseur_lng, fournisseur_rayon_max_km, fournisseur_coef_sinuosite, fournisseur_assujetti_tva, fournisseur_modes_paiement, materiau_slug, materiau_nom, categorie_slug, categorie_nom";

export interface FiltresFournisseurs {
  recherche?: string;
  verifiesUniquement?: boolean;
  localiteId?: string | null;
  page?: number;
}

export async function listerFournisseurs(filtres: FiltresFournisseurs = {}): Promise<FournisseurPublic[]> {
  const page = filtres.page ?? 0;
  let requete = supabase.from("fournisseurs_publics").select(COLONNES_FOURNISSEUR);
  if (filtres.verifiesUniquement) requete = requete.in("niveau_verification", ["verifie", "partenaire"]);
  if (filtres.localiteId) requete = requete.eq("localite_id", filtres.localiteId);
  if (filtres.recherche && filtres.recherche.trim().length >= 2) {
    requete = requete.ilike("raison_sociale", `%${filtres.recherche.trim()}%`);
  }
  const { data, error } = await requete
    // Vérifiés d'abord, puis les mieux notés. Le tri est une promesse du badge.
    .order("niveau_verification", { ascending: false })
    .order("note_moyenne", { ascending: false, nullsFirst: false })
    .order("raison_sociale")
    .range(page * PAR_PAGE, page * PAR_PAGE + PAR_PAGE - 1);
  if (error) throw error;
  return (data ?? []) as unknown as FournisseurPublic[];
}

/**
 * Les fournisseurs DU PANIER, par identifiants. Le panier et le tunnel
 * passaient par `listerFournisseurs({ page: 0 })` — les 20 premiers de
 * l'annuaire, triés par badge puis par note. Dès qu'un fournisseur du panier
 * n'était pas dans ce top 20 : coordonnées introuvables, livraison non
 * chiffrée, total faux, paiement en ligne refusé — sans un mot d'explication.
 */
export async function listerFournisseursParIds(ids: readonly string[]): Promise<FournisseurPublic[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("fournisseurs_publics")
    .select(COLONNES_FOURNISSEUR)
    .in("id", ids as string[]);
  if (error) throw error;
  return (data ?? []) as unknown as FournisseurPublic[];
}

export async function lireFournisseur(slug: string): Promise<FournisseurPublic | null> {
  const { data, error } = await supabase
    .from("fournisseurs_publics")
    .select(COLONNES_FOURNISSEUR)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as FournisseurPublic) ?? null;
}

export interface FiltresProduits {
  fournisseurId?: string;
  categorieSlug?: string;
  materiauRefId?: string;
  recherche?: string;
  verifiesUniquement?: boolean;
  page?: number;
}

export async function listerProduits(filtres: FiltresProduits = {}): Promise<ProduitPublic[]> {
  const page = filtres.page ?? 0;
  let requete = supabase.from("produits_publics").select(COLONNES_PRODUIT);
  if (filtres.fournisseurId) requete = requete.eq("fournisseur_id", filtres.fournisseurId);
  if (filtres.categorieSlug) requete = requete.eq("categorie_slug", filtres.categorieSlug);
  if (filtres.materiauRefId) requete = requete.eq("materiau_ref_id", filtres.materiauRefId);
  if (filtres.verifiesUniquement) requete = requete.in("fournisseur_niveau", ["verifie", "partenaire"]);
  if (filtres.recherche && filtres.recherche.trim().length >= 2) {
    const terme = filtres.recherche.trim();
    requete = requete.or(`nom_affiche.ilike.%${terme}%,materiau_nom.ilike.%${terme}%`);
  }
  const { data, error } = await requete
    .order("prix_unitaire")
    .range(page * PAR_PAGE, page * PAR_PAGE + PAR_PAGE - 1);
  if (error) throw error;
  return (data ?? []) as unknown as ProduitPublic[];
}

export async function lireProduit(fournisseurSlug: string, produitSlug: string): Promise<ProduitPublic | null> {
  const { data, error } = await supabase
    .from("produits_publics")
    .select(COLONNES_PRODUIT)
    .eq("fournisseur_slug", fournisseurSlug)
    .eq("slug", produitSlug)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ProduitPublic) ?? null;
}

/**
 * Révélation du téléphone : réservée aux comptes connectés, plafonnée, et
 * JOURNALISÉE côté serveur. C'est la seule sortie des coordonnées — sans
 * elle, l'annuaire des fournisseurs s'aspirerait en une requête.
 */
export async function revelerContact(fournisseurId: string): Promise<{ telephone: string | null; whatsapp: string | null }> {
  const { data, error } = await supabase.rpc("reveler_contact_fournisseur", {
    _fournisseur_id: fournisseurId,
  });
  if (error) throw error;
  const ligne = (data as unknown as { telephone: string | null; whatsapp: string | null }[])?.[0];
  return ligne ?? { telephone: null, whatsapp: null };
}

/** Compteur de vues, agrégé par jour côté base — jamais une ligne par vue. */
export async function compterVue(produitId: string): Promise<void> {
  await supabase.rpc("compter_vue_produit", { _produit_id: produitId });
}

/**
 * Paliers de PLUSIEURS produits en une requête. Le comparateur affiche
 * jusqu'à vingt offres : vingt requêtes séparées, ce serait vingt allers-
 * retours sur une 3G à 185 ms de latence.
 */
export async function listerPaliersGroupes(
  produitIds: readonly string[],
): Promise<Map<string, { quantite_min: number; prix_unitaire: number }[]>> {
  const groupes = new Map<string, { quantite_min: number; prix_unitaire: number }[]>();
  if (produitIds.length === 0) return groupes;
  const { data, error } = await supabase
    .from("produits_paliers")
    .select("produit_id, quantite_min, prix_unitaire")
    .in("produit_id", produitIds as string[])
    .order("quantite_min");
  if (error) throw error;
  for (const ligne of (data ?? []) as unknown as {
    produit_id: string;
    quantite_min: number;
    prix_unitaire: number;
  }[]) {
    const liste = groupes.get(ligne.produit_id) ?? [];
    liste.push({ quantite_min: Number(ligne.quantite_min), prix_unitaire: Number(ligne.prix_unitaire) });
    groupes.set(ligne.produit_id, liste);
  }
  return groupes;
}
