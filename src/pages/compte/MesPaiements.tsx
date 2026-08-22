import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LIBELLE_PAIEMENT } from "@/lib/types-metier";
import { formaterAriary, formaterDateHeure, NOM_OPERATEUR } from "@/lib/format";
import { Seo } from "@/components/Seo";
import { Pastille } from "@/components/ui/badge";
import { Tableau, TableauCorps, TableauTete } from "@/components/ui/table";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

/**
 * Mes paiements. Lecture seule, comme partout : un acheteur ne modifie jamais
 * un statut de paiement, même le sien.
 */
export default function MesPaiements() {
  const { utilisateur } = useAuth();

  const paiements = useQuery({
    queryKey: ["mes-paiements", utilisateur?.id],
    enabled: Boolean(utilisateur?.id),
    staleTime: 30_000,
    queryFn: async () => {
      const { data: commandes } = await supabase
        .from("commandes")
        .select("id, numero")
        .eq("acheteur_id", utilisateur?.id as string);
      const ids = (commandes ?? []).map((c) => c.id as string);
      if (ids.length === 0) return [];
      const numeros = new Map((commandes ?? []).map((c) => [c.id as string, c.numero as string]));
      const { data, error } = await supabase
        .from("paiements")
        .select("id, commande_id, operateur, mode, montant, statut, reference_saisie, initie_le")
        .in("commande_id", ids)
        .order("initie_le", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, numero: numeros.get(p.commande_id as string) ?? "" }));
    },
  });

  return (
    <>
      <Seo titre="Mes paiements" chemin="/compte/paiements" indexable={false} />
      <h2 className="text-section">Mes paiements</h2>

      {paiements.isPending ? (
        <Squelette className="mt-4 h-32 w-full" />
      ) : (paiements.data ?? []).length === 0 ? (
        <div className="mt-4">
          <EtatVide
            titre="Aucun paiement"
            phrase="Les paiements mobile money apparaîtront ici, avec leur statut de séquestre."
          />
        </div>
      ) : (
        <Tableau conteneurClassName="mt-4">
          <TableauTete>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Commande</th>
              <th scope="col">Opérateur</th>
              <th scope="col">Montant</th>
              <th scope="col">Statut</th>
            </tr>
          </TableauTete>
          <TableauCorps>
            {(paiements.data ?? []).map((p) => (
              <tr key={p.id as string}>
                <td data-nombre="">{formaterDateHeure(p.initie_le as string)}</td>
                <td>
                  <Link to={"/commande/" + p.numero} className="nombres font-mono lien-souligne">
                    {p.numero}
                  </Link>
                </td>
                <td>{NOM_OPERATEUR[p.operateur as never]}</td>
                <td data-nombre="">{formaterAriary(Number(p.montant))}</td>
                <td>
                  <Pastille
                    ton={
                      p.statut === "libere" || p.statut === "sequestre"
                        ? "succes"
                        : p.statut === "rejete" || p.statut === "echoue" || p.statut === "expire"
                          ? "danger"
                          : "info"
                    }
                  >
                    {LIBELLE_PAIEMENT[p.statut as never]}
                  </Pastille>
                </td>
              </tr>
            ))}
          </TableauCorps>
        </Tableau>
      )}

      <p className="mt-3 text-[0.78rem] text-muted-foreground">
        « Sous séquestre » veut dire que la somme est retenue par Akora et n'a pas encore été versée
        au fournisseur. Elle ne l'est qu'après votre confirmation de livraison, ou 72 heures après
        celle-ci sans contestation de votre part.
      </p>
    </>
  );
}
