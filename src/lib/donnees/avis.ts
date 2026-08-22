import { supabase } from "@/integrations/supabase/client";
import type { StatutModeration } from "@/lib/types-metier";

/**
 * Avis. Un avis n'existe que sur une commande CLÔTURÉE : pas d'avis sans
 * achat (spec B12). La politique RLS l'impose, ce module ne fait que suivre.
 */
export interface Avis {
  id: string;
  fournisseur_id: string;
  auteur_id: string;
  commande_id: string;
  note: number;
  commentaire: string | null;
  statut: StatutModeration;
  reponse_fournisseur: string | null;
  created_at: string;
}

const COLONNES =
  "id, fournisseur_id, auteur_id, commande_id, note, commentaire, statut, reponse_fournisseur, created_at";

export async function listerAvisFournisseur(fournisseurId: string): Promise<Avis[]> {
  const { data, error } = await supabase
    .from("avis")
    .select(COLONNES)
    .eq("fournisseur_id", fournisseurId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Avis[];
}

export async function deposerAvis(entree: {
  fournisseur_id: string;
  commande_id: string;
  note: number;
  commentaire: string | null;
}): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const auteur = session.session?.user.id;
  if (!auteur) throw new Error("Connectez-vous pour laisser un avis.");
  const { data, error } = await supabase
    .from("avis")
    .insert({ ...entree, auteur_id: auteur })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Droit de reponse du fournisseur. Il ne peut pas publier, seulement repondre. */
export async function repondreAvis(id: string, reponse: string): Promise<void> {
  const { error } = await supabase
    .from("avis")
    .update({ reponse_fournisseur: reponse })
    .eq("id", id)
    .select("id");
  if (error) throw error;
}

export async function signaler(entree: {
  entite: string;
  entite_id: string;
  motif: string;
  description?: string | null;
}): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const auteur = session.session?.user.id;
  if (!auteur) throw new Error("Connectez-vous pour signaler.");
  const { error } = await supabase
    .from("signalements")
    .insert({ ...entree, signale_par: auteur })
    .select("id");
  if (error) throw error;
}
