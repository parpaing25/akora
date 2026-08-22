// Fabrique .env.local à partir des secrets locaux. Le fichier est ignoré par git.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lireSecrets } from "./secrets.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const s = lireSecrets();

const contenu = [
  "# Généré par scripts/ecrire-env.mjs — ne pas versionner.",
  `VITE_SUPABASE_URL=${s.SUPABASE_URL}`,
  `VITE_SUPABASE_ANON_KEY=${s.SUPABASE_ANON_KEY}`,
  "VITE_UPLOAD_ENDPOINT=https://akora.fonenako.mg/api/o2upload.php",
  "VITE_DELETE_ENDPOINT=https://akora.fonenako.mg/api/o2delete.php",
  "VITE_SITE_URL=https://akora.fonenako.mg",
  // Cle PUBLIQUE VAPID : elle est faite pour etre dans le bundle, c'est le
  // navigateur qui s'en sert pour verifier la signature du serveur. La privee
  // ne quitte jamais les secrets d'Edge Function.
  ...(s.VITE_VAPID_PUBLIC_KEY ? [`VITE_VAPID_PUBLIC_KEY=${s.VITE_VAPID_PUBLIC_KEY}`] : []),
  "",
].join("\n");

writeFileSync(join(racine, ".env.local"), contenu, "utf8");
console.log("✓ .env.local écrit (clé anon uniquement).");
