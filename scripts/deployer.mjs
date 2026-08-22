// Build + envoi FTP vers akora.fonenako.mg, en réutilisant le déployeur
// résilient déjà en place (identifiants dans ~/.deploy-sites, hors dépôt).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const deployeur = join(homedir(), ".deploy-sites", "ftp_deploy_robuste.py");
if (!existsSync(deployeur)) {
  console.error(`Déployeur introuvable : ${deployeur}`);
  process.exit(1);
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
execFileSync(npm, ["run", "build"], { cwd: racine, stdio: "inherit" });
execFileSync("python", [deployeur, join(racine, "dist"), "akora.fonenako.mg"], { cwd: racine, stdio: "inherit" });
console.log("✓ déployé sur https://akora.fonenako.mg");
