import * as React from "react";

/**
 * Saisie d'un code à six chiffres, une case par chiffre.
 *
 * Six cases plutôt qu'un champ : sur un téléphone, on recopie un code en
 * gardant un œil sur le mail. Le collage du code entier fonctionne aussi,
 * parce que c'est ce que font les gens — et il remplit les six cases d'un
 * coup, quel que soit celle où on l'a collé.
 *
 * Écrit ici une seule fois : l'inscription et le mot de passe oublié
 * demandent le même geste, ils partagent donc le même champ.
 */
const LONGUEUR = 6;

export function SaisieCode({
  valeur,
  onChange,
  onComplet,
  desactive = false,
  idPrefixe = "code",
  etiquette = "Code à six chiffres",
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  /** Appelé dès que les six chiffres sont posés — évite un clic inutile. */
  onComplet?: (valeur: string) => void;
  desactive?: boolean;
  idPrefixe?: string;
  etiquette?: string;
}) {
  const cases = React.useRef<(HTMLInputElement | null)[]>([]);
  const chiffres = React.useMemo(
    () => Array.from({ length: LONGUEUR }, (_, i) => valeur[i] ?? ""),
    [valeur],
  );

  React.useEffect(() => {
    cases.current[0]?.focus();
  }, []);

  const poser = (index: number, saisie: string) => {
    const propre = saisie.replace(/\D/g, "");

    if (!propre) {
      const suivants = [...chiffres];
      suivants[index] = "";
      onChange(suivants.join("").trimEnd());
      return;
    }

    // Collage d'un code entier depuis le presse-papiers.
    if (propre.length > 1) {
      const complet = propre.slice(0, LONGUEUR);
      onChange(complet);
      cases.current[Math.min(complet.length, LONGUEUR - 1)]?.focus();
      if (complet.length === LONGUEUR) onComplet?.(complet);
      return;
    }

    const suivants = [...chiffres];
    suivants[index] = propre;
    const assemble = suivants.join("");
    onChange(assemble);
    if (index < LONGUEUR - 1) cases.current[index + 1]?.focus();
    if (assemble.length === LONGUEUR && !suivants.includes("")) onComplet?.(assemble);
  };

  return (
    <div className="flex justify-center gap-1.5" role="group" aria-label={etiquette}>
      {chiffres.map((chiffre, index) => (
        <React.Fragment key={index}>
          <label htmlFor={idPrefixe + "-" + index} className="sr-only">
            Chiffre {index + 1} sur {LONGUEUR}
          </label>
          <input
            id={idPrefixe + "-" + index}
            ref={(element) => {
              cases.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={LONGUEUR}
            disabled={desactive}
            value={chiffre}
            onChange={(e) => poser(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !chiffre && index > 0) cases.current[index - 1]?.focus();
            }}
            className="nombres size-11 rounded-md border border-input bg-card text-center text-[1.25rem] font-bold disabled:opacity-60"
          />
        </React.Fragment>
      ))}
    </div>
  );
}

export const LONGUEUR_CODE = LONGUEUR;
