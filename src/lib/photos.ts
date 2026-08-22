import imageCompression from "browser-image-compression";
import { ENV } from "./env";
import { supabase } from "@/integrations/supabase/client";

/**
 * Envoi des photos de produits sur o2switch (spec D5).
 *
 * Le front n'a AUCUN secret : il présente le jeton d'accès Supabase de
 * l'utilisateur, et c'est le PHP côté serveur qui le valide auprès de
 * /auth/v1/user avant d'écrire quoi que ce soit.
 *
 * ⚠️ Les documents KYC ne passent JAMAIS par ici. Ils vont dans le bucket
 * privé `kyc` (voir donnees/documents.ts).
 */

export const TAILLE_MAX_OCTETS = 8 * 1024 * 1024;
export const PHOTOS_MAX_PAR_PRODUIT = 8;
const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp"];
/** Le mutualisé n'aime pas les rafales : on espace les envois. */
const PAUSE_ENTRE_ENVOIS_MS = 1000;

export type DossierPhoto = "produits" | "fournisseurs" | "profils";

function extension(fichier: File): string {
  if (fichier.type === "image/png") return "png";
  if (fichier.type === "image/webp") return "webp";
  return "jpg";
}

/** Compression navigateur avant envoi : 1280 px, qualité 0,75 (règle A4). */
export async function comprimer(fichier: File): Promise<File> {
  if (!TYPES_ACCEPTES.includes(fichier.type)) {
    throw new Error("Format non accepté. Utilisez une photo JPEG, PNG ou WebP.");
  }
  if (fichier.size > TAILLE_MAX_OCTETS) {
    throw new Error("Photo trop lourde : 8 Mo maximum.");
  }
  return imageCompression(fichier, {
    maxWidthOrHeight: 1280,
    initialQuality: 0.75,
    useWebWorker: true,
    fileType: fichier.type === "image/png" ? "image/png" : "image/jpeg",
  });
}

async function envoyerUn(fichier: File, dossier: DossierPhoto, jeton: string, userId: string): Promise<string> {
  const nom = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension(fichier)}`;

  const formulaire = new FormData();
  formulaire.append("file", fichier, nom);
  formulaire.append("filename", nom);
  formulaire.append("folder", dossier);

  let reponse = await fetch(ENV.uploadEndpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton}` },
    body: formulaire,
  });

  // Repli JSON base64 : certains mutualisés refusent le multipart selon la
  // configuration PHP. On ne perd pas la photo pour autant.
  if (!reponse.ok) {
    const base64 = await new Promise<string>((resoudre, rejeter) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resoudre(String(lecteur.result).split(",")[1] ?? "");
      lecteur.onerror = () => rejeter(new Error("Lecture du fichier impossible."));
      lecteur.readAsDataURL(fichier);
    });
    reponse = await fetch(ENV.uploadEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
      body: JSON.stringify({ filename: nom, folder: dossier, data: base64 }),
    });
  }

  if (!reponse.ok) throw new Error(`Envoi refusé par le serveur (${reponse.status}).`);
  const resultat = (await reponse.json()) as { success?: boolean; url?: string; error?: string };
  if (!resultat.success || !resultat.url) throw new Error(resultat.error ?? "Envoi incomplet.");
  return resultat.url;
}

/**
 * Envoie plusieurs photos, SÉQUENTIELLEMENT et espacées d'une seconde.
 * `surProgression` reçoit l'index en cours pour afficher un vrai compteur.
 */
export async function envoyerPhotos(
  fichiers: readonly File[],
  dossier: DossierPhoto,
  surProgression?: (fait: number, total: number) => void,
): Promise<string[]> {
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  const userId = data.session?.user.id;
  if (!jeton || !userId) throw new Error("Connectez-vous pour envoyer des photos.");

  const urls: string[] = [];
  for (const [index, fichier] of fichiers.entries()) {
    const compresse = await comprimer(fichier);
    urls.push(await envoyerUn(compresse, dossier, jeton, userId));
    surProgression?.(index + 1, fichiers.length);
    if (index < fichiers.length - 1) {
      await new Promise((r) => setTimeout(r, PAUSE_ENTRE_ENVOIS_MS));
    }
  }
  return urls;
}

/** Suppression : le serveur n'autorise que le dossier de l'utilisateur. */
export async function supprimerPhoto(url: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error("Connectez-vous pour supprimer une photo.");
  const reponse = await fetch(ENV.deleteEndpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!reponse.ok) throw new Error(`Suppression refusée (${reponse.status}).`);
}
