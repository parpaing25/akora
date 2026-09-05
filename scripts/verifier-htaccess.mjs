// Casse le build si un préfixe de premier niveau de src/App.tsx manque dans la
// RewriteCond du « vrai 404 » de public/.htaccess : sinon une vraie page
// répondrait 404 (audit S-01, 05/09/2026). Branché en `prebuild`.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(racine, "src", "App.tsx"), "utf8");
const htaccess = readFileSync(join(racine, "public", ".htaccess"), "utf8");

// Premier segment de chaque route déclarée (path="a/b" → a ; path="a" → a).
const declares = new Set(
  [...app.matchAll(/path="([a-z0-9-]+)(?:\/|")/g)].map((m) => m[1]).filter((p) => p !== "*"),
);
// Les routes imbriquées de compte/pro/admin n'ont pas de préfixe propre : elles
// vivent sous compte, pro, admin, déjà déclarés comme <Route path="compte">.
const bloc = htaccess.match(/!\^\/\(([^)]+)\)\(\/\|\$\)/)?.[1];
if (!bloc) {
  console.error("htaccess : la RewriteCond du vrai 404 est introuvable (motif !^/(…)(/|$)).");
  process.exit(1);
}
const autorises = new Set(bloc.split("|"));
const enfants = new Set([
  // segments qui n'existent que sous /compte, /pro ou /admin (jamais en premier segment)
  "commandes", "paiements", "favoris", "adresses", "securite", "publier", "demandes", "clients",
  "catalogue", "livraison", "vitrine", "portefeuille", "avis", "statistiques", "utilisateurs",
  "verifications", "litiges", "versements", "referentiels", "moderation", "audit", "retour",
]);
const manquants = [...declares].filter((p) => !autorises.has(p) && !enfants.has(p));
if (manquants.length) {
  console.error(`htaccess : préfixes de App.tsx absents du vrai 404 → ${manquants.join(", ")}`);
  process.exit(1);
}
console.log(`htaccess : ${autorises.size} préfixes autorisés, tous ceux de App.tsx sont couverts.`);
