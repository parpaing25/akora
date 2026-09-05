// Depose dans le COFFRE de Supabase les secrets dont l'ordonnanceur a besoin.
//
// Le coffre (`vault`) chiffre au repos : le secret n'apparait ni dans le
// depot, ni dans les migrations, ni dans le journal des requetes. Seule une
// fonction SECURITY DEFINER le relit.
//
//   node scripts/poser-secrets-coffre.mjs
//
// Rejouable : relancer remplace la valeur sans creer de doublon.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { lireSecrets, refProjet } from "./secrets.mjs";

const s = lireSecrets();
const ref = refProjet(s.SUPABASE_URL);

function lireFichier(nom) {
  try {
    const o = {};
    for (const l of readFileSync(join(homedir(), ".akora-secrets", nom), "utf8").split(/\r?\n/)) {
      if (l.includes("=") && !l.trim().startsWith("#")) {
        const i = l.indexOf("=");
        o[l.slice(0, i).trim()] = l.slice(i + 1).trim();
      }
    }
    return o;
  } catch {
    return {};
  }
}

const cron = lireFichier("vapid.txt").AKORA_CRON_SECRET;
if (!cron) {
  console.error("AKORA_CRON_SECRET introuvable dans ~/.akora-secrets/vapid.txt");
  process.exit(1);
}

// Pas d'apostrophe dans les descriptions : elles partent dans du SQL, et
// echapper trois champs vaut mieux qu'en oublier un.
const aPoser = [
  ["akora_url_fonctions", `${s.SUPABASE_URL}/functions/v1`, "Base des Edge Functions"],
  ["akora_cron_secret", cron, "Secret d appel de l ordonnanceur"],
];

/** Tout ce qui entre dans une requete y entre echappe. Sans exception. */
const q = (v) => `'${String(v).replaceAll("'", "''")}'`;

const sql = async (requete) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "akora-coffre/1.0",
    },
    body: JSON.stringify({ query: requete }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t.slice(0, 400));
  return JSON.parse(t);
};

for (const [nom, valeur, description] of aPoser) {
  try {
    await sql(`
      do $$
      declare v_id uuid;
      begin
        select id into v_id from vault.secrets where name = ${q(nom)};
        if v_id is null then
          perform vault.create_secret(${q(valeur)}, ${q(nom)}, ${q(description)});
        else
          perform vault.update_secret(v_id, ${q(valeur)}, ${q(nom)}, ${q(description)});
        end if;
      end $$;`);
  } catch (erreur) {
    // Le message d'erreur de Postgres reprend la requete ENTIERE, secret
    // compris. On ne le laisse pas remonter tel quel.
    console.error(`  ${nom} : depot impossible (message masque, il contiendrait le secret)`);
    process.exit(1);
  }
  console.log(`  ${nom.padEnd(24)} ${valeur.length} caractere(s), chiffre`);
}

const taches = await sql(
  "select jobname, schedule, active from cron.job where jobname like 'akora-%' order by jobname",
);
console.log("\nTaches ordonnancees :");
for (const t of taches) {
  console.log(`  ${String(t.jobname).padEnd(24)} ${String(t.schedule).padEnd(12)} ${t.active ? "active" : "INACTIVE"}`);
}
console.log("\n✓ Le coffre est garni. L'ordonnanceur n'attend plus rien.");
