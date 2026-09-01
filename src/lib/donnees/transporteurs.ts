import { supabase } from "@/integrations/supabase/client";

/**
 * Les transporteurs indépendants — la catégorie demandée le 01/09/2026.
 *
 * Un transporteur est un fournisseur de `nature` 'transporteur' ou 'mixte' :
 * il ne vend pas forcément de matériaux, il loue ses camions. La vue
 * `transporteurs_publics` (migration 20260902090000) expose sa fiche et sa
 * flotte, SANS téléphone ni e-mail — le contact passe par la fiche, comme
 * pour les dépôts.
 *
 * Règle A2.8 : « 10 roues » est la mesure malgache de la taille d'un camion.
 * On l'affiche telle quelle ; une capacité absente reste absente, elle ne se
 * déduit jamais du nombre de roues.
 */
export interface VehiculeTransporteur {
  nom: string | null;
  marque: string | null;
  modele: string | null;
  categorie: string | null;
  nb_roues: number | null;
  capacite_m3: number | null;
  capacite_kg: number | null;
  prix_par_km: number | null;
  forfait_base: number | null;
  km_inclus: number | null;
  prix_minimum: number | null;
  facturer_aller_retour: boolean | null;
  materiaux_acceptes: string[] | null;
  photo_url: string | null;
}

export interface TransporteurPublic {
  id: string;
  slug: string;
  raison_sociale: string;
  description: string | null;
  logo_url: string | null;
  couverture_url: string | null;
  photo_depot: string | null;
  localite_id: string | null;
  localite_nom: string | null;
  lat: number | null;
  lng: number | null;
  rayon_max_km: number | null;
  niveau_verification: string;
  note_moyenne: number | null;
  nb_avis: number | null;
  nature: "transporteur" | "mixte";
  vehicules: VehiculeTransporteur[];
}

/** Libellés des catégories de véhicules — le vocabulaire du terrain. */
export const LIBELLE_CATEGORIE_VEHICULE: Record<string, string> = {
  benne: "Camion benne",
  plateau: "Plateau",
  semi: "Semi-remorque",
  citerne: "Citerne / toupie",
  camion: "Camion",
  fourgon: "Fourgon",
  leger: "Pick-up / léger",
};

export async function listerTransporteurs(): Promise<TransporteurPublic[]> {
  // `types.ts` n'est pas régénéré depuis la migration : cast local, à retirer
  // à la prochaine régénération du schéma.
  const client = supabase as unknown as {
    from(vue: string): {
      select(colonnes: string): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
  const { data, error } = await client
    .from("transporteurs_publics")
    .select(
      "id, slug, raison_sociale, description, logo_url, couverture_url, photo_depot, localite_id, localite_nom, lat, lng, rayon_max_km, niveau_verification, note_moyenne, nb_avis, nature, vehicules",
    );
  if (error) throw new Error(error.message);
  return (data ?? []) as TransporteurPublic[];
}
