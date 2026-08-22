/**
 * Enregistrement DIFFÉRÉ du service worker.
 *
 * On attend « load » puis une seconde de plus : le précache, même limité à la
 * coquille, ne doit pas concurrencer l'affichage de la première page sur une
 * 3G lente. C'est la leçon la plus chère de Fonenako.
 */
export function enregistrerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

  const demarrer = () => {
    window.setTimeout(() => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Un service worker qui ne s'installe pas n'empêche pas le site de
        // fonctionner : on n'alerte pas l'utilisateur pour ça.
      });
    }, 1000);
  };

  if (document.readyState === "complete") demarrer();
  else window.addEventListener("load", demarrer, { once: true });
}
