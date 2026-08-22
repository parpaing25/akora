/// <reference lib="webworker" />
// Service worker d'Akora. Le precache est INJECTE par vite-plugin-pwa et se
// limite volontairement a la coquille (cf. vite.config.ts) : sur o2switch, un
// precache large fait s'ecrouler le temps d'affichage de la premiere page.
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("message", (evenement) => {
  if (evenement.data && evenement.data.type === "SKIP_WAITING") self.skipWaiting();
});
