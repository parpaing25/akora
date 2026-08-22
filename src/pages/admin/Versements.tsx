import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listerRetraitsATraiter } from "@/lib/donnees/admin";
import { formaterAriary, formaterDateHeure, NOM_OPERATEUR } from "@/lib/format";
import { Carte } from "@/components/ui/card";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

/**
 * Versements à exécuter.
 *
 * Le geste est manuel : on envoie l'argent depuis le compte marchand, puis on
 * saisit la référence. Elle est obligatoire — sans elle, rien n'est prouvable
 * si le fournisseur conteste. L'écriture de ledger est faite par la fonction,
 * jamais par cet écran.
 */
export default function Versements() {
  const client = useQueryClient();
  const [saisies, setSaisies] = React.useState<Record<string, string>>({});

  const retraits = useQuery({
    queryKey: ["retraits-a-traiter"],
    queryFn: listerRetraitsATraiter,
    staleTime: 20_000,
  });

  const executer = async (id: string) => {
    const { error } = await supabase.rpc("executer_retrait", {
      _retrait_id: id,
      _reference: (saisies[id] ?? "").trim(),
    });
    if (error) {
      toast.error("Versement refusé", { description: error.message });
      return;
    }
    await client.invalidateQueries({ queryKey: ["retraits-a-traiter"] });
    toast.success("Versement enregistré");
  };

  const refuser = async (id: string) => {
    const { error } = await supabase.rpc("refuser_retrait", {
      _retrait_id: id,
      _motif: (saisies[id] ?? "").trim(),
    });
    if (error) {
      toast.error("Refus impossible", { description: error.message });
      return;
    }
    await client.invalidateQueries({ queryKey: ["retraits-a-traiter"] });
    toast.success("Versement refusé");
  };

  if (retraits.isPending) return <Squelette className="h-48 w-full" />;
  if ((retraits.data ?? []).length === 0) {
    return <EtatVide titre="Aucun versement en attente" phrase="Les demandes des fournisseurs arrivent ici." />;
  }

  return (
    <div className="space-y-3">
      {(retraits.data ?? []).map((r) => (
        <Carte key={r.id as string} className="p-4">
          <div>
            <p className="nombres text-[1.125rem] font-bold text-primary">
              {formaterAriary(Number(r.montant))}
            </p>
            <p className="text-legende text-muted-foreground">
              {NOM_OPERATEUR[r.operateur as never]} · <span className="nombres">{String(r.msisdn)}</span>
            </p>
            <p className="text-[0.78rem] text-muted-foreground">
              Demandé le {formaterDateHeure(r.demande_le as string)}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1">
              <label htmlFor={"ref-" + r.id} className="text-[0.78rem] text-muted-foreground">
                Référence du versement (ou motif de refus)
              </label>
              <Saisie
                id={"ref-" + r.id}
                className="mt-1 font-mono"
                value={saisies[r.id as string] ?? ""}
                onChange={(e) => setSaisies({ ...saisies, [r.id as string]: e.target.value })}
              />
            </div>
            <Bouton
              disabled={(saisies[r.id as string] ?? "").trim().length < 4}
              onClick={() => void executer(r.id as string)}
            >
              Marquer comme versé
            </Bouton>
            <Bouton
              variante="fantome"
              className="text-destructive-strong"
              disabled={(saisies[r.id as string] ?? "").trim().length < 5}
              onClick={() => void refuser(r.id as string)}
            >
              Refuser
            </Bouton>
          </div>
        </Carte>
      ))}
    </div>
  );
}
