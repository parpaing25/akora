import { ENV } from "@/lib/env";

/**
 * Blocs JSON-LD communs (audit S-06, 05/09/2026). Avant, le site n'avait ni
 * `Organization` ni `WebSite` : pour un moteur de réponse IA, Akora n'avait pas
 * d'entité éditrice lisible. Une seule source ici ; les pages composent.
 */

const MARQUE = "Akora";

/** Coordonnées publiques : les mêmes que la page Contact (une seule vérité). */
export const CONTACT_PUBLIC = {
  courriel: "contact@akora.fonenako.mg",
  telephoneAffiche: "032 72 090 33",
  telephoneE164: "+261327209033",
  whatsapp: "261327209033",
  horaires: "Lundi – samedi, 8 h – 17 h (heure de Madagascar)",
  facebook: "https://www.facebook.com/fonenako",
} as const;

export const ORGANISATION: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${ENV.siteUrl}/#organisation`,
  name: MARQUE,
  url: ENV.siteUrl,
  logo: `${ENV.siteUrl}/icon-512.png`,
  description:
    "Place de marché des matériaux de gros œuvre à Madagascar : comparaison des fournisseurs au prix rendu chantier, livraison calculée, paiement mobile money sous séquestre.",
  areaServed: { "@type": "Country", name: "Madagascar" },
  parentOrganization: { "@type": "Organization", name: "Fonenako", url: "https://fonenako.mg" },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: CONTACT_PUBLIC.courriel,
      telephone: CONTACT_PUBLIC.telephoneE164,
      availableLanguage: ["fr", "mg"],
      areaServed: "MG",
    },
  ],
  sameAs: [CONTACT_PUBLIC.facebook],
};

/** Site + boîte de recherche : Google peut afficher un champ de recherche direct. */
export const SITE_WEB: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${ENV.siteUrl}/#site`,
  url: ENV.siteUrl,
  name: MARQUE,
  inLanguage: "fr",
  publisher: { "@id": `${ENV.siteUrl}/#organisation` },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${ENV.siteUrl}/recherche?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

/** Liste ordonnée d'URL (fournisseurs, matériaux, guides). */
export function listeElements(nom: string, elements: { nom: string; chemin: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: nom,
    numberOfItems: elements.length,
    itemListElement: elements.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.nom,
      url: new URL(e.chemin, ENV.siteUrl).toString(),
    })),
  };
}

/** FAQPage : questions/réponses en texte brut (pas de HTML dans `text`). */
export function faq(entrees: { question: string; reponse: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entrees.map((e) => ({
      "@type": "Question",
      name: e.question,
      acceptedAnswer: { "@type": "Answer", text: e.reponse },
    })),
  };
}
