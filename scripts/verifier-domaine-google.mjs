// Pose le fichier de verification Google Search Console, puis deploie.
//
//   node scripts/verifier-domaine-google.mjs google1a2b3c4d5e6f7890.html
//   node scripts/verifier-domaine-google.mjs --meta 1a2b3c4d5e6f7890
//
// ── Pourquoi c'est necessaire ────────────────────────────────────────────
// Google refuse d'afficher le nom et le logo d'une application tant que
// l'URL de sa page d'accueil n'est pas VERIFIEE dans Search Console, par le
// compte Google qui possede le projet Cloud. Sans cela, l'ecran de
// consentement montre le domaine technique de Supabase — ce qui n'inspire
// aucune confiance, et ressemble a de l'hameconnage.
//
// ── Deux methodes, deux portees ─────────────────────────────────────────
// · FICHIER HTML  → propriete « prefixe d'URL » : ne vaut QUE pour cette
//   adresse exacte. C'est ce que fait ce script.
// · TXT DNS       → propriete « domaine » : couvre le domaine ET tous ses
//   sous-domaines, en une fois. Preferable quand on gere plusieurs sites
//   sous le meme domaine, mais elle demande l'acces a la zone DNS.
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(
    "Usage :\n" +
      "  node scripts/verifier-domaine-google.mjs <googleXXXX.html>\n" +
      "  node scripts/verifier-domaine-google.mjs --meta <jeton>\n\n" +
      "Le nom du fichier vient de Search Console : Ajouter une propriete →\n" +
      "Prefixe d'URL → https://akora.fonenako.mg → methode « Fichier HTML ».",
  );
  process.exit(1);
}

if (args[0] === "--meta") {
  const jeton = args[1];
  if (!jeton) {
    console.error("Jeton manquant apres --meta.");
    process.exit(1);
  }
  const index = join(racine, "index.html");
  let contenu = readIndex(index);
  const balise = `<meta name="google-site-verification" content="${jeton}" />`;
  if (contenu.includes('name="google-site-verification"')) {
    contenu = contenu.replace(
      /<meta name="google-site-verification"[^>]*>/,
      balise,
    );
  } else {
    contenu = contenu.replace("</head>", `    ${balise}\n  </head>`);
  }
  writeFileSync(index, contenu, "utf8");
  console.log(`✓ balise posee dans index.html`);
} else {
  const nom = args[0];
  if (!/^google[a-z0-9]+\.html$/.test(nom)) {
    console.error(
      `« ${nom} » ne ressemble pas a un fichier de verification Google.\n` +
        "Attendu : googleXXXXXXXXXXXXXXXX.html, tel que Search Console le nomme.",
    );
    process.exit(1);
  }
  // Le contenu exact qu'attend Google : une seule ligne, rien d'autre.
  writeFileSync(join(racine, "public", nom), `google-site-verification: ${nom}\n`, "utf8");
  console.log(`✓ public/${nom} ecrit`);
}

console.log("\nDeployez, puis cliquez « Verifier » dans Search Console :");
console.log("  npm run deploy");
console.log("\nLa regle de reecriture du site laisse passer les fichiers reels :");
console.log("le fichier sera servi tel quel, pas remplace par l'application.");

function readIndex(chemin) {
  if (!existsSync(chemin)) {
    console.error(`index.html introuvable : ${chemin}`);
    process.exit(1);
  }
  return String(readFileSync(chemin, "utf8"));
}
