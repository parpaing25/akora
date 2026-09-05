import { supabase } from "@/integrations/supabase/client";

/**
 * Le referentiel, en trois niveaux : famille › type › format.
 *
 * Une liste de 92 references melangees ne se parcourt pas : le parpaing creux
 * 15 y voisinait avec le ciment CEM II. On cherche « hourdis », puis on
 * choisit l'epaisseur — c'est ce que ces trois niveaux reproduisent.
 *
 * Lecture par les vues publiques uniquement : les tables du referentiel sont
 * fermees au visiteur anonyme, comme le reste.
 */

export interface TypeVitrine {
  id: string;
  nom: string;
  nom_mg: string | null;
  slug: string;
  photo: string | null;
  description: string | null;
  ordre: number;
  famille_slug: string;
  famille_nom: string;
  nb_formats: number;
  nb_offres: number;
  nb_fournisseurs: number;
  prix_des: number | null;
  unite: string;
  formats_apercu: { slug: string; libelle_court: string }[];
}

export interface FormatVitrine {
  id: string;
  nom: string;
  slug: string;
  libelle_court: string | null;
  dimensions: string | null;
  photo: string | null;
  unite: string;
  poids_kg_unite: number;
  volume_m3_unite: number;
  ordre_format: number;
  note: string | null;
  type_slug: string;
  type_nom: string;
  famille_slug: string;
  famille_nom: string;
  nb_offres: number;
  nb_offres_verifiees: number;
  prix_des: number | null;
  offre_lat: number | null;
  offre_lng: number | null;
  offre_rayon_max_km: number | null;
  offre_coef_sinuosite: number | null;
  offre_fournisseur_id: string | null;
  /** Ordre de grandeur constate publiquement, tant qu'aucun depot ne publie. */
  prix_indicatif_min: number | null;
  prix_indicatif_max: number | null;
  prix_indicatif_source: string | null;
  prix_indicatif_le: string | null;
}

export type NatureResultat = "type" | "format" | "famille";

export interface ResultatRecherche {
  kind: NatureResultat;
  id: string;
  nom: string;
  famille_nom: string;
  famille_slug: string;
  type_nom: string | null;
  type_slug: string | null;
  format_slug: string | null;
  nb_formats: number | null;
  nb_offres: number | null;
  prix_des: number | null;
  rang: number;
}

const COLONNES_TYPE =
  "id, nom, nom_mg, slug, photo, description, ordre, famille_slug, famille_nom, " +
  "nb_formats, nb_offres, nb_fournisseurs, prix_des, unite, formats_apercu";

export async function listerTypes(familleSlug: string): Promise<TypeVitrine[]> {
  const { data, error } = await supabase
    .from("types_vitrine")
    .select(COLONNES_TYPE)
    .eq("famille_slug", familleSlug)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as TypeVitrine[];
}

export async function listerFormats(typeSlug: string): Promise<FormatVitrine[]> {
  const { data, error } = await supabase
    .from("formats_vitrine")
    .select("*")
    .eq("type_slug", typeSlug)
    // `ordre_format` est numerique : sans lui, 12 / 120 / 15 / 16 / 20.
    .order("ordre_format", { ascending: true })
    .order("nom", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FormatVitrine[];
}

/**
 * Un format seul, avec sa famille et son type — donc de quoi construire son
 * adresse complete. Utile partout ou l'on ne connait que le slug du format.
 */
export async function lireFormat(slug: string): Promise<FormatVitrine | null> {
  const { data, error } = await supabase
    .from("formats_vitrine")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as FormatVitrine) ?? null;
}

/**
 * Autocompletion. Les types remontent AVANT les formats : qui tape « hou »
 * veut les six hourdis d'un coup, pas six lignes presque identiques.
 */
export async function rechercherReferentiel(
  requete: string,
  portee?: string | null,
  limite = 8,
): Promise<ResultatRecherche[]> {
  const { data, error } = await supabase.rpc("rechercher_referentiel", {
    requete,
    portee: portee ?? undefined,
    limite,
  });
  if (error) throw error;
  return (data ?? []) as unknown as ResultatRecherche[];
}

/** L'URL d'un resultat, selon son niveau. */
export function cheminResultat(r: ResultatRecherche): string {
  if (r.kind === "type") return `/materiaux/${r.famille_slug}/${r.type_slug}`;
  if (r.kind === "format") return `/materiaux/${r.famille_slug}/${r.type_slug}/${r.format_slug}`;
  return `/materiaux/${r.famille_slug}`;
}
