import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listerLitiges } from "@/lib/donnees/admin";
import { formaterAriary, formaterDateHeure } from "@/lib/format";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie, ZoneTexte } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

/**
 * Arbitrage des litiges.
 *
 * Trancher, c'est décider où va l'argent bloqué : remboursement total,
 * partiel, ou libération au fournisseur. La décision est obligatoire et part
 * aux deux parties — personne ne doit apprendre qu'il a perdu sans savoir
 * pourquoi.
 */
export default function Litiges() {
  const client = useQueryClient();
  const [saisies, setSaisies] = React.useState<Record<string, { decision: string; montant: string }>>({});

  const litiges = useQuery({ queryKey: ["litiges"], queryFn: listerLitiges, staleTime: 30_000 });
  const ouverts = (litiges.data ?? []).filter((l) => l.statut !== "tranche");

  const trancher = async (id: string) => {
    const saisie = saisies[id] ?? { decision: "", montant: "0" };
    if (saisie.decision.trim().length < 10) {
      toast.error("Motivez la décision", { description: "Dix caractères au moins, en français clair." });
      return;
    }
    const { error } = await supabase.rpc("arbitrer_litige", {
      _litige_id: id,
      _decision: saisie.decision.trim(),
      _montant_rembourse: Number.parseInt(saisie.montant, 10) || 0,
    });
    if (error) {
      toast.error("Arbitrage refusé", { description: error.message });
      return;
    }
    await client.invalidateQueries({ queryKey: ["litiges"] });
    toast.success("Litige tranché", { description: "Les deux parties sont prévenues." });
  };

  if (litiges.isPending) return <Squelette className="h-48 w-full" />;
  if (ouverts.length === 0) {
    return <EtatVide titre="Aucun litige ouvert" phrase="Rien à arbitrer pour l'instant." />;
  }

  return (
    <div className="space-y-3">
      {ouverts.map((l) => {
        const saisie = saisies[l.id as string] ?? { decision: "", montant: "0" };
        return (
          <Carte key={l.id as string} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-produit">{String(l.motif)}</h2>
                <p className="text-[0.78rem] text-muted-foreground">
                  Ouvert le {formaterDateHeure(l.created_at as string)}
                </p>
              </div>
              <Pastille ton={l.statut === "ouvert" ? "danger" : "attention"}>
                {l.statut === "ouvert" ? "Ouvert" : "En examen"}
              </Pastille>
            </div>

            {l.description ? <p className="mt-2 text-[0.9375rem]">{String(l.description)}</p> : null}

            {((l.photos ?? []) as string[]).length > 0 ? (
              <ul className="mt-2 flex gap-2 overflow-x-auto">
                {((l.photos ?? []) as string[]).map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt="Pièce jointe au litige"
                        className="size-24 rounded-xs border border-border object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-3 space-y-3">
              <Champ etiquette="Décision" aide="Elle est envoyée à l'acheteur ET au fournisseur." obligatoire>
                {(a) => (
                  <ZoneTexte
                    {...a}
                    rows={3}
                    value={saisie.decision}
                    onChange={(e) =>
                      setSaisies({ ...saisies, [l.id as string]: { ...saisie, decision: e.target.value } })
                    }
                  />
                )}
              </Champ>
              <Champ
                etiquette="Montant remboursé à l'acheteur (Ar)"
                aide="Zéro = le fournisseur est payé normalement."
              >
                {(a) => (
                  <Saisie
                    {...a}
                    className="nombres"
                    inputMode="numeric"
                    value={saisie.montant}
                    onChange={(e) =>
                      setSaisies({ ...saisies, [l.id as string]: { ...saisie, montant: e.target.value } })
                    }
                  />
                )}
              </Champ>
              <Bouton onClick={() => void trancher(l.id as string)}>
                Trancher {Number(saisie.montant) > 0 ? "et rembourser " + formaterAriary(Number(saisie.montant)) : ""}
              </Bouton>
            </div>
          </Carte>
        );
      })}
    </div>
  );
}
