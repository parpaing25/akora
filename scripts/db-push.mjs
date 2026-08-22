// Applique les migrations de supabase/migrations sur le projet distant.
//
// On passe par l'API de gestion Supabase plutot que par `supabase link` +
// `db push` : la CLI exige une connexion Postgres directe, souvent en IPv6
// seule, et un config.toml. L'API, elle, ne demande que le jeton personnel et
// fonctionne depuis n'importe quel poste. Les versions appliquees sont
// enregistrees dans supabase_migrations.schema_migrations, exactement comme
// le ferait la CLI, pour que les deux outils restent interchangeables.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lireSecrets, refProjet } from "./secrets.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const dossier = join(racine, "supabase", "migrations");
const s = lireSecrets();
if (!s.SUPABASE_ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN requis. Voir docs/SUPABASE-DEMARRAGE.md.");
  process.exit(1);
}
const ref = refProjet(s.SUPABASE_URL);

async function executer(sql) {
  const reponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "akora-db-push/1.0",
    },
    body: JSON.stringify({ query: sql }),
  });
  const texte = await reponse.text();
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status} — ${texte.slice(0, 1200)}`);
  try {
    return JSON.parse(texte);
  } catch {
    return texte;
  }
}

await executer(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  );
`);

const deja = new Set(
  (await executer("select version from supabase_migrations.schema_migrations;")).map((l) => l.version),
);

const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();
let appliquees = 0;

for (const nom of fichiers) {
  const version = (nom.match(/^(\d+)/) ?? [])[1];
  if (!version) {
    console.error(`Nom de migration inattendu (prefixe horodate manquant) : ${nom}`);
    process.exit(1);
  }
  if (deja.has(version)) {
    console.log(`· ${nom} — deja appliquee`);
    continue;
  }
  const sql = readFileSync(join(dossier, nom), "utf8");
  process.stdout.write(`→ ${nom} … `);
  try {
    await executer(sql);
  } catch (erreur) {
    console.log("ECHEC");
    console.error(String(erreur.message ?? erreur));
    process.exit(1);
  }
  await executer(
    `insert into supabase_migrations.schema_migrations (version, name)
     values ('${version}', '${nom.replace(/'/g, "''")}')
     on conflict (version) do nothing;`,
  );
  console.log("ok");
  appliquees++;
}

console.log(`\n✓ ${appliquees} migration(s) appliquee(s), ${fichiers.length} au total.`);
