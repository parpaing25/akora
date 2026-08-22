// Controle de recette, joue avec la VRAIE cle anon contre la VRAIE base.
// Verifie que ce qui doit etre ferme l'est, et que ce qui doit etre ouvert
// l'est aussi. A relancer apres toute migration touchant la RLS.
import { lireSecrets } from "./secrets.mjs";

const s = lireSecrets();
const base = s.SUPABASE_URL;
const cle = s.SUPABASE_ANON_KEY;

async function rest(chemin) {
  const r = await fetch(`${base}/rest/v1/${chemin}`, {
    headers: { apikey: cle, Accept: "application/json" },
  });
  return { statut: r.status, corps: await r.text() };
}
async function rpc(nom, args = {}) {
  const r = await fetch(`${base}/rest/v1/rpc/${nom}`, {
    method: "POST",
    headers: { apikey: cle, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return { statut: r.status, corps: await r.text() };
}

const resultats = [];
function verifier(intitule, ok, detail) {
  resultats.push({ intitule, ok, detail });
}

// ── Ce qui doit rester FERME a un visiteur ────────────────────────────────
for (const table of [
  "profiles", "fournisseurs", "produits", "commandes", "lignes_commande",
  "paiements", "ledger", "portefeuilles", "documents_fournisseur", "retraits",
  "litiges", "audit_log", "webhooks_recus", "notifications", "favoris",
  "adresses_chantier", "demandes_materiau", "user_roles", "vues_produit_jour",
  "rate_limits", "compteurs_commande", "signalements", "fournisseur_membres",
]) {
  const { statut } = await rest(`${table}?select=*&limit=1`);
  verifier(`anon ne lit pas ${table}`, statut === 401 || statut === 403 || statut === 404, `HTTP ${statut}`);
}

// ── Les fonctions internes ne doivent pas etre appelables ─────────────────
for (const nom of ["ecrire_ledger", "liberer_sequestre", "journaliser", "notifier",
                   "consommer_quota", "prochain_numero_commande",
                   "recalculer_niveau_verification", "attribuer_badges_partenaire",
                   "verifier_solde_ledger", "controle_ledger"]) {
  const { statut } = await rpc(nom);
  verifier(`anon n'appelle pas ${nom}()`, statut === 401 || statut === 403 || statut === 404, `HTTP ${statut}`);
}

// ── Ce qui doit rester OUVERT ─────────────────────────────────────────────
// Le nombre attendu est un PLANCHER, pas une égalité : ces tables
// s'enrichissent (les 106 quartiers de Tana sont arrivés après l'écriture de
// ce contrôle, et l'ont fait échouer alors que rien n'était cassé). Ce qu'on
// vérifie ici, c'est que la lecture anonyme reste ouverte et non vide.
const ouvert = [
  ["categories?select=slug,nom&limit=100", 8],
  ["materiaux_ref?select=slug&limit=200", 79],
  ["localites?select=slug&limit=500", 81],
  ["ratios_metre?select=cle&limit=100", 22],
  ["parametres?select=cle&limit=100", 8],
];
for (const [chemin, plancher] of ouvert) {
  const { statut, corps } = await rest(chemin);
  let n = -1;
  try { n = JSON.parse(corps).length; } catch { /* corps non JSON */ }
  verifier(`anon lit ${chemin.split("?")[0]} (${plancher} lignes au moins)`, statut === 200 && n >= plancher, `HTTP ${statut}, ${n} ligne(s)`);
}
for (const vue of ["fournisseurs_publics", "produits_publics", "prix_marche"]) {
  const { statut } = await rest(`${vue}?select=*&limit=1`);
  verifier(`anon lit la vue ${vue}`, statut === 200, `HTTP ${statut}`);
}

// ── La vue publique ne doit exposer AUCUNE coordonnee personnelle ─────────
const { statut: sv, corps: cv } = await rest("fournisseurs_publics?select=*&limit=1");
const interdits = ["telephone", "whatsapp", "email", "adresse", "msisdn_versement", "operateur_versement", "owner_id"];
const { corps: colonnes } = await rest("fournisseurs_publics?select=*&limit=0");
const fuite = interdits.filter((c) => (colonnes + cv).includes(`"${c}"`));
verifier("la vue publique n'expose aucune donnee personnelle", sv === 200 && fuite.length === 0,
         fuite.length ? `colonnes exposees : ${fuite.join(", ")}` : "aucune");

// ── Rapport ───────────────────────────────────────────────────────────────
// ── Les fonctions doivent etre APPELABLES DEPUIS UN NAVIGATEUR ───────────
// Un appel depuis Node ne declenche aucune requete prealable CORS : tout
// passait en test et rien ne partait du navigateur. Le 22/08/2026, l'envoi du
// code d'inscription est reste muet pendant des heures pour cette seule
// raison — le client Supabase pose `x-application-name` sur chaque requete, le
// navigateur le declarait dans son preflight, et la fonction ne l'autorisait
// pas. On rejoue donc ici le preflight EXACT du navigateur.
const ENTETES_NAVIGATEUR = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-application-name",
];
for (const fonction of ["envoyer-code", "verifier-code", "mot-de-passe-code",
                        "mot-de-passe-reinitialiser", "commande-creer", "paiement-initier"]) {
  let autorises = "";
  let statut = 0;
  try {
    const r = await fetch(`${base}/functions/v1/${fonction}`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://akora.fonenako.mg",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": ENTETES_NAVIGATEUR.join(", "),
      },
    });
    statut = r.status;
    autorises = (r.headers.get("access-control-allow-headers") ?? "").toLowerCase();
  } catch (erreur) {
    statut = -1;
  }
  const manquants = ENTETES_NAVIGATEUR.filter((h) => !autorises.includes(h));
  verifier(`${fonction} accepte le preflight du navigateur`,
    statut === 200 && manquants.length === 0,
    manquants.length ? `manque : ${manquants.join(", ")}` : `HTTP ${statut}`);
}

const echecs = resultats.filter((r) => !r.ok);
for (const r of resultats) {
  if (!r.ok) console.log(`  ECHEC  ${r.intitule} — ${r.detail}`);
}
console.log(`\n${resultats.length - echecs.length}/${resultats.length} controles passes.`);
if (echecs.length) process.exit(1);
console.log("Tout est conforme.");
