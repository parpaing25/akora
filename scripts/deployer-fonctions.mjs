// Déploie les Edge Functions sur le projet Supabase.
//
// Le noyau métier (livraison, paliers, argent, prestataires de paiement) n'est
// PAS dupliqué : il est lu depuis src/lib au moment du déploiement et embarqué
// sous `_partage/`. Le serveur exécute donc exactement le code qui a affiché
// l'estimation au client — condition de la recette F7.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lireSecrets, refProjet } from "./secrets.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const s = lireSecrets();
if (!s.SUPABASE_ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN requis.");
  process.exit(1);
}
const ref = refProjet(s.SUPABASE_URL);

/** Modules partagés, copiés tels quels depuis src/lib. */
const PARTAGE = [
  ["argent.ts", "src/lib/argent.ts"],
  ["paliers.ts", "src/lib/paliers.ts"],
  ["livraison.ts", "src/lib/livraison.ts"],
  ["paiement/types.ts", "src/lib/paiement/types.ts"],
  ["paiement/oauth-marchand.ts", "src/lib/paiement/oauth-marchand.ts"],
  ["paiement/mvola.ts", "src/lib/paiement/mvola.ts"],
  ["paiement/orange-money.ts", "src/lib/paiement/orange-money.ts"],
  ["paiement/airtel-money.ts", "src/lib/paiement/airtel-money.ts"],
  ["paiement/reference-manuelle.ts", "src/lib/paiement/reference-manuelle.ts"],
  ["paiement/index.ts", "src/lib/paiement/index.ts"],
];

const fichiersPartages = PARTAGE.map(([nom, source]) => {
  const chemin = join(racine, source);
  if (!existsSync(chemin)) {
    console.error(`Module partagé introuvable : ${source}`);
    process.exit(1);
  }
  return { name: `_partage/${nom}`, content: readFileSync(chemin, "utf8") };
});

const commun = {
  name: "_commun.ts",
  content: readFileSync(join(racine, "supabase/functions/_commun.ts"), "utf8"),
};

const dossierFonctions = join(racine, "supabase", "functions");
const fonctions = readdirSync(dossierFonctions, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
  .map((e) => e.name);

const demandees = process.argv.slice(2);
const aDeployer = demandees.length ? fonctions.filter((f) => demandees.includes(f)) : fonctions;

// Le webhook est PUBLIC : les opérateurs n'ont pas de jeton Supabase.
// Il vérifie lui-même la signature, et n'applique rien sans elle.
const SANS_JWT = new Set([
  "paiement-webhook",
  "paiement-reconciliation",
  "commande-creer",
  // Appelees juste apres signUp, avant toute session utilisable.
  "envoyer-code",
  "verifier-code",
]);

for (const nom of aDeployer) {
  const entree = join(dossierFonctions, nom, "index.ts");
  if (!existsSync(entree)) continue;

  // L'API place tous les fichiers a plat, a cote de l'entree. On reecrit donc
  // les imports « ../ » du dossier local en « ./ » — le rangement local reste
  // lisible, et le bundler retrouve ses petits.
  const aPlat = (contenu) => contenu.replaceAll('from "../_commun.ts"', 'from "./_commun.ts"').replaceAll('from "../_partage/', 'from "./_partage/');

  const fichiers = [
    { name: "index.ts", content: aPlat(readFileSync(entree, "utf8")) },
    { name: commun.name, content: aPlat(commun.content) },
    ...fichiersPartages,
  ];

  process.stdout.write(`→ ${nom} … `);
  const reponse = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=${encodeURIComponent(nom)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`,
        "User-Agent": "akora-functions/1.0",
      },
      body: corpsMultipart(nom, fichiers, !SANS_JWT.has(nom)),
    },
  );
  const texte = await reponse.text();
  if (!reponse.ok) {
    console.log("ECHEC");
    console.error(texte.slice(0, 1200));
    process.exit(1);
  }
  console.log("ok");
}
console.log(`\n✓ ${aDeployer.length} fonction(s) déployée(s).`);

/** Construit le corps multipart attendu par l'API de déploiement. */
function corpsMultipart(nom, fichiers, verifyJwt) {
  const donnees = new FormData();
  donnees.append(
    "metadata",
    JSON.stringify({
      name: nom,
      entrypoint_path: "index.ts",
      verify_jwt: verifyJwt,
      static_patterns: [],
    }),
  );
  for (const fichier of fichiers) {
    donnees.append("file", new Blob([fichier.content], { type: "text/typescript" }), fichier.name);
  }
  return donnees;
}
