import { clientAdmin, enTetesCors, reponse } from "../_commun.ts";

/**
 * Envoi des notifications push en attente.
 *
 * Appelee par un trigger de base des qu'une ligne arrive dans `notifications`
 * (via `pg_net`), et rejouable par le cron pour rattraper ce qui aurait
 * echoue. Elle n'est jamais appelee par le navigateur : le secret partage la
 * ferme.
 *
 * Le Web Push n'est pas un simple POST : la charge est chiffree pour le
 * navigateur destinataire (aes128gcm) et signee avec la cle VAPID. On s'appuie
 * donc sur `web-push`, plutot que de reimplementer une cryptographie qu'on
 * n'aurait aucun moyen de tester serieusement.
 *
 * Un abonnement mort (404 ou 410) est SUPPRIME : c'est un navigateur
 * desinstalle ou des donnees effacees, et le garder ferait echouer chaque
 * envoi suivant pour toujours.
 */

interface Notification {
  id: string;
  user_id: string;
  titre: string;
  corps: string | null;
  lien: string | null;
}

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response("ok", { headers: enTetesCors });
  if (requete.method !== "POST") return reponse(405, { erreur: "Méthode non autorisée." });

  const attendu = Deno.env.get("AKORA_CRON_SECRET");
  if (!attendu || requete.headers.get("x-akora-secret") !== attendu) {
    return reponse(401, { erreur: "Appel non autorisé." });
  }

  const publique = Deno.env.get("VAPID_PUBLIC_KEY");
  const privee = Deno.env.get("VAPID_PRIVATE_KEY");
  const sujet = Deno.env.get("VAPID_SUBJECT") ?? "mailto:akora@akora.fonenako.mg";
  if (!publique || !privee) {
    return reponse(503, { erreur: "Clés VAPID absentes des secrets." });
  }

  let corps: { notificationId?: string } = {};
  try {
    corps = await requete.json();
  } catch {
    // Appel du cron, sans corps : on traite tout ce qui est en attente.
  }

  const client = clientAdmin();

  // Les notifications non encore poussees. Le trigger en designe une ; le cron
  // ratisse les dernieres heures pour rattraper les envois manques.
  let requeteNotifs = client
    .from("notifications")
    .select("id, user_id, titre, corps, lien")
    .is("poussee_le", null)
    .order("created_at", { ascending: true })
    .limit(200);
  if (corps.notificationId) requeteNotifs = requeteNotifs.eq("id", corps.notificationId);

  const { data: notifications, error } = await requeteNotifs;
  if (error) {
    console.error("Lecture des notifications impossible :", error);
    return reponse(500, { erreur: "Lecture impossible." });
  }
  const aTraiter = (notifications ?? []) as Notification[];
  if (aTraiter.length === 0) return reponse(200, { envoyees: 0, abonnements: 0 });

  const webpush = await import("npm:web-push@3.6.7");
  webpush.default.setVapidDetails(sujet, publique, privee);

  let envoyees = 0;
  let cibles = 0;
  const perimes: string[] = [];

  for (const notification of aTraiter) {
    const { data: abonnements } = await client
      .from("abonnements_push")
      .select("id, endpoint, cle_p256dh, cle_auth")
      .eq("user_id", notification.user_id);

    for (const abonnement of abonnements ?? []) {
      cibles += 1;
      try {
        await webpush.default.sendNotification(
          {
            endpoint: abonnement.endpoint as string,
            keys: { p256dh: abonnement.cle_p256dh as string, auth: abonnement.cle_auth as string },
          },
          JSON.stringify({
            titre: notification.titre,
            corps: notification.corps ?? "",
            lien: notification.lien ?? "/",
          }),
          { TTL: 24 * 3600 },
        );
        envoyees += 1;
      } catch (erreur) {
        const statut = (erreur as { statusCode?: number }).statusCode;
        if (statut === 404 || statut === 410) perimes.push(abonnement.id as string);
        else console.error("Envoi push impossible :", statut, (erreur as Error).message);
      }
    }

    await client
      .from("notifications")
      .update({ poussee_le: new Date().toISOString() })
      .eq("id", notification.id)
      .select("id");
  }

  if (perimes.length > 0) {
    await client.from("abonnements_push").delete().in("id", perimes).select("id");
  }

  return reponse(200, {
    notifications: aTraiter.length,
    abonnements: cibles,
    envoyees,
    perimes: perimes.length,
  });
});
