import * as React from "react";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo, filAriane } from "@/components/Seo";
import { lireFournisseur, listerProduits, PAR_PAGE } from "@/lib/donnees/vitrine";
import { usePanier } from "@/lib/panier";
import { usePointLivraison } from "@/lib/point-livraison";
import { versCarte, versLignePanier } from "@/lib/adaptateurs";
import { haversine } from "@/lib/livraison";
import { ENV } from "@/lib/env";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { initiales } from "@/lib/donnees/annuaire";
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
/** « mars 2026 » — l'anciennete d'un depot se lit au mois, pas au jour. */
function moisAnnee(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

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

  // Distance a vol d'oiseau majoree du coefficient du depot : la meme regle
  // que partout ailleurs (B6), et le meme calcul pur.
  const distanceKm = React.useMemo(() => {
    const f = fournisseur.data as { lat?: number | null; lng?: number | null; coef_sinuosite?: number | null } | null;
    if (!point || !f?.lat || !f?.lng) return null;
    return haversine({ lat: Number(f.lat), lng: Number(f.lng) }, { lat: point.lat, lng: point.lng })
      * Number(f.coef_sinuosite ?? 1.3);
  }, [fournisseur.data, point]);

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
          {/*
            Photo de couverture, avatar debordant, badge en surimpression :
            c'est la premiere chose que voit un acheteur, et elle doit dire en
            un regard qui est ce depot, ou il est, et a quelle distance de SON
            chantier. Un nom seul ne dit rien.
          */}
          <header className="carte overflow-hidden p-0">
            <div className="relative aspect-[4/1] min-h-[8rem] w-full bg-muted">
              {f.couverture_url || f.photo_depot ? (
                <img
                  src={(f.couverture_url as string | null) ?? (f.photo_depot as string)}
                  alt=""
                  width={1200}
                  height={300}
                  className="size-full object-cover"
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4 px-4 pb-4">
              <div className="flex min-w-0 items-end gap-3">
                <span
                  aria-hidden="true"
                  className="nombres -mt-8 flex size-16 shrink-0 items-center justify-center rounded-lg border-4 border-card bg-primary text-[1.25rem] font-bold text-primary-foreground"
                >
                  {f.logo_url ? (
                    <img
                      src={f.logo_url as string}
                      alt=""
                      width={64}
                      height={64}
                      className="size-full rounded-md object-cover"
                    />
                  ) : (
                    initiales(f.raison_sociale as string)
                  )}
                </span>
                <div className="min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-page">{f.raison_sociale as string}</h1>
                    <BadgeVerification
                      niveau={f.niveau_verification as never}
                      verifieLe={f.verifie_le as string | null}
                    />
                  </div>
                  <p className="mt-0.5 text-legende text-muted-foreground">
                    {[f.metier as string | null, f.localite_nom as string | null]
                      .filter(Boolean)
                      .join(" · ")}
                    {distanceKm != null ? (
                      <>
                        {" · "}
                        <span className="nombres">
                          {distanceKm.toFixed(1).replace(".", ",")} km de votre chantier
                        </span>
                      </>
                    ) : null}
                    {f.created_at ? (
                      <> · membre depuis {moisAnnee(f.created_at as string)}</>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1">
                <BoutonSuivre fournisseurId={f.id as string} />
                <RevelerContact fournisseurId={f.id as string} />
              </div>
            </div>

            {f.description ? (
              <p className="border-t border-border px-4 py-3 text-courant text-muted-foreground">
                {f.description as string}
              </p>
            ) : null}

            <ul className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              {f.horaires ? (
                <li className="rounded-full border border-border px-3 py-1 text-legende text-muted-foreground">
                  {String(f.horaires)}
                </li>
              ) : null}
              {f.retrait_sur_place ? (
                <li className="rounded-full border border-border px-3 py-1 text-legende text-muted-foreground">
                  Retrait sur place possible
                </li>
              ) : null}
              {((f.vehicules as string[] | null) ?? []).map((vehicule) => (
                <li
                  key={vehicule}
                  className="rounded-full border border-border px-3 py-1 text-legende text-muted-foreground"
                >
                  {vehicule}
                </li>
              ))}
            </ul>
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
              {/*
                Le statut de verification en tete de colonne, et ce qu'il
                IMPLIQUE — pas seulement une pastille. Un acheteur qui decouvre
                au moment de payer que le sequestre n'existe pas pour ce depot
                a une mauvaise surprise ; ici, il le sait avant de remplir son
                panier.
              */}
              {f.niveau_verification === "verifie" || f.niveau_verification === "partenaire" ? (
                <div className="rounded-lg border border-secondary/30 bg-secondary-soft p-4">
                  <p className="text-produit">Dépôt vérifié</p>
                  <p className="mt-1 text-legende leading-relaxed text-muted-foreground">
                    Carte fiscale, carte statistique, registre du commerce, pièce du gérant et photo
                    du dépôt ont été examinés. Le paiement en ligne et le séquestre sont ouverts.
                  </p>
                  <Link to="/verification" className="lien-souligne mt-2 inline-block text-legende font-semibold">
                    Que veut dire vérifié ?
                  </Link>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted p-4">
                  <p className="text-produit">Ce dépôt n'est pas vérifié</p>
                  <p className="mt-1 text-legende leading-relaxed text-muted-foreground">
                    Le paiement en ligne et le séquestre ne sont pas disponibles pour ce
                    fournisseur. Les commandes se règlent directement, à la livraison.
                  </p>
                  <Link to="/verification" className="lien-souligne mt-2 inline-block text-legende font-semibold">
                    Que veut dire vérifié ?
                  </Link>
                </div>
              )}

              <div className="carte p-4">
                <h2 className="text-produit">Zone de livraison</h2>
                <dl className="mt-2 space-y-1.5 text-legende">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Rayon desservi</dt>
                    <dd className="nombres">{String(f.rayon_max_km)} km</dd>
                  </div>
                  {distanceKm != null ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Votre chantier</dt>
                      <dd className="nombres">{distanceKm.toFixed(1).replace(".", ",")} km</dd>
                    </div>
                  ) : null}
                </dl>
                {distanceKm != null ? (
                  <p className="mt-2 rounded-md bg-muted p-2.5 text-legende text-muted-foreground">
                    {distanceKm <= Number(f.rayon_max_km)
                      ? "Votre chantier est dans la zone desservie. Le prix rendu est calculé sur chaque produit."
                      : "Votre chantier est hors de la zone desservie : la livraison est à convenir directement avec le dépôt."}
                  </p>
                ) : (
                  <p className="mt-2 rounded-md bg-muted p-2.5 text-legende text-muted-foreground">
                    Indiquez où livrer pour savoir si ce dépôt dessert votre chantier.
                  </p>
                )}
              </div>

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
