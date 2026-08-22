import { supabase } from "@/integrations/supabase/client";
import type { EcritureLedger } from "@/lib/ledger";
import type { OperateurPaiement, StatutRetrait } from "@/lib/types-metier";

/**
 * Portefeuille, ledger et versements.
 *
 * En lecture seule côté client, sauf la DEMANDE de versement. Aucun solde ne
 * se modifie depuis le navigateur : c'est `ecrire_ledger`, appelée par le
 * serveur, qui a le monopole.
 */

export interface Portefeuille {
  fournisseur_id: string;
  solde_disponible: number;
  solde_sequestre: number;
  maj_le: string;
}

export interface EcritureAffichee extends EcritureLedger {
  libelle: string;
  created_at: string;
  commande_id: string | null;
}

export interface Retrait {
  id: string;
  montant: number;
  operateur: OperateurPaiement;
  msisdn: string;
  statut: StatutRetrait;
  reference: string | null;
  motif_refus: string | null;
  demande_le: string;
  traite_le: string | null;
}

export async function lirePortefeuille(fournisseurId: string): Promise<Portefeuille | null> {
  const { data, error } = await supabase
    .from("portefeuilles")
    .select("fournisseur_id, solde_disponible, solde_sequestre, maj_le")
    .eq("fournisseur_id", fournisseurId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Portefeuille) ?? null;
}

export async function listerEcritures(fournisseurId: string, limite = 100): Promise<EcritureAffichee[]> {
  const { data, error } = await supabase
    .from("ledger")
    .select("id, type, montant, solde_apres, libelle, created_at, commande_id")
    .eq("fournisseur_id", fournisseurId)
    .order("id", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as unknown as EcritureAffichee[];
}

export async function listerRetraits(fournisseurId: string): Promise<Retrait[]> {
  const { data, error } = await supabase
    .from("retraits")
    .select("id, montant, operateur, msisdn, statut, reference, motif_refus, demande_le, traite_le")
    .eq("fournisseur_id", fournisseurId)
    .order("demande_le", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Retrait[];
}

/**
 * Demande de versement. La base vérifie le minimum et le solde disponible :
 * ce n'est pas au formulaire d'être l'autorité sur ce qui est retirable.
 */
export async function demanderRetrait(entree: {
  fournisseur_id: string;
  montant: number;
  operateur: OperateurPaiement;
  msisdn: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("retraits")
    .insert({ ...entree, statut: "demande" })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}
