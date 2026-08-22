import { supabase } from "@/integrations/supabase/client";
import type { StatutDocument, TypeDocument, Unite } from "@/lib/types-metier";

/**
 * Lectures et actions d'administration.
 *
 * Rien n'est autorisé ici parce que l'écran est réservé : tout passe par des
 * fonctions qui vérifient `has_role(auth.uid(),'admin')` en base. Cacher un
 * bouton n'a jamais protégé une donnée.
 */

export interface DossierAVerifier {
  fournisseur_id: string;
  raison_sociale: string;
  slug: string;
  niveau_verification: string;
  documents: {
    id: string;
    type: TypeDocument;
    numero: string | null;
    chemin_bucket: string | null;
    statut: StatutDocument;
    motif_refus: string | null;
  }[];
}

export async function listerDossiers(): Promise<DossierAVerifier[]> {
  const { data: documents, error } = await supabase
    .from("documents_fournisseur")
    .select("id, fournisseur_id, type, numero, chemin_bucket, statut, motif_refus")
    .order("created_at");
  if (error) throw error;

  const ids = [...new Set((documents ?? []).map((d) => d.fournisseur_id as string))];
  if (ids.length === 0) return [];

  const { data: fournisseurs } = await supabase
    .from("fournisseurs")
    .select("id, raison_sociale, slug, niveau_verification")
    .in("id", ids);

  return (fournisseurs ?? []).map((f) => ({
    fournisseur_id: f.id as string,
    raison_sociale: f.raison_sociale as string,
    slug: f.slug as string,
    niveau_verification: String(f.niveau_verification),
    documents: (documents ?? [])
      .filter((d) => d.fournisseur_id === f.id)
      .map((d) => ({
        id: d.id as string,
        type: d.type as TypeDocument,
        numero: (d.numero as string | null) ?? null,
        chemin_bucket: (d.chemin_bucket as string | null) ?? null,
        statut: d.statut as StatutDocument,
        motif_refus: (d.motif_refus as string | null) ?? null,
      })),
  }));
}

export async function statuerDocument(
  documentId: string,
  statut: StatutDocument,
  motif?: string,
): Promise<void> {
  const { error } = await supabase.rpc("statuer_document", {
    _document_id: documentId,
    _statut: statut,
    _motif: motif,
  });
  if (error) throw error;
}

export interface DemandeMateriauAdmin {
  id: string;
  fournisseur_id: string;
  nom_propose: string;
  categorie_id: string;
  unite: Unite;
  poids_kg_unite: number;
  volume_m3_unite: number;
  description: string | null;
  statut: "en_attente" | "acceptee" | "refusee";
  nb_demandeurs: number;
  created_at: string;
}

export async function listerDemandesMateriau(): Promise<DemandeMateriauAdmin[]> {
  const { data, error } = await supabase
    .from("demandes_materiau")
    .select(
      "id, fournisseur_id, nom_propose, categorie_id, unite, poids_kg_unite, volume_m3_unite, description, statut, nb_demandeurs, created_at",
    )
    .order("statut")
    .order("nb_demandeurs", { ascending: false })
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as DemandeMateriauAdmin[];
}

export async function accepterDemande(entree: {
  demandeId: string;
  nom: string;
  slug: string;
  categorieId: string;
  unite: Unite;
  poids: number;
  volume: number;
}): Promise<void> {
  const { error } = await supabase.rpc("accepter_demande_materiau", {
    _demande_id: entree.demandeId,
    _nom_normalise: entree.nom,
    _slug: entree.slug,
    _categorie_id: entree.categorieId,
    _unite: entree.unite,
    _poids_kg: entree.poids,
    _volume_m3: entree.volume,
  });
  if (error) throw error;
}

export async function refuserDemande(demandeId: string, motif: string): Promise<void> {
  const { error } = await supabase.rpc("refuser_demande_materiau", {
    _demande_id: demandeId,
    _motif: motif,
  });
  if (error) throw error;
}

export async function listerPaiementsAVerifier() {
  const { data, error } = await supabase
    .from("paiements")
    .select("id, commande_id, operateur, mode, montant, reference_saisie, msisdn, initie_le")
    .eq("statut", "en_verification")
    .order("initie_le");
  if (error) throw error;
  return data ?? [];
}

export async function listerLitiges() {
  const { data, error } = await supabase
    .from("litiges")
    .select("id, commande_id, ouvert_par, motif, description, photos, statut, decision, montant_rembourse, created_at")
    .order("statut")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function listerRetraitsATraiter() {
  const { data, error } = await supabase
    .from("retraits")
    .select("id, fournisseur_id, montant, operateur, msisdn, statut, demande_le")
    .in("statut", ["demande", "en_cours"])
    .order("demande_le");
  if (error) throw error;
  return data ?? [];
}

export async function listerJournal(limite = 200) {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, acteur_id, action, entite, entite_id, avant, apres, created_at")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

export async function controlerLedger() {
  const { data, error } = await supabase.rpc("controle_ledger");
  if (error) throw error;
  return data ?? [];
}
