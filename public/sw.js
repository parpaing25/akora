/// <reference lib="webworker" />
// Service worker d'Akora.
//
// Le precache est INJECTE par vite-plugin-pwa et limite a la coquille
// (cf. vite.config.ts). Retour d'experience Fonenako : un precache de
// 154 fichiers a fait passer l'accueil de 4,3 s a 9,6 s sur mutualise.
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("message", (evenement) => {
  if (evenement.data && evenement.data.type === "SKIP_WAITING") self.skipWaiting();
});

// ── Web Push ─────────────────────────────────────────────────────────────
// L'envoi exige une paire de cles VAPID, qui vit dans les secrets serveur.
// Ce recepteur, lui, est pret : il n'y aura rien a redeployer cote client.
self.addEventListener("push", (evenement) => {
  let charge = { titre: "Akora", corps: "", lien: "/" };
  try {
    charge = { ...charge, ...(evenement.data ? evenement.data.json() : {}) };
  } catch {
    if (evenement.data) charge.corps = evenement.data.text();
  }
  evenement.waitUntil(
    self.registration.showNotification(charge.titre, {
      body: charge.corps,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { lien: charge.lien },
      lang: "fr",
    }),
  );
});

self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  const lien = (evenement.notification.data && evenement.notification.data.lien) || "/";
  evenement.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const fenetre of fenetres) {
        if ("focus" in fenetre) {
          fenetre.navigate(lien);
          return fenetre.focus();
        }
      }
      return self.clients.openWindow(lien);
    }),
  );
});
