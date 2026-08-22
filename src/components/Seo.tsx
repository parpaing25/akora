import * as React from "react";
import { ENV } from "@/lib/env";

/**
 * Métadonnées de page (AKORA-DESIGN §5, spec D6).
 *
 * ⚠️ La CANONIQUE est propre à chaque page. Sur Fonenako, une canonique fixe
 * pointant vers l'accueil a fait déclarer 22 pages « doublons » par Google et
 * les a sorties de l'index. Ici, `chemin` est obligatoire.
 *
 * Le JSON-LD est injecté via `textContent` sur un <script> créé par le DOM :
 * aucun `dangerouslySetInnerHTML` nulle part dans Akora (règle A2.9).
 */

const MARQUE = "Akora";
const DESCRIPTION_DEFAUT =
  "Comparez les fournisseurs de matériaux au prix rendu chantier, livraison calculée depuis votre adresse.";

export interface ProprietesSeo {
  titre: string;
  description?: string;
  /** Chemin absolu propre à CETTE page, ex. « /materiaux/granulats ». */
  chemin: string;
  image?: string | null;
  /** `noindex` pour les espaces privés (compte, pro, admin, tunnel de paiement). */
  indexable?: boolean;
  /** Un ou plusieurs blocs JSON-LD (Product, Store, BreadcrumbList, FAQPage…). */
  donneesStructurees?: Record<string, unknown> | Record<string, unknown>[];
}

/** Crée ou met à jour une balise <meta>, et la marque comme gérée par Akora. */
function poserMeta(selecteur: string, attribut: "name" | "property", cle: string, contenu: string) {
  let balise = document.head.querySelector<HTMLMetaElement>(selecteur);
  if (!balise) {
    balise = document.createElement("meta");
    balise.setAttribute(attribut, cle);
    balise.dataset.akoraSeo = "";
    document.head.appendChild(balise);
  }
  balise.setAttribute("content", contenu);
}

export function Seo({
  titre,
  description = DESCRIPTION_DEFAUT,
  chemin,
  image,
  indexable = true,
  donneesStructurees,
}: ProprietesSeo) {
  const titreComplet = titre === MARQUE ? MARQUE : `${titre} — ${MARQUE}`;
  const canonique = new URL(chemin, ENV.siteUrl).toString();
  const imageAbsolue = image ? new URL(image, ENV.siteUrl).toString() : undefined;

  React.useEffect(() => {
    document.title = titreComplet;
    poserMeta('meta[name="description"]', "name", "description", description);
    poserMeta('meta[name="robots"]', "name", "robots", indexable ? "index, follow" : "noindex, nofollow");

    poserMeta('meta[property="og:title"]', "property", "og:title", titreComplet);
    poserMeta('meta[property="og:description"]', "property", "og:description", description);
    poserMeta('meta[property="og:url"]', "property", "og:url", canonique);
    poserMeta('meta[property="og:type"]', "property", "og:type", "website");
    poserMeta('meta[property="og:site_name"]', "property", "og:site_name", MARQUE);
    poserMeta('meta[property="og:locale"]', "property", "og:locale", "fr_MG");
    poserMeta('meta[name="twitter:card"]', "name", "twitter:card", imageAbsolue ? "summary_large_image" : "summary");
    poserMeta('meta[name="twitter:title"]', "name", "twitter:title", titreComplet);
    poserMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    if (imageAbsolue) {
      poserMeta('meta[property="og:image"]', "property", "og:image", imageAbsolue);
      poserMeta('meta[name="twitter:image"]', "name", "twitter:image", imageAbsolue);
    }

    let lien = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!lien) {
      lien = document.createElement("link");
      lien.rel = "canonical";
      document.head.appendChild(lien);
    }
    lien.href = canonique;
  }, [titreComplet, description, canonique, imageAbsolue, indexable]);

  React.useEffect(() => {
    const precedents = document.head.querySelectorAll("script[data-akora-jsonld]");
    precedents.forEach((n) => n.remove());
    if (!donneesStructurees) return;

    const blocs = Array.isArray(donneesStructurees) ? donneesStructurees : [donneesStructurees];
    const ajoutes = blocs.map((bloc) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.akoraJsonld = "";
      script.textContent = JSON.stringify(bloc);
      document.head.appendChild(script);
      return script;
    });
    return () => ajoutes.forEach((n) => n.remove());
  }, [donneesStructurees]);

  return null;
}

/** Fil d'Ariane JSON-LD, présent sur toutes les pages profondes (D6). */
export function filAriane(elements: { nom: string; chemin: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: elements.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.nom,
      item: new URL(e.chemin, ENV.siteUrl).toString(),
    })),
  };
}
