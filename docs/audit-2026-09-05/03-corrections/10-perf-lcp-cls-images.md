# Correctifs P-01 → P-05 — LCP 4,2–4,9 s, CLS 0,167, images surdimensionnées, N+1 (P1 lab / P0 barème)

## Mesures (Lighthouse 12.8.2, mobile simulé « moto g power, 4G lent », 05/09/2026 ; fichiers `lh-*.json` du scratchpad)

| Page | Perf | FCP | LCP | TBT | CLS | Élément LCP | Poids |
|---|---|---|---|---|---|---|---|
| `/` | 77 | 3,1 s | **4,2 s** | 50 ms | 0 | lien texte du fil | 603 KiB, 61 requêtes (22 scripts, 14 fetch + 14 préflights) |
| `/fournisseurs/hourdis-mg/hourdis-tc-20` | **67** | 3,3 s | **4,9 s** | 30 ms | **0,167** | `<img alt="Hourdis 20x33x33">` **original 1280 px** affiché en 324 px (`naturalWidth` lu en prod) | 495 KiB |
| `/materiaux/bois/madrier/madrier-70x150-4m` | 77 | 3,3 s | 4,3 s | 30 ms | 0 | `<h1>` | 369 KiB |

Décomposition du LCP de l'accueil : TTFB 1 000 ms (24 %), **rendu différé 3 245 ms (76 %)** — le HTML arrive vide, il faut télécharger 218 Ko de JS (brotli), exécuter, puis attendre les données Supabase (14 requêtes séquencées par le code, chacune précédée d'un préflight CORS : 28 allers-retours vers Singapour/Francfort depuis Madagascar). Seuils : LCP ≤ 2,5 s, CLS ≤ 0,1 (barème 2.1, [P0]). Terrain (CrUX) : **NON VÉRIFIÉ** — le site n'a pas de trafic ; PageSpeed Insights a répondu 429 (quota) les deux fois. Les chiffres ci-dessus sont ceux d'un laboratoire pessimiste ; la 3G malgache réelle est **plus** lente que la simulation.

Causes retenues et correctifs, du plus rentable au moins :

| ID | Cause | Gain attendu | Effort |
|---|---|---|---|
| P-05 | 14 requêtes Supabase sur l'accueil : 6 `vehicules_livraison` + 6 `zones_livraison` (une paire par carte du fil), `categories`, `fil_publications` | −12 requêtes, −24 allers-retours → LCP −0,8 à −1,5 s en 3G | 2 h |
| P-01 | Image LCP de la fiche produit : original 1280 px, pas de `srcset`, pas de `fetchpriority` | LCP produit −1 à −1,5 s | 1 h |
| P-03 | Photos du fil : JPEG plein format (80 Ko) là où la vignette WebP 480 px (44 Ko) existe ; 175 KiB gaspillés sur l'accueil | −175 Ko sur l'accueil | 0,5 h |
| P-02 | Logo du pied de page `h-9 w-auto` + `loading=lazy` : Lighthouse attribue le décalage 0,161 à cette image non dimensionnée | CLS 0,167 → < 0,05 | 0,25 h |
| P-07 | Aucun `preconnect` vers Supabase : DNS + TLS payés au premier `fetch`, après le JS | −150 à −400 ms en 3G | 0,1 h |
| P-06 | TTFB 640–1 000 ms : serveur o2switch en France, pas de CDN | −300 à −500 ms | Cloudflare gratuit devant o2switch (DNS chez o2switch → proxy orange) : 1 h + validation HSTS/CSP |

---

## P-05 · Un barème par fournisseur, pas par carte : `src/hooks/useLivraison.ts`

Le correctif `01-livraison-cle-composite.md` fait déjà passer `queryKey: ["bareme", <uuid fournisseur>]` : deux cartes du même dépôt partagent la requête. Reste le cas de 6 dépôts différents = 12 requêtes. Regrouper en **une** :

```ts
// src/lib/donnees/transport.ts
export async function listerBaremes(fournisseurIds: readonly string[]): Promise<Map<string, { vehicules: Vehicule[]; zones: Zone[] }>> {
  const ids = [...new Set(fournisseurIds.map((id) => exigerUuid(id, "listerBaremes")))];
  if (ids.length === 0) return new Map();
  const [v, z] = await Promise.all([
    supabase.from("vehicules_livraison").select(COLONNES_VEHICULE + ", fournisseur_id").in("fournisseur_id", ids).eq("actif", true).order("ordre").order("capacite_m3"),
    supabase.from("zones_livraison").select(COLONNES_ZONE + ", fournisseur_id").in("fournisseur_id", ids).order("rayon_km"),
  ]);
  if (v.error) throw v.error;
  if (z.error) throw z.error;
  const par = new Map<string, { vehicules: Vehicule[]; zones: Zone[] }>();
  for (const id of ids) par.set(id, { vehicules: [], zones: [] });
  for (const ligne of v.data ?? []) par.get(ligne.fournisseur_id)?.vehicules.push(ligne as Vehicule);
  for (const ligne of z.data ?? []) par.get(ligne.fournisseur_id)?.zones.push(ligne as Zone);
  return par;
}
```
et dans `useLivraison` remplacer `useQueries` par un seul `useQuery({ queryKey: ["baremes", ids.slice().sort().join(",")], queryFn: () => listerBaremes(ids), staleTime: 15 * 60_000 })`, puis `const bareme = baremes.data?.get(entree.fournisseurId)`. Résultat : **2 requêtes** quel que soit le nombre de cartes (au lieu de 2 × N). Les vues `vehicules_livraison` / `zones_livraison` sont lisibles par `anon` (policy `actif`), l'opérateur `in` passe la RLS.

## P-01 · L'image principale de la fiche produit

`src/components/produit/ImageProduit.tsx` — ajouter `srcset` quand la vignette existe, et la priorité réseau :

```diff
   return (
     <img
       src={source}
+      // Vignette 480 px pour les cartes et les mobiles, original au-delà :
+      // la fiche produit chargeait l'original 1280 px pour 324 px affichés.
+      srcSet={original && getThumbUrl(original) && variante === "original"
+        ? `${getThumbUrl(original)} 480w, ${original} 1280w`
+        : undefined}
+      sizes={variante === "original" ? "(min-width: 1024px) 560px, 100vw" : undefined}
       alt={alt}
       className={className}
       loading={prioritaire ? "eager" : "lazy"}
       decoding={prioritaire ? "sync" : "async"}
+      // @ts-expect-error React 18 attend fetchpriority en minuscules
+      fetchpriority={prioritaire ? "high" : undefined}
```
(Sur React 19 la prop s'écrit `fetchPriority`.) Sur un écran de 390 px, `sizes=100vw` sélectionne la vignette 480 px : **44 Ko au lieu de ~80–150 Ko**, décodage plus court, LCP en avance. En cas d'échec de la vignette, le `onError` existant retombe déjà sur l'original.

## P-03 · Photos du fil : `src/components/fil/CartePublication.tsx:138-148`

```diff
+import { getThumbUrl } from "@/components/produit/ImageProduit";
 …
               <img
-                src={url}
+                src={getThumbUrl(url) ?? url}
+                srcSet={getThumbUrl(url) ? `${getThumbUrl(url)} 480w, ${url} 1200w` : undefined}
+                sizes={publication.photos.length > 1 ? "(min-width: 1024px) 300px, 50vw" : "(min-width: 1024px) 600px, 100vw"}
+                onError={(e) => { if (e.currentTarget.src !== url) e.currentTarget.src = url; }}
                 alt=""
                 loading="lazy"
```
`getThumbUrl` doit être exporté depuis `ImageProduit.tsx` (il y est défini). Vérifié : `/uploads/prospects/d16a1964_p133.thumb.webp` existe (200, 44 Ko) à côté du JPEG (80 Ko).

## P-02 · Logo : `src/components/marque/LogoAkora.tsx:43`

```diff
-      className={cn(estLogo ? "h-10 w-auto" : "size-8", className)}
+      // Largeur explicite via le ratio : avec `w-auto` seul, Lighthouse compte
+      // l'image comme non dimensionnée et lui attribue le décalage du pied de
+      // page (CLS 0,161 mesuré le 05/09/2026).
+      className={cn(estLogo ? "aspect-[33/10] h-10 w-auto" : "size-8", className)}
```
(132 / 40 = 3,3 = 33/10.) Le logo de l'en-tête reçoit `prioritaire` (il est au-dessus de la ligne de flottaison) ; celui du pied de page garde `lazy`.

## P-07 · `index.html` — préconnexion

```html
<link rel="preconnect" href="https://lvhnqrnmkajhlohympcs.supabase.co" crossorigin />
<link rel="dns-prefetch" href="https://lvhnqrnmkajhlohympcs.supabase.co" />
```
juste après la balise `theme-color`. La CSP `connect-src` autorise déjà cette origine.

## P-06 · CDN (décision, pas un patch)

Cloudflare (offre gratuite) en proxy devant o2switch : cache des assets immuables au plus près de Madagascar (PoP Johannesburg/Maurice), TLS 1.3 + HTTP/3, protection anti-flood **remplaçant** celle d'o2switch (voir O-02). Conditions : DNS de `akora.fonenako.mg` en CNAME orange ; règle de cache « Cache Everything » **sauf** `index.html`, `sw.js`, `/uploads/*` (respecter les `Cache-Control` existants) ; mode SSL « Full (strict) ». Effort 1 h + une journée d'observation. Alternative sans DNS : ne rien faire et accepter ~600–1 000 ms de TTFB.

## Vérification

```bash
# après déploiement, même laboratoire qu'avant :
CHROME_PATH=… npx lighthouse@12 https://akora.fonenako.mg/ --form-factor=mobile --screenEmulation.mobile --output=json --output-path=lh-home-apres.json --chrome-flags="--headless=new"
```
Cibles réalistes après P-01/02/03/05/07 sur ce laboratoire : LCP accueil ≤ 3,0 s, LCP produit ≤ 3,2 s, CLS ≤ 0,05, perf ≥ 85. Le passage sous 2,5 s en 3G réelle demande en plus P-06 (CDN) **ou** un pré-rendu des pages publiques (S-03, `06-amelioration-continue.md`).

## Commit

```
perf: un seul appel de barèmes, vignettes WebP en srcset (fil, fiche), logo dimensionné, preconnect Supabase
```
Fichiers : `src/lib/donnees/transport.ts`, `src/hooks/useLivraison.ts`, `src/components/produit/ImageProduit.tsx`, `src/components/fil/CartePublication.tsx`, `src/components/marque/LogoAkora.tsx`, `index.html`.
