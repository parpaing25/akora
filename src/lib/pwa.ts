/**
 * Enregistrement DIFFÉRÉ du service worker.
 *
 * On attend « load » puis une seconde de plus : le précache, même limité à la
 * coquille, ne doit pas concurrencer l'affichage de la première page sur une
 * 3G lente. C'est la leçon la plus chère de Fonenako.
 *
 * Et on recharge la page dès qu'une nouvelle version prend la main. Sans cela,
 * l'onglet ouvert continue d'exécuter l'ancien code jusqu'à sa fermeture — ce
 * qui, sur un téléphone, n'arrive jamais. Le 22/08/2026, une correction
 * d'authentification est restée invisible côté navigateur pour cette seule
 * raison, alors qu'elle était en ligne et correcte.
 */
export function enregistrerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

  // Y avait-il déjà une version aux commandes ? Si non, la prise de main qui
  // suit est la toute première installation : il n'y a rien à recharger, et le
  // faire ferait clignoter la page d'accueil de chaque nouveau visiteur.
  const versionPrecedente = Boolean(navigator.serviceWorker.controller);
  let rechargement = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!versionPrecedente || rechargement) return;
    rechargement = true;
    window.location.reload();
  });

  const demarrer = () => {
    window.setTimeout(() => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((enregistrement) => {
          // Un onglet laissé ouvert plusieurs jours ne redemande jamais le
          // fichier de lui-même : on le lui fait vérifier à chaque ouverture,
          // puis une fois par heure.
          void enregistrement.update();
          window.setInterval(() => void enregistrement.update(), 60 * 60 * 1000);
        })
        .catch(() => {
          // Un service worker qui ne s'installe pas n'empêche pas le site de
          // fonctionner : on n'alerte pas l'utilisateur pour ça.
        });
    }, 1000);
  };

  if (document.readyState === "complete") demarrer();
  else window.addEventListener("load", demarrer, { once: true });
}
