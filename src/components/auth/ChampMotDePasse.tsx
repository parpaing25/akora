import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Champ } from "@/components/ui/champ";
import { forceMotDePasse, LIBELLES_FORCE } from "@/lib/mot-de-passe";

/**
 * Mot de passe, avec bouton « afficher » et jauge de force.
 *
 * Il remplace le couple « mot de passe » + « confirmer le mot de passe » :
 * retaper à l'aveugle ce qu'on vient de taper à l'aveugle ne vérifie rien, cela
 * recopie la même faute de frappe. Voir ce qu'on écrit, si.
 *
 * L'étiquette, l'`id`, `aria-describedby` et `aria-invalid` restent produits
 * par `Champ` : la garantie « aucun champ sans étiquette » tient par la
 * structure, pas par la relecture.
 */
export function ChampMotDePasse({
  etiquette = "Mot de passe",
  aide = "8 caractères minimum, dont une lettre et un chiffre.",
  erreur,
  valeur,
  enregistrement,
  autoComplete = "new-password",
  avecJauge = true,
}: {
  etiquette?: string;
  aide?: string;
  erreur?: string;
  valeur: string;
  enregistrement: UseFormRegisterReturn;
  autoComplete?: string;
  avecJauge?: boolean;
}) {
  const [visible, setVisible] = React.useState(false);
  const force = forceMotDePasse(valeur);

  return (
    <Champ etiquette={etiquette} aide={aide} erreur={erreur} obligatoire>
      {(attributs) => (
        <>
          <div className="flex min-h-11 items-center rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
            <input
              {...attributs}
              {...enregistrement}
              type={visible ? "text" : "password"}
              autoComplete={autoComplete}
              className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-courant outline-none"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="flex min-h-11 min-w-11 items-center justify-center px-3 text-muted-foreground"
            >
              {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>

          {avecJauge ? (
            <div aria-live="polite" className="flex items-center gap-2.5 pt-0.5">
              <span className="flex flex-1 gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={
                      "h-1 flex-1 rounded-full " +
                      (index < force ? (force >= 3 ? "bg-success" : "bg-accent") : "bg-border")
                    }
                  />
                ))}
              </span>
              <span
                className={
                  "text-legende font-semibold " +
                  (force >= 3 ? "text-success-strong" : "text-muted-foreground")
                }
              >
                {force > 0 ? LIBELLES_FORCE[force] : ""}
              </span>
            </div>
          ) : null}
        </>
      )}
    </Champ>
  );
}
