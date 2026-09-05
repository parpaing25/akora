# Correctif F-06 — « Supprimer mon compte » ne supprime pas le compte (P1, obligation légale)

**Constat** (05/09/2026) :
- `src/pages/compte/Securite.tsx:81-93` : le bouton exécute `supabase.from("profiles").delete().eq("id", uid)` puis déconnecte, et affiche « Compte supprimé ».
- Base : la clé étrangère va de `profiles.id` **vers** `auth.users(id) ON DELETE CASCADE` — supprimer le profil **ne supprime pas** l'utilisateur ; l'inverse seulement. Aucune fonction ne fait `delete from auth.users` (seule `creer_code_reinitialisation` touche la table, en lecture). Aucun trigger sur `profiles` ne relaie la suppression.
- Résultat : l'identité (e-mail, mot de passe, sessions, `auth.identities` Google) **reste** ; la personne peut se reconnecter et retombe sur un compte sans profil (état incohérent, `gerer_nouvel_utilisateur` ne se rejoue pas). La politique de confidentialité promet « Supprimer votre compte » (`Confidentialite.tsx:84`) : la promesse n'est pas tenue (loi 2014-038, droit à l'effacement ; barème 2.8 −10).

Ce que la suppression réelle doit respecter (relevé des clés étrangères vers `auth.users`, SQL 05/09) :

| Table | Règle | Conséquence |
|---|---|---|
| `fournisseurs.owner_id` | **RESTRICT** | Un propriétaire de dépôt ne peut pas être supprimé tant que son dépôt existe → il doit d'abord fermer ou transférer le dépôt |
| `litiges.ouvert_par` | **RESTRICT** | Un litige ouvert bloque la suppression (cohérent avec `Conditions.tsx:73`) |
| `commandes.acheteur_id` | SET NULL | La commande reste (comptabilité) mais perd son lien ; les colonnes `nom_contact`, `telephone_contact`, `email_contact`, `adresse_libre` doivent être **pseudonymisées** à la main |
| `avis.auteur_id`, `favoris`, `adresses_chantier`, `notifications`, `abonnements_push`, `demandes`, `user_roles`, `profiles` | CASCADE | Effacés automatiquement |
| `audit_log.acteur_id`, `signalements.*`, `documents_fournisseur.valide_par` | SET NULL | Journaux conservés, anonymisés |

**Effort** : 3 h.

---

## 1. Edge Function `supabase/functions/compte-supprimer/index.ts` (nouvelle)

```ts
import { clientAdmin, corsEntetes, reponse, utilisateurAppelant } from "../_commun.ts";

/**
 * Suppression RÉELLE du compte de l'appelant (droit à l'effacement, loi 2014-038).
 * Refuse tant qu'une obligation court : dépôt possédé, litige ouvert, commande
 * en cours. Pseudonymise les commandes clôturées (la comptabilité garde le
 * montant, pas la personne), puis supprime l'utilisateur GoTrue — les CASCADE
 * de la base font le reste.
 */
Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response(null, { headers: corsEntetes });
  const uid = await utilisateurAppelant(requete);
  if (!uid) return reponse(401, { erreur: "Connectez-vous." });
  const client = clientAdmin();

  const { count: depots } = await client.from("fournisseurs").select("id", { count: "exact", head: true }).eq("owner_id", uid);
  if ((depots ?? 0) > 0) {
    return reponse(409, { erreur: "Vous possédez un dépôt. Fermez-le ou transférez-le (Mon dépôt › Vitrine) avant de supprimer votre compte." });
  }
  const { count: litiges } = await client.from("litiges").select("id", { count: "exact", head: true }).eq("ouvert_par", uid).not("statut", "in", "(clos,arbitre)");
  if ((litiges ?? 0) > 0) return reponse(409, { erreur: "Un litige que vous avez ouvert est encore en cours." });
  const { count: enCours } = await client.from("commandes").select("id", { count: "exact", head: true }).eq("acheteur_id", uid)
    .not("statut", "in", "(cloturee,annulee,refusee)");
  if ((enCours ?? 0) > 0) return reponse(409, { erreur: "Une commande est encore en cours. Attendez sa clôture (ou annulez-la) avant de supprimer le compte." });

  // Pseudonymisation des commandes terminées : le montant reste, la personne part.
  const { error: erreurPseudo } = await client.from("commandes")
    .update({ nom_contact: "Compte supprimé", telephone_contact: "0000000000", email_contact: null, adresse_libre: null, message: null })
    .eq("acheteur_id", uid);
  if (erreurPseudo) return reponse(500, { erreur: "Pseudonymisation impossible : " + erreurPseudo.message });

  await client.rpc("journaliser", { _action: "supprimer_compte", _entite: "auth.users", _entite_id: uid, _avant: null, _apres: { par: "lui-meme" } });

  const { error } = await client.auth.admin.deleteUser(uid);   // CASCADE : profiles, favoris, adresses, notifications, avis…
  if (error) return reponse(500, { erreur: "Suppression refusée par le service d'authentification : " + error.message });
  return reponse(200, { ok: true });
});
```
(`telephone_contact` est `not null` avec un motif de validation — vérifier `MOTIF_TELEPHONE` dans `_commun.ts` ; si le trigger de validation refuse `0000000000`, utiliser une valeur acceptée et documentée, ou rendre la colonne nullable par migration.)

## 2. `src/pages/compte/Securite.tsx:81-93`

```diff
   const supprimer = async () => {
-    const { error } = await supabase
-      .from("profiles")
-      .delete()
-      .eq("id", utilisateur?.id ?? "")
-      .select("id");
+    const { data, error } = await supabase.functions.invoke("compte-supprimer", { body: {} });
     if (error) {
-      toast.error("Suppression impossible", { description: error.message });
+      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
+      toast.error("Suppression impossible", { description: (detail as { erreur?: string } | null)?.erreur ?? error.message });
       return;
     }
+    if (!(data as { ok?: boolean })?.ok) { toast.error("Suppression impossible"); return; }
     await deconnexion();
-    toast.success("Compte supprimé");
+    toast.success("Compte supprimé", { description: "Vos données personnelles sont effacées. Les montants de vos commandes passées sont conservés sans votre nom." });
   };
```
Le texte de la boîte de confirmation (ligne ~140) doit dire ce qui se passe : « Votre profil, vos adresses, favoris, avis et notifications sont effacés définitivement. Les commandes terminées sont conservées sans votre nom (obligation comptable). Un dépôt ou un litige en cours bloque la suppression. »

## 3. Ne plus laisser le client supprimer un profil « à moitié »

```sql
-- Le chemin direct est trompeur : on le ferme. La seule suppression passe par la fonction.
drop policy if exists "profil supprimable par son proprietaire" on public.profiles;
```

## 4. `Confidentialite.tsx` — § Vos droits

Ajouter après « Supprimer votre compte » : « La suppression est immédiate depuis *Mon compte › Sécurité*. Les commandes terminées sont conservées cinq ans sans votre nom ni votre numéro (obligation comptable) ; un dépôt ou un litige en cours doit être clos avant. »

## 5. Vérification

Avec le compte de recette (F-04) : créer une adresse, un favori → supprimer → tenter de se reconnecter (échec attendu « identifiants invalides ») → SQL : `select count(*) from auth.users where email = '…'` = 0, `select count(*) from public.favoris where user_id = '…'` = 0.

## Commit

```
fix(compte): la suppression efface vraiment l'utilisateur (fonction compte-supprimer), pseudonymise les commandes closes
```
Fichiers : `supabase/functions/compte-supprimer/index.ts`, `src/pages/compte/Securite.tsx`, `supabase/migrations/20260906110000_profiles_sans_delete_direct.sql`, `src/pages/contenu/Confidentialite.tsx`.
