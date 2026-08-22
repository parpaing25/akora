import { clientAdmin, enTetesCors, reponse, utilisateurAppelant } from "../_commun.ts";
import { prestataire, type Operateur } from "../_partage/paiement/index.ts";

/**
 * Interrogation de statut, en SECOURS du webhook.
 *
 * Un webhook peut se perdre : réseau coupé, redéploiement au mauvais moment,
 * opérateur qui abandonne après trois essais. Sans ce recours, un acheteur qui
 * a réellement payé resterait bloqué. La confirmation reste toutefois
 * subordonnée à la réponse de l'opérateur, jamais à l'affirmation du client.
 */

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response("ok", { headers: enTetesCors });
  if (requete.method !== "POST") return reponse(405, { erreur: "Méthode non autorisée." });

  const utilisateur = await utilisateurAppelant(requete);
  if (!utilisateur) return reponse(401, { erreur: "Connectez-vous." });

  const client = clientAdmin();
  const { paiement_id } = (await requete.json().catch(() => ({}))) as { paiement_id?: string };
  if (!paiement_id) return reponse(400, { erreur: "Paiement non précisé." });

  const { data: paiement } = await client
    .from("paiements")
    .select("id, statut, operateur, cle_idempotence, reference_externe, commande_id")
    .eq("id", paiement_id)
    .maybeSingle();
  if (!paiement) return reponse(404, { erreur: "Paiement introuvable." });

  const { data: commande } = await client
    .from("commandes")
    .select("id, acheteur_id")
    .eq("id", paiement.commande_id)
    .maybeSingle();
  if (commande?.acheteur_id !== utilisateur) {
    return reponse(403, { erreur: "Ce paiement ne vous appartient pas." });
  }

  // Un paiement déjà résolu n'a plus rien à demander à l'opérateur.
  if (!["initie", "en_attente_client", "en_verification"].includes(String(paiement.statut))) {
    return reponse(200, { statut: paiement.statut, interroge: false });
  }

  const service = prestataire(paiement.operateur as Operateur);
  const etat = await service.verifierStatut(
    String(paiement.reference_externe ?? paiement.cle_idempotence),
  );

  if (etat.statut === "confirme" && paiement.statut !== "confirme") {
    await client
      .from("paiements")
      .update({ statut: "confirme", reference_externe: etat.referenceExterne })
      .eq("id", paiement.id)
      .select("id");
    await client.rpc("journaliser", {
      _action: "confirmer_paiement_par_statut",
      _entite: "paiements",
      _entite_id: paiement.id,
      _avant: { statut: paiement.statut },
      _apres: { statut: "confirme" },
    });
    return reponse(200, { statut: "confirme", interroge: true });
  }

  if (etat.statut === "rejete" || etat.statut === "expire") {
    await client
      .from("paiements")
      .update({ statut: etat.statut === "rejete" ? "rejete" : "expire" })
      .eq("id", paiement.id)
      .select("id");
    return reponse(200, { statut: etat.statut, interroge: true });
  }

  return reponse(200, { statut: paiement.statut, interroge: true });
});
