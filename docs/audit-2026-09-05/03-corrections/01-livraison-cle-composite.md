# Correctif F-02 — le prix rendu des pages type ne se calcule jamais (P1)

**Constat** (05/09/2026) : sur `/materiaux/bois/madrier` (et toute page `/materiaux/:famille/:type` qui a des offres), le navigateur envoie **6 requêtes en HTTP 400** vers PostgREST :

```
GET /rest/v1/vehicules_livraison?…&fournisseur_id=eq.feb3901c-…-721c3096bcb5%3A%3Aebc7fc74-…-36f13ec8dffc
{"code":"22P02","message":"invalid input syntax for type uuid: \"feb3901c-87d4-4fe4-b864-721c3096bcb5::ebc7fc74-d169-433f-8269-36f13ec8dffc\""}
```

**Cause** : `src/pages/public/TypeMateriau.tsx:49` construit une **clé composite** `fournisseur::format` dans le champ `fournisseurId`, parce que `useLivraison` range ses résultats par `fournisseurId` et qu'un même fournisseur peut vendre plusieurs formats. Mais `src/hooks/useLivraison.ts:27-34` passe ce même champ **tel quel** à `listerVehicules(id)` et `listerZones(id)`. Postgres refuse l'uuid, TanStack Query garde l'erreur, `baremes[index].data` reste vide, `rendu()` rend `null` : la colonne « rendu chantier » de la page type ne s'affiche **jamais**, et chaque format coûte 2 requêtes perdues (plus 2 préflights CORS) à un visiteur en 3G.

**Effet mesuré** : 6 échecs à 390 px et à 1280 px (`crawl_akora.json`, `anomalies2_akora.py`) ; Lighthouse compte ces échecs dans « errors-in-console » (bonnes pratiques 96 → 100 après correction).

**Effort** : 0,5 h + 0,5 h de vérification.

---

## 1. `src/hooks/useLivraison.ts` — séparer la clé de rangement de l'identifiant

```diff
 export interface EntreeLivraison {
+  /** Identifiant RÉEL du fournisseur (uuid) : c'est lui qui part en base. */
   fournisseurId: string;
+  /**
+   * Clé de rangement dans la Map rendue, quand une même page calcule
+   * plusieurs lignes pour un même fournisseur (une par format sur la page
+   * type). Par défaut : `fournisseurId`. Ne JAMAIS y mettre l'uuid composé —
+   * le 05/09/2026, « uuid::format » partait en base et Postgres répondait
+   * 22P02 six fois par page.
+   */
+  cle?: string;
   rayonMaxKm: number;
   coefSinuosite: number | null;
   depart: { lat: number; lng: number } | null;
   lignes: LigneACharger[];
   montantProduits: number;
 }

 export function useLivraison(entrees: readonly EntreeLivraison[]): Map<string, ResultatLivraison> {
   const { point } = usePointLivraison();
   const arrivee = coordonnees(point);
-  const ids = entrees.map((e) => e.fournisseurId);
+  // Un barème par FOURNISSEUR : deux formats du même dépôt partagent la
+  // même requête (queryKey identique → TanStack dédoublonne).
+  const ids = entrees.map((e) => e.fournisseurId);

   const baremes = useQueries({
     queries: ids.map((id) => ({
       queryKey: ["bareme", id],
       queryFn: async () => ({
         vehicules: await listerVehicules(id),
         zones: await listerZones(id),
       }),
       staleTime: 15 * 60_000,
     })),
   });

   return React.useMemo(() => {
     const resultats = new Map<string, ResultatLivraison>();
     entrees.forEach((entree, index) => {
       const bareme = baremes[index]?.data;
       if (!bareme) return;
       resultats.set(
-        entree.fournisseurId,
+        entree.cle ?? entree.fournisseurId,
         calculerLivraison({
```

Le reste du fichier ne change pas. `useLivraisonUnique` continue de lire `resultats.get(entree.fournisseurId)` : sans `cle`, la clé est l'uuid, comportement identique pour le panier, la fiche fournisseur, le simulateur et `Commander.tsx` (`livraisons.get(groupe.fournisseurId)`).

## 2. `src/pages/public/TypeMateriau.tsx` — l'uuid dans `fournisseurId`, la composite dans `cle`

```diff
       .filter((f) => f.offre_fournisseur_id && f.prix_des != null)
       .map((f) => ({
-        fournisseurId: `${f.offre_fournisseur_id}::${f.id}`,
+        fournisseurId: String(f.offre_fournisseur_id),
+        cle: `${f.offre_fournisseur_id}::${f.id}`,
         rayonMaxKm: Number(f.offre_rayon_max_km ?? 0),
```

`rendu()` (ligne 75) lit déjà `livraisons.get(\`${f.offre_fournisseur_id}::${f.id}\`)` : rien à changer.

## 3. Garde-fou : refuser l'uuid composé à la source

Dans `src/lib/donnees/transport.ts`, avant `.eq("fournisseur_id", fournisseurId)` des deux fonctions `listerVehicules` et `listerZones` :

```ts
const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function exigerUuid(valeur: string, ou: string): string {
  if (!MOTIF_UUID.test(valeur)) {
    // Mieux vaut une erreur nommée en développement qu'un 400 muet en prod.
    throw new Error(`${ou} : identifiant fournisseur invalide « ${valeur.slice(0, 60)} »`);
  }
  return valeur;
}
```

puis `.eq("fournisseur_id", exigerUuid(fournisseurId, "listerVehicules"))` et idem pour les zones. Le test ci-dessous casse si quelqu'un remet une composite.

## 4. Test de non-régression — `src/lib/donnees/transport.test.ts` (nouveau)

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const chaine = {
    select: () => chaine, eq: (_c: string, v: string) => { chaine.dernier = v; return chaine; },
    order: () => chaine, then: (r: (x: unknown) => void) => r({ data: [], error: null }), dernier: "",
  };
  return { supabase: { from: () => chaine, __chaine: chaine } };
});

import { listerVehicules } from "@/lib/donnees/transport";

describe("barème de transport — identifiant fournisseur", () => {
  it("refuse un uuid composé « fournisseur::format » (incident du 05/09/2026)", async () => {
    await expect(
      listerVehicules("feb3901c-87d4-4fe4-b864-721c3096bcb5::ebc7fc74-d169-433f-8269-36f13ec8dffc"),
    ).rejects.toThrow(/identifiant fournisseur invalide/);
  });
  it("accepte un uuid nu", async () => {
    await expect(listerVehicules("feb3901c-87d4-4fe4-b864-721c3096bcb5")).resolves.toEqual([]);
  });
});
```

## 5. Vérification après déploiement

```bash
# Depuis le scratchpad de l'audit (agent mobile : le headless par défaut est bloqué par o2switch, voir O-02)
python anomalies2_akora.py | grep -c "HTTP 400"      # attendu : 0
```
et à l'œil, `/materiaux/bois/madrier` à 390 px : la colonne « rendu » affiche un prix pour chaque format qui a une offre et un point de livraison choisi.

## 6. Commit

```
fix(livraison): la page type envoyait « uuid::format » comme fournisseur_id — six 400 par page, prix rendu jamais affiché
```
Fichiers : `src/hooks/useLivraison.ts`, `src/pages/public/TypeMateriau.tsx`, `src/lib/donnees/transport.ts`, `src/lib/donnees/transport.test.ts`.
