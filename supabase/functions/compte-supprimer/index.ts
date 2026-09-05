import { clientAdmin, enTetesCors, reponse, utilisateurAppelant } from "../_commun.ts";

/**
 * Suppression RÉELLE du compte de l'appelant (droit à l'effacement, loi 2014-038).
 *
 * Avant le 06/09/2026, le bouton « Supprimer mon compte » effaçait la ligne
 * `profiles` seulement : la clé étrangère va de profiles VERS auth.users, donc
 * l'identité restait et la personne pouvait se reconnecter sur un compte sans
 * profil (audit F-06). Ici : refus tant qu'une obligation court (dépôt possédé,
 * litige ouvert, commande en cours), pseudonymisation des commandes closes (la
 * comptabilité garde le montant, pas la personne), puis suppression GoTrue —
 * les CASCADE de la base (profil, adresses, favoris, avis, notifications…)
 * font le reste.
 */
Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response("ok", { headers: enTetesCors });
  if (requete.method !== "POST") return reponse(405, { erreur: "Méthode non autorisée." });

  const uid = await utilisateurAppelant(requete);
  if (!uid) return reponse(401, { erreur: "Connectez-vous pour supprimer votre compte." });
  const client = clientAdmin();

  const { count: depots } = await client
    .from("fournisseurs").select("id", { count: "exact", head: true }).eq("owner_id", uid);
  if ((depots ?? 0) > 0) {
    return reponse(409, {
      erreur: "Vous possédez un dépôt. Fermez-le ou transférez-le (Mon dépôt › Vitrine) avant de supprimer votre compte.",
    });
  }

  const { count: litiges } = await client
    .from("litiges").select("id", { count: "exact", head: true }).eq("ouvert_par", uid).neq("statut", "tranche");
  if ((litiges ?? 0) > 0) {
    return reponse(409, { erreur: "Un litige que vous avez ouvert est encore en cours d'examen." });
  }

  const { count: enCours } = await client
    .from("commandes").select("id", { count: "exact", head: true }).eq("acheteur_id", uid)
    .not("statut", "in", "(cloturee,annulee,refusee)");
  if ((enCours ?? 0) > 0) {
    return reponse(409, {
      erreur: "Une commande est encore en cours. Attendez sa clôture (ou annulez-la) avant de supprimer le compte.",
    });
  }

  // Pseudonymisation des commandes terminées : le montant reste, la personne part.
  // Le numéro factice respecte la contrainte commandes_telephone_valide (^\+2613[2-9]\d{7}$).
  const { error: erreurPseudo } = await client
    .from("commandes")
    .update({ nom_contact: "Compte supprimé", telephone_contact: "+261390000000", email_contact: null, adresse_libre: null, message: null })
    .eq("acheteur_id", uid);
  if (erreurPseudo) return reponse(500, { erreur: "Pseudonymisation impossible : " + erreurPseudo.message });

  await client.rpc("journaliser", {
    _action: "supprimer_compte",
    _entite: "auth.users",
    _entite_id: uid,
    _avant: null,
    _apres: { par: "lui-meme" },
  });

  const { error } = await client.auth.admin.deleteUser(uid);
  if (error) return reponse(500, { erreur: "Suppression refusée par le service d'authentification : " + error.message });

  return reponse(200, { ok: true });
});
