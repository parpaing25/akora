// Dépose des secrets d'Edge Function sur le projet Supabase.
//
//   node scripts/definir-secrets.mjs SMTP_HOST=... SMTP_PORT=465 ...
//
// Les valeurs ne sont ni affichées ni journalisées : seul leur nom l'est.
// Elles ne transitent que vers l'API de gestion, et ne touchent jamais le
// dépôt (règle A2.5).
import { lireSecrets, refProjet } from "./secrets.mjs";

const paires = process.argv.slice(2);
if (paires.length === 0) {
  console.error("Usage : node scripts/definir-secrets.mjs CLE=valeur [CLE=valeur ...]");
  process.exit(1);
}

const s = lireSecrets();
if (!s.SUPABASE_ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN requis.");
  process.exit(1);
}
const ref = refProjet(s.SUPABASE_URL);

const corps = paires.map((paire) => {
  const separateur = paire.indexOf("=");
  if (separateur === -1) {
    console.error(`Paire invalide : ${paire.split("=")[0]}`);
    process.exit(1);
  }
  return { name: paire.slice(0, separateur).trim(), value: paire.slice(separateur + 1) };
});

const reponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "akora-secrets/1.0",
  },
  body: JSON.stringify(corps),
});
if (!reponse.ok) {
  console.error(`HTTP ${reponse.status} — ${(await reponse.text()).slice(0, 600)}`);
  process.exit(1);
}

console.log(`✓ ${corps.length} secret(s) déposé(s) :`);
for (const { name, value } of corps) {
  console.log(`  ${name.padEnd(24)} ${value.length} caractère(s)`);
}
console.log("\nRedéployez les fonctions pour qu'elles les voient : npm run fonctions:deploy");
