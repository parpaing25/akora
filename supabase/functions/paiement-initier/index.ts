import { clientAdmin, enTetesCors, MOTIF_TELEPHONE, quotaOk, reponse, utilisateurAppelant } from "../_commun.ts";
import { prestataire, type Operateur } from "../_partage/paiement/index.ts";
import { pourcentage } from "../_partage/argent.ts";

/**
 * Initiation d'un paiement.
 *
 * Le client envoie une commande, un opérateur, un mode et un numéro payeur.
 * IL N'ENVOIE JAMAIS DE MONTANT : celui-ci est recalculé ici depuis la
 * commande (recette F7). Une double soumission ne crée pas deux paiements,
 * grâce à la clé d'idempotence.
 */

interface CorpsRequete {
  commande_id: string;
  operateur: Operateur;
  mode: "en_ligne_integral" | "en_ligne_acompte";
  msisdn: string;
}

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response("ok", { headers: enTetesCors });
  if (requete.method !== "POST") return reponse(405, { erreur: "Méthode non autorisée." });

  const utilisateur = await utilisateurAppelant(requete);
  if (!utilisateur) {
    return reponse(401, { erreur: "Connectez-vous pour payer en ligne." });
  }

  const client = clientAdmin();

  // L'adresse doit avoir ete confirmee par le code a six chiffres. On ne se
  // fie PAS a `auth.users.email_confirmed_at` : la confirmation native de
  // Supabase est desactivee, cette colonne est remplie des l'inscription.
  const { data: profil } = await client
    .from("profiles")
    .select("email_verifie")
    .eq("id", utilisateur)
    .maybeSingle();
  if (!profil?.email_verifie) {
    return reponse(403, {
      erreur:
        "Confirmez votre adresse e-mail avant de payer en ligne. Le code a six chiffres vous a ete envoye a l'inscription.",
    });
  }

  if (!(await quotaOk(client, "initier_paiement", utilisateur, 30))) {
    return reponse(429, { erreur: "Trop de tentatives de paiement. Réessayez dans une heure." });
  }

  let corps: CorpsRequete;
  try {
    corps = (await requete.json()) as CorpsRequete;
  } catch {
    return reponse(400, { erreur: "Corps de requête illisible." });
  }
  if (!MOTIF_TELEPHONE.test(corps.msisdn ?? "")) {
    return reponse(400, { erreur: "Numéro payeur invalide." });
  }

  const { data: commande, error } = await client
    .from("commandes")
    .select("id, numero, acheteur_id, fournisseur_id, montant_total, statut, mode_paiement, livraison_estimable")
    .eq("id", corps.commande_id)
    .maybeSingle();
  if (error) return reponse(500, { erreur: error.message });
  if (!commande) return reponse(404, { erreur: "Commande introuvable." });
  if (commande.acheteur_id !== utilisateur) {
    return reponse(403, { erreur: "Cette commande ne vous appartient pas." });
  }
  if (!commande.livraison_estimable) {
    return reponse(400, {
      erreur: "La livraison de cette commande n'est pas chiffrable : le paiement en ligne est indisponible.",
    });
  }
  if (["annulee", "refusee", "cloturee", "litige"].includes(String(commande.statut))) {
    return reponse(400, { erreur: "Cette commande n'accepte plus de paiement." });
  }

  // ── LE MONTANT, recalculé ici et nulle part ailleurs ────────────────────
  const { data: fournisseur } = await client
    .from("fournisseurs")
    .select("taux_acompte, niveau_verification, modes_paiement_acceptes")
    .eq("id", commande.fournisseur_id)
    .maybeSingle();
  if (!["verifie", "partenaire"].includes(String(fournisseur?.niveau_verification))) {
    return reponse(400, { erreur: "Ce fournisseur n'est pas autorisé à encaisser en ligne." });
  }
  if (!(fournisseur?.modes_paiement_acceptes ?? []).includes(corps.mode)) {
    return reponse(400, { erreur: "Ce mode de paiement n'est pas proposé par le fournisseur." });
  }

  const total = Number(commande.montant_total);
  const montant =
    corps.mode === "en_ligne_acompte" ? pourcentage(total, Number(fournisseur?.taux_acompte ?? 30)) : total;
  if (!(montant > 0)) return reponse(400, { erreur: "Montant nul : rien à payer en ligne." });

  // Clé d'idempotence : la même demande ne crée jamais deux paiements.
  const cleIdempotence = `${commande.id}:${corps.mode}:${montant}`;
  const { data: existant } = await client
    .from("paiements")
    .select("id, statut, operateur, montant, reference_externe")
    .eq("cle_idempotence", cleIdempotence)
    .maybeSingle();
  if (existant && !["rejete", "expire", "echoue"].includes(String(existant.statut))) {
    return reponse(200, {
      paiement_id: existant.id,
      montant: Number(existant.montant),
      statut: existant.statut,
      deja_initie: true,
    });
  }

  const service = prestataire(corps.operateur);
  const initiation = await service.initier({
    reference: cleIdempotence,
    montant,
    msisdn: corps.msisdn,
    numeroCommande: String(commande.numero),
    libelle: "Akora " + commande.numero,
  });

  if (initiation.statut === "echoue") {
    return reponse(502, { erreur: initiation.erreur ?? "L'opérateur a refusé l'initiation." });
  }

  const { data: paiement, error: erreurInsert } = await client
    .from("paiements")
    .insert({
      commande_id: commande.id,
      operateur: corps.operateur,
      mode: corps.mode,
      montant,
      cle_idempotence: cleIdempotence,
      reference_externe: initiation.referenceExterne,
      msisdn: corps.msisdn,
      statut: "initie",
      payload_brut: (initiation.brut ?? null) as never,
    })
    .select("id")
    .single();
  if (erreurInsert || !paiement) {
    return reponse(500, { erreur: erreurInsert?.message ?? "Création du paiement refusée." });
  }

  await client.from("paiements").update({ statut: "en_attente_client" }).eq("id", paiement.id).select("id");
  await client
    .from("commandes")
    .update({ statut: "en_attente_paiement" })
    .eq("id", commande.id)
    .select("id");

  await client.rpc("journaliser", {
    _action: "initier_paiement",
    _entite: "paiements",
    _entite_id: paiement.id,
    _avant: null,
    _apres: { montant, operateur: corps.operateur, mode: corps.mode },
  });

  return reponse(200, {
    paiement_id: paiement.id,
    montant,
    statut: "en_attente_client",
    instructions: initiation.instructions ?? null,
    url_redirection: initiation.urlRedirection ?? null,
    mode_prestataire: service.constructor.name === "ReferenceManuelle" ? "reference_manuelle" : "api",
  });
});
