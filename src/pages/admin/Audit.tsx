import { useQuery } from "@tanstack/react-query";
import { controlerLedger, listerJournal } from "@/lib/donnees/admin";
import { formaterAriary, formaterDateHeure } from "@/lib/format";
import { Carte } from "@/components/ui/card";
import { Tableau, TableauCorps, TableauTete } from "@/components/ui/table";
import { Squelette } from "@/components/ui/skeleton";
import { AvertissementMetier, EtatVide } from "@/components/ui/etats";

interface EcartLedger {
  fournisseur_id: string;
  solde_portefeuille: number;
  solde_ledger: number;
  ecart: number;
}

/**
 * Journal d'audit et contrôle du ledger.
 *
 * Le contrôle en tête est celui de la recette F10 : chaque portefeuille dont
 * le solde ne correspond PAS à la somme de ses écritures est listé ici. Un
 * tableau vide est la seule réponse acceptable.
 */
export default function Audit() {
  const controle = useQuery({ queryKey: ["controle-ledger"], queryFn: controlerLedger, staleTime: 60_000 });
  const journal = useQuery({ queryKey: ["journal"], queryFn: () => listerJournal(200), staleTime: 30_000 });

  const anomalies = (controle.data ?? []) as unknown as EcartLedger[];

  return (
    <div className="space-y-5">
      <Carte className="p-4">
        <h2 className="text-produit">Contrôle du ledger</h2>
        <p className="mt-0.5 text-legende text-muted-foreground">
          Le solde de chaque portefeuille doit être exactement la somme de ses écritures.
        </p>
        {controle.isPending ? (
          <Squelette className="mt-3 h-16 w-full" />
        ) : anomalies.length === 0 ? (
          <p className="mt-3 rounded-md bg-success-soft px-3 py-2.5 text-legende font-semibold text-success-strong">
            Aucun écart. Tous les soldes se reconstituent depuis leurs écritures.
          </p>
        ) : (
          <div className="mt-3">
            <AvertissementMetier titre={anomalies.length + " portefeuille(s) en écart"}>
              Un solde qui ne se reconstitue pas est un défaut, pas un arrondi. À traiter avant tout
              versement.
            </AvertissementMetier>
            <Tableau conteneurClassName="mt-2">
              <TableauTete sombre>
                <tr>
                  <th scope="col">Fournisseur</th>
                  <th scope="col">Solde stocké</th>
                  <th scope="col">Somme du ledger</th>
                  <th scope="col">Écart</th>
                </tr>
              </TableauTete>
              <TableauCorps>
                {anomalies.map((a) => (
                  <tr key={a.fournisseur_id}>
                    <td className="font-mono text-[0.78rem]">{a.fournisseur_id}</td>
                    <td data-nombre="">{formaterAriary(Number(a.solde_portefeuille))}</td>
                    <td data-nombre="">{formaterAriary(Number(a.solde_ledger))}</td>
                    <td data-nombre="" className="font-semibold text-destructive-strong">
                      {formaterAriary(Number(a.ecart))}
                    </td>
                  </tr>
                ))}
              </TableauCorps>
            </Tableau>
          </div>
        )}
      </Carte>

      <div>
        <h2 className="text-produit">Journal d'audit</h2>
        {journal.isPending ? (
          <Squelette className="mt-2 h-64 w-full" />
        ) : (journal.data ?? []).length === 0 ? (
          <div className="mt-2">
            <EtatVide titre="Journal vide" phrase="Aucune action sensible n'a encore été enregistrée." />
          </div>
        ) : (
          <Tableau conteneurClassName="mt-2">
            <TableauTete sombre>
              <tr>
                <th scope="col">Quand</th>
                <th scope="col">Action</th>
                <th scope="col">Entité</th>
                <th scope="col">Acteur</th>
              </tr>
            </TableauTete>
            <TableauCorps>
              {(journal.data ?? []).map((l) => (
                <tr key={String(l.id)}>
                  <td data-nombre="">{formaterDateHeure(l.created_at as string)}</td>
                  <td className="font-semibold">{String(l.action)}</td>
                  <td className="font-mono text-[0.78rem]">
                    {String(l.entite)}
                    <span className="block text-muted-foreground">{String(l.entite_id ?? "")}</span>
                  </td>
                  <td className="font-mono text-[0.78rem]">{String(l.acteur_id ?? "système")}</td>
                </tr>
              ))}
            </TableauCorps>
          </Tableau>
        )}
      </div>
    </div>
  );
}
