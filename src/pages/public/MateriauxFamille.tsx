import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Seo, filAriane } from "@/components/Seo";
import { lireFamille } from "@/lib/donnees/categories";
import { chercherMateriaux } from "@/lib/donnees/materiaux";
import { LIBELLE_UNITE } from "@/lib/types-metier";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import NonTrouve from "@/pages/NonTrouve";

/**
 * Les matériaux d'une famille. Chaque ligne mène au COMPARATEUR, pas à un
 * produit : c'est la référence commune qui met les fournisseurs face à face.
 */
export default function MateriauxFamille() {
  const { categorie } = useParams<{ categorie: string }>();

  const famille = useQuery({
    queryKey: ["famille", categorie],
    queryFn: () => lireFamille(categorie as string),
    enabled: Boolean(categorie),
    staleTime: 30 * 60_000,
  });

  const materiaux = useQuery({
    queryKey: ["materiaux-famille", famille.data?.id],
    queryFn: () => chercherMateriaux("", famille.data?.id ?? null, 200),
    enabled: Boolean(famille.data?.id),
    staleTime: 10 * 60_000,
  });

  if (famille.isSuccess && !famille.data) return <NonTrouve />;

  return (
    <div className="container py-6">
      {famille.data ? (
        <Seo
          titre={famille.data.nom}
          chemin={`/materiaux/${famille.data.slug}`}
          description={`Comparez les fournisseurs de ${famille.data.nom.toLowerCase()} au prix rendu chantier, livraison comprise.`}
          donneesStructurees={filAriane([
            { nom: "Accueil", chemin: "/" },
            { nom: "Matériaux", chemin: "/materiaux" },
            { nom: famille.data.nom, chemin: `/materiaux/${famille.data.slug}` },
          ])}
        />
      ) : null}

      <nav aria-label="Fil d'Ariane" className="text-legende text-muted-foreground">
        <Link to="/materiaux" className="hover:underline">
          Matériaux
        </Link>
        <ChevronRight className="mx-1 inline size-3.5" aria-hidden="true" />
        <span className="text-foreground">{famille.data?.nom ?? "…"}</span>
      </nav>

      <h1 className="mt-1 text-page">{famille.data?.nom ?? <Squelette className="h-8 w-64" />}</h1>

      <div className="mt-4">
        <SelecteurPoint />
      </div>

      {materiaux.isPending || famille.isPending ? (
        <div className="mt-5 space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Squelette key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : materiaux.isError ? (
        <div className="mt-5">
          <EtatErreur onReessayer={() => void materiaux.refetch()} />
        </div>
      ) : materiaux.data.length === 0 ? (
        <div className="mt-5">
          <EtatVide
            titre="Aucun matériau dans cette famille"
            phrase="Le catalogue commun est en cours de constitution."
          />
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-border rounded-lg border border-border bg-card">
          {materiaux.data.map((materiau) => (
            <li key={materiau.id}>
              <Link
                to={`/materiaux/${categorie}/${materiau.slug}`}
                className="flex min-h-14 items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block text-[0.9375rem] font-semibold">{materiau.nom}</span>
                  <span className="nombres block text-[0.78rem] text-muted-foreground">
                    au {LIBELLE_UNITE[materiau.unite_defaut]} · {materiau.poids_kg_unite_defaut} kg ·{" "}
                    {materiau.volume_m3_unite_defaut} m³
                  </span>
                </span>
                <span className="shrink-0 text-legende font-semibold text-primary">Comparer</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
