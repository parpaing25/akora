import * as React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Seo, filAriane } from "@/components/Seo";
import { lireFournisseur, listerProduits, PAR_PAGE } from "@/lib/donnees/vitrine";
import { usePanier } from "@/lib/panier";
import { usePointLivraison } from "@/lib/point-livraison";
import { versCarte, versLignePanier } from "@/lib/adaptateurs";
import { haversine } from "@/lib/livraison";
import { formaterNote } from "@/lib/format";
import { ENV } from "@/lib/env";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { BoutonSuivre } from "@/components/fil/BoutonSuivre";
import { RevelerContact } from "@/components/marque/RevelerContact";
import { CarteProduit } from "@/components/produit/CarteProduit";
import { CartePoint } from "@/components/carte/CartePoint";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { GrilleSquelettes, Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import NonTrouve from "@/pages/NonTrouve";

/** Vitrine publique d'un fournisseur. Aucun telephone dans le HTML servi. */
export default function FournisseurFiche() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = React.useState(0);
  const ajouter = usePanier((e) => e.ajouter);
  const { point } = usePointLivraison();

  const fournisseur = useQuery({
    queryKey: ["fournisseur", slug],
    queryFn: () => lireFournisseur(slug as string),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });

  const produits = useQuery({
    queryKey: ["produits-fournisseur", fournisseur.data?.id, page],
    queryFn: () => listerProduits({ fournisseurId: fournisseur.data?.id as string, page }),
    enabled: Boolean(fournisseur.data?.id),
    staleTime: 2 * 60_000,
  });

  if (fournisseur.isSuccess && !fournisseur.data) return <NonTrouve />;
  const f = fournisseur.data;

  const lat = f?.lat == null ? null : Number(f.lat);
  const lng = f?.lng == null ? null : Number(f.lng);
  const distance =
    point && lat != null && lng != null
      ? haversine({ lat, lng }, point) * Number(f?.coef_sinuosite ?? 1.3)
      : null;

  const jsonLd = f
    ? [
        filAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Fournisseurs", chemin: "/fournisseurs" },
          { nom: f.raison_sociale as string, chemin: "/fournisseurs/" + f.slug },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "Store",
          name: f.raison_sociale,
          url: new URL("/fournisseurs/" + f.slug, ENV.siteUrl).toString(),
          image: f.logo_url ?? undefined,
          geo: lat == null ? undefined : { "@type": "GeoCoordinates", latitude: lat, longitude: lng },
          aggregateRating:
            f.note_moyenne == null
              ? undefined
              : {
                  "@type": "AggregateRating",
                  ratingValue: Number(f.note_moyenne),
                  reviewCount: Number(f.nb_avis),
                },
        },
      ]
    : undefined;

  return (
    <div className="container py-6">
      {f ? (
        <Seo
          titre={f.raison_sociale as string}
          chemin={"/fournisseurs/" + f.slug}
          description={(f.description as string | null) ?? "Matériaux de construction à Madagascar."}
          image={(f.logo_url as string | null) ?? null}
          donneesStructurees={jsonLd}
        />
      ) : null}

      {fournisseur.isPending ? (
        <div className="space-y-3">
          <Squelette className="h-10 w-2/3" />
          <Squelette className="h-24 w-full" />
        </div>
      ) : !f ? null : (
        <>
          <header className="flex flex-wrap items-start gap-4">
            {f.logo_url ? (
              <img
                src={f.logo_url as string}
                alt=""
                width={72}
                height={72}
                className="shrink-0 rounded-lg border border-border object-cover"
                style={{ width: 72, height: 72 }}
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-page">{f.raison_sociale as string}</h1>
                <BoutonSuivre fournisseurId={f.id as string} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <BadgeVerification
                  niveau={f.niveau_verification as never}
                  verifieLe={f.verifie_le as string | null}
                />
                {f.note_moyenne != null ? (
                  <span className="nombres inline-flex items-center gap-1 text-legende text-muted-foreground">
                    <Star className="size-3.5 text-accent" aria-hidden="true" />
                    {formaterNote(Number(f.note_moyenne))} ({String(f.nb_avis)} avis)
                  </span>
                ) : null}
              </div>
              {f.description ? (
                <p className="mt-2 max-w-prose text-legende text-muted-foreground">
                  {f.description as string}
                </p>
              ) : null}
              <div className="mt-3">
                <RevelerContact fournisseurId={f.id as string} />
              </div>
            </div>
          </header>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <SelecteurPoint />
              <h2 className="mt-4 text-section">Catalogue</h2>

              {produits.isPending ? (
                <div className="mt-3">
                  <GrilleSquelettes nombre={6} />
                </div>
              ) : produits.isError ? (
                <div className="mt-3">
                  <EtatErreur onReessayer={() => void produits.refetch()} />
                </div>
              ) : produits.data.length === 0 ? (
                <div className="mt-3">
                  <EtatVide
                    titre="Aucun produit publié"
                    phrase="Ce dépôt n'a pas encore mis son catalogue en ligne."
                  />
                </div>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {produits.data.map((produit) => (
                      <CarteProduit
                        key={produit.id as string}
                        produit={versCarte(produit, distance)}
                        onAjouter={() => ajouter(versLignePanier(produit))}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Bouton variante="secondaire" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                      Précédent
                    </Bouton>
                    <Bouton
                      variante="secondaire"
                      disabled={produits.data.length < PAR_PAGE}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Suivant
                    </Bouton>
                  </div>
                </>
              )}
            </div>

            <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
              <Carte className="p-3">
                <h2 className="text-produit">Le dépôt</h2>
                {lat != null && lng != null ? (
                  <CartePoint className="mt-2 h-40" intitule="Emplacement du dépôt" point={{ lat, lng }} />
                ) : (
                  <p className="mt-2 text-legende text-muted-foreground">
                    Position non renseignée : les livraisons ne sont pas chiffrables.
                  </p>
                )}
                <dl className="mt-3 space-y-1 text-legende">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Rayon de livraison</dt>
                    <dd className="nombres">{String(f.rayon_max_km)} km</dd>
                  </div>
                  {distance != null ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Depuis votre chantier</dt>
                      <dd className="nombres">{distance.toFixed(1).replace(".", ",")} km</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Facturation</dt>
                    <dd>{f.assujetti_tva ? "HT, TVA en sus" : "TTC, non assujetti"}</dd>
                  </div>
                </dl>
              </Carte>

              {f.nif || f.stat || f.rcs ? (
                <Carte className="p-3">
                  <h2 className="text-produit">Identifiants d'entreprise</h2>
                  <dl className="mt-2 space-y-1 text-legende">
                    {([["NIF", f.nif], ["STAT", f.stat], ["RCS", f.rcs]] as [string, string | null][])
                      .filter(([, v]) => Boolean(v))
                      .map(([libelle, valeur]) => (
                        <div key={libelle} className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">{libelle}</dt>
                          <dd className="font-mono text-[0.8rem]">{valeur}</dd>
                        </div>
                      ))}
                  </dl>
                </Carte>
              ) : null}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
