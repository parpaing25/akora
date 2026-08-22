// Active la connexion Google sur le projet Supabase.
//
// Usage :
//   node scripts/configurer-google.mjs <client_id> <client_secret>
//   node scripts/configurer-google.mjs --etat      (sans rien changer)
//
// Les deux valeurs viennent de la console Google Cloud, et elles seules
// peuvent être créées par le proprietaire du compte Google. Elles ne sont
// jamais écrites dans le dépôt : elles partent directement dans la
// configuration Supabase, où elles restent côté serveur.
//
// L'URI de redirection à coller dans Google Cloud est affichee ci-dessous :
// c'est celle de Supabase, PAS celle du site. Google renvoie vers Supabase,
// qui pose la session, puis nous ramène sur /auth/retour.
import { lireSecrets, refProjet } from "./secrets.mjs";

const s = lireSecrets();
if (!s.SUPABASE_ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN requis.");
  process.exit(1);
}
const ref = refProjet(s.SUPABASE_URL);
const urlConfig = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const enTetes = {
  Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "akora-google/1.0",
};

const [identifiant, secret] = process.argv.slice(2);

console.log("");
console.log("URI de redirection à déclarer dans Google Cloud Console :");
console.log(`  ${s.SUPABASE_URL}/auth/v1/callback`);
console.log("Origine JavaScript autorisée :");
console.log("  https://akora.fonenako.mg");
console.log("");

if (!identifiant || identifiant === "--etat") {
  const etat = await fetch(urlConfig, { headers: enTetes });
  if (!etat.ok) {
    console.error(`HTTP ${etat.status} — ${(await etat.text()).slice(0, 400)}`);
    process.exit(1);
  }
  const config = await etat.json();
  console.log("État actuel :");
  console.log("  external_google_enabled   " + JSON.stringify(config.external_google_enabled));
  console.log("  external_google_client_id " + (config.external_google_client_id ? "renseigné" : "vide"));
  console.log("");
  console.log("Pour activer : node scripts/configurer-google.mjs <client_id> <client_secret>");
  process.exit(0);
}

if (!secret) {
  console.error("Le secret client est requis en second argument.");
  process.exit(1);
}
if (!identifiant.endsWith(".apps.googleusercontent.com")) {
  console.error("L'identifiant client Google se termine par « .apps.googleusercontent.com ».");
  console.error("Vérifiez que vous avez copié l'identifiant, et non le secret.");
  process.exit(1);
}

const reponse = await fetch(urlConfig, {
  method: "PATCH",
  headers: enTetes,
  body: JSON.stringify({
    external_google_enabled: true,
    external_google_client_id: identifiant,
    external_google_secret: secret,
  }),
});
if (!reponse.ok) {
  console.error(`HTTP ${reponse.status} — ${(await reponse.text()).slice(0, 800)}`);
  process.exit(1);
}
const config = await reponse.json();
console.log("✓ Connexion Google activée");
console.log("  external_google_enabled   " + JSON.stringify(config.external_google_enabled));
console.log("  identifiant client        " + identifiant.slice(0, 18) + "… (" + identifiant.length + " caractères)");
console.log("  secret                    déposé (" + secret.length + " caracteres, jamais affiché)");
console.log("");
console.log("Le bouton « Continuer avec Google » apparaît tout seul sur le site :");
console.log("il interroge cette configuration avant de s'afficher.");
