import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listerPaiementsAVerifier } from "@/lib/donnees/admin";
import { confirmerPaiementManuel } from "@/lib/donnees/commandes";
import { formaterAriary, formaterDateHeure, NOM_OPERATEUR } from "@/lib/format";
import { Carte } from "@/components/ui/card";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

/**
 * Paiements à confirmer à la main.
 *
 * C'est le pendant humain du webhook. Confirmer met la somme SOUS SÉQUESTRE —
 * pas dans la poche du fournisseur. Il faut avoir vérifié la référence sur le
 * relevé de l'opérateur avant de cliquer.
 */
export default function PaiementsAdmin() {
  const client = useQueryClient();
  const [motifs, setMotifs] = React.useState<Record<string, string>>({});

  const paiements = useQuery({
    queryKey: ["paiements-a-verifier"],
    queryFn: listerPaiementsAVerifier,
    staleTime: 20_000,
  });

  const trancher = async (id: string, accepte: boolean) => {
    try {
      await confirmerPaiementManuel(id, accepte, motifs[id]);
      await client.invalidateQueries({ queryKey: ["paiements-a-verifier"] });
      toast.success(accepte ? "Paiement confirmé et mis sous séquestre" : "Paiement rejeté");
    } catch (erreur) {
      toast.error("Action refusée", { description: (erreur as Error).message });
    }
  };

  if (paiements.isPending) return <Squelette className="h-48 w-full" />;
  if ((paiements.data ?? []).length === 0) {
    return (
      <EtatVide
        titre="Aucun paiement à vérifier"
        phrase="Les références saisies par les acheteurs arrivent ici, en attente de contrôle."
      />
    );
  }

  return (
    <div className="space-y-3">
      {(paiements.data ?? []).map((p) => (
        <Carte key={p.id as string} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="nombres text-[1.125rem] font-bold text-primary">
                {formaterAriary(Number(p.montant))}
              </p>
              <p className="text-legende text-muted-foreground">
                {NOM_OPERATEUR[p.operateur as never]} · payé depuis{" "}
                <span className="nombres">{String(p.msisdn ?? "—")}</span>
              </p>
              <p className="text-[0.78rem] text-muted-foreground">
                Initié le {formaterDateHeure(p.initie_le as string)}
              </p>
            </div>
            <p className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-[0.9375rem]">
              {String(p.reference_saisie ?? "—")}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1">
              <label htmlFor={"motif-" + p.id} className="text-[0.78rem] text-muted-foreground">
                Motif, si vous rejetez
              </label>
              <Saisie
                id={"motif-" + p.id}
                className="mt-1"
                value={motifs[p.id as string] ?? ""}
                onChange={(e) => setMotifs({ ...motifs, [p.id as string]: e.target.value })}
              />
            </div>
            <Bouton onClick={() => void trancher(p.id as string, true)}>
              Confirmer et mettre sous séquestre
            </Bouton>
            <Bouton
              variante="fantome"
              className="text-destructive-strong"
              disabled={(motifs[p.id as string] ?? "").trim().length < 5}
              onClick={() => void trancher(p.id as string, false)}
            >
              Rejeter
            </Bouton>
          </div>
        </Carte>
      ))}

      <p className="text-[0.78rem] text-muted-foreground">
        Confirmer ne verse rien au fournisseur : la somme reste sous séquestre jusqu'à la
        confirmation de livraison par l'acheteur, ou 72 heures après la livraison sans contestation.
      </p>
    </div>
  );
}
