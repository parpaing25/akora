import { supabase } from "@/integrations/supabase/client";
import { comprimer } from "@/lib/photos";
import type { StatutDocument, TypeDocument } from "@/lib/types-metier";

/**
 * Dossier de vérification (spec B5).
 *
 * Les scans vont dans le bucket Supabase PRIVÉ `kyc`, jamais sur o2switch,
 * jamais dans un dossier devinable. Le fournisseur dépose dans son propre
 * dossier ; il ne peut pas relire ses fichiers en clair, et personne d'autre
 * qu'un administrateur ne le peut, par une URL signée de 60 secondes dont
 * chaque génération est journalisée.
 *
 * Motif, en clair : sur un projet précédent, des cartes d'identité se sont
 * retrouvées dans un dossier `uploads` public. Ça ne se reproduit pas.
 */

export const BUCKET_KYC = "kyc";
const TAILLE_MAX_OCTETS = 8 * 1024 * 1024;

export interface DocumentFournisseur {
  id: string;
  type: TypeDocument;
  numero: string | null;
  chemin_bucket: string | null;
  statut: StatutDocument;
  motif_refus: string | null;
  expire_le: string | null;
  valide_le: string | null;
}

export async function listerDocuments(fournisseurId: string): Promise<DocumentFournisseur[]> {
  const { data, error } = await supabase
    .from("documents_fournisseur")
    .select("id, type, numero, chemin_bucket, statut, motif_refus, expire_le, valide_le")
    .eq("fournisseur_id", fournisseurId)
    .order("type");
  if (error) throw error;
  return (data ?? []) as unknown as DocumentFournisseur[];
}

function extension(fichier: File): string {
  if (fichier.type === "application/pdf") return "pdf";
  if (fichier.type === "image/png") return "png";
  if (fichier.type === "image/webp") return "webp";
  return "jpg";
}

/**
 * Dépose un scan dans le bucket privé et enregistre (ou remplace) la pièce.
 * Le statut retombe systématiquement à `en_attente` : c'est un trigger en base
 * qui l'impose, pas une politesse du client.
 */
export async function deposerPiece(
  fournisseurId: string,
  userId: string,
  type: TypeDocument,
  fichier: File,
  numero?: string | null,
): Promise<void> {
  if (fichier.size > TAILLE_MAX_OCTETS) {
    throw new Error("Fichier trop lourd : 8 Mo maximum.");
  }
  const estPdf = fichier.type === "application/pdf";
  if (!estPdf && !["image/jpeg", "image/png", "image/webp"].includes(fichier.type)) {
    throw new Error("Envoyez une photo (JPEG, PNG, WebP) ou un PDF.");
  }

  // Un PDF part tel quel ; une photo est compressée comme le reste du site,
  // sinon un scan de CIN pris au téléphone pèse 6 Mo pour rien.
  const aEnvoyer = estPdf ? fichier : await comprimer(fichier);
  const chemin = `${userId}/${type}_${Date.now()}.${extension(aEnvoyer)}`;

  const { error: erreurDepot } = await supabase.storage
    .from(BUCKET_KYC)
    .upload(chemin, aEnvoyer, { upsert: false, contentType: aEnvoyer.type });
  if (erreurDepot) throw erreurDepot;

  const { error } = await supabase
    .from("documents_fournisseur")
    .upsert(
      {
        fournisseur_id: fournisseurId,
        type,
        chemin_bucket: chemin,
        numero: numero ?? null,
      },
      { onConflict: "fournisseur_id,type" },
    )
    .select("id");
  if (error) throw error;
}

/** Enregistre un simple numéro (NIF, STAT, RCS) sans nouveau scan. */
export async function enregistrerNumero(
  fournisseurId: string,
  type: TypeDocument,
  numero: string,
): Promise<void> {
  const { error } = await supabase
    .from("documents_fournisseur")
    .upsert({ fournisseur_id: fournisseurId, type, numero }, { onConflict: "fournisseur_id,type" })
    .select("id");
  if (error) throw error;
}

/**
 * URL signée de 60 secondes — RÉSERVÉE AUX ADMINISTRATEURS.
 * La politique du bucket refuse la lecture à tout le monde d'autre ; cet appel
 * échouera donc côté serveur pour un fournisseur, même s'il connaît le chemin.
 */
export async function urlSigneeAdmin(chemin: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_KYC).createSignedUrl(chemin, 60);
  if (error) throw error;
  return data.signedUrl;
}
