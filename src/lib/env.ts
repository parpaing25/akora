/**
 * Configuration publique du client. Le navigateur ne reçoit QUE la clé anon :
 * aucune clé service_role, aucun secret marchand ici (règles A2.4 et A2.5).
 */
function requis(nom: string, valeur: string | undefined): string {
  if (!valeur) {
    throw new Error(
      `Variable d'environnement manquante : ${nom}. Copiez .env.example en .env.local ` +
        "(ou lancez `node scripts/ecrire-env.mjs`).",
    );
  }
  return valeur;
}

export const ENV = {
  supabaseUrl: requis("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: requis("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY),
  uploadEndpoint: import.meta.env.VITE_UPLOAD_ENDPOINT ?? "https://akora.fonenako.mg/api/o2upload.php",
  deleteEndpoint: import.meta.env.VITE_DELETE_ENDPOINT ?? "https://akora.fonenako.mg/api/o2delete.php",
  siteUrl: import.meta.env.VITE_SITE_URL ?? "https://akora.fonenako.mg",
} as const;
