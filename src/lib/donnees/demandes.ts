import { supabase } from "@/integrations/supabase/client";
import type { Unite } from "@/lib/types-metier";

/**
 * Les demandes structurées (migration 20260902110000).
 *
 * Une demande = des LIGNES (matériau du catalogue + quantité), un lieu, une
 * date. Une seule ouverte par personne. Tout passe par des RPC : les tables
 * n'ont aucune policy — ni le lieu précis de l'acheteur ni les propositions
 * ne sont listables autrement.
 */
export interface LigneDemande {
  id: string;
  materiau_ref_id: string;
  materiau_slug: string;
  nom: string;
  quantite: number;
  unite: Unite;
  precision: string | null;
}

export interface FournisseurProposant {
  id: string;
  slug: string;
  raison_sociale: string;
  niveau_verification: string;
  localite_nom: string | null;
  lat: number | null;
  lng: number | null;
}

export interface Proposition {
  id: string;
  statut: "envoyee" | "acceptee" | "refusee" | "retiree";
  livraison: number | null;
  delai_jours: number | null;
  message: string | null;
  created_at: string;
  fournisseur: FournisseurProposant;
  lignes: { ligne_id: string; prix_unitaire: number | null; disponible: boolean }[];
}

export interface MaDemande {
  id: string;
  statut: "ouverte" | "pourvue" | "fermee";
  localite_id: string | null;
  localite_nom: string | null;
  lat: number | null;
  lng: number | null;
  libelle_lieu: string | null;
  date_souhaitee: string | null;
  note: string | null;
  created_at: string;
  expire_le: string;
  lignes: LigneDemande[];
  propositions: Proposition[];
}

export interface NouvelleLigne {
  materiau_ref_id: string;
  quantite: number;
  precision?: string | null;
}

export interface NouvelleDemande {
  lignes: NouvelleLigne[];
  localiteId: string | null;
  lat: number | null;
  lng: number | null;
  libelleLieu: string | null;
  dateSouhaitee: string | null;
  note: string | null;
}

// `types.ts` peut être en retard d'une migration : le client est typé
// localement pour ces RPC, et rien d'autre.
const rpc = supabase as unknown as {
  rpc(nom: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function creerDemande(d: NouvelleDemande): Promise<string> {
  const { data, error } = await rpc.rpc("creer_demande", {
    _lignes: d.lignes,
    _localite_id: d.localiteId,
    _lat: d.lat,
    _lng: d.lng,
    _libelle_lieu: d.libelleLieu,
    _date_souhaitee: d.dateSouhaitee,
    _note: d.note,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function maDemande(): Promise<MaDemande | null> {
  const { data, error } = await rpc.rpc("ma_demande");
  if (error) throw new Error(error.message);
  return (data as MaDemande | null) ?? null;
}

export async function fermerDemande(id: string): Promise<void> {
  const { error } = await rpc.rpc("fermer_demande", { _demande_id: id });
  if (error) throw new Error(error.message);
}

export async function repondreProposition(id: string, decision: "acceptee" | "refusee"): Promise<void> {
  const { error } = await rpc.rpc("repondre_proposition", { _proposition_id: id, _decision: decision });
  if (error) throw new Error(error.message);
}

/** Côté dépôt : les demandes ouvertes qui portent sur ce que je vends. */
export interface DemandePourDepot {
  id: string;
  libelle_lieu: string | null;
  localite_nom: string | null;
  distance_km: number | null;
  date_souhaitee: string | null;
  note: string | null;
  created_at: string;
  expire_le: string;
  lignes: {
    id: string;
    materiau_ref_id: string;
    nom: string;
    quantite: number;
    unite: Unite;
    precision: string | null;
    mon_produit_id: string | null;
    mon_prix: number | null;
  }[];
  nb_correspondances: number;
  deja_propose: boolean;
  statut_proposition: string | null;
}

export async function demandesPourMonDepot(): Promise<DemandePourDepot[]> {
  const { data, error } = await rpc.rpc("demandes_pour_mon_depot");
  if (error) throw new Error(error.message);
  return (data as DemandePourDepot[] | null) ?? [];
}

export async function proposer(p: {
  demandeId: string;
  lignes: { ligne_id: string; prix_unitaire: number | null; disponible: boolean }[];
  livraison: number | null;
  delaiJours: number | null;
  message: string | null;
}): Promise<string> {
  const { data, error } = await rpc.rpc("proposer", {
    _demande_id: p.demandeId,
    _lignes: p.lignes,
    _livraison: p.livraison,
    _delai_jours: p.delaiJours,
    _message: p.message,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Le total d'une proposition : lignes disponibles × quantités + livraison. */
export function totalProposition(proposition: Proposition, lignes: LigneDemande[]): number | null {
  let total = 0;
  let complet = true;
  for (const ligne of lignes) {
    const prix = proposition.lignes.find((l) => l.ligne_id === ligne.id);
    if (!prix || !prix.disponible || prix.prix_unitaire == null) {
      complet = false;
      continue;
    }
    total += Number(prix.prix_unitaire) * Number(ligne.quantite);
  }
  if (!complet && total === 0) return null;
  return total + Number(proposition.livraison ?? 0);
}
