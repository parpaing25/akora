import { supabase } from "@/integrations/supabase/client";
import { ENV } from "./env";

/**
 * Liste des URL à mettre au sitemap (spec D6).
 *
 * Le fichier XML lui-même est produit côté serveur, en PHP : ce module expose
 * la liste, pour que la génération n'ait jamais à deviner les routes.
 *
 * Les pages privées — compte, espace pro, admin, panier, tunnel de paiement —
 * n'y figurent pas, et sont déjà refusées par robots.txt.
 */
export interface EntreeSitemap {
  chemin: string;
  priorite: number;
  frequence: "daily" | "weekly" | "monthly";
  modifieLe?: string;
}

const STATIQUES: EntreeSitemap[] = [
  { chemin: "/", priorite: 1, frequence: "daily" },
  { chemin: "/materiaux", priorite: 0.9, frequence: "weekly" },
  { chemin: "/fournisseurs", priorite: 0.9, frequence: "daily" },
  { chemin: "/calculateurs", priorite: 0.8, frequence: "monthly" },
  { chemin: "/verification", priorite: 0.7, frequence: "monthly" },
  { chemin: "/devenir-fournisseur", priorite: 0.8, frequence: "monthly" },
  { chemin: "/a-propos", priorite: 0.4, frequence: "monthly" },
  { chemin: "/contact", priorite: 0.4, frequence: "monthly" },
  { chemin: "/conditions-utilisation", priorite: 0.3, frequence: "monthly" },
  { chemin: "/politique-confidentialite", priorite: 0.3, frequence: "monthly" },
  { chemin: "/mentions-legales", priorite: 0.3, frequence: "monthly" },
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

export async function construireSitemap(): Promise<EntreeSitemap[]> {
  const entrees = [...STATIQUES];

  const { data: familles } = await supabase.from("categories").select("slug").eq("active", true);
  for (const famille of familles ?? []) {
    entrees.push({ chemin: "/materiaux/" + famille.slug, priorite: 0.8, frequence: "weekly" });
  }

  // Un matériau ne mérite une URL que si un fournisseur le vend : une page de
  // comparateur vide est exactement le genre de « contenu mince » qui a coûté
  // cher à Fonenako.
  const { data: offres } = await supabase
    .from("produits_publics")
    .select("materiau_slug, materiau_type_slug, categorie_slug, fournisseur_slug, slug, prix_maj_le")
    .limit(2000);

  const comparateurs = new Set<string>();
  for (const offre of offres ?? []) {
    // Trois segments depuis la navigation famille › type › format. Un
    // comparateur sans son type mene a la page d'un type qui n'existe pas.
    if (offre.materiau_slug && offre.materiau_type_slug && offre.categorie_slug) {
      comparateurs.add(
        `/materiaux/${offre.categorie_slug}/${offre.materiau_type_slug}/${offre.materiau_slug}`,
      );
    }
    entrees.push({
      chemin: "/fournisseurs/" + offre.fournisseur_slug + "/" + offre.slug,
      priorite: 0.6,
      frequence: "weekly",
      modifieLe: (offre.prix_maj_le as string | null) ?? undefined,
    });
  }
  for (const chemin of comparateurs) {
    entrees.push({ chemin, priorite: 0.9, frequence: "daily" });
  }

  const { data: fournisseurs } = await supabase.from("fournisseurs_publics").select("slug").limit(1000);
  for (const fournisseur of fournisseurs ?? []) {
    entrees.push({ chemin: "/fournisseurs/" + fournisseur.slug, priorite: 0.7, frequence: "weekly" });
  }

  return entrees;
}

/** Rend le XML, pour un export manuel ou un script de génération. */
export function versXml(entrees: readonly EntreeSitemap[]): string {
  const urls = entrees
    .map((e) => {
      const lieu = new URL(e.chemin, ENV.siteUrl).toString();
      const date = e.modifieLe ? `\n    <lastmod>${e.modifieLe.slice(0, 10)}</lastmod>` : "";
      return `  <url>\n    <loc>${lieu}</loc>${date}\n    <changefreq>${e.frequence}</changefreq>\n    <priority>${e.priorite}</priority>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
