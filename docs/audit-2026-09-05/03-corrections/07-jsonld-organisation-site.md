# Correctif S-06 — aucune donnée structurée sur l'accueil, la liste des fournisseurs et l'observatoire (P2)

**Constat** (crawl 05/09, colonne JSON-LD, 24 pages publiques) : `/`, `/fournisseurs`, `/prix`, `/transporteurs`, `/panier`, `/devenir-fournisseur`, `/a-propos`, `/contact` et les trois pages légales n'émettent **aucun** bloc `application/ld+json`. Le reste est bien couvert : `BreadcrumbList` sur les pages profondes, `ItemList` sur `/materiaux`, `Store` sur la fiche fournisseur, `Product` sur la fiche produit, `FAQPage` sur `/verification`. Ce qui manque est précisément l'**identité** : aucune `Organization`, aucun `WebSite` (boîte de recherche), aucune liste sur `/fournisseurs` et `/prix` — pour un moteur de réponse IA, Akora n'a pas d'entité éditrice lisible.

**Effort** : 1 h.

---

## 1. `src/lib/seo/jsonld.ts` (nouveau) — les blocs communs, un seul endroit

```ts
import { ENV } from "@/lib/env";

const MARQUE = "Akora";

/** Organisation éditrice. `sameAs` et `telephone` : à compléter (Q1, Q5 de la fiche d'identité). */
export const ORGANISATION: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${ENV.siteUrl}/#organisation`,
  name: MARQUE,
  legalName: "[À COMPLÉTER — dénomination légale]",
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
      email: "contact@akora.fonenako.mg",
      telephone: "[À COMPLÉTER — +261 …]",
      availableLanguage: ["fr", "mg"],
      areaServed: "MG",
    },
  ],
  sameAs: ["[À COMPLÉTER — URL de la page Facebook Akora]"],
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

/** Liste ordonnée d'URL (fournisseurs, matériaux, guides). `elements` = [{nom, chemin}]. */
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
```

## 2. `src/pages/Accueil.tsx:105-109`

```diff
+import { ORGANISATION, SITE_WEB } from "@/lib/seo/jsonld";
 …
       <Seo
         titre="Akora"
         chemin="/"
         description="Le fil des dépôts de matériaux à Madagascar : stock du jour, baisses de prix, tournées de livraison. Comparez au prix rendu chantier, livraison comprise."
+        donneesStructurees={[ORGANISATION, SITE_WEB]}
       />
```

Au passage (S-08) : le `<title>` de l'accueil est **« Akora »** (5 caractères ; cible 50–60). `Seo.tsx:52` garde la marque nue quand `titre === MARQUE`. Passer `titre="Matériaux de construction au prix rendu chantier"` donne « Matériaux de construction au prix rendu chantier — Akora » (55 c.). La description de `index.html:7` (« Comparez les fournisseurs… ») et celle de l'accueil diffèrent : aligner les deux sur celle de l'accueil, c'est elle que Google lit après hydratation.

## 3. `src/pages/public/Fournisseurs.tsx` — la liste

Dans le rendu de la liste, quand `fournisseurs.data` est chargé :

```tsx
import { listeElements } from "@/lib/seo/jsonld";
…
<Seo
  titre="Fournisseurs de matériaux"
  chemin="/fournisseurs"
  donneesStructurees={listeElements(
    "Fournisseurs de matériaux de construction à Madagascar",
    (fournisseurs.data ?? []).slice(0, 50).map((f) => ({ nom: f.raison_sociale, chemin: `/fournisseurs/${f.slug}` })),
  )}
/>
```
Même motif pour `/materiaux` (types) et `/guides` (articles). Les props exactes (`titre`, `chemin`) existent déjà dans chaque page : seule la ligne `donneesStructurees` s'ajoute.

## 4. Fiche fournisseur : `LocalBusiness`

`FournisseurFiche.tsx` porte déjà un fil d'Ariane ; ajouter un `HardwareStore` (sous-type Schema.org de `LocalBusiness`) : `name`, `url`, `image` (`logo_url`/`photo_depot`), `geo` (`lat`,`lng` de `fournisseurs_publics`), `address.addressLocality` (`localite_nom`), `openingHours` (`horaires` si renseigné), `aggregateRating` **seulement si `nb_avis > 0`** (un rating à 0 avis est une erreur de validation). Toutes ces colonnes existent dans la vue `fournisseurs_publics` (relevé SQL 05/09).

## 5. Vérification

- Test des résultats enrichis : https://search.google.com/test/rich-results sur `/`, `/fournisseurs`, `/faq`, une fiche fournisseur → 0 erreur (les avertissements sur les champs `[À COMPLÉTER]` disparaissent une fois remplis).
- Validateur : https://validator.schema.org.
- `python scratchpad/crawl_akora.py` → colonne JSON-LD non vide sur les pages publiques.

## Commit

```
feat(seo): Organization + WebSite (recherche) sur l'accueil, ItemList sur les listes, FAQPage ; titre d'accueil descriptif
```
Fichiers : `src/lib/seo/jsonld.ts`, `src/pages/Accueil.tsx`, `src/pages/public/Fournisseurs.tsx`, `src/pages/public/Materiaux.tsx`, `src/pages/public/FournisseurFiche.tsx`, `index.html`.
