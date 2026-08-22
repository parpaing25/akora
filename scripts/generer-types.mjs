// Genere src/integrations/supabase/types.ts depuis le schema distant.
// Les types ne sont JAMAIS ecrits a la main (regle A7).
//
// On interroge directement l'API de gestion : c'est ce que fait la CLI, mais
// sans dependre de son installation ni d'un config.toml local.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lireSecrets, refProjet } from "./secrets.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const s = lireSecrets();
if (!s.SUPABASE_ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN requis pour generer les types.");
  process.exit(1);
}
const ref = refProjet(s.SUPABASE_URL);

const reponse = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`,
  {
    headers: {
      Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`,
      "User-Agent": "akora-types/1.0",
    },
  },
);
if (!reponse.ok) {
  console.error(`HTTP ${reponse.status} — ${(await reponse.text()).slice(0, 800)}`);
  process.exit(1);
}
const { types } = await reponse.json();
if (!types || types.length < 200) {
  console.error("Reponse inattendue : types vides ou tronques.");
  process.exit(1);
}

const chemin = join(racine, "src", "integrations", "supabase", "types.ts");
writeFileSync(
  chemin,
  "// Fichier GENERE par `npm run types:gen`. Ne pas modifier a la main.\n" + types,
  "utf8",
);
console.log(`✓ ${chemin} (${types.split("\n").length} lignes)`);
