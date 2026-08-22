// Génère une paire de clés VAPID pour les notifications push.
//
// Rien à acheter, rien à demander à personne : VAPID, c'est simplement une
// paire de clés ECDSA P-256 que le serveur signe et que le navigateur vérifie.
// On la fabrique en local, en dix secondes, avec la crypto de Node.
//
//   node scripts/generer-vapid.mjs
//
// La clé PUBLIQUE part dans .env.local (VITE_VAPID_PUBLIC_KEY) : elle est
// visible dans le bundle, c'est son rôle.
// La clé PRIVÉE ne quitte JAMAIS le serveur : secret d'Edge Function.
import { webcrypto } from "node:crypto";

const paire = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);

const base64url = (tampon) =>
  Buffer.from(tampon).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// La clé publique VAPID est le point non compressé de 65 octets (format « raw ».)
const publique = base64url(await webcrypto.subtle.exportKey("raw", paire.publicKey));
// La privée voyage en JWK : c'est ce qu'attendent les bibliothèques d'envoi.
const jwk = await webcrypto.subtle.exportKey("jwk", paire.privateKey);

console.log("\n── Clé PUBLIQUE (navigateur, dans le bundle) ──");
console.log("VITE_VAPID_PUBLIC_KEY=" + publique);
console.log("\n── Clé PRIVÉE (serveur uniquement, JAMAIS versionnée) ──");
console.log("VAPID_PRIVATE_KEY=" + jwk.d);
console.log("VAPID_SUBJECT=mailto:contact@akora.fonenako.mg");
console.log(`
À faire ensuite :
  1. Ajoutez la ligne VITE_VAPID_PUBLIC_KEY à ~/.akora-secrets/supabase.txt,
     puis relancez « node scripts/ecrire-env.mjs ».
  2. Déposez VAPID_PRIVATE_KEY et VAPID_SUBJECT dans les secrets des Edge
     Functions (tableau de bord Supabase, Edge Functions -> Secrets).
  3. La clé privée ne doit apparaître nulle part ailleurs. Si elle fuite,
     regénérez la paire : les abonnements existants deviennent caducs, rien
     de plus grave.
`);
