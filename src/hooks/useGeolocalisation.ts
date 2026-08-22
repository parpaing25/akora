import * as React from "react";
import type { Point } from "@/lib/livraison";

/**
 * « Ma position », via l'API du navigateur (règle A2.3 : aucun service à clé).
 * Elle échoue souvent — permission refusée, GPS coupé, intérieur d'un bâtiment.
 * On renvoie donc toujours un message lisible plutôt qu'un code d'erreur.
 */
export function useGeolocalisation() {
  const [enCours, setEnCours] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);

  const localiser = React.useCallback((): Promise<Point | null> => {
    setErreur(null);
    if (!("geolocation" in navigator)) {
      setErreur("Votre navigateur ne sait pas donner votre position.");
      return Promise.resolve(null);
    }
    setEnCours(true);
    return new Promise((resoudre) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setEnCours(false);
          resoudre({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (echec) => {
          setEnCours(false);
          setErreur(
            echec.code === echec.PERMISSION_DENIED
              ? "Position refusée. Autorisez la localisation, ou pointez sur la carte."
              : "Position introuvable. Pointez sur la carte à la place.",
          );
          resoudre(null);
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
      );
    });
  }, []);

  return { localiser, enCours, erreur };
}
