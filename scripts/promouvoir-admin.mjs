// Donne le rôle « admin » à un compte, par son adresse e-mail.
//
//   node scripts/promouvoir-admin.mjs onjaniaina27@gmail.com
//
// Ce geste ne peut PAS se faire depuis le site : le navigateur n'a aucun droit
// d'écriture sur `user_roles` (règle A3). Il passe donc par l'API de gestion,
// avec le jeton personnel — c'est-à-dire depuis ce poste, par quelqu'un qui a
// déjà les clés du projet.
import { lireSecrets, refProjet } from "./secrets.mjs";

const email = process.argv[2];
if (!email) {
  console.error("Usage : node scripts/promouvoir-admin.mjs <email>");
  process.exit(1);
}

const s = lireSecrets();
if (!s.SUPABASE_ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN requis.");
  process.exit(1);
}
const ref = refProjet(s.SUPABASE_URL);

async function sql(requete) {
  const reponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "akora-admin/1.0",
    },
    body: JSON.stringify({ query: requete }),
  });
  const texte = await reponse.text();
  if (!reponse.ok) throw new Error(texte.slice(0, 600));
  return JSON.parse(texte);
}

const echappe = email.replace(/'/g, "''");

const trouves = await sql(`select id, email, email_confirmed_at from auth.users where lower(email) = lower('${echappe}');`);
if (trouves.length === 0) {
  console.error(`Aucun compte avec l'adresse ${email}.`);
  console.error("Créez-le d'abord sur https://akora.fonenako.mg/inscription.");
  process.exit(1);
}
const compte = trouves[0];

await sql(`
  insert into public.user_roles (user_id, role)
  values ('${compte.id}', 'admin')
  on conflict (user_id, role) do nothing;
`);

const roles = await sql(`select role from public.user_roles where user_id = '${compte.id}' order by role;`);

console.log(`✓ ${compte.email}`);
console.log(`  identifiant : ${compte.id}`);
console.log(`  e-mail confirmé : ${compte.email_confirmed_at ? "oui" : "NON — confirmez-le avant de payer en ligne"}`);
console.log(`  rôles : ${roles.map((r) => r.role).join(", ")}`);
console.log("\nDéconnectez-vous puis reconnectez-vous : le menu « Administration » apparaîtra.");
