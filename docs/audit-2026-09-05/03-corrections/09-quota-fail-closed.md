# Correctif X-03 — le plafond anti-abus s'ouvre quand la base tousse (P2)

**Constat** : `supabase/functions/_commun.ts:66-72`

```ts
const { data, error } = await client.rpc("consommer_quota", { _cle: cle, _sujet: sujet, _plafond: plafond });
if (error) return true; // Un quota indisponible ne doit pas bloquer une vente.
return data !== false;
```

Toute erreur (RPC révoquée, table absente, base saturée) rend `true` : **toutes** les fonctions perdent leur plafond en même temps — y compris `envoyer-code` (envoi de courriels : 2/h avec le mailer intégré, voir X-04), `verifier-code` (60 essais/h par IP, 5 par code) et `mot-de-passe-code`. Une base saturée est précisément le moment où un attaquant enchaîne les appels. Le commentaire est juste pour une **vente**, faux pour un **code**.

Après le correctif X-02 (`consommer_quota` réservée à `service_role`), un appel avec une autre clé produirait exactement cette erreur et ouvrirait tout : la mesure ci-dessous rend l'un et l'autre cohérents.

**Effort** : 0,5 h.

---

## `supabase/functions/_commun.ts:60-73`

```ts
/**
 * Plafond glissant par heure (rpc consommer_quota, réservée à service_role).
 *
 * `strict` décide du comportement quand le compteur est INDISPONIBLE :
 *   · false (défaut) : on laisse passer et on journalise — un quota en panne ne
 *     doit pas bloquer une vente (commande-creer, paiement-initier) ;
 *   · true : on refuse — un code, un courriel, une tentative de connexion sans
 *     plafond est une porte ouverte au moment même où la base est fragile.
 * Le 05/09/2026, tout était fail-open : un incident base ouvrait envoyer-code.
 */
export async function quotaOk(
  client: SupabaseClient,
  cle: string,
  sujet: string,
  plafond: number,
  strict = false,
): Promise<boolean> {
  const { data, error } = await client.rpc("consommer_quota", {
    _cle: cle,
    _sujet: sujet,
    _plafond: plafond,
  });
  if (error) {
    console.error(`quota ${cle} indisponible (${strict ? "REFUS" : "laissé passer"}) : ${error.message}`);
    return !strict;
  }
  return data !== false;
}
```

## Appelants à passer en strict (grep `quotaOk(` dans `supabase/functions/`)

| Fonction | Clé | Aujourd'hui | Après |
|---|---|---|---|
| `envoyer-code` | e-mail / IP | fail-open | `strict = true` |
| `verifier-code` | IP (60/h) + code (5) | fail-open | `strict = true` |
| `mot-de-passe-code` | e-mail / IP | fail-open | `strict = true` |
| `commande-creer` (`_commun.ts` appelé ligne 48, plafond 20/h par acheteur ou IP) | acheteur ∥ IP | fail-open | fail-open **conservé** (vente) |
| `paiement-initier` | commande / acheteur | fail-open | fail-open conservé |

Pour chaque appelant strict : `if (!(await quotaOk(client, "envoyer_code", cle, 5, true))) return reponse(429, { erreur: "Trop de demandes. Réessayez dans une heure." });` — le message existe déjà, seul le cinquième argument s'ajoute.

## Vérification

```bash
grep -rn "quotaOk(" supabase/functions --include=*.ts | grep -v _commun    # chaque ligne : 5e argument présent pour les codes
npx supabase functions deploy envoyer-code verifier-code mot-de-passe-code --use-api
```
Test manuel : 6 demandes de code sur la même adresse en moins d'une heure → la 6e répond 429.

## Commit

```
fix(edge): les quotas des codes et courriels refusent quand le compteur est indisponible ; les ventes restent ouvertes
```
Fichiers : `supabase/functions/_commun.ts`, `envoyer-code/index.ts`, `verifier-code/index.ts`, `mot-de-passe-code/index.ts`.
