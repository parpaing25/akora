# 06 — Amélioration continue : le site doit s'améliorer seul après le lancement

**État au 05/09/2026** : rien. Pas de suivi d'erreurs, pas de moniteur, pas de vitals terrain, pas d'analytics, pas de CI, pas de tests planifiés, pas de sauvegarde testée, pas de retour utilisateur, pas de drapeaux de fonctionnalité. Domaine 2.11 noté **0/100**. Ce document livre le socle complet, **à coût récurrent nul**, en ~12 h de mise en place.

| Brique | Outil retenu (gratuit) | Alternative | Effort | Fichier livré ci-dessous |
|---|---|---|---|---|
| Erreurs front | Sentry (5 000 événements/mois) | GlitchTip auto-hébergé sur le VPS des bots | 1 h | §1 |
| Disponibilité | Better Stack (10 moniteurs, 3 min) ou UptimeRobot (50 moniteurs, 5 min) + page publique | — | 0,5 h | §2 |
| Vitals terrain (RUM) | `web-vitals` → table Supabase via RPC | Sentry Performance (échantillon payant vite) | 1,5 h | §3 |
| Analytics d'entonnoir | Table `evenements` maison via RPC (0 traceur, 0 cookie) | Umami Cloud (10 000 événements/mois gratuits, script tiers) | 2 h | §4 |
| CI à chaque PR | GitHub Actions : typecheck, tests, a11y, build, audit, htaccess, sitemap | — | 1 h | §5 |
| Lighthouse hebdo avec budgets | Lighthouse CI en Action, agent utilisateur réaliste (o2switch bloque le headless nu) | — | 1 h | §6 |
| E2E nocturnes | Playwright contre la **préprod** (Q-03) ; parcours A/B/D | — | 6 h (hors socle) | §7 |
| Dépendances | Dependabot hebdo, `npm audit` en CI | Renovate | 0,2 h | §8 |
| Retours utilisateurs | Widget « Cette page vous a aidé ? » → table `retours` | Tally (formulaire externe) | 1,5 h | §9 |
| Drapeaux / A-B | Table `parametres` + `useParametre()` ; seau A/B déterministe | — | 1 h | §10 |
| Agent d'amélioration hebdo | Action lundi 06 h : collecte → rapport → propositions (Claude) → PR | — | 3 h | §11 |
| SEO/GEO continu | Sitemap hebdo (03/06), Search Console API | — | 1 h | §12 |
| Sauvegardes testées | `03-corrections/15-sauvegardes-nocturnes.md` | Supabase Pro | 2 h | — |
| Incident : bandeau, statut, runbook, maintenance | `parametres.bandeau_incident`, page publique du moniteur, `maintenance.html`, runbook | — | 2 h | §13 |
| ErrorBoundary global | Écran « quelque chose a cassé » + envoi Sentry | — | 1 h | §1 |

---

## 1. Erreurs front — Sentry + ErrorBoundary

`npm i @sentry/react` puis `src/main.tsx` :
```ts
import * as Sentry from "@sentry/react";
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    release: import.meta.env.VITE_VERSION,           // posé par le build : git describe --tags
    environment: "production",
    sampleRate: 1.0,                                 // toutes les erreurs
    tracesSampleRate: 0.05,                          // 5 % des navigations : assez pour voir, sous le quota
    beforeSend(evenement) {                          // jamais de donnée personnelle
      delete evenement.user; if (evenement.request?.headers) delete evenement.request.headers;
      return evenement;
    },
    ignoreErrors: ["ResizeObserver loop", "Failed to update a ServiceWorker"],
  });
}
```
`src/App.tsx` : envelopper le routeur d'un `<Sentry.ErrorBoundary fallback={<EcranCasse />} showDialog={false}>` où `EcranCasse` (nouveau, `src/components/EcranCasse.tsx`) affiche : « Quelque chose a cassé de notre côté. Rechargez la page ; si ça continue, écrivez-nous » + bouton `location.reload()` + lien contact. Aujourd'hui une exception de rendu = **page blanche** (aucun `ErrorBoundary`, grep 05/09).

CSP (`.htaccess`) : ajouter `https://*.ingest.de.sentry.io` (région UE) à `connect-src`. Alerte : règle Sentry « > 5 erreurs en 10 min » → e-mail + Telegram (webhook).

Edge Functions : `console.error` suffit (journaux Supabase 24 h sur Free) ; ajouter `import * as Sentry from "npm:@sentry/deno"` seulement sur `commande-creer` et `paiement-*` (argent).

## 2. Disponibilité

Better Stack (gratuit) — 4 moniteurs, 3 min, alerte e-mail + Telegram :

| Moniteur | URL | Attendu |
|---|---|---|
| Site | `https://akora.fonenako.mg/` | 200, contient `id="racine"` |
| Sitemap | `https://akora.fonenako.mg/sitemap.xml` | 200, `<urlset` |
| Base (REST) | `https://lvhnqrnmkajhlohympcs.supabase.co/rest/v1/types_vitrine?select=slug&limit=1` avec en-tête `apikey: <anon>` | 200, `[{` |
| Fonctions | `https://lvhnqrnmkajhlohympcs.supabase.co/functions/v1/commande-creer` en OPTIONS | 200/204 |

**Agent utilisateur** : Better Stack et UptimeRobot signent leurs requêtes avec leur propre UA ; vérifier dès le premier ping que la réponse n'est pas la page « tigre » d'o2switch (contenu attendu `id="racine"`). Page de statut publique : `https://akora.betteruptime.com` → lien « État du service » dans le pied de page.

## 3. Vitals terrain (RUM) — zéro tiers

Migration :
```sql
create table public.vitals (
  id bigserial primary key, page text not null, nom text not null check (nom in ('LCP','INP','CLS','FCP','TTFB')),
  valeur numeric not null, note text check (note in ('good','needs-improvement','poor')),
  connexion text, appareil text, created_at timestamptz default now());
alter table public.vitals enable row level security;               -- aucune policy : lecture admin par service_role seulement
create index vitals_created_idx on public.vitals (created_at);
create or replace function public.enregistrer_vital(_page text, _nom text, _valeur numeric, _note text, _connexion text, _appareil text)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.vitals (page, nom, valeur, note, connexion, appareil)
  select left(_page, 120), _nom, _valeur, _note, left(_connexion, 10), left(_appareil, 20)
  where _nom in ('LCP','INP','CLS','FCP','TTFB') and _valeur between 0 and 60000;
$$;
grant execute on function public.enregistrer_vital(text,text,numeric,text,text,text) to anon, authenticated;
select cron.schedule('akora-purge-vitals', '0 5 * * 1', $$delete from public.vitals where created_at < now() - interval '90 days'$$);
```
`src/lib/vitals.ts` (`npm i web-vitals`, 2 Ko) :
```ts
import { onLCP, onINP, onCLS, onFCP, onTTFB, type Metric } from "web-vitals";
import { supabase } from "@/integrations/supabase/client";
const envoyer = (m: Metric) => {
  if (Math.random() > 0.25) return;                       // 1 visite sur 4 : assez pour un p75 hebdo
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
  void supabase.rpc("enregistrer_vital", {
    _page: location.pathname.replace(/\/[0-9a-f-]{36}/g, "/:id").slice(0, 120), _nom: m.name, _valeur: Math.round(m.value * 1000) / 1000,
    _note: m.rating, _connexion: nav.connection?.effectiveType ?? null, _appareil: /Android/.test(navigator.userAgent) ? "android" : /iPhone/.test(navigator.userAgent) ? "iphone" : "autre",
  });
};
export function mesurerVitals() { onLCP(envoyer); onINP(envoyer); onCLS(envoyer); onFCP(envoyer); onTTFB(envoyer); }
```
appelé une fois dans `main.tsx`. Requête hebdo (agent §11) : `select nom, percentile_cont(0.75) within group (order by valeur) p75, count(*) from vitals where created_at > now() - interval '7 days' group by nom;` — c'est **la** mesure que le barème 2.1 demande (75e percentile terrain), impossible aujourd'hui.

## 4. Analytics d'entonnoir — table maison, pas de cookie

Même motif que §3 : table `evenements (id, nom, page, proprietes jsonb, session_id text, created_at)`, RPC `enregistrer_evenement(_nom, _page, _proprietes)` avec liste fermée de noms et quota par IP (`consommer_quota`), `session_id` = uuid aléatoire en `sessionStorage` (meurt avec l'onglet : pas de suivi entre visites, donc pas de consentement à demander). Événements à poser (un `emettre("…")` par étape du parcours A et B) :

`voir_accueil` · `voir_type` · `voir_comparateur` · `voir_produit` · `ajouter_panier` · `ouvrir_commander` · `commande_envoyee` (avec `mode_paiement`, `invite: bool`) · `paiement_reference_saisie` · `voir_devenir_fournisseur` · `inscription_fournisseur` · `produit_publie` · `recherche` (avec `nb_resultats`).

Rapport hebdo (SQL dans l'agent) : entonnoir `voir_produit → ajouter_panier → ouvrir_commander → commande_envoyee`, taux par étape, recherches à 0 résultat (les 20 plus fréquentes = matériaux à ajouter au catalogue), pages d'entrée. Mise à jour de la politique de confidentialité : « compteurs agrégés par étape, identifiant de session non persistant ».

## 5. CI à chaque PR — `.github/workflows/ci.yml`

```yaml
name: CI
on: { pull_request: {}, push: { branches: [main] } }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  verifier:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env: { NODE_OPTIONS: --max-old-space-size=4096 }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run test:a11y
      - run: npm audit --audit-level=high --omit=dev        # les vulnérabilités dev-only ne bloquent pas la prod
      - run: node scripts/verifier-htaccess.mjs
      - name: Build (sans secrets : sitemap statique seul, c'est voulu)
        run: npm run build
      - name: Le build est complet ?
        run: test -f dist/index.html && test "$(ls dist/assets | wc -l)" -gt 50
      - uses: actions/upload-artifact@v4
        with: { name: dist-${{ github.sha }}, path: dist, retention-days: 7 }
```
Les jobs tournent **en série** (un seul runner) : la règle « jamais build et tests en parallèle » vaut aussi là. Protéger `main` : PR obligatoire, CI verte requise.

## 6. Lighthouse hebdomadaire avec budgets — `.github/workflows/lighthouse.yml`

```yaml
name: Lighthouse (prod, hebdo)
on: { schedule: [{ cron: "0 3 * * 1" }], workflow_dispatch: {} }
jobs:
  mesurer:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm i -g @lhci/cli@0.14 lighthouse@12
      - name: Mesure (agent utilisateur réaliste : o2switch bloque HeadlessChrome nu, constat O-02)
        run: |
          for u in / /materiaux/bois/madrier/madrier-70x150-4m /fournisseurs/hourdis-mg/hourdis-tc-20; do
            n=$(echo "$u" | tr '/' '_'); lighthouse "https://akora.fonenako.mg$u" --quiet --output=json --output-path="lh$n.json" \
              --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate \
              --emulated-user-agent="Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36 AkoraLighthouse" \
              --chrome-flags="--headless=new --no-sandbox"; done
      - name: Budgets
        run: |
          node -e '
            const fs=require("fs"); let ko=0;
            for (const f of fs.readdirSync(".").filter(f=>f.startsWith("lh"))) {
              const a=JSON.parse(fs.readFileSync(f)).audits; const lcp=a["largest-contentful-paint"].numericValue, cls=a["cumulative-layout-shift"].numericValue, tbt=a["total-blocking-time"].numericValue;
              const perf=JSON.parse(fs.readFileSync(f)).categories.performance.score*100;
              console.log(f, {perf, lcp:Math.round(lcp), cls, tbt:Math.round(tbt)});
              if (lcp>3000||cls>0.1||tbt>300||perf<80) ko++; }
            if (ko) { console.error(`${ko} page(s) hors budget`); process.exit(1); }'
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: lighthouse-${{ github.run_id }}, path: "lh*.json", retention-days: 90 }
```
Budgets de départ (réalistes après `03/10`) : LCP ≤ 3 000 ms, CLS ≤ 0,1, TBT ≤ 300 ms, perf ≥ 80 ; resserrer à 2 500 ms quand le CDN est en place. Un échec = e-mail GitHub ; l'agent §11 lit les JSON.

## 7. E2E nocturnes (Playwright) — sur la préprod

Préalable Q-03 : second projet Supabase (Free) + déploiement `preprod.akora.fonenako.mg` (sous-domaine o2switch, `VITE_SITE_URL`). Trois scénarios, `tests/e2e/` :
- **A acheter** : accueil → type → comparateur (quantité 200) → fiche → ajouter → commander (invité, à la livraison) → l'URL contient `?j=` → l'écran affiche le numéro et le total.
- **B vendre** : inscription → devenir fournisseur → publier un produit avec photo → il apparaît en `/fournisseurs/:slug`.
- **D métrer** : calculateur mur → « voir les matériaux » → comparateur pré-rempli.
Chaque test **vise ses boutons par panneau et nom accessible** (`getByRole("region", …)` puis `getByRole("button", { name })`), jamais `.first()` (règle du 04/09). Agent utilisateur posé dans `playwright.config.ts` (`userAgent`). Cron 02 h ; échec → e-mail + capture.

## 8. Dépendances — `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly, day: monday }
    open-pull-requests-limit: 5
    groups: { radix: { patterns: ["@radix-ui/*"] }, dev: { dependency-type: development } }
    ignore:
      - dependency-name: "@supabase/supabase-js"
        versions: ["<2.108.2"]          # cycle webauthn → page blanche Firefox (règle Fonenako)
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: monthly }
```

## 9. Retours utilisateurs

Composant `RetourPage` en bas de `PageTexte`, des fiches produit et de la page commande : « Cette page vous a aidé ? 👍 👎 » puis, sur 👎, un champ « Que manquait-il ? » (200 caractères, honeypot, quota). Table `retours (id, page, utile bool, texte, created_at)` via RPC `enregistrer_retour`. L'agent §11 résume les 👎 de la semaine. Pas d'enregistrement de session (poids, vie privée, 3G).

## 10. Drapeaux de fonctionnalité et A/B

```sql
create table public.parametres (cle text primary key, valeur jsonb not null, maj_le timestamptz default now());
alter table public.parametres enable row level security;
create policy "parametres lisibles par tous" on public.parametres for select to anon, authenticated using (true);
insert into public.parametres values ('bandeau_incident', '{"actif": false, "texte": ""}'), ('recherche_ia', '{"actif": false, "part": 0}');
```
`src/hooks/useParametre.ts` : `useQuery(["parametre", cle], …, { staleTime: 5 * 60_000 })`. Seau A/B : `seau = hash(sessionId) % 100 < part` — déterministe pour la session, mesuré via `evenements.proprietes.variante`. Bascule sans déploiement : `update parametres set valeur = '{"actif": true, "part": 20}' where cle = 'recherche_ia'`.

## 11. Agent d'amélioration hebdomadaire — `.github/workflows/agent-hebdo.yml` + `scripts/agent-hebdo.mjs`

Lundi 06 h (03 h UTC). Collecte **déterministe** (script), rédaction **par le modèle**, validation **humaine** (PR) — la règle « extraire = script, juger = agent ».

```yaml
name: Agent d'amélioration (hebdo)
on: { schedule: [{ cron: "0 3 * * 1" }], workflow_dispatch: {} }
permissions: { contents: write, pull-requests: write }
jobs:
  rapport:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci --omit=dev
      - run: node scripts/agent-hebdo.mjs
        env:
          SUPABASE_URL: https://lvhnqrnmkajhlohympcs.supabase.co
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ github.token }}
      - uses: peter-evans/create-pull-request@v6
        with:
          branch: rapport/hebdo-${{ github.run_id }}
          title: "Rapport d'amélioration — semaine ${{ github.run_number }}"
          body-path: docs/rapports/dernier.md
          commit-message: "docs(rapports): rapport hebdomadaire automatique"
```

`scripts/agent-hebdo.mjs` (squelette ; la collecte est du code, pas du modèle) :
```js
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const semaine = new Date().toISOString().slice(0, 10);

// 1. Collecte déterministe
const [vitals, entonnoir, recherchesVides, retours, sentry] = await Promise.all([
  sb.rpc("rapport_vitals_7j"),               // p75 par métrique et par page (vue SQL)
  sb.rpc("rapport_entonnoir_7j"),            // comptes par étape, taux
  sb.rpc("rapport_recherches_vides_7j"),     // top 20 des recherches sans résultat
  sb.from("retours").select("page, utile, texte").gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()),
  fetch("https://sentry.io/api/0/projects/<org>/akora/issues/?statsPeriod=7d&sort=freq", { headers: { Authorization: `Bearer ${process.env.SENTRY_AUTH_TOKEN}` } }).then((r) => r.ok ? r.json() : []),
]);
const faits = { semaine, vitals: vitals.data, entonnoir: entonnoir.data, recherchesVides: recherchesVides.data, retours: retours.data, erreurs: (sentry ?? []).slice(0, 10).map((i) => ({ titre: i.title, nb: i.count, users: i.userCount })) };

// 2. Jugement : le modèle lit les FAITS et propose ; il n'invente aucun chiffre (on lui interdit d'en écrire un qui n'est pas dans `faits`).
const prompt = `Tu es l'auditeur qualité du site akora.fonenako.mg (place de marché de matériaux, Madagascar, public mobile 3G).
Voici les mesures de la semaine (JSON). Rédige en français un rapport d'une page : 1) ce qui a bougé, 2) les 5 actions prioritaires classées impact/effort avec l'heure estimée et le fichier probable, 3) les correctifs simples que tu peux écrire directement (textes, alt, meta) sous forme de diff. Interdit : tout chiffre absent des mesures. Si une mesure manque, écris « non mesuré ».
MESURES: ${JSON.stringify(faits)}`;
const r = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
  body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 3000, messages: [{ role: "user", content: prompt }] }),
});
const texte = (await r.json()).content?.[0]?.text ?? "Rédaction indisponible — mesures brutes ci-dessous.";

mkdirSync("docs/rapports", { recursive: true });
const md = `# Rapport hebdomadaire — ${semaine}\n\n${texte}\n\n## Mesures brutes\n\n\`\`\`json\n${JSON.stringify(faits, null, 1)}\n\`\`\`\n`;
writeFileSync(`docs/rapports/${semaine}.md`, md); writeFileSync("docs/rapports/dernier.md", md);
```
Coût : ~15 000 jetons/semaine ≈ **0,10 €/mois**. Les vues `rapport_*_7j` sont trois `create view` sur `vitals`, `evenements`, `evenements where nom='recherche' and (proprietes->>'nb_resultats')='0'`. Les correctifs proposés en diff ne sont **jamais** appliqués sans revue : la PR est le garde-fou.

## 12. SEO / GEO en continu

- Sitemap hebdomadaire : workflow de `03-corrections/06 §2` (génération + envoi FTP du seul fichier).
- Search Console API (compte de service, propriété vérifiée en J-3) : le script §11 ajoute `clics, impressions, position` des 20 premières requêtes et alerte si une page perd > 30 % d'impressions sur 7 jours.
- Citations par les moteurs IA : test manuel mensuel (« prix du parpaing à Antananarivo » sur Perplexity, ChatGPT, Gemini) noté dans le rapport ; `llms.txt` et FAQ (`03/05`, `04`) sont les leviers.
- Pré-rendu (S-03, 8 h) : `vite-plugin-prerender` sur les ~330 URL du sitemap au build → HTML complet servi aux robots et aux moteurs IA, hydratation React ensuite ; c'est la seule réponse structurelle au « rendu client seul ».

## 13. Incident : bandeau, statut, maintenance, runbook

- **Bandeau** : `parametres.bandeau_incident` lu par `Coquille.tsx` (`useParametre`) → `<div role="status" className="bg-attention …">{texte}</div>` sous l'en-tête. Activation : une ligne SQL, visible en 5 min (staleTime).
- **Statut public** : page Better Stack liée dans le pied de page.
- **Maintenance** : `public/maintenance.html` (statique, style inline, logo, « Retour dans quelques minutes », `<meta http-equiv="refresh" content="120">`). Bascule dans `.htaccess`, en tête du bloc rewrite : `RewriteCond %{REQUEST_URI} !^/maintenance\.html$` · `RewriteCond %{DOCUMENT_ROOT}/MAINTENANCE -f` · `RewriteRule ^ /maintenance.html [R=503,L]` + `Header always set Retry-After "600" env=REDIRECT_STATUS` — créer le fichier vide `MAINTENANCE` à la racine = mode maintenance ; le supprimer = retour.
- **Runbook** `docs/RUNBOOK-INCIDENT.md` (1 page) : qui est joignable (Andry + second admin, O-08), où regarder (Better Stack → Sentry → journaux Supabase → cPanel), les 4 pannes types et leur geste (`03/15 §A5`), le message type pour le bandeau et pour la page Facebook, et le compte rendu post-incident (cause, durée, correctif, date).

## Cadence

| Quand | Quoi | Par |
|---|---|---|
| Chaque PR | CI (§5) | GitHub |
| Chaque nuit | Sauvegarde (03/15) ; E2E préprod (§7) | GitHub |
| 3 min | Moniteurs (§2) | Better Stack |
| Lundi 06 h | Lighthouse (§6), sitemap (§12), rapport de l'agent (§11) | GitHub |
| Lundi 08 h | Andry lit la PR du rapport, choisit 1 à 3 actions, ferme le reste | Andry |
| 1er du mois | Test de restauration (03/15 §A3) ; revue des accès et des coûts | GitHub / Andry |
| Trimestre | Relevé de sécurité (`verifier-securite.mjs`), rotation des clés SMTP/API, revue de `07` | Andry |
