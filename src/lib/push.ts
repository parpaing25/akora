import { supabase } from "@/integrations/supabase/client";

/**
 * Abonnement Web Push.
 *
 * ⚠️ À BRANCHER : clés VAPID. Sans clé publique, on ne demande même pas la
 * permission — mieux vaut ne rien proposer que griller le seul consentement
 * que l'utilisateur accordera. Le jour où la clé est là, il n'y a rien à
 * changer ici.
 */
const CLE_PUBLIQUE = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function pushDisponible(): boolean {
  return (
    Boolean(CLE_PUBLIQUE) &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** La cle VAPID arrive en base64url ; PushManager veut des octets bruts. */
function versTableauOctets(base64: string): ArrayBuffer {
  const complement = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalise = (base64 + complement).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(normalise);
  const tampon = new ArrayBuffer(brut.length);
  const octets = new Uint8Array(tampon);
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return tampon;
}

/** Demande la permission et enregistre l'abonnement. Renvoie false si refusé. */
export async function activerPush(): Promise<boolean> {
  if (!pushDisponible()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  const abonnement = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: versTableauOctets(CLE_PUBLIQUE as string),
  });

  const donnees = abonnement.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId || !donnees.endpoint || !donnees.keys?.p256dh || !donnees.keys.auth) return false;

  const { error } = await supabase
    .from("abonnements_push")
    .upsert(
      {
        user_id: userId,
        endpoint: donnees.endpoint,
        cle_p256dh: donnees.keys.p256dh,
        cle_auth: donnees.keys.auth,
        agent: navigator.userAgent.slice(0, 200),
        vu_le: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    )
    .select("id");
  return !error;
}

export async function desactiverPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const abonnement = await registration.pushManager.getSubscription();
  if (!abonnement) return;
  await supabase.from("abonnements_push").delete().eq("endpoint", abonnement.endpoint).select("id");
  await abonnement.unsubscribe();
}
