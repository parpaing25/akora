import { supabase } from "@/integrations/supabase/client";

/**
 * Le fil d'accueil.
 *
 * Une seule lecture, la vue `fil_publications` : les tables de base sont
 * fermées au navigateur, la vue est le seul chemin. Elle porte déjà les
 * jointures utiles — dépôt, localité, produits mis en avant — et aucune
 * donnée personnelle.
 *
 * Pagination par CURSEUR, pas par `offset` : un fil bouge pendant qu'on le
 * lit. Avec un offset, une publication qui arrive en tête décale tout, et la
 * page suivante redonne une ligne déjà vue. Le curseur est la date de la
 * dernière publication rendue.
 */

export const TAILLE_PAGE = 10;

export type TypePublication = "stock" | "baisse_prix" | "livraison" | "prix_marche" | "demande";
export type NiveauVerification = "non_verifie" | "en_cours" | "verifie" | "partenaire";

export interface ProduitDuFil {
  id: string;
  slug: string;
  nom_affiche: string;
  unite: string;
  prix_unitaire: number;
  prix_promo: number | null;
  stock_statut: "en_stock" | "sur_commande" | "rupture";
  quantite_min: number;
  poids_kg_unite: number;
  volume_m3_unite: number;
  photo: string | null;
}

export interface Publication {
  id: string;
  type: TypePublication;
  texte: string;
  photos: string[];
  publie_le: string;
  epingle: boolean;
  fournisseur_id: string | null;
  fournisseur_nom: string | null;
  fournisseur_slug: string | null;
  fournisseur_niveau: NiveauVerification | null;
  fournisseur_note: number | null;
  fournisseur_nb_avis: number | null;
  localite_nom: string | null;
  fournisseur_lat: number | null;
  fournisseur_lng: number | null;
  fournisseur_rayon_max_km: number | null;
  fournisseur_coef_sinuosite: number | null;
  suivi: boolean;
  produits: ProduitDuFil[];
}

export type FiltreFil = "proche" | "verifies" | "baisses" | "suivis";

const COLONNES =
  "id, type, texte, photos, publie_le, epingle, fournisseur_id, fournisseur_nom, fournisseur_slug, " +
  "fournisseur_niveau, fournisseur_note, fournisseur_nb_avis, localite_nom, fournisseur_lat, " +
  "fournisseur_lng, fournisseur_rayon_max_km, fournisseur_coef_sinuosite, suivi, produits";

export async function chargerFil(options: {
  curseur: string | null;
  filtre: FiltreFil;
}): Promise<Publication[]> {
  let requete = supabase
    .from("fil_publications")
    .select(COLONNES)
    .order("publie_le", { ascending: false })
    .limit(TAILLE_PAGE);

  if (options.curseur) requete = requete.lt("publie_le", options.curseur);
  if (options.filtre === "verifies") requete = requete.in("fournisseur_niveau", ["verifie", "partenaire"]);
  if (options.filtre === "baisses") requete = requete.eq("type", "baisse_prix");
  if (options.filtre === "suivis") requete = requete.eq("suivi", true);

  const { data, error } = await requete;
  if (error) throw error;
  return (data ?? []) as unknown as Publication[];
}

/** S'abonner, ou se désabonner. Rend le nouvel état. */
export async function basculerAbonnement(fournisseurId: string, suivi: boolean): Promise<boolean> {
  const { data: session } = await supabase.auth.getUser();
  const utilisateur = session.user?.id;
  if (!utilisateur) throw new Error("Connectez-vous pour suivre un fournisseur.");

  if (suivi) {
    // `.select()` même sur un DELETE : sans lui, une suppression refusée par
    // la RLS rend un succès vide, et le bouton repasse à « Suivre » alors que
    // rien n'a bougé en base.
    const { error } = await supabase
      .from("abonnements")
      .delete()
      .eq("user_id", utilisateur)
      .eq("fournisseur_id", fournisseurId)
      .select("fournisseur_id");
    if (error) throw error;
    return false;
  }

  const { error } = await supabase
    .from("abonnements")
    .insert({ user_id: utilisateur, fournisseur_id: fournisseurId })
    .select("fournisseur_id");
  if (error) throw error;
  return true;
}

export interface NouvellePublication {
  type: Exclude<TypePublication, "prix_marche">;
  texte: string;
  photos?: string[];
  fournisseurId?: string | null;
  auteurId?: string | null;
  localiteId?: string | null;
  produitIds?: string[];
  expireLe?: string | null;
}

/**
 * Publie, puis rattache les produits mis en avant.
 *
 * `.select('id')` n'est pas décoratif : sans lui, une insertion refusée par la
 * RLS rend un succès vide, et on croit avoir publié un brouillon fantôme.
 */
export async function publier(entree: NouvellePublication): Promise<string> {
  const { data, error } = await supabase
    .from("publications")
    .insert({
      type: entree.type,
      texte: entree.texte,
      photos: entree.photos ?? [],
      fournisseur_id: entree.fournisseurId ?? null,
      auteur_id: entree.auteurId ?? null,
      localite_id: entree.localiteId ?? null,
      expire_le: entree.expireLe ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  const id = (data as { id: string } | null)?.id;
  if (!id) throw new Error("Publication refusée.");

  const produits = entree.produitIds ?? [];
  if (produits.length > 0) {
    const { error: erreurProduits } = await supabase
      .from("publication_produits")
      .insert(produits.slice(0, 4).map((produitId, ordre) => ({
        publication_id: id,
        produit_id: produitId,
        ordre,
      })))
      .select("publication_id");
    if (erreurProduits) throw erreurProduits;
  }
  return id;
}

/** Retire une publication du fil. L'auteur ne peut jamais la relever. */
export async function retirerPublication(id: string): Promise<void> {
  const { error } = await supabase
    .from("publications")
    .update({ statut: "supprimee" })
    .eq("id", id)
    .select("id");
  if (error) throw error;
}
