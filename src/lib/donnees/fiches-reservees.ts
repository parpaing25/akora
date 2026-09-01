import { supabase } from "@/integrations/supabase/client";

/**
 * Fiches réservées (migration « fiches_reservees ») et activation du rôle
 * fournisseur (migration « devenir_fournisseur »).
 *
 * ⚠️ Ces RPC ne figurent pas encore dans src/integrations/supabase/types.ts :
 * ce fichier est GÉNÉRÉ (« Ne pas modifier a la main », règle A7) et ne sera
 * régénéré par `npm run types:gen` qu'APRÈS application des migrations. D'ici
 * là, le client typé refuse ces noms de fonction — on passe donc par un appel
 * délié du schéma, confiné à CE module et nulle part ailleurs. Une fois les
 * types régénérés, ce détour devient inutile et peut être remplacé par
 * `supabase.rpc(...)` ordinaire.
 */
const rpcHorsSchema = supabase.rpc.bind(supabase) as unknown as (
  fonction: string,
  parametres?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/* ── Ce que renvoie fiche_reservee() — le contrat jsonb de la migration ── */

export interface ProduitRepere {
  libelle: string;
  materiau: string;
  materiau_slug: string;
  famille: string;
  prix_unitaire: number | null;
  unite: string | null;
  quantite_min: number | null;
}

export interface VehiculeRepere {
  nom: string;
  categorie: string | null;
  capacite_m3: number | null;
  capacite_kg: number | null;
  forfait_base: number | null;
  prix_par_km: number | null;
  aller_retour: boolean;
}

export interface FicheReservee {
  jeton: string;
  nature: "depot" | "transporteur" | "mixte";
  rayon_km: number | null;
  vehicules: VehiculeRepere[];
  raison_sociale: string;
  metier: string | null;
  ville: string | null;
  quartier: string | null;
  adresse: string | null;
  telephone: string | null;
  photos: string[];
  langue: string;
  source_url: string | null;
  reserve_le: string;
  produits: ProduitRepere[];
}

/**
 * Lit une fiche par son jeton — et rien d'autre : pas d'énumération possible.
 * `null` couvre TOUS les cas sans fiche lisible (jeton inconnu, fiche refusée,
 * retirée ou déjà revendiquée) : la fonction en base ne distingue pas, exprès,
 * pour ne rien apprendre à qui essaie des jetons.
 */
export async function lireFicheReservee(jeton: string): Promise<FicheReservee | null> {
  const { data, error } = await rpcHorsSchema("fiche_reservee", { _jeton: jeton });
  if (error) throw new Error(error.message);
  return (data as FicheReservee | null) ?? null;
}

/**
 * Revendique la fiche pour le compte connecté : crée (ou transfère) un VRAI
 * fournisseur en brouillon, avec ses produits et sa flotte, et accorde le rôle.
 * Renvoie l'id du fournisseur. Les refus (pas connecté, fiche partie, compte
 * qui gère déjà un dépôt) arrivent en exception, message en français inclus.
 */
export async function revendiquerFiche(jeton: string): Promise<string> {
  const { data, error } = await rpcHorsSchema("revendiquer_fiche", { _jeton: jeton });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * « Ne me recontactez plus » : marche SANS compte — exiger une inscription
 * pour se faire retirer d'une liste serait le contraire de la promesse.
 * Renvoie `false` si la fiche n'était déjà plus là.
 */
export async function refuserFiche(jeton: string, motif?: string): Promise<boolean> {
  const { data, error } = await rpcHorsSchema("refuser_fiche", {
    _jeton: jeton,
    _motif: motif && motif.trim() !== "" ? motif.trim() : null,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * Ajoute le rôle fournisseur au compte connecté (adresse confirmée exigée).
 * Idempotente côté base : re-cliquer ne casse rien.
 */
export async function devenirFournisseur(): Promise<void> {
  const { error } = await rpcHorsSchema("devenir_fournisseur");
  if (error) throw new Error(error.message);
}
