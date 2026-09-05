# Correctif S-04 — sitemap sans `lastmod`, sans les 40 fiches produit, figé au build (P2)

**Constat** (05/09/2026) : `https://akora.fonenako.mg/sitemap.xml` → 289 URL, **0 `<lastmod>`**, aucune URL `/fournisseurs/:slug/:produit` alors que la fiche produit est la page qui convertit et qu'elle porte le JSON-LD `Product`. Le fichier est écrit **au build** (`scripts/generer-sitemap.mjs`, branché en `prebuild`) : un produit publié par le bot entre deux déploiements n'y entre pas.

**Pourquoi ça compte** : sans `lastmod`, Google recrawle « au hasard » ; sans URL produit, les 40 pages les plus riches ne sont découvertes que par liens internes ; le site n'a **aucune** autre source d'acquisition gratuite au lancement.

**Effort** : 1 h (script) + 15 min (planification hebdomadaire, voir `06-amelioration-continue.md`).

---

## 1. `scripts/generer-sitemap.mjs` — diff

```diff
 const ENTREES = [
-  { chemin: "/", priorite: 1, frequence: "daily" },
+  { chemin: "/", priorite: 1, frequence: "daily", maj: null },
   { chemin: "/materiaux", priorite: 0.9, frequence: "weekly" },
   …
+  // Pages construites par l'audit du 05/09/2026 (04-pages-construites/).
+  { chemin: "/faq", priorite: 0.7, frequence: "monthly", maj: "2026-09-06" },
+  { chemin: "/accessibilite", priorite: 0.3, frequence: "yearly", maj: "2026-09-06" },
-  { chemin: "/conditions-utilisation", priorite: 0.3, frequence: "monthly" },
-  { chemin: "/politique-confidentialite", priorite: 0.3, frequence: "monthly" },
-  { chemin: "/mentions-legales", priorite: 0.3, frequence: "monthly" },
+  // `maj` = la date « mis à jour le » affichée par PageTexte : la seule vraie.
+  { chemin: "/conditions-utilisation", priorite: 0.3, frequence: "yearly", maj: "2026-08-22" },
+  { chemin: "/politique-confidentialite", priorite: 0.3, frequence: "yearly", maj: "2026-08-22" },
+  { chemin: "/mentions-legales", priorite: 0.3, frequence: "yearly", maj: "2026-09-06" },
 ];
+
+/** AAAA-MM-JJ ou null. On n'écrit JAMAIS une date inventée : Google ignore un
+ *  lastmod qui vaut « maintenant » partout, et finit par ignorer le reste. */
+function jour(valeur) {
+  if (!valeur) return null;
+  const d = new Date(valeur);
+  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
+}
```

```diff
   try {
-    const [types, formats, fournisseurs] = await Promise.all([
+    const [types, formats, fournisseurs, produits] = await Promise.all([
       lire("types_vitrine?select=slug,famille_slug"),
-      lire("formats_vitrine?select=slug,type_slug,famille_slug"),
-      lire("fournisseurs_publics?select=slug&limit=500"),
+      lire("formats_vitrine?select=slug,type_slug,famille_slug,prix_indicatif_le"),
+      lire("fournisseurs_publics?select=slug,created_at&limit=500"),
+      // 40 fiches aujourd'hui ; la limite PostgREST par défaut est 1000 : au-delà, paginer avec Range.
+      lire("produits_publics?select=slug,fournisseur_slug,prix_maj_le,created_at&limit=1000"),
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
-      entrees.push({ chemin: `/prix/${fo.slug}/madagascar`, priorite: 0.6, frequence: "daily" });
+      // La page prix bouge quand le prix indicatif bouge : c'est SA date.
+      entrees.push({ chemin: `/prix/${fo.slug}/madagascar`, priorite: 0.6, frequence: "daily", maj: jour(fo.prix_indicatif_le) });
     }
     for (const f of fournisseurs)
-      entrees.push({ chemin: `/fournisseurs/${f.slug}`, priorite: 0.6, frequence: "weekly" });
+      entrees.push({ chemin: `/fournisseurs/${f.slug}`, priorite: 0.6, frequence: "weekly", maj: jour(f.created_at) });
+    for (const p of produits) {
+      if (!p.slug || !p.fournisseur_slug) continue;
+      entrees.push({
+        chemin: `/fournisseurs/${p.fournisseur_slug}/${p.slug}`,
+        priorite: 0.7,
+        frequence: "weekly",
+        maj: jour(p.prix_maj_le ?? p.created_at),
+      });
+    }
     return entrees;
```

```diff
 const urls = toutes
   .map(
     (e) =>
       `  <url>\n    <loc>${SITE}${e.chemin === "/" ? "/" : e.chemin}</loc>\n` +
+      (e.maj ? `    <lastmod>${e.maj}</lastmod>\n` : "") +
       `    <changefreq>${e.frequence}</changefreq>\n` +
       `    <priority>${e.priorite}</priority>\n  </url>`,
   )
   .join("\n");
```

Et le message de fin :
```diff
-  `sitemap.xml : ${toutes.length} URL ecrites (${ENTREES.length} statiques + ${dynamiques.length} referentiel) — ${SITE}.`,
+  `sitemap.xml : ${toutes.length} URL ecrites (${ENTREES.length} statiques + ${dynamiques.length} referentiel, dont ${toutes.filter((e) => e.maj).length} avec lastmod) — ${SITE}.`,
```

## 2. Ne plus dépendre d'un déploiement

Le sitemap doit vivre au rythme du catalogue, pas des mises en production. Deux options, la première est retenue dans `06-amelioration-continue.md` :

| Option | Comment | Coût | Délai de fraîcheur |
|---|---|---|---|
| **A. GitHub Actions hebdomadaire** | `node scripts/generer-sitemap.mjs` chaque lundi 05:00, puis envoi du seul `sitemap.xml` par FTP (secret `O2SWITCH_FTP_*`) | 0 | 7 jours |
| B. Génération côté serveur | `sitemap.php` sur o2switch qui lit PostgREST avec la clé anon et met en cache 6 h | 0 | 6 h |

Le script accepte déjà de tourner sans base (repli statique) : l'option A échoue proprement si Supabase ne répond pas.

## 3. Vérification

```bash
node scripts/generer-sitemap.mjs
grep -c "<lastmod>" public/sitemap.xml          # attendu : ≥ 150 (prix + fournisseurs + produits + 5 pages datées)
grep -c "/fournisseurs/.*/.*</loc>" public/sitemap.xml   # attendu : 40 (+ 6 pages fournisseur = pas de /)
xmllint --noout public/sitemap.xml 2>&1 | head -3   # aucune erreur
```
Puis, au lancement : Search Console › Sitemaps › `https://akora.fonenako.mg/sitemap.xml` (NON VÉRIFIÉ : la propriété Search Console n'est pas vérifiée à ce jour, voir 07-checklist J-3).

## Commit

```
feat(sitemap): lastmod réels (prix, fournisseurs, produits, pages datées) et les 40 fiches produit
```
Fichier : `scripts/generer-sitemap.mjs`.
