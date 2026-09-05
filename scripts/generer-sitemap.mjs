// Produit public/sitemap.xml AVANT chaque build (branche en `prebuild`).
//
// Pourquoi un fichier reel : le site est une SPA servie avec un fallback vers
// index.html. Sans fichier, /sitemap.xml — que robots.txt annonce — repondait
// du HTML en 200, et Google classe ca en « sitemap illisible ». Un fichier
// statique ecrit au build regle le probleme sans PHP ni serveur.
//
// Les routes STATIQUES sont ecrites en dur ; les URL du REFERENTIEL
// (familles, types, formats — ~135 pages indexables) sont lues dans la base
// au moment du build, avec un REPLI : si la base ne repond pas, le sitemap
// reste statique et le build ne casse pas. Un sitemap partiel et juste vaut
// mieux qu'un build qui echoue. Avant le 01/09, 20 URL sur ~135 etaient
// declarees : le seul canal d'acquisition gratuit etait ferme a 85 %.
//
// /recherche n'y figure pas : robots.txt la refuse (Disallow), et annoncer
// dans le sitemap ce qu'on interdit au robot est une contradiction que la
// Search Console signale. Meme logique pour /depot-reserve : confidentiel.
import { writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lireSecrets, CHEMIN_SECRETS } from "./secrets.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");

// Meme valeur par defaut que ENV.siteUrl (src/lib/env.ts) : surchargeable par
// VITE_SITE_URL pour une preprod, identique en prod.
const SITE = (process.env.VITE_SITE_URL ?? "https://akora.fonenako.mg").replace(/\/$/, "");

/** Les routes publiques statiques, reprises de feu src/lib/sitemap.ts. */
const ENTREES = [
  { chemin: "/", priorite: 1, frequence: "daily" },
  { chemin: "/materiaux", priorite: 0.9, frequence: "weekly" },
  { chemin: "/fournisseurs", priorite: 0.9, frequence: "daily" },
  { chemin: "/transporteurs", priorite: 0.9, frequence: "daily" },
  { chemin: "/prix", priorite: 0.9, frequence: "daily" },
  { chemin: "/calculateurs", priorite: 0.8, frequence: "monthly" },
  { chemin: "/verification", priorite: 0.7, frequence: "monthly" },
  { chemin: "/devenir-fournisseur", priorite: 0.8, frequence: "monthly" },
  { chemin: "/a-propos", priorite: 0.4, frequence: "monthly", maj: "2026-09-06" },
  { chemin: "/contact", priorite: 0.4, frequence: "monthly", maj: "2026-09-06" },
  // Pages construites par l'audit du 05/09/2026 (docs/audit-2026-09-05/04-pages-construites).
  { chemin: "/faq", priorite: 0.7, frequence: "monthly", maj: "2026-09-06" },
  { chemin: "/accessibilite", priorite: 0.3, frequence: "yearly", maj: "2026-09-06" },
  // `maj` = la date « mis à jour le » affichée par PageTexte : la seule vraie.
  { chemin: "/conditions-utilisation", priorite: 0.3, frequence: "yearly", maj: "2026-08-22" },
  { chemin: "/politique-confidentialite", priorite: 0.3, frequence: "yearly", maj: "2026-09-06" },
  { chemin: "/mentions-legales", priorite: 0.3, frequence: "yearly", maj: "2026-09-06" },
  { chemin: "/guides/choisir-son-sable", priorite: 0.7, frequence: "monthly" },
  { chemin: "/guides/combien-de-parpaings", priorite: 0.7, frequence: "monthly" },
  { chemin: "/guides/reception-livraison", priorite: 0.7, frequence: "monthly" },
  { chemin: "/guides/payer-mobile-money", priorite: 0.7, frequence: "monthly" },
  { chemin: "/calculateurs/mur-parpaings", priorite: 0.7, frequence: "monthly" },
  { chemin: "/calculateurs/dalle-hourdis", priorite: 0.7, frequence: "monthly" },
  { chemin: "/calculateurs/beton", priorite: 0.7, frequence: "monthly" },
  { chemin: "/calculateurs/chape-enduit", priorite: 0.7, frequence: "monthly" },
  { chemin: "/calculateurs/toiture", priorite: 0.7, frequence: "monthly" },
];

/** AAAA-MM-JJ ou null. Jamais une date inventée : Google ignore un lastmod qui
 *  vaut « maintenant » partout, et finit par ignorer le reste. */
function jour(valeur) {
  if (!valeur) return null;
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Les URL du référentiel, lues dans les vues publiques avec la clé anon.
 * Toute erreur rend une liste vide : le sitemap reste statique, le build vit.
 */
async function entreesReferentiel() {
  // `lireSecrets()` termine le processus si le fichier manque : on teste
  // l'existence NOUS-MÊMES pour que le sitemap reste statique au lieu de
  // tuer le build sur une machine sans secrets.
  if (!existsSync(CHEMIN_SECRETS)) {
    console.warn("sitemap : pas de secrets Akora sur cette machine — sitemap statique seul.");
    return [];
  }
  const secrets = lireSecrets();
  const url = secrets.SUPABASE_URL.replace(/\/$/, "");
  const cle = secrets.SUPABASE_ANON_KEY;
  const lire = async (chemin) => {
    const reponse = await fetch(`${url}/rest/v1/${chemin}`, {
      headers: { apikey: cle, Authorization: `Bearer ${cle}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!reponse.ok) throw new Error(`${chemin} : HTTP ${reponse.status}`);
    return reponse.json();
  };
  try {
    const [types, formats, fournisseurs, produits] = await Promise.all([
      lire("types_vitrine?select=slug,famille_slug"),
      lire("formats_vitrine?select=slug,type_slug,famille_slug,prix_indicatif_le"),
      lire("fournisseurs_publics?select=slug,created_at&limit=500"),
      // 40 fiches aujourd'hui ; la limite PostgREST par défaut est 1000 : au-delà, paginer.
      lire("produits_publics?select=slug,fournisseur_slug,prix_maj_le,created_at&limit=1000"),
    ]);
    const entrees = [];
    const familles = new Set(types.map((t) => t.famille_slug));
    for (const f of familles)
      entrees.push({ chemin: `/materiaux/${f}`, priorite: 0.8, frequence: "weekly" });
    for (const t of types)
      entrees.push({ chemin: `/materiaux/${t.famille_slug}/${t.slug}`, priorite: 0.7, frequence: "weekly" });
    for (const fo of formats) {
      entrees.push({
        chemin: `/materiaux/${fo.famille_slug}/${fo.type_slug}/${fo.slug}`,
        priorite: 0.6,
        frequence: "weekly",
      });
      // La page prix nationale de chaque format existe toujours (repli
      // fourchette indicative) : indexable des le premier jour.
      // La page prix bouge quand le prix indicatif bouge : c'est SA date.
      entrees.push({ chemin: `/prix/${fo.slug}/madagascar`, priorite: 0.6, frequence: "daily", maj: jour(fo.prix_indicatif_le) });
    }
    for (const f of fournisseurs)
      entrees.push({ chemin: `/fournisseurs/${f.slug}`, priorite: 0.6, frequence: "weekly", maj: jour(f.created_at) });
    // Les fiches produit : la page qui convertit, et la seule à porter le JSON-LD Product (audit S-04).
    for (const p of produits) {
      if (!p.slug || !p.fournisseur_slug) continue;
      entrees.push({
        chemin: `/fournisseurs/${p.fournisseur_slug}/${p.slug}`,
        priorite: 0.7,
        frequence: "weekly",
        maj: jour(p.prix_maj_le ?? p.created_at),
      });
    }
    return entrees;
  } catch (erreur) {
    console.warn(`sitemap : referentiel injoignable (${erreur.message}) — sitemap statique seul.`);
    return [];
  }
}

const dynamiques = await entreesReferentiel();
const toutes = [...ENTREES, ...dynamiques];

const urls = toutes
  .map(
    (e) =>
      `  <url>\n    <loc>${SITE}${e.chemin === "/" ? "/" : e.chemin}</loc>\n` +
      (e.maj ? `    <lastmod>${e.maj}</lastmod>\n` : "") +
      `    <changefreq>${e.frequence}</changefreq>\n` +
      `    <priority>${e.priorite}</priority>\n  </url>`,
  )
  .join("\n");

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

const destination = join(racine, "public", "sitemap.xml");
writeFileSync(destination, xml, "utf8");
console.log(
  `sitemap.xml : ${toutes.length} URL ecrites (${ENTREES.length} statiques + ${dynamiques.length} referentiel, dont ${toutes.filter((e) => e.maj).length} avec lastmod) — ${SITE}.`,
);
