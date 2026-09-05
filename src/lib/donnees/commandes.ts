import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Operateur } from "@/lib/paiement/types";
import type { ModePaiement } from "@/lib/types-metier";

type Tables = Database["public"]["Tables"];
export type LigneCommande = Tables["commandes"]["Row"];
export type LigneDeCommande = Tables["lignes_commande"]["Row"];
export type LignePaiement = Tables["paiements"]["Row"];

/**
 * Commandes et paiements.
 *
 * Toute création passe par une Edge Function : le navigateur n'a AUCUN droit
 * d'insertion sur `commandes`, `lignes_commande` ni `paiements`. Il envoie des
 * identifiants et des quantités ; le serveur recalcule les montants.
 */

async function invoquer<T>(fonction: string, corps: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fonction, { body: corps });
  if (error) {
    // Le corps d'erreur des Edge Functions porte le vrai message métier.
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error((detail as { erreur?: string } | null)?.erreur ?? error.message);
  }
  return data as T;
}

export interface DemandeCommande {
  lignes: { produit_id: string; quantite: number }[];
  nom_contact: string;
  telephone_contact: string;
  email_contact?: string | null;
  localite_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  adresse_libre?: string | null;
  mode_paiement?: ModePaiement;
  message?: string | null;
}

export interface CommandeCreee {
  id: string;
  numero: string;
  /** Secret remis une fois : seule preuve de propriété d'une commande passée sans compte (F-01). */
  jeton_suivi: string;
  fournisseur: string;
  montant_total: number;
}

export interface CommandeInvitee {
  commande: LigneCommande;
  lignes: LigneDeCommande[];
  paiements: LignePaiement[];
}

/** Lecture par jeton (commande passée sans compte). `null` si le couple ne correspond pas. */
export async function lireCommandeInvitee(numero: string, jeton: string): Promise<CommandeInvitee | null> {
  const { data, error } = await supabase.rpc("lire_commande_invitee" as never, { _numero: numero, _jeton: jeton } as never);
  if (error) throw error;
  return (data as unknown as CommandeInvitee | null) ?? null;
}

export async function confirmerLivraisonInvitee(numero: string, jeton: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("confirmer_livraison_invitee" as never, { _numero: numero, _jeton: jeton } as never);
  if (error) throw error;
  return Boolean(data);
}

/** Les commandes passées sans compte, gardées dans CE navigateur pour les retrouver. */
const CLE_INVITE = "akora-commandes-invite";
export interface CommandeMemorisee { numero: string; jeton: string; le: string }
export function memoriserCommandeInvitee(c: { numero: string; jeton_suivi: string }): void {
  try {
    const liste = JSON.parse(localStorage.getItem(CLE_INVITE) ?? "[]") as CommandeMemorisee[];
    liste.unshift({ numero: c.numero, jeton: c.jeton_suivi, le: new Date().toISOString() });
    localStorage.setItem(CLE_INVITE, JSON.stringify(liste.slice(0, 20)));
  } catch {
    // stockage indisponible : le lien reste dans l'URL et le courriel
  }
}
export function commandesInvitees(): CommandeMemorisee[] {
  try {
    return JSON.parse(localStorage.getItem(CLE_INVITE) ?? "[]") as CommandeMemorisee[];
  } catch {
    return [];
  }
}

export function creerCommandes(demande: DemandeCommande): Promise<{ commandes: CommandeCreee[] }> {
  return invoquer("commande-creer", demande as unknown as Record<string, unknown>);
}

export interface InitiationPaiement {
  paiement_id: string;
  montant: number;
  statut: string;
  instructions?: string | null;
  url_redirection?: string | null;
  mode_prestataire?: "api" | "reference_manuelle";
  deja_initie?: boolean;
}

export function initierPaiement(entree: {
  commande_id: string;
  operateur: Operateur;
  mode: "en_ligne_integral" | "en_ligne_acompte";
  msisdn: string;
}): Promise<InitiationPaiement> {
  return invoquer("paiement-initier", entree as unknown as Record<string, unknown>);
}

export function verifierPaiement(paiementId: string): Promise<{ statut: string; interroge: boolean }> {
  return invoquer("paiement-statut", { paiement_id: paiementId });
}

const COLONNES_COMMANDE =
  "id, numero, acheteur_id, nom_contact, telephone_contact, email_contact, fournisseur_id, localite_id, lat, lng, adresse_libre, distance_km, nb_rotations, montant_produits, montant_livraison, montant_total, livraison_estimable, mode_paiement, statut, message, vue_le, livree_le, confirmee_le, cloturee_le, created_at";

export async function lireCommandeParNumero(numero: string): Promise<LigneCommande | null> {
  const { data, error } = await supabase
    .from("commandes")
    .select(COLONNES_COMMANDE)
    .eq("numero", numero)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as LigneCommande) ?? null;
}

export async function listerLignes(commandeId: string): Promise<LigneDeCommande[]> {
  const { data, error } = await supabase
    .from("lignes_commande")
    .select("id, produit_id, designation_snapshot, unite_snapshot, prix_unitaire_snapshot, quantite, total_ligne")
    .eq("commande_id", commandeId);
  if (error) throw error;
  return (data ?? []) as unknown as LigneDeCommande[];
}

export async function listerPaiements(commandeId: string): Promise<LignePaiement[]> {
  const { data, error } = await supabase
    .from("paiements")
    .select("id, operateur, mode, montant, statut, reference_saisie, reference_externe, initie_le, confirme_le, libere_le")
    .eq("commande_id", commandeId)
    .order("initie_le", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LignePaiement[];
}

/** Mes commandes, pour l'espace acheteur. */
export async function listerMesCommandes(userId: string): Promise<LigneCommande[]> {
  const { data, error } = await supabase
    .from("commandes")
    .select(COLONNES_COMMANDE)
    .eq("acheteur_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as LigneCommande[];
}

/** Les commandes reçues par un fournisseur. */
export async function listerCommandesFournisseur(fournisseurId: string): Promise<LigneCommande[]> {
  const { data, error } = await supabase
    .from("commandes")
    .select(COLONNES_COMMANDE)
    .eq("fournisseur_id", fournisseurId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as LigneCommande[];
}

/** Changement de statut par le fournisseur. La base refuse toute transition interdite. */
export async function changerStatutCommande(id: string, statut: LigneCommande["statut"]): Promise<void> {
  const { error } = await supabase.from("commandes").update({ statut }).eq("id", id).select("id");
  if (error) throw error;
}

/** Confirmation de réception par l'acheteur : libère le séquestre. */
export async function confirmerLivraison(commandeId: string): Promise<void> {
  const { error } = await supabase.rpc("confirmer_livraison", { _commande_id: commandeId });
  if (error) throw error;
}

/** Enregistre la référence du SMS et bascule le paiement en vérification. */
export async function enregistrerReference(paiementId: string, reference: string): Promise<void> {
  const { error } = await supabase.rpc("enregistrer_reference_paiement", {
    _paiement_id: paiementId,
    _reference: reference,
  });
  if (error) throw error;
}

/** Réservé aux administrateurs : tranche un paiement en vérification. */
export async function confirmerPaiementManuel(
  paiementId: string,
  accepte: boolean,
  motif?: string,
): Promise<void> {
  const { error } = await supabase.rpc("confirmer_paiement_manuel", {
    _paiement_id: paiementId,
    _accepte: accepte,
    _motif: motif,
  });
  if (error) throw error;
}
