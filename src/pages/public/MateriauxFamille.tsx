import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import { Seo, filAriane } from "@/components/Seo";
import { lireFamille } from "@/lib/donnees/categories";
import { listerTypes } from "@/lib/donnees/referentiel";
import { formaterAriary } from "@/lib/format";
import { usePointLivraison } from "@/lib/point-livraison";
import { RechercheMateriaux } from "@/components/materiaux/RechercheMateriaux";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";
import NonTrouve from "@/pages/NonTrouve";

/**
 * Niveau 2 — les TYPES d'une famille.
 *
 * Avant, cette page alignait les 92 references d'un coup : le parpaing creux
 * 15 y voisinait avec le ciment. Elle montre desormais les types — parpaing
 * creux, hourdis, bordure — et c'est le type qui ouvre ses formats. Une page
 * par type vaut aussi mieux en referencement qu'une liste unique.
 */
export default function MateriauxFamille() {
  const { famille: familleSlug } = useParams<{ famille: string }>();
  const { point } = usePointLivraison();

  const famille = useQuery({
    queryKey: ["famille", familleSlug],
    queryFn: () => lireFamille(familleSlug as string),
    enabled: Boolean(familleSlug),
    staleTime: 30 * 60_000,
  });

  const types = useQuery({
    queryKey: ["types", familleSlug],
    queryFn: () => listerTypes(familleSlug as string),
    enabled: Boolean(familleSlug),
    staleTime: 10 * 60_000,
  });

  if (famille.isSuccess && !famille.data) return <NonTrouve />;

  const liste = types.data ?? [];
  const totalFormats = liste.reduce((somme, t) => somme + Number(t.nb_formats), 0);
  const totalOffres = liste.reduce((somme, t) => somme + Number(t.nb_offres), 0);

  return (
    <div className="container py-6">
      {famille.data ? (
        <Seo
          titre={famille.data.nom}
          chemin={`/materiaux/${famille.data.slug}`}
          description={`Comparez les ${famille.data.nom.toLowerCase()} au prix rendu chantier : ${totalFormats} formats, ${totalOffres} offres de fournisseurs vérifiés à Madagascar.`}
          donneesStructurees={filAriane([
            { nom: "Accueil", chemin: "/" },
            { nom: "Matériaux", chemin: "/materiaux" },
            { nom: famille.data.nom, chemin: `/materiaux/${famille.data.slug}` },
          ])}
        />
      ) : null}

      <nav
        aria-label="Fil d'Ariane"
        className="mb-2 flex flex-wrap items-center gap-2 text-legende text-muted-foreground"
      >
        <Link to="/materiaux" className="lien-souligne">
          Matériaux
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-foreground">{famille.data?.nom ?? "…"}</span>
      </nav>

      <h1 className="text-page">{famille.data?.nom ?? " "}</h1>
      <p className="mt-1 text-legende text-muted-foreground">
        {types.isSuccess ? (
          <>
            <span className="nombres">{liste.length}</span> types ·{" "}
            <span className="nombres">{totalFormats}</span> formats ·{" "}
            <span className="nombres">{totalOffres}</span> offres de fournisseurs
            {point ? (
              <>
                {" · "}
                <span className="font-semibold text-primary">prix rendu à {point.libelle}</span>
              </>
            ) : null}
          </>
        ) : (
          " "
        )}
      </p>

      <div className="mt-4 max-w-xl">
        <RechercheMateriaux
          portee={familleSlug}
          etiquette={`Chercher dans les ${famille.data?.nom.toLowerCase() ?? "matériaux"}`}
          placeholder="Hourdis, parpaing 15, bordure…"
        />
      </div>

      {types.isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Squelette key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      {types.isError ? (
        <div className="mt-6">
          <EtatErreur
            message="Les types n'ont pas pu être chargés."
            onReessayer={() => void types.refetch()}
          />
        </div>
      ) : null}

      {types.isSuccess && liste.length === 0 ? (
        <div className="mt-6">
          <EtatVide
            titre="Aucun type dans cette famille"
            phrase="Le référentiel est encore en cours de constitution pour cette famille."
          />
        </div>
      ) : null}

      <div className="entree mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {liste.map((type) => (
          <Link
            key={type.id}
            to={`/materiaux/${type.famille_slug}/${type.slug}`}
            className="carte carte-cliquable flex flex-col gap-3 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-produit text-foreground">{type.nom}</p>
                {type.nom_mg ? <p className="text-legende text-muted-foreground">{type.nom_mg}</p> : null}
              </div>
              <ArrowRight size={18} className="fleche mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>

            <p className="text-courant">
              {type.prix_des != null ? (
                <>
                  <span className="nombres text-[1.125rem] font-bold">{formaterAriary(type.prix_des)}</span>
                  <span className="text-legende text-muted-foreground"> dès · {type.unite}</span>
                </>
              ) : (
                <span className="text-legende text-muted-foreground">Aucune offre pour l'instant</span>
              )}
            </p>

            {type.formats_apercu.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {type.formats_apercu.slice(0, 4).map((format) => (
                  <li
                    key={format.slug}
                    className="puce nombres rounded-full border border-border px-2 py-0.5 text-[0.75rem] text-muted-foreground"
                  >
                    {format.libelle_court}
                  </li>
                ))}
                {Number(type.nb_formats) > 4 ? (
                  <li className="nombres rounded-full px-2 py-0.5 text-[0.75rem] text-muted-foreground">
                    +{Number(type.nb_formats) - 4}
                  </li>
                ) : null}
              </ul>
            ) : null}

            <p className="mt-auto border-t border-border pt-2.5 text-legende text-muted-foreground">
              <span className="nombres">{type.nb_formats}</span> format
              {Number(type.nb_formats) > 1 ? "s" : ""} ·{" "}
              <span className="nombres">{type.nb_offres}</span> offre
              {Number(type.nb_offres) > 1 ? "s" : ""} ·{" "}
              <span className="nombres">{type.nb_fournisseurs}</span> fournisseur
              {Number(type.nb_fournisseurs) > 1 ? "s" : ""}
            </p>
          </Link>
        ))}
      </div>

      <div className="carte mt-6 flex flex-wrap items-center justify-between gap-3 border-dashed p-4">
        <p className="max-w-xl text-legende text-muted-foreground">
          Un type manque, ou un format que vous vendez n'existe pas dans le référentiel ? Les
          fournisseurs demandent l'ajout, un administrateur crée la référence — c'est ce qui garde
          les offres comparables.
        </p>
        <Link
          to="/pro/catalogue"
          className="cible-44 flex shrink-0 items-center gap-2 rounded-md border border-foreground px-4 text-courant font-semibold"
        >
          <Plus size={16} aria-hidden="true" /> Demander un ajout
        </Link>
      </div>
    </div>
  );
}
