// Charge un ou plusieurs fichiers de supabase/seed dans la base distante.
// Usage : node scripts/charger-seed.mjs 01 02 03 04
//
// Les fichiers de seed ne sont JAMAIS appliques par `db:push` : ce sont des
// donnees, pas du schema, et `99_demo.sql` n'a rien a faire en production.
// On passe par l'API de gestion Supabase pour ne dependre ni de psql ni de
// Docker, absents d'un poste Windows par defaut.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lireSecrets, refProjet } from "./secrets.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const dossier = join(racine, "supabase", "seed");
const demandes = process.argv.slice(2);
const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();

if (demandes.length === 0) {
  console.log("Fichiers disponibles :");
  for (const f of fichiers) console.log("  " + f);
  console.log("\nUsage : node scripts/charger-seed.mjs 01 02 03 04");
  process.exit(0);
}

const choisis = demandes.map((prefixe) => {
  const trouve = fichiers.find((f) => f.startsWith(prefixe));
  if (!trouve) {
    console.error(`Aucun fichier de seed ne commence par "${prefixe}".`);
    process.exit(1);
  }
  return trouve;
});

if (choisis.some((f) => f.startsWith("99"))) {
  console.warn("\n  ATTENTION : 99_demo.sql contient des donnees FICTIVES.");
  console.warn("  A ne jamais charger sur la base de production.\n");
}

const s = lireSecrets();
if (!s.SUPABASE_ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN requis. Voir docs/SUPABASE-DEMARRAGE.md, section 2.");
  process.exit(1);
}
const ref = refProjet(s.SUPABASE_URL);

for (const nom of choisis) {
  const sql = readFileSync(join(dossier, nom), "utf8");
  process.stdout.write(`→ ${nom} … `);
  const reponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!reponse.ok) {
    console.log("echec");
    console.error(await reponse.text());
    process.exit(1);
  }
  console.log("ok");
}
console.log("✓ seed charge.");
