// Build + envoi FTP vers akora.fonenako.mg, en réutilisant le déployeur
// résilient déjà en place (identifiants dans ~/.deploy-sites, hors dépôt).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const deployeur = join(homedir(), ".deploy-sites", "ftp_deploy_robuste.py");
if (!existsSync(deployeur)) {
  console.error(`Déployeur introuvable : ${deployeur}`);
  process.exit(1);
}
// `npm.cmd` est un script de commande, pas un executable : sans `shell`,
// Node refuse de le lancer (EINVAL) des que l'appelant n'est pas cmd.exe.
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

// ⚠ Mémoire (03/09/2026). Sur le PC d'Andry, avec Docker, VS Code, Firefox,
// Outlook et plusieurs sessions Claude, il reste parfois moins d'un Go
// d'engagement mémoire. esbuild (Go) meurt alors « fatal error: out of
// memory » au rendu des chunks, et Node « heap out of memory » : `dist/`
// disparaît, et la prod garde l'ancien bundle sans que rien ne le dise.
// Ces réglages ont fait passer le build avec 2,4 Go libres : Go garde son
// tas sous 512 Mo et un seul fil, Node plafonne à 2,5 Go. Chacun reste
// surchargeable par l'environnement.
const env = {
  ...process.env,
  GOMEMLIMIT: process.env.GOMEMLIMIT ?? "512MiB",
  GOGC: process.env.GOGC ?? "30",
  GOMAXPROCS: process.env.GOMAXPROCS ?? "1",
  NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=2560 --max-semi-space-size=16",
};
execFileSync(npm, ["run", "build"], {
  cwd: racine,
  stdio: "inherit",
  shell: process.platform === "win32",
  env,
});

// Un build tombé sur la mémoire peut laisser un `dist/` vide ou partiel :
// on refuse d'envoyer tant que la coquille et son bundle ne sont pas là.
const index = join(racine, "dist", "index.html");
const bundle = existsSync(index) ? /assets\/index-[^"]+\.js/.exec(readFileSync(index, "utf8"))?.[0] : undefined;
if (!bundle || !existsSync(join(racine, "dist", bundle))) {
  console.error("Build incomplet : dist/index.html ou son bundle manque. Rien n'est envoyé.");
  process.exit(1);
}

execFileSync("python", [deployeur, join(racine, "dist"), "akora.fonenako.mg"], { cwd: racine, stdio: "inherit" });
console.log(`✓ déployé sur https://akora.fonenako.mg — vérifier en ligne : ${bundle}`);
