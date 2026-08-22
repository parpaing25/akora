import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo, filAriane } from "@/components/Seo";
import { listerFamilles } from "@/lib/donnees/categories";
import { iconeFamille } from "@/lib/icones-familles";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur } from "@/components/ui/etats";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { ENV } from "@/lib/env";

/** Les 8 familles de gros œuvre. Lues en base, jamais écrites en dur ici. */
export default function Materiaux() {
  const familles = useQuery({ queryKey: ["familles"], queryFn: listerFamilles, staleTime: 30 * 60_000 });

  return (
    <div className="container py-6">
      <Seo
        titre="Matériaux de construction"
        chemin="/materiaux"
        description="Parpaings, briques, granulats, ciment, bois, tôles, fers à béton, béton prêt à l'emploi. Comparez au prix rendu chantier."
        donneesStructurees={[
          filAriane([
            { nom: "Accueil", chemin: "/" },
            { nom: "Matériaux", chemin: "/materiaux" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Familles de matériaux de gros œuvre",
            itemListElement: (familles.data ?? []).map((f, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: f.nom,
              url: new URL(`/materiaux/${f.slug}`, ENV.siteUrl).toString(),
            })),
          },
        ]}
      />

      <h1 className="text-page">Matériaux</h1>
      <p className="mt-1 max-w-prose text-legende text-muted-foreground">
        Akora ne référence que le gros œuvre : ce qui fait tenir un bâtiment. Ni quincaillerie, ni
        plomberie, ni finitions.
      </p>

      <div className="mt-4">
        <SelecteurPoint />
      </div>

      {familles.isPending ? (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Squelette key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : familles.isError ? (
        <div className="mt-5">
          <EtatErreur onReessayer={() => void familles.refetch()} />
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {familles.data.map((famille) => {
            const Icone = iconeFamille(famille.icone);
            return (
              <li key={famille.id}>
                <Link
                  to={`/materiaux/${famille.slug}`}
                  className="carte filet-primaire flex h-full min-h-28 flex-col justify-between p-3 hover:bg-muted/40"
                >
                  <Icone className="size-5 text-primary" aria-hidden="true" />
                  <span>
                    <span className="block text-produit leading-snug">{famille.nom}</span>
                    {famille.nom_mg ? (
                      <span className="block text-[0.78rem] text-muted-foreground">{famille.nom_mg}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
