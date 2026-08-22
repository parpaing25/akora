import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * État vide (§5) : cadre pointillé, titre 15/600, UNE phrase, UNE action concrète.
 * L'action doit être formulée en actes (« Élargir à 40 km »), pas en concept.
 */
export function EtatVide({
  titre,
  phrase,
  action,
  className,
}: {
  titre: string;
  phrase: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-dashed border-border bg-card/60 px-4 py-8 text-center", className)}>
      <p className="text-[0.9375rem] font-semibold text-foreground">{titre}</p>
      <p className="mx-auto mt-1 max-w-prose text-legende text-muted-foreground">{phrase}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Avertissement métier (§5) : hors zone, fournisseur non vérifié, estimation
 * impossible. Bloc `accent` très clair, filet gauche `accent`, titre +
 * explication. Pas d'icône d'alerte criarde.
 */
export function AvertissementMetier({
  titre,
  children,
  action,
  className,
}: {
  titre: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border-l-4 border-l-accent bg-accent-soft px-3 py-2.5", className)}>
      <p className="text-[0.9375rem] font-semibold text-accent-strong">{titre}</p>
      <div className="mt-0.5 text-legende text-accent-strong/90">{children}</div>
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}

/** Erreur de chargement : on dit ce qui a échoué et on propose de réessayer. */
export function EtatErreur({ message, onReessayer }: { message?: string; onReessayer?: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2.5">
      <p className="text-[0.9375rem] font-semibold text-destructive-strong">Chargement impossible</p>
      <p className="mt-0.5 text-legende text-destructive-strong/90">
        {message ?? "La connexion au serveur a échoué. Vérifiez votre réseau."}
      </p>
      {onReessayer && (
        <button
          type="button"
          onClick={onReessayer}
          className="mt-2 min-h-11 text-legende font-semibold text-destructive-strong underline underline-offset-4"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
