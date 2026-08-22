import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { slugifier } from "@/lib/format";

type Tables = Database["public"]["Tables"];
export type LigneFournisseur = Tables["fournisseurs"]["Row"];
export type FournisseurPublic = Database["public"]["Views"]["fournisseurs_publics"]["Row"];

/**
 * Colonnes lues pour le propriétaire de la fiche. On les énumère au lieu de
 * `select('*')` : la table porte des données personnelles, et une colonne
 * ajoutée plus tard ne doit pas partir sur le réseau sans qu'on l'ait décidé
 * (règle A3).
 */
const COLONNES_FICHE =
  "id, owner_id, raison_sociale, slug, description, logo_url, couverture_url, telephone, whatsapp, email, nif, stat, rcs, adresse, localite_id, lat, lng, horaires, rayon_max_km, coef_sinuosite, assujetti_tva, statut, niveau_verification, verifie_le, note_moyenne, nb_avis, nb_commandes_cloturees, modes_paiement_acceptes, taux_acompte, operateur_versement, msisdn_versement, created_at";

/** La fiche du fournisseur dont l'utilisateur courant est propriétaire ou membre. */
export async function lireMaFiche(userId: string): Promise<LigneFournisseur | null> {
  const { data, error } = await supabase
    .from("fournisseurs")
    .select(COLONNES_FICHE)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as LigneFournisseur) ?? null;
}

/** Slug unique : on suffixe tant que le nom est déjà pris. */
async function slugDisponible(base: string): Promise<string> {
  const racine = slugifier(base).slice(0, 60) || "fournisseur";
  for (let essai = 0; essai < 20; essai++) {
    const candidat = essai === 0 ? racine : `${racine}-${essai + 1}`;
    const { data, error } = await supabase
      .from("fournisseurs_publics")
      .select("id")
      .eq("slug", candidat)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidat;
  }
  return `${racine}-${Date.now().toString(36)}`;
}

export interface CreationFiche {
  raison_sociale: string;
  telephone: string;
  localite_id: string | null;
  lat: number | null;
  lng: number | null;
  adresse: string | null;
}

/** Crée la fiche. Le statut et le niveau de vérification restent hors de portée. */
export async function creerMaFiche(userId: string, valeurs: CreationFiche): Promise<string> {
  const slug = await slugDisponible(valeurs.raison_sociale);
  const { data, error } = await supabase
    .from("fournisseurs")
    .insert({ ...valeurs, owner_id: userId, slug })
    // Toute écriture retourne l'id explicitement : sans `.select('id')`, une
    // insertion « réussie » a déjà produit des lignes fantômes sur Fonenako.
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export type MiseAJourFiche = Partial<
  Pick<
    LigneFournisseur,
    | "raison_sociale"
    | "description"
    | "logo_url"
    | "couverture_url"
    | "telephone"
    | "whatsapp"
    | "email"
    | "nif"
    | "stat"
    | "rcs"
    | "adresse"
    | "localite_id"
    | "lat"
    | "lng"
    | "horaires"
    | "rayon_max_km"
    | "coef_sinuosite"
    | "assujetti_tva"
    | "modes_paiement_acceptes"
    | "taux_acompte"
    | "operateur_versement"
    | "msisdn_versement"
  >
>;

/**
 * Met à jour la fiche. Les colonnes sensibles — statut, niveau de
 * vérification, note, compteurs — sont volontairement absentes du type ; et
 * même si elles étaient envoyées, un trigger en base les remettrait à leur
 * valeur précédente (recette F9).
 */
export async function majMaFiche(id: string, valeurs: MiseAJourFiche): Promise<void> {
  const { error } = await supabase.from("fournisseurs").update(valeurs).eq("id", id).select("id");
  if (error) throw error;
}
