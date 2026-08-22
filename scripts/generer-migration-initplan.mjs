// Genere une migration qui reecrit toutes les politiques RLS contenant un
// `auth.uid()` nu, en l'enveloppant dans un sous-select. Postgres le calcule
// alors une fois par requete au lieu d'une fois par ligne.
// Usage ponctuel : node scripts/generer-migration-initplan.mjs <fichier>
import { writeFileSync } from "node:fs";
import { lireSecrets, refProjet } from "./secrets.mjs";

const sortie = process.argv[2];
if (!sortie) {
  console.error("Usage : node scripts/generer-migration-initplan.mjs <chemin du fichier .sql>");
  process.exit(1);
}
const s = lireSecrets();
const ref = refProjet(s.SUPABASE_URL);

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "akora/1.0",
    },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t.slice(0, 800));
  return JSON.parse(t);
}

const lignes = await q(`
  select tablename, policyname, cmd, roles::text as roles,
         coalesce(qual, '') as qual, coalesce(with_check, '') as wc
    from pg_policies where schemaname = 'public'
   order by tablename, policyname`);

const enveloppe = (e) => e.replace(/auth\.uid\(\)/g, "(select auth.uid())");
const guillemets = (nom) => '"' + nom.replace(/"/g, '""') + '"';

const morceaux = [
  "-- ═══════════════════════════════════════════════════════════════════════════",
  "-- AKORA — 17. auth.uid() evalue une fois par requete, pas une fois par ligne",
  "-- ═══════════════════════════════════════════════════════════════════════════",
  "-- Fichier GENERE par scripts/generer-migration-initplan.mjs a partir des",
  "-- politiques reellement en place. Chaque `auth.uid()` nu est enveloppe dans",
  "-- un sous-select : Postgres le sort alors de la boucle sur les lignes.",
  "-- La logique d'autorisation, elle, est rigoureusement inchangee.",
  "",
];
let nombre = 0;

for (const l of lignes) {
  const brut = `${l.qual}|${l.wc}`;
  if (!/auth\.uid\(\)/.test(brut.replace(/\( SELECT auth\.uid\(\) AS uid\)/g, "@"))) continue;

  const roles = l.roles.replace(/[{}]/g, "").split(",").filter(Boolean).join(", ");
  const action = { ALL: "all", SELECT: "select", INSERT: "insert", UPDATE: "update", DELETE: "delete" }[l.cmd];
  const nom = guillemets(l.policyname);
  const table = `public.${l.tablename}`;

  const bloc = [`drop policy if exists ${nom} on ${table};`, `create policy ${nom} on ${table}`, `  for ${action} to ${roles}`];
  if (l.qual && l.cmd !== "INSERT") bloc.push(`  using (${enveloppe(l.qual)})`);
  if (l.wc) bloc.push(`  with check (${enveloppe(l.wc)})`);
  morceaux.push(bloc.join("\n") + ";", "");
  nombre++;
}

writeFileSync(sortie, morceaux.join("\n"), "utf8");
console.log(`✓ ${nombre} politique(s) reecrite(s) dans ${sortie}`);
