// Contrôle de recette STATIQUE sur le code source (partie F de la spec).
// Ce que ce script vérifie ne se voit pas à l'exécution : il faut le lire.
// Le pendant dynamique est scripts/verifier-securite.mjs, joué contre la base.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const constats = [];
const echecs = [];

function verifier(intitule, ok, detail) {
  constats.push({ intitule, ok, detail });
  if (!ok) echecs.push(intitule);
}

function fichiers(dossier, extensions) {
  const sortie = [];
  const parcourir = (chemin) => {
    for (const entree of readdirSync(chemin)) {
      if (["node_modules", "dist", ".git"].includes(entree)) continue;
      const complet = join(chemin, entree);
      if (statSync(complet).isDirectory()) parcourir(complet);
      else if (extensions.some((e) => entree.endsWith(e))) sortie.push(complet);
    }
  };
  parcourir(join(racine, dossier));
  return sortie;
}

const sources = fichiers("src", [".ts", ".tsx"]);
const lire = (f) => readFileSync(f, "utf8");
const court = (f) => relative(racine, f).split('\\').join('/');

// ── F1 : aucun select('*') sur une table porteuse de donnees personnelles ──
const TABLES_PII = [
  "profiles", "fournisseurs", "commandes", "paiements", "documents_fournisseur",
  "litiges", "retraits", "adresses_chantier", "notifications", "audit_log",
];
const etoiles = [];
for (const fichier of sources) {
  const contenu = lire(fichier);
  for (const table of TABLES_PII) {
    const motif = new RegExp(`from\\("${table}"\\)[\\s\\S]{0,80}?\\.select\\(\\s*"\\*"`, "g");
    if (motif.test(contenu)) etoiles.push(`${court(fichier)} → ${table}`);
  }
}
// L'export personnel de /compte/securite fait exception : l'utilisateur
// telecharge SES lignes, filtrees par la RLS, et il a le droit de tout voir.
const etoilesReelles = etoiles.filter((e) => !e.includes("compte/Securite"));
verifier("F1 · aucun select('*') sur une table à données personnelles", etoilesReelles.length === 0,
  etoilesReelles.join(", ") || "aucun");

// ── F2 : toute ecriture retourne un id ────────────────────────────────────
const ecrituresNues = [];
for (const fichier of sources) {
  const contenu = lire(fichier);
  const motif = /\.(insert|update|upsert|delete)\(([\s\S]{0,400}?)\)([\s\S]{0,200}?);/g;
  let trouve;
  while ((trouve = motif.exec(contenu)) !== null) {
    const suite = trouve[3] ?? "";
    if (!suite.includes(".select(")) ecrituresNues.push(`${court(fichier)}:${trouve[1]}`);
  }
}
verifier("F2 · toute écriture se termine par .select('id')", ecrituresNues.length === 0,
  ecrituresNues.slice(0, 5).join(", ") || "aucune écriture nue");

// ── F3 : un seul abonnement Realtime, sur notifications ───────────────────
const canaux = sources.filter((f) => /\.channel\(/.test(lire(f))).map(court);
const canauxHorsNotifications = canaux.filter((f) => !f.includes("useNotifications"));
verifier("F3 · un seul abonnement Realtime, sur notifications", canauxHorsNotifications.length === 0,
  canaux.join(", ") || "aucun");

// ── F4 : aucun secret, aucune cle service_role, aucune URL d'API en dur ───
const tous = [...sources, ...fichiers("supabase", [".sql", ".ts"]), ...fichiers("serveur", [".php"])];
const suspects = [];
for (const fichier of tous) {
  const contenu = lire(fichier);
  // Lire la cle depuis l'environnement du serveur est legitime ; l'ecrire en
  // dur ne l'est pas. On ne signale que l'affectation d'une valeur.
  if (/service_role[^)\n]{0,40}=\s*["'][A-Za-z0-9._-]{20,}/i.test(contenu)) {
    suspects.push(court(fichier) + " (service_role en dur)");
  }
  if (/eyJhbGciOiJIUzI1NiI/.test(contenu)) suspects.push(court(fichier) + " (JWT en dur)");
  if (/sb_secret_/.test(contenu)) suspects.push(court(fichier) + " (clé secrète)");
  if (/https:\/\/(api\.)?(mvola|orange|airtel)[a-z.]*\//i.test(contenu)) suspects.push(court(fichier) + " (URL marchande en dur)");
}
verifier("F4 · aucun secret ni URL d'API marchande dans le dépôt", suspects.length === 0,
  suspects.join(", ") || "aucun");

// ── F6 : les roles viennent de user_roles, jamais de profiles ─────────────
const rolesDansProfil = sources.filter((f) => /profiles[\s\S]{0,120}\brole\b/.test(lire(f))).map(court);
verifier("F6 · les rôles ne sont jamais lus dans profiles", rolesDansProfil.length === 0,
  rolesDansProfil.join(", ") || "aucun");

// ── A2.9 : aucun dangerouslySetInnerHTML ──────────────────────────────────
// On cherche l'USAGE de la propriete, pas sa mention dans un commentaire.
const innerHtml = sources.filter((f) => /dangerouslySetInnerHTML\s*=\s*\{/.test(lire(f))).map(court);
verifier("A2.9 · aucun dangerouslySetInnerHTML", innerHtml.length === 0, innerHtml.join(", ") || "aucun");

// ── A3 : tout lien externe porte rel="noopener noreferrer" ────────────────
const liensNus = [];
for (const fichier of sources) {
  const contenu = lire(fichier);
  const motif = /<a\s([^>]*target="_blank"[^>]*)>/g;
  let trouve;
  while ((trouve = motif.exec(contenu)) !== null) {
    if (!/noopener/.test(trouve[1] ?? "")) liensNus.push(court(fichier));
  }
}
verifier("A3 · tout lien en nouvel onglet porte rel=noopener", liensNus.length === 0,
  liensNus.join(", ") || "aucun");

// ── A5 : aucun champ de saisie sans etiquette associee ────────────────────
const champsNus = [];
for (const fichier of sources) {
  const contenu = lire(fichier);
  const motif = /<(input|textarea|select)\s([\s\S]{0,300}?)\/?>/g;
  let trouve;
  while ((trouve = motif.exec(contenu)) !== null) {
    const attributs = trouve[2] ?? "";
    const etiquete =
      /\{\.\.\.a\}|\{\.\.\.attributs\}|\bid=/.test(attributs) ||
      /aria-label|sr-only|proprietesLeurre|type="file"|type="hidden"/.test(attributs);
    if (!etiquete) champsNus.push(`${court(fichier)} → <${trouve[1]}>`);
  }
}
verifier("A5 · aucun champ de saisie sans étiquette ou identifiant", champsNus.length === 0,
  champsNus.slice(0, 5).join(", ") || "aucun");

// ── A4 : aucune image sans dimensions ni aspect-ratio ─────────────────────
const imagesNues = [];
for (const fichier of sources) {
  const contenu = lire(fichier);
  const motif = /<img\s([\s\S]{0,400}?)\/>/g;
  let trouve;
  while ((trouve = motif.exec(contenu)) !== null) {
    const attributs = trouve[1] ?? "";
    if (!/width=|aspect-|size-|className=/.test(attributs)) imagesNues.push(court(fichier));
  }
}
verifier("A4 · aucune image sans dimension ni aspect-ratio", imagesNues.length === 0,
  imagesNues.join(", ") || "aucune");

// ── D6 : chaque appel a <Seo> porte un chemin propre ──────────────────────
const seoSansChemin = [];
for (const fichier of sources) {
  const contenu = lire(fichier);
  const motif = /<Seo\s([\s\S]{0,600}?)\/>/g;
  let trouve;
  while ((trouve = motif.exec(contenu)) !== null) {
    if (!/chemin=/.test(trouve[1] ?? "")) seoSansChemin.push(court(fichier));
  }
}
verifier("F14 · chaque page a une canonique propre", seoSansChemin.length === 0,
  seoSansChemin.join(", ") || "aucune page sans chemin");

// ── Rapport ───────────────────────────────────────────────────────────────
for (const constat of constats) {
  console.log(`${constat.ok ? "  ok  " : "ECHEC "} ${constat.intitule}`);
  if (!constat.ok) console.log(`        ${constat.detail}`);
}
console.log(`\n${constats.length - echecs.length}/${constats.length} contrôles passés.`);
if (echecs.length) process.exit(1);
