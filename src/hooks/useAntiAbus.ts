import * as React from "react";

/**
 * Anti-abus côté formulaire (règle A3) : un champ leurre invisible et un délai
 * minimal de 3 secondes entre l'affichage et l'envoi.
 *
 * Ce n'est que la première barrière, la moins chère. Le vrai plafond
 * N/heure/IP vit en base (table `rate_limits`), parce qu'un robot ne passe pas
 * forcément par cet écran.
 */
const DELAI_MINIMAL_MS = 3_000;

export interface AntiAbus {
  /** À étaler sur un input caché, hors flux et hors tabulation. */
  proprietesLeurre: {
    name: string;
    tabIndex: number;
    autoComplete: string;
    "aria-hidden": true;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    style: React.CSSProperties;
  };
  /** `null` si tout va bien, sinon le message à afficher. */
  verifier: () => string | null;
}

export function useAntiAbus(): AntiAbus {
  const [leurre, setLeurre] = React.useState("");
  const affichageRef = React.useRef<number>(Date.now());

  return {
    proprietesLeurre: {
      name: "societe_web",
      tabIndex: -1,
      autoComplete: "off",
      "aria-hidden": true,
      value: leurre,
      onChange: (e) => setLeurre(e.target.value),
      style: { position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: 0 },
    },
    verifier: () => {
      if (leurre.trim() !== "") return "Envoi refusé.";
      if (Date.now() - affichageRef.current < DELAI_MINIMAL_MS) {
        return "Merci de prendre quelques secondes pour vérifier vos informations avant d'envoyer.";
      }
      return null;
    },
  };
}
