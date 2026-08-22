import { clientAdmin, enTetesCors, reponse } from "../_commun.ts";
import { prestataire, type Operateur } from "../_partage/paiement/index.ts";

/**
 * Webhook des opérateurs. Point d'entrée PUBLIC — donc le plus exposé du
 * produit. Trois garde-fous, dans cet ordre :
 *
 * 1. SIGNATURE vérifiée. Un webhook non signé ne fait jamais avancer un
 *    paiement : il est enregistré, et c'est tout.
 * 2. REJEU rejeté. `webhooks_recus` porte une contrainte d'unicité sur
 *    (opérateur, id d'événement) : dix envois du même événement ne créditent
 *    qu'une fois.
 * 3. RÉPONSE 200 dès l'enregistrement, même si le traitement métier échoue.
 *    Sinon l'opérateur réessaie en boucle et on perd l'événement. Ce qui
 *    n'a pas pu être traité reste `traite = false` et sera repris.
 */

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response("ok", { headers: enTetesCors });
  if (requete.method !== "POST") return reponse(405, { erreur: "Méthode non autorisée." });

  const url = new URL(requete.url);
  const operateur = (url.searchParams.get("operateur") ?? "") as Operateur;
  if (!["mvola", "orange_money", "airtel_money"].includes(operateur)) {
    return reponse(400, { erreur: "Opérateur inconnu." });
  }

  const client = clientAdmin();
  const signature =
    requete.headers.get("x-signature") ??
    requete.headers.get("x-hub-signature-256") ??
    requete.headers.get("signature");

  let payload: unknown;
  try {
    payload = await requete.json();
  } catch {
    return reponse(400, { erreur: "Corps illisible." });
  }

  const service = prestataire(operateur);
  const evenement = await service.traiterWebhook(payload, signature);
  const idEvenement = evenement.idEvenement || crypto.randomUUID();

  // Enregistrement AVANT tout traitement : c'est lui qui rend le rejeu inerte.
  const { error: erreurEnregistrement } = await client
    .from("webhooks_recus")
    .insert({
      operateur,
      id_evenement: idEvenement,
      signature_valide: evenement.signatureValide,
      payload: payload as never,
      traite: false,
    })
    .select("id");

  if (erreurEnregistrement) {
    // Violation d'unicité = rejeu. On répond 200 : l'opérateur a fait son
    // travail, il n'a pas à réessayer.
    if (erreurEnregistrement.code === "23505") {
      return reponse(200, { recu: true, rejeu: true });
    }
    return reponse(200, { recu: true, enregistre: false });
  }

  if (!evenement.signatureValide) {
    await client
      .from("webhooks_recus")
      .update({ erreur: "Signature absente ou invalide : aucun paiement modifié." })
      .eq("operateur", operateur)
      .eq("id_evenement", idEvenement)
      .select("id");
    return reponse(200, { recu: true, applique: false });
  }

  try {
    if (evenement.reference) {
      const { data: paiement } = await client
        .from("paiements")
        .select("id, statut, commande_id")
        .eq("cle_idempotence", evenement.reference)
        .maybeSingle();

      if (paiement) {
        const nouveau =
          evenement.statut === "confirme"
            ? "confirme"
            : evenement.statut === "rejete"
              ? "rejete"
              : evenement.statut === "expire"
                ? "expire"
                : null;

        if (nouveau) {
          await client
            .from("paiements")
            .update({ statut: nouveau, reference_externe: evenement.referenceExterne })
            .eq("id", paiement.id)
            .select("id");

          if (nouveau === "confirme") {
            await mettreSousSequestre(client, paiement.id, String(paiement.commande_id));
          }
        }
      }
    }
    await client
      .from("webhooks_recus")
      .update({ traite: true })
      .eq("operateur", operateur)
      .eq("id_evenement", idEvenement)
      .select("id");
  } catch (erreur) {
    await client
      .from("webhooks_recus")
      .update({ erreur: String((erreur as Error).message) })
      .eq("operateur", operateur)
      .eq("id_evenement", idEvenement)
      .select("id");
  }

  return reponse(200, { recu: true });
});

/**
 * Passage en séquestre : le paiement est confirmé mais l'argent n'appartient
 * pas encore au fournisseur. Il est porté au `solde_sequestre`, pas au solde
 * disponible — et ne bougera qu'à la confirmation de livraison.
 */
export async function mettreSousSequestre(
  client: ReturnType<typeof clientAdmin>,
  paiementId: string,
  commandeId: string,
): Promise<void> {
  const { data: paiement } = await client
    .from("paiements")
    .select("id, montant, statut")
    .eq("id", paiementId)
    .maybeSingle();
  if (!paiement || paiement.statut !== "confirme") return;

  const { data: commande } = await client
    .from("commandes")
    .select("id, numero, fournisseur_id, statut, acheteur_id")
    .eq("id", commandeId)
    .maybeSingle();
  if (!commande) return;

  await client.from("paiements").update({ statut: "sequestre" }).eq("id", paiementId).select("id");

  await client.from("portefeuilles").upsert(
    { fournisseur_id: commande.fournisseur_id },
    { onConflict: "fournisseur_id", ignoreDuplicates: true },
  );
  const { data: portefeuille } = await client
    .from("portefeuilles")
    .select("solde_sequestre")
    .eq("fournisseur_id", commande.fournisseur_id)
    .maybeSingle();
  await client
    .from("portefeuilles")
    .update({
      solde_sequestre: Number(portefeuille?.solde_sequestre ?? 0) + Number(paiement.montant),
      maj_le: new Date().toISOString(),
    })
    .eq("fournisseur_id", commande.fournisseur_id)
    .select("fournisseur_id");

  if (commande.statut === "en_attente_paiement") {
    await client.from("commandes").update({ statut: "payee" }).eq("id", commandeId).select("id");
  }

  await client.rpc("journaliser", {
    _action: "sequestre",
    _entite: "paiements",
    _entite_id: paiementId,
    _avant: { statut: "confirme" },
    _apres: { statut: "sequestre", montant: Number(paiement.montant) },
  });

  const { data: fournisseur } = await client
    .from("fournisseurs")
    .select("owner_id")
    .eq("id", commande.fournisseur_id)
    .maybeSingle();
  if (fournisseur?.owner_id) {
    await client.rpc("notifier", {
      _user_id: fournisseur.owner_id,
      _titre: "Paiement reçu " + commande.numero,
      _corps: "La somme est sous séquestre jusqu'à la confirmation de livraison.",
      _lien: "/pro/commandes",
      _categorie: "paiement",
    });
  }
}
