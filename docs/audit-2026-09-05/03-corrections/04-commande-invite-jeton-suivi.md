# Correctif F-01 — un invité qui commande atterrit sur « Commande introuvable » (P0)

## Constat, de bout en bout (code + base + crawl, 05/09/2026)

1. `Commander.tsx:222-235` : « **Vous pouvez commander sans compte** et régler à la livraison » — le formulaire se soumet sans session.
2. `commande-creer/index.ts:46,177` : `acheteurId = await utilisateurAppelant(requete)` → `null` pour un invité ; la commande est insérée avec `acheteur_id: null` (clé service_role). La commande **existe**.
3. `Commander.tsx:133-137` : toast « Commande envoyée » (4 s), puis `naviguer("/commande/" + numero)`.
4. `CommandeSuivi.tsx:38-41` → `lireCommandeParNumero()` → `supabase.from("commandes").select(…)` avec la clé **anon**.
5. Base (SQL 05/09) : `commandes` n'a **aucun** droit `SELECT` pour `anon` (grants : `authenticated` seulement ; policy `commande lisible par son acheteur son fournisseur ou un admin`, rôle `authenticated`). PostgREST répond **401**. Reproduit par le crawl : `/commande/AK-000000` → 2 requêtes 401.
6. `commandes.ts:85` : `if (error) throw error` → la requête est en erreur, `c` est vide → `CommandeSuivi.tsx:64-77` affiche **« Commande introuvable — Le numéro est peut-être erroné, ou cette commande ne vous appartient pas »** avec un bouton « Mes commandes » qui mène à la connexion.

Résultat : l'acheteur invité a commandé, le fournisseur est notifié, et l'acheteur voit un écran d'erreur. Aucun courriel (F-03), aucun SMS. Il n'a **aucune trace** de sa commande à part un toast de quatre secondes. C'est le parcours A (fiche d'identité) — cassé sur son dernier écran. Le barème 2.8 classe le chemin nominal en **[P0]**.

Pourquoi personne ne l'a vu : **0 commande** n'a jamais été passée en production.

## Deux corrections possibles

| | A. Jeton de suivi (retenue, H3) | B. Compte obligatoire |
|---|---|---|
| Idée | La commande porte un jeton secret ; le lien `/commande/AK-…?j=…` la rend lisible par qui détient le lien | On exige la connexion avant « Commander » |
| Garde le « sans compte » promis à l'écran | Oui | Non (le texte de `Commander.tsx:231-233` devient faux, à réécrire) |
| Effort | **4 h** (migration + RPC + fonction + 2 écrans + tests) | 1 h |
| Risque | Lien = accès : le jeton fait 128 bits, transmis en https ; l'écran affiche nom, téléphone, adresse de l'acheteur à qui possède le lien | Perte de conversion sur une audience téléphone-first |

Les deux sont ci-dessous. **A** est complète ; **B** est le repli si le lancement presse.

---

## A. Jeton de suivi

### A1. Migration `supabase/migrations/20260906100000_commande_jeton_suivi.sql`

```sql
-- F-01 (audit 05/09/2026) : un invité ne pouvait pas relire sa commande.
begin;

alter table public.commandes
  add column if not exists jeton_suivi text not null default encode(gen_random_bytes(16), 'hex');
create unique index if not exists commandes_jeton_suivi_idx on public.commandes (jeton_suivi);
comment on column public.commandes.jeton_suivi is
  'Secret 128 bits remis à l''acheteur à la création. Seule preuve de propriété pour une commande sans compte. Jamais renvoyé par une vue publique.';

-- Lecture par jeton : commande + lignes + paiements en un seul JSON, sans les
-- colonnes qu'un invité n'a pas à voir (jeton, acheteur_id).
create or replace function public.lire_commande_invitee(_numero text, _jeton text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c public.commandes%rowtype;
begin
  if _numero is null or _jeton is null or length(_jeton) <> 32 then
    return null;
  end if;
  select * into c from public.commandes where numero = _numero and jeton_suivi = _jeton;
  if not found then
    perform pg_sleep(0.25);   -- ralentit une énumération, sans coûter à un vrai client
    return null;
  end if;
  return jsonb_build_object(
    'commande', to_jsonb(c) - 'jeton_suivi' - 'acheteur_id',
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'produit_id', l.produit_id, 'designation_snapshot', l.designation_snapshot,
        'unite_snapshot', l.unite_snapshot, 'prix_unitaire_snapshot', l.prix_unitaire_snapshot,
        'quantite', l.quantite, 'total_ligne', l.total_ligne))
      from public.lignes_commande l where l.commande_id = c.id), '[]'::jsonb),
    'paiements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'operateur', p.operateur, 'mode', p.mode, 'montant', p.montant, 'statut', p.statut,
        'reference_saisie', p.reference_saisie, 'reference_externe', p.reference_externe,
        'initie_le', p.initie_le, 'confirme_le', p.confirme_le, 'libere_le', p.libere_le)
        order by p.initie_le desc)
      from public.paiements p where p.commande_id = c.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.lire_commande_invitee(text, text) from public;
grant execute on function public.lire_commande_invitee(text, text) to anon, authenticated;

-- Confirmer la réception sans compte : même preuve, même transition que le bouton connecté.
-- ⚠ Vérifier que `transition_commande_valide('livree','confirmee')` est vraie
--   (trigger trg_commandes_transition) — sinon reprendre le nom d'état exact du code.
create or replace function public.confirmer_livraison_invitee(_numero text, _jeton text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  update public.commandes
     set statut = 'confirmee', confirmee_le = now()
   where numero = _numero and jeton_suivi = _jeton and statut = 'livree';
  get diagnostics n = row_count;
  return n = 1;
end;
$$;
revoke all on function public.confirmer_livraison_invitee(text, text) from public;
grant execute on function public.confirmer_livraison_invitee(text, text) to anon, authenticated;

commit;
```

### A2. `supabase/functions/commande-creer/index.ts`

```diff
       .insert({ … })
-      .select("id, numero")
+      .select("id, numero, jeton_suivi")
       .single();
@@
     creees.push({
       id: commande.id,
       numero: commande.numero,
+      // Remis une seule fois, à la création. L'acheteur connecté n'en a pas
+      // besoin (RLS) mais le lien de partage reste utile : on le donne à tous.
+      jeton_suivi: commande.jeton_suivi,
       fournisseur: String(premier.fournisseur_nom),
       montant_total: montantProduits + montantLivraison,
     });
```

### A3. `src/lib/donnees/commandes.ts`

```diff
 export interface CommandeCreee {
   id: string;
   numero: string;
+  jeton_suivi: string;
   fournisseur: string;
   montant_total: number;
 }
+
+export interface CommandeInvitee {
+  commande: LigneCommande;
+  lignes: LigneDeCommande[];
+  paiements: LignePaiement[];
+}
+
+/** Lecture par jeton (commande passée sans compte). `null` si le couple ne correspond pas. */
+export async function lireCommandeInvitee(numero: string, jeton: string): Promise<CommandeInvitee | null> {
+  const { data, error } = await supabase.rpc("lire_commande_invitee", { _numero: numero, _jeton: jeton });
+  if (error) throw error;
+  return (data as CommandeInvitee | null) ?? null;
+}
+
+export async function confirmerLivraisonInvitee(numero: string, jeton: string): Promise<boolean> {
+  const { data, error } = await supabase.rpc("confirmer_livraison_invitee", { _numero: numero, _jeton: jeton });
+  if (error) throw error;
+  return Boolean(data);
+}
+
+/** Les commandes passées sans compte, gardées dans CE navigateur pour les retrouver. */
+const CLE_INVITE = "akora-commandes-invite";
+export function memoriserCommandeInvitee(c: { numero: string; jeton_suivi: string }) {
+  try {
+    const liste = JSON.parse(localStorage.getItem(CLE_INVITE) ?? "[]") as { numero: string; jeton: string; le: string }[];
+    liste.unshift({ numero: c.numero, jeton: c.jeton_suivi, le: new Date().toISOString() });
+    localStorage.setItem(CLE_INVITE, JSON.stringify(liste.slice(0, 20)));
+  } catch { /* stockage indisponible : le lien reste dans l'URL et le courriel */ }
+}
+export function commandesInvitees(): { numero: string; jeton: string; le: string }[] {
+  try { return JSON.parse(localStorage.getItem(CLE_INVITE) ?? "[]"); } catch { return []; }
+}
```

### A4. `src/pages/public/Commander.tsx:131-137`

```diff
       vider();
       const premiere = commandes[0];
+      if (!session) commandes.forEach(memoriserCommandeInvitee);
       toast.success(
         commandes.length > 1 ? `${commandes.length} commandes envoyées` : "Commande envoyée",
-        { description: commandes.map((c) => c.numero).join(", ") },
+        {
+          description: commandes.map((c) => c.numero).join(", ") + " — gardez ce numéro, le fournisseur vous appelle.",
+          duration: 12_000,
+        },
       );
-      naviguer(premiere ? "/commande/" + premiere.numero : "/compte/commandes");
+      naviguer(
+        premiere
+          ? "/commande/" + premiere.numero + (session ? "" : "?j=" + premiere.jeton_suivi)
+          : "/compte/commandes",
+      );
```

### A5. `src/pages/public/CommandeSuivi.tsx`

```diff
-import { Link, useParams } from "react-router-dom";
+import { Link, useParams, useSearchParams } from "react-router-dom";
 import {
   confirmerLivraison,
+  confirmerLivraisonInvitee,
   lireCommandeParNumero,
+  lireCommandeInvitee,
   listerLignes,
   listerPaiements,
 } from "@/lib/donnees/commandes";
+import { useAuth } from "@/hooks/useAuth";
@@
 export default function CommandeSuivi() {
   const { numero } = useParams<{ numero: string }>();
+  const [params] = useSearchParams();
+  const jeton = params.get("j");
+  const { session } = useAuth();
+  // Sans session ET avec jeton : lecture par jeton. Avec session : RLS comme avant.
+  const parJeton = !session && Boolean(jeton);
   const client = useQueryClient();

   const commande = useQuery({
-    queryKey: ["commande", numero],
-    queryFn: () => lireCommandeParNumero(numero as string),
+    queryKey: ["commande", numero, parJeton ? jeton : "rls"],
+    queryFn: async () => {
+      if (parJeton) return (await lireCommandeInvitee(numero as string, jeton as string))?.commande ?? null;
+      return lireCommandeParNumero(numero as string);
+    },
     enabled: Boolean(numero),
     staleTime: 30_000,
   });

   const lignes = useQuery({
-    queryKey: ["lignes-commande", commande.data?.id],
-    queryFn: () => listerLignes(commande.data?.id as string),
+    queryKey: ["lignes-commande", commande.data?.id, parJeton],
+    queryFn: async () =>
+      parJeton
+        ? (await lireCommandeInvitee(numero as string, jeton as string))?.lignes ?? []
+        : listerLignes(commande.data?.id as string),
     enabled: Boolean(commande.data?.id),
   });

   const paiements = useQuery({
-    queryKey: ["paiements-commande", commande.data?.id],
-    queryFn: () => listerPaiements(commande.data?.id as string),
+    queryKey: ["paiements-commande", commande.data?.id, parJeton],
+    queryFn: async () =>
+      parJeton
+        ? (await lireCommandeInvitee(numero as string, jeton as string))?.paiements ?? []
+        : listerPaiements(commande.data?.id as string),
     enabled: Boolean(commande.data?.id),
   });
```

(TanStack déduplique les trois appels RPC identiques dans la même fenêtre ; sinon, lire une fois et distribuer — variante à 20 lignes.)

Écran « introuvable » — dire la vérité à l'invité :

```diff
   if (!c) {
     return (
       <div className="container max-w-3xl py-10">
         <Seo titre="Commande introuvable" chemin={"/commande/" + numero} indexable={false} />
         <EtatVide
           titre="Commande introuvable"
-          phrase="Le numéro est peut-être erroné, ou cette commande ne vous appartient pas."
+          phrase={
+            session
+              ? "Le numéro est peut-être erroné, ou cette commande ne vous appartient pas."
+              : "Pour revoir une commande passée sans compte, ouvrez le lien reçu (ou celui affiché juste après la commande). Avec un compte, retrouvez-la dans « Mes commandes »."
+          }
           action={
             <Bouton asChild variante="secondaire">
-              <Link to="/compte/commandes">Mes commandes</Link>
+              <Link to={session ? "/compte/commandes" : "/connexion"} state={{ retour: "/commande/" + numero }}>
+                {session ? "Mes commandes" : "Se connecter"}
+              </Link>
             </Bouton>
           }
         />
```

Confirmer la réception :
```diff
   const confirmer = async () => {
     try {
-      await confirmerLivraison(c.id);
+      if (parJeton) {
+        if (!(await confirmerLivraisonInvitee(numero as string, jeton as string)))
+          throw new Error("La commande n'est pas encore marquée livrée par le fournisseur.");
+      } else {
+        await confirmerLivraison(c.id);
+      }
```

Et, en bas de page, quand `parJeton` : masquer `<DeposerAvis>` et `<OuvrirLitige>` (ils exigent un compte) et afficher :
```tsx
<p className="mt-4 text-legende text-muted-foreground">
  Pour déposer un avis ou ouvrir un litige, <Link to="/inscription" className="lien-souligne">créez un compte</Link> avec
  le même numéro de téléphone : la commande {c.numero} y sera rattachée.
</p>
```
(Le rattachement téléphone → compte est une évolution : `update commandes set acheteur_id = … where telephone_contact = … and acheteur_id is null` à l'inscription, à faire dans `gerer_nouvel_utilisateur` — noté dans la dette, `06-amelioration-continue.md`.)

### A6. `/panier` — retrouver ses commandes sans compte

Dans `Panier.tsx`, sous le panier, si `!session && commandesInvitees().length` : une carte « Vos dernières commandes sur ce téléphone » listant `numero` → `/commande/{numero}?j={jeton}`.

### A7. Tests

- `supabase/tests/lire_commande_invitee.test.sql` (pgTAP) ou, plus simple, un test d'intégration Playwright : commander en invité un produit à la livraison → l'URL contient `?j=` → l'écran affiche le numéro, le total, le téléphone saisi → retirer `?j=` → « Commande introuvable » avec le texte invité → mauvais jeton → introuvable en ≥ 250 ms.
- Le compte de recette existant (`recette.akora.…@example.com`, F-04) sert au parcours connecté, puis se supprime.

---

## B. Repli — compte obligatoire (1 h)

`Commander.tsx` : au montage, `if (!session) naviguer("/connexion", { state: { retour: "/commander" } })` ; supprimer le bloc « Vous pouvez commander sans compte » (lignes 222-235) ; `commande-creer/index.ts:46` : `if (!acheteurId) return reponse(401, { erreur: "Connectez-vous pour commander." });`. Mettre à jour `Conditions.tsx` et `Guides` (« payer-mobile-money ») s'ils mentionnent la commande sans compte.

## Commit (A)

```
fix(commande): un invité relit sa commande par jeton de suivi — l'écran de confirmation disait « introuvable »
```
Fichiers : `supabase/migrations/20260906100000_commande_jeton_suivi.sql`, `supabase/functions/commande-creer/index.ts`, `src/lib/donnees/commandes.ts`, `src/pages/public/Commander.tsx`, `src/pages/public/CommandeSuivi.tsx`, `src/pages/public/Panier.tsx`.
