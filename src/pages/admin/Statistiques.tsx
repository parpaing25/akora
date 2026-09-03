import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur } from "@/components/ui/etats";
import { formaterAriary, formaterNombre } from "@/lib/format";
import { seriesAdmin } from "@/lib/donnees/pilotage";
import { Barres } from "./TableauDeBord";
import { cn } from "@/lib/utils";

const FENETRES = [
  { jours: 7, libelle: "7 jours" },
  { jours: 30, libelle: "30 jours" },
  { jours: 90, libelle: "90 jours" },
] as const;

/**
 * Les séries — l'onglet « Visites » de la console Fonenako, sans recharts.
 * Quatre courbes en barres, une fenêtre au choix, les totaux en tête.
 */
export default function Statistiques() {
  const [jours, setJours] = React.useState<7 | 30 | 90>(30);
  const series = useQuery({
    queryKey: ["admin", "series", jours],
    queryFn: () => seriesAdmin(jours),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-4">
      <Seo titre="Statistiques" chemin="/admin/statistiques" indexable={false} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-section">Statistiques</h2>
        <div className="flex gap-2" role="group" aria-label="Fenêtre">
          {FENETRES.map((f) => (
            <button
              key={f.jours}
              type="button"
              aria-pressed={jours === f.jours}
              onClick={() => setJours(f.jours)}
              className={cn(
                "min-h-9 rounded-full px-3.5 text-legende",
                jours === f.jours ? "bg-foreground font-semibold text-background" : "border border-border bg-card",
              )}
            >
              {f.libelle}
            </button>
          ))}
        </div>
      </div>

      {series.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Squelette key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : series.isError ? (
        <EtatErreur onReessayer={() => void series.refetch()} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Total libelle="Inscriptions" valeur={formaterNombre(series.data.reduce((s, p) => s + p.inscriptions, 0))} />
            <Total libelle="Commandes" valeur={formaterNombre(series.data.reduce((s, p) => s + p.commandes, 0))} />
            <Total libelle="Volume payé" valeur={formaterAriary(series.data.reduce((s, p) => s + p.volume, 0))} />
            <Total libelle="Vues de produits" valeur={formaterNombre(series.data.reduce((s, p) => s + p.vues, 0))} />
          </dl>
          <div className="grid gap-3 sm:grid-cols-2">
            <Barres points={series.data} cle="inscriptions" libelle="Inscriptions" />
            <Barres points={series.data} cle="commandes" libelle="Commandes" />
            <Barres points={series.data} cle="volume" libelle="Volume payé" format={formaterAriary} />
            <Barres points={series.data} cle="vues" libelle="Vues de produits" />
          </div>
        </>
      )}
    </div>
  );
}

function Total({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="carte p-3.5">
      <dt className="text-legende text-muted-foreground">{libelle}</dt>
      <dd className="nombres mt-1 text-[1.5rem] font-bold leading-tight">{valeur}</dd>
    </div>
  );
}
