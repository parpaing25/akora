import * as React from "react";
import { Etiquette } from "./label";
import { cn } from "@/lib/utils";

/**
 * Enveloppe étiquette + champ + aide + erreur.
 *
 * C'est le SEUL moyen de saisir dans Akora : l'objectif « zéro champ sans
 * <label> associé » (A5) n'est pas une consigne de relecture, il est garanti
 * par la structure — l'`id` est généré et câblé ici, avec `aria-describedby`
 * et `aria-invalid`.
 */
export interface ProprietesChamp {
  etiquette: string;
  aide?: string;
  erreur?: string;
  obligatoire?: boolean;
  className?: string;
  /** Reçoit les attributs à poser sur le contrôle (id, aria-*). */
  children: (attributs: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean;
    required: boolean;
  }) => React.ReactNode;
}

export function Champ({ etiquette, aide, erreur, obligatoire = false, className, children }: ProprietesChamp) {
  const id = React.useId();
  const idAide = aide ? `${id}-aide` : undefined;
  const idErreur = erreur ? `${id}-erreur` : undefined;
  const decrit = [idErreur, idAide].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Etiquette htmlFor={id}>
        {etiquette}
        {obligatoire && (
          <span className="text-destructive" aria-hidden="true">
            {" *"}
          </span>
        )}
      </Etiquette>
      {children({ id, "aria-describedby": decrit, "aria-invalid": Boolean(erreur), required: obligatoire })}
      {erreur && (
        <p id={idErreur} role="alert" className="text-[0.78rem] text-destructive-strong">
          {erreur}
        </p>
      )}
      {aide && !erreur && (
        <p id={idAide} className="text-[0.78rem] text-muted-foreground">
          {aide}
        </p>
      )}
    </div>
  );
}
