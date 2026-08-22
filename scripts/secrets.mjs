// Lit les secrets Akora depuis ~/.akora-secrets/supabase.txt.
// Ce fichier vit HORS du dépôt : rien de sensible n'est jamais versionné (A2.5).
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CHEMIN_SECRETS = join(homedir(), ".akora-secrets", "supabase.txt");

export function lireSecrets() {
  if (!existsSync(CHEMIN_SECRETS)) {
    console.error(`\nFichier de secrets introuvable : ${CHEMIN_SECRETS}`);
    console.error("Voir docs/SUPABASE-DEMARRAGE.md, section 3.\n");
    process.exit(1);
  }
  const secrets = {};
  for (const ligne of readFileSync(CHEMIN_SECRETS, "utf8").split(/\r?\n/)) {
    const nettoyee = ligne.trim();
    if (!nettoyee || nettoyee.startsWith("#")) continue;
    const sep = nettoyee.indexOf("=");
    if (sep === -1) continue;
    secrets[nettoyee.slice(0, sep).trim()] = nettoyee.slice(sep + 1).trim();
  }
  const manquants = ["SUPABASE_URL", "SUPABASE_ANON_KEY"].filter((c) => !secrets[c]);
  if (manquants.length) {
    console.error(`Clés manquantes dans ${CHEMIN_SECRETS} : ${manquants.join(", ")}`);
    process.exit(1);
  }
  // Garde-fou : on refuse net une clé service_role, même déposée par erreur.
  for (const [cle, valeur] of Object.entries(secrets)) {
    if (/service_role|sb_secret_/i.test(cle) || /sb_secret_/.test(valeur)) {
      console.error(`\nSTOP : ${cle} ressemble à une clé service_role.`);
      console.error("Elle ne doit jamais être utilisée ici. Fais-la tourner dans Supabase.\n");
      process.exit(1);
    }
  }
  return secrets;
}

/** Extrait la référence du projet depuis son URL (https://<ref>.supabase.co). */
export function refProjet(url) {
  const m = /^https:\/\/([a-z0-9]+)\.supabase\.(co|in)/i.exec(url);
  if (!m) {
    console.error(`URL de projet inattendue : ${url}`);
    process.exit(1);
  }
  return m[1];
}
