import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listerMesCommandes } from "@/lib/donnees/commandes";
import { LIBELLE_COMMANDE } from "@/lib/types-metier";
import { formaterAriary, formaterDate } from "@/lib/format";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";

const TONS: Record<string, "succes" | "info" | "attention" | "danger" | "neutre"> = {
  cloturee: "succes",
  livree: "succes",
  payee: "succes",
  litige: "danger",
  annulee: "danger",
  refusee: "danger",
  en_attente_paiement: "attention",
};

export default function MesCommandes() {
  const { utilisateur } = useAuth();
  const commandes = useQuery({
    queryKey: ["mes-commandes", utilisateur?.id],
    queryFn: () => listerMesCommandes(utilisateur?.id as string),
    enabled: Boolean(utilisateur?.id),
    staleTime: 30_000,
  });

  return (
    <>
      <Seo titre="Mes commandes" chemin="/compte/commandes" indexable={false} />
      <h2 className="text-section">Mes commandes</h2>

      {commandes.isPending ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Squelette key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : commandes.isError ? (
        <div className="mt-4">
          <EtatErreur onReessayer={() => void commandes.refetch()} />
        </div>
      ) : (commandes.data ?? []).length === 0 ? (
        <div className="mt-4">
          <EtatVide
            titre="Aucune commande"
            phrase="Vos commandes s'afficheront ici, avec leur suivi et leur reçu imprimable."
            action={
              <Bouton asChild>
                <Link to="/materiaux">Voir les matériaux</Link>
              </Bouton>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {(commandes.data ?? []).map((c) => (
            <li key={c.id}>
              <Carte className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="nombres font-mono font-semibold">
                    <Link to={"/commande/" + c.numero} className="hover:underline">
                      {c.numero}
                    </Link>
                  </p>
                  <p className="text-[0.78rem] text-muted-foreground">
                    {formaterDate(c.created_at)}
                    {c.adresse_libre ? " · " + c.adresse_libre : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Pastille ton={TONS[c.statut] ?? "neutre"}>{LIBELLE_COMMANDE[c.statut]}</Pastille>
                  <span className="nombres font-bold text-primary">
                    {formaterAriary(Number(c.montant_total))}
                  </span>
                  <Bouton asChild variante="tertiaire" taille="compact">
                    <Link to={"/commande/" + c.numero}>Suivre</Link>
                  </Bouton>
                </div>
              </Carte>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
