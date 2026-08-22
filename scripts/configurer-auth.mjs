// Aligne la configuration d'authentification du projet Supabase sur ce que le
// site attend. Rejouable : relancer ne casse rien.
//
// Choix repris de Fonenako : la confirmation d'e-mail NATIVE de Supabase est
// desactivee (`mailer_autoconfirm: true`), parce qu'Akora envoie son PROPRE
// code a six chiffres par SMTP o2switch. Laisser les deux actifs enverrait
// deux messages et bloquerait la connexion sur un lien jamais ouvert.
//
// La confirmation reste OBLIGATOIRE : c'est notre fonction verifier-code qui
// pose `email_confirmed_at`, pas Supabase.
import { lireSecrets, refProjet } from "./secrets.mjs";

const s = lireSecrets();
if (!s.SUPABASE_ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN requis.");
  process.exit(1);
}
const ref = refProjet(s.SUPABASE_URL);
const site = "https://akora.fonenako.mg";

const reglages = {
  site_url: site,
  uri_allow_list: [site + "/**", "http://localhost:8080/**"].join(","),
  // Notre OTP remplace le lien de confirmation natif.
  mailer_autoconfirm: true,
  external_email_enabled: true,
  disable_signup: false,
  // Le formulaire exige 8 caracteres avec lettre et chiffre : la base doit
  // etre au moins aussi stricte, sinon un appel direct a l'API passerait.
  password_min_length: 8,
  // Un changement d'adresse exige de confirmer l'ancienne ET la nouvelle.
  mailer_secure_email_change_enabled: true,
  // Duree de vie d'un lien magique, si jamais on en emet un.
  mailer_otp_exp: 900,
  jwt_exp: 3600,
};

const reponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${s.SUPABASE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "akora-auth/1.0",
  },
  body: JSON.stringify(reglages),
});
if (!reponse.ok) {
  console.error(`HTTP ${reponse.status} — ${(await reponse.text()).slice(0, 800)}`);
  process.exit(1);
}

const config = await reponse.json();
console.log("✓ Authentification configurée");
for (const cle of Object.keys(reglages)) {
  console.log("  " + cle.padEnd(36) + JSON.stringify(config[cle]));
}
