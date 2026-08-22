// Génère src/integrations/supabase/types.ts depuis le schéma distant.
// Les types ne sont JAMAIS écrits à la main (règle A7).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lireSecrets, refProjet } from "./secrets.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const s = lireSecrets();
if (!s.SUPABASE_ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN requis pour générer les types.");
  process.exit(1);
}
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const sortie = execFileSync(
  npx,
  ["--yes", "supabase", "gen", "types", "typescript", "--project-id", refProjet(s.SUPABASE_URL), "--schema", "public"],
  { cwd: racine, env: { ...process.env, SUPABASE_ACCESS_TOKEN: s.SUPABASE_ACCESS_TOKEN }, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
const chemin = join(racine, "src", "integrations", "supabase", "types.ts");
writeFileSync(chemin, "// Fichier GÉNÉRÉ par `npm run types:gen`. Ne pas modifier à la main.\n" + sortie, "utf8");
console.log(`✓ ${chemin}`);
