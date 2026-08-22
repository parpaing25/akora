import * as React from "react";

/**
 * Vrai au-dessus du point de rupture `lg` (1024 px).
 *
 * Pourquoi un hook plutôt que deux blocs `lg:hidden` / `hidden lg:flex` : les
 * pages d'authentification n'ont pas la même STRUCTURE selon la taille — un
 * parcours en deux étapes sur téléphone, un écran scindé sur ordinateur. Poser
 * les deux dans le DOM dupliquerait chaque champ : mêmes `id`, mêmes
 * étiquettes, deux fois. Un lecteur d'écran y perdrait son latin, et
 * react-hook-form garderait la référence du dernier champ monté.
 *
 * On n'en rend donc qu'un. La lecture initiale est synchrone : pas de saut de
 * mise en page au premier affichage.
 */
function lire(requete: string): boolean {
  // `matchMedia` manque au rendu hors navigateur — les controles
  // d'accessibilite passent par un rendu serveur. On retombe alors sur la
  // disposition telephone, qui est la plus contrainte : si elle passe, l'autre
  // passe aussi.
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(requete).matches;
}

export function useGrandEcran(requete = "(min-width: 1024px)"): boolean {
  const [grand, setGrand] = React.useState(() => lire(requete));

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(requete);
    const majeur = () => setGrand(media.matches);
    majeur();
    media.addEventListener("change", majeur);
    return () => media.removeEventListener("change", majeur);
  }, [requete]);

  return grand;
}
