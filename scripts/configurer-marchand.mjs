// Depose les identifiants d'un operateur mobile money dans les secrets.
//
//   node scripts/configurer-marchand.mjs mvola  <client_id> <client_secret> <msisdn_marchand> [--production]
//   node scripts/configurer-marchand.mjs --etat
//
// Les URL et chemins d'API de MVola sont pre-remplis d'apres sa documentation
// publique. Rien n'est invente : ce qui n'est pas documente publiquement — les
// en-tetes exacts — reste a completer depuis le portail, apres connexion.
//
// Les identifiants ne transitent JAMAIS par le depot : ils vont directement
// dans les secrets des Edge Functions, ou seule la fonction de paiement les
// lit.
import { lireSecrets, refProjet } from "./secrets.mjs";

const OPERATEURS = {
  mvola: {
    nom: "MVola (Telma)",
    prefixes: "034, 038",
    portail: "https://www.mvola.mg/devportal/",
    // Confirmes par la documentation publique de l'API MVola.
    defauts: {
      MVOLA_BASE_URL_SANDBOX: "https://devapi.mvola.mg",
      MVOLA_BASE_URL_PRODUCTION: "https://api.mvola.mg",
      MVOLA_TOKEN_PATH: "/token",
      MVOLA_TOKEN_SCOPE: "EXT_INT_MVOLA_SCOPE",
      MVOLA_TRANSACTION_PATH: "/mvola/mm/transactions/type/merchantpay/1.0.0/",
      MVOLA_STATUS_PATH: "/mvola/mm/transactions/type/merchantpay/1.0.0/status/",
    },
  },
  orange: {
    nom: "Orange Money",
    prefixes: "032",
    portail: "https://developer.orange.com/apis/om-webpay",
    defauts: {},
  },
  airtel: {
    nom: "Airtel Money",
    prefixes: "033",
    portail: "https://developers.airtel.africa/",
    defauts: {},
  },
};

const s = lireSecrets();
const ref = refProjet(s.SUPABASE_URL);
const args = process.argv.slice(2);

const poser = async (valeurs) => {
  const reponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "akora-marchand/1.0",
    },
    body: JSON.stringify(Object.entries(valeurs).map(([name, value]) => ({ name, value }))),
  });
  if (!reponse.ok) {
    console.error(`HTTP ${reponse.status} — depot refuse (message masque, il contiendrait le secret)`);
    process.exit(1);
  }
};

if (args.length === 0 || args[0] === "--etat") {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
    headers: { Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`, "User-Agent": "akora-marchand/1.0" },
  });
  const noms = (await r.json()).map((x) => x.name);
  console.log("\nOperateurs mobile money :\n");
  for (const [cle, o] of Object.entries(OPERATEURS)) {
    const prefixe = cle.toUpperCase();
    const pret = noms.includes(`${prefixe}_CLIENT_ID`) && noms.includes(`${prefixe}_CLIENT_SECRET`);
    console.log(`  ${o.nom.padEnd(18)} ${o.prefixes.padEnd(10)} ${pret ? "configure" : "ABSENT"}`);
    if (!pret) console.log(`  ${" ".padEnd(18)} identifiants a demander sur ${o.portail}`);
  }
  console.log(
    "\nTant qu'un operateur est absent, Akora ne le propose pas au paiement — plutot\n" +
      "que d'echouer sous les doigts de l'acheteur. Le paiement retombe alors sur la\n" +
      "reference manuelle, qui fonctionne sans aucun identifiant.\n",
  );
  process.exit(0);
}

const [operateur, clientId, clientSecret, msisdn] = args;
const config = OPERATEURS[operateur];
if (!config) {
  console.error(`Operateur inconnu : ${operateur}. Attendu : mvola, orange ou airtel.`);
  process.exit(1);
}
if (!clientId || !clientSecret || !msisdn) {
  console.error(`Usage : node scripts/configurer-marchand.mjs ${operateur} <client_id> <client_secret> <msisdn_marchand>`);
  process.exit(1);
}

const production = args.includes("--production");
const prefixe = operateur.toUpperCase();
const base =
  config.defauts[`${prefixe}_BASE_URL_${production ? "PRODUCTION" : "SANDBOX"}`] ?? null;

if (!base) {
  console.error(
    `Aucune URL d'API documentee publiquement pour ${config.nom}.\n` +
      `Recuperez-la sur ${config.portail}, puis posez-la a la main :\n` +
      `  node scripts/definir-secrets.mjs "${prefixe}_BASE_URL=https://…"`,
  );
  process.exit(1);
}

const valeurs = {
  [`${prefixe}_BASE_URL`]: base,
  [`${prefixe}_CLIENT_ID`]: clientId,
  [`${prefixe}_CLIENT_SECRET`]: clientSecret,
  [`${prefixe}_PARTNER_MSISDN`]: msisdn,
  [`${prefixe}_PARTNER_NAME`]: "Akora",
};
for (const [cle, valeur] of Object.entries(config.defauts)) {
  if (!cle.includes("BASE_URL")) valeurs[cle] = valeur;
}

await poser(valeurs);

console.log(`\n✓ ${config.nom} configure en ${production ? "PRODUCTION" : "bac a sable"}`);
for (const cle of Object.keys(valeurs)) {
  const masque = cle.includes("SECRET") || cle.includes("CLIENT_ID");
  console.log(`  ${cle.padEnd(28)} ${masque ? `${valeurs[cle].length} caractere(s)` : valeurs[cle]}`);
}
console.log("\nRedeployez les fonctions : npm run fonctions:deploy paiement-initier paiement-statut");
console.log("Puis verifiez que l'operateur apparait bien au paiement avant d'annoncer quoi que ce soit.");
