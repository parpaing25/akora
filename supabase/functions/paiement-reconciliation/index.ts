import { clientAdmin, enTetesCors, reponse } from "../_commun.ts";

/**
 * Tâche quotidienne de réconciliation.
 *
 * Trois nettoyages, dans cet ordre :
 * 1. Les paiements restés `en_attente_client` depuis plus de 30 minutes sont
 *    expirés — un acheteur ne doit pas voir « en attente » pendant trois jours.
 * 2. Les commandes livrées depuis plus de 72 h sans contestation voient leur
 *    séquestre libéré (spec B10).
 * 3. Les badges « Partenaire Akora » sont recalculés.
 *
 * Protégée par un secret d'appel : cette fonction bouge de l'argent.
 */

const DELAI_EXPIRATION_MINUTES = 30;

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response("ok", { headers: enTetesCors });

  const attendu = Deno.env.get("AKORA_CRON_SECRET");
  const fourni = requete.headers.get("x-akora-cron");
  if (!attendu || fourni !== attendu) {
    return reponse(403, { erreur: "Appel non autorisé." });
  }

  const client = clientAdmin();
  const maintenant = Date.now();
  const rapport = { expires: 0, liberes: 0, badges: 0, erreurs: [] as string[] };

  // ── 1. Paiements abandonnés ─────────────────────────────────────────────
  const limite = new Date(maintenant - DELAI_EXPIRATION_MINUTES * 60_000).toISOString();
  const { data: abandonnes } = await client
    .from("paiements")
    .select("id")
    .eq("statut", "en_attente_client")
    .lt("initie_le", limite);
  for (const paiement of abandonnes ?? []) {
    const { error } = await client
      .from("paiements")
      .update({ statut: "expire" })
      .eq("id", paiement.id)
      .select("id");
    if (error) rapport.erreurs.push("expiration " + paiement.id + " : " + error.message);
    else rapport.expires++;
  }

  // ── 2. Séquestres à libérer : 72 h après la livraison, sans litige ──────
  const { data: parametre } = await client
    .from("parametres")
    .select("valeur")
    .eq("cle", "delai_liberation_heures")
    .maybeSingle();
  const delaiHeures = Number(parametre?.valeur ?? 72);
  const seuil = new Date(maintenant - delaiHeures * 3_600_000).toISOString();

  const { data: aLiberer } = await client
    .from("commandes")
    .select("id, numero")
    .eq("statut", "livree")
    .lt("livree_le", seuil);

  for (const commande of aLiberer ?? []) {
    const { data: litige } = await client
      .from("litiges")
      .select("id")
      .eq("commande_id", commande.id)
      .neq("statut", "tranche")
      .maybeSingle();
    if (litige) continue;

    const { data: paiements } = await client
      .from("paiements")
      .select("id")
      .eq("commande_id", commande.id)
      .eq("statut", "sequestre");
    for (const paiement of paiements ?? []) {
      const { error } = await client.rpc("liberer_sequestre", { _paiement_id: paiement.id });
      if (error) rapport.erreurs.push("libération " + paiement.id + " : " + error.message);
      else rapport.liberes++;
    }
    await client.from("commandes").update({ statut: "cloturee" }).eq("id", commande.id).select("id");
  }

  // ── 3. Badges Partenaire ────────────────────────────────────────────────
  const { data: badges, error: erreurBadges } = await client.rpc("attribuer_badges_partenaire");
  if (erreurBadges) rapport.erreurs.push("badges : " + erreurBadges.message);
  else rapport.badges = Number(badges ?? 0);

  return reponse(200, rapport);
});
