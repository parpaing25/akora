// Lie le projet Supabase distant puis applique toutes les migrations du dossier
// supabase/migrations. Exige SUPABASE_ACCESS_TOKEN et SUPABASE_DB_PASSWORD.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lireSecrets, refProjet } from "./secrets.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const s = lireSecrets();
if (!s.SUPABASE_ACCESS_TOKEN || !s.SUPABASE_DB_PASSWORD) {
  console.error("SUPABASE_ACCESS_TOKEN et SUPABASE_DB_PASSWORD sont requis pour db:push.");
  console.error("Sinon, colle supabase/migrations-a-coller.sql dans le SQL Editor.");
  process.exit(1);
}
const ref = refProjet(s.SUPABASE_URL);
const env = { ...process.env, SUPABASE_ACCESS_TOKEN: s.SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD: s.SUPABASE_DB_PASSWORD };
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const lancer = (args) => execFileSync(npx, ["--yes", "supabase", ...args], { cwd: racine, env, stdio: "inherit" });

lancer(["link", "--project-ref", ref, "--password", s.SUPABASE_DB_PASSWORD]);
lancer(["db", "push", "--include-all"]);
console.log("✓ migrations appliquées.");
