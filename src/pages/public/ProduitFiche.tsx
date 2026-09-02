import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Seo, filAriane } from "@/components/Seo";
import { compterVue, lireProduit } from "@/lib/donnees/vitrine";
import { listerPaliers } from "@/lib/donnees/produits";
import { prixUnitaireApplicable, prochainPalier } from "@/lib/paliers";
import { usePanier, type LignePanier } from "@/lib/panier";
import { departFournisseur, versLignePanier } from "@/lib/adaptateurs";
import { useLivraisonUnique } from "@/hooks/useLivraison";
import { formaterAriary, formaterDate } from "@/lib/format";
import { LIBELLE_STOCK, LIBELLE_UNITE } from "@/lib/types-metier";
import { ENV } from "@/lib/env";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { ImageProduit } from "@/components/produit/ImageProduit";
import { Visionneuse, useVisionneuse } from "@/components/ui/visionneuse";
import { couverture, quantitePourSurface } from "@/lib/couverture";
import { Prix } from "@/components/produit/Prix";
import { SimulateurLivraison } from "@/components/livraison/SimulateurLivraison";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { RouteLivraison } from "@/components/motion/RouteLivraison";
import { usePointLivraison } from "@/lib/point-livraison";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { Squelette } from "@/components/ui/skeleton";
import NonTrouve from "@/pages/NonTrouve";

export default function ProduitFiche() {
  const { slug, produitSlug } = useParams<{ slug: string; produitSlug: string }>();
  const ajouter = usePanier((e) => e.ajouter);
  const { point } = usePointLivraison();
  const [quantite, setQuantite] = React.useState(1);
  const [surface, setSurface] = React.useState(0);
  const [photoActive, setPhotoActive] = React.useState(0);

  const produit = useQuery({
    queryKey: ["produit-public", slug, produitSlug],
    queryFn: () => lireProduit(slug as string, produitSlug as string),
    enabled: Boolean(slug && produitSlug),
    staleTime: 2 * 60_000,
  });

  const paliers = useQuery({
    queryKey: ["paliers-public", produit.data?.id],
    queryFn: () => listerPaliers(produit.data?.id as string),
    enabled: Boolean(produit.data?.id),
    staleTime: 5 * 60_000,
  });

  const p = produit.data;

  React.useEffect(() => {
    if (p?.quantite_min) setQuantite(Number(p.quantite_min));
  }, [p?.quantite_min]);

  // Compteur de vues : agrégé par jour côté base, une seule fois par montage.
  React.useEffect(() => {
    if (p?.id) void compterVue(p.id as string);
  }, [p?.id]);

  const ligneBase: Omit<LignePanier, "quantite"> | null = p ? versLignePanier(p, paliers.data ?? []) : null;
  const prixApplique = ligneBase
    ? prixUnitaireApplicable(ligneBase.prixUnitaire, paliers.data ?? [], quantite)
    : 0;
  const totalProduits = Math.round(prixApplique * quantite);
  const suivant = prochainPalier(paliers.data ?? [], quantite);

  const livraison = useLivraisonUnique(
    p && ligneBase
      ? {
          fournisseurId: p.fournisseur_id as string,
          rayonMaxKm: Number(p.fournisseur_rayon_max_km ?? 40),
          coefSinuosite: p.fournisseur_coef_sinuosite == null ? null : Number(p.fournisseur_coef_sinuosite),
          depart: departFournisseur(p),
          lignes: [
            {
              quantite,
              poids_kg_unite: ligneBase.poidsKgUnite,
              volume_m3_unite: ligneBase.volumeM3Unite,
            },
          ],
          montantProduits: totalProduits,
        }
      : null,
  );

  if (produit.isSuccess && !produit.data) return <NonTrouve />;

  const photos = ((p?.photos as string[] | null) ?? []).filter(Boolean);
  const visionneuse = useVisionneuse(photos);
  // La couverture au m2 n'existe que pour ce qui se pose en surface : une
  // brique, une tuile, un hourdis. Pas pour un sac de ciment ni un metre cube
  // de sable — d'ou le `null`, et le champ qui ne s'affiche pas.
  const couvertureProduit = React.useMemo(
    () => (p && p.unite === "piece" ? couverture(p as never) : null),
    [p],
  );

  // V2 : « Combien ? » se répond en un tap. Les paliers proposés dépendent de
  // l'unité — 100 sacs de ciment se commandent, 100 m³ de sable non.
  const presets = React.useMemo(() => {
    const minimum = Number(p?.quantite_min ?? 1);
    const base =
      p?.unite === "m3" || p?.unite === "tonne" || p?.unite === "chargement"
        ? [1, 2, 5, 10]
        : p?.unite === "sac" || p?.unite === "botte" || p?.unite === "palette"
          ? [10, 20, 50, 100]
          : p?.unite === "m2" || p?.unite === "ml"
            ? [10, 25, 50, 100]
            : [50, 100, 200, 500];
    return base.filter((q) => q >= minimum);
  }, [p?.unite, p?.quantite_min]);

  const coutLivraison =
    livraison?.statut === "estimee" ? livraison.cout : livraison?.statut === "offerte" ? 0 : null;
  const totalRendu = coutLivraison === null ? null : totalProduits + coutLivraison;

  return (
    <div className="container pb-28 pt-6 sm:pb-6">
      {p ? (
        <Seo
          titre={p.nom_affiche as string}
          chemin={"/fournisseurs/" + p.fournisseur_slug + "/" + p.slug}
          description={
            (p.description as string | null) ??
            `${p.nom_affiche} chez ${p.fournisseur_nom}. Prix rendu chantier, livraison calculée depuis votre adresse.`
          }
          image={photos[0] ?? null}
          donneesStructurees={[
            filAriane([
              { nom: "Accueil", chemin: "/" },
              { nom: "Fournisseurs", chemin: "/fournisseurs" },
              { nom: p.fournisseur_nom as string, chemin: "/fournisseurs/" + p.fournisseur_slug },
              { nom: p.nom_affiche as string, chemin: "/fournisseurs/" + p.fournisseur_slug + "/" + p.slug },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "Product",
              name: p.nom_affiche,
              description: p.description ?? undefined,
              image: photos.length ? photos : undefined,
              brand: { "@type": "Organization", name: p.fournisseur_nom },
              offers: {
                "@type": "Offer",
                priceCurrency: "MGA",
                price: Number(p.prix_promo ?? p.prix_unitaire),
                availability:
                  p.stock_statut === "rupture"
                    ? "https://schema.org/OutOfStock"
                    : "https://schema.org/InStock",
                url: new URL("/fournisseurs/" + p.fournisseur_slug + "/" + p.slug, ENV.siteUrl).toString(),
                seller: { "@type": "Organization", name: p.fournisseur_nom },
              },
              aggregateRating:
                p.fournisseur_note == null
                  ? undefined
                  : {
                      "@type": "AggregateRating",
                      ratingValue: Number(p.fournisseur_note),
                      reviewCount: Number(p.fournisseur_nb_avis ?? 0),
                    },
            },
          ]}
        />
      ) : null}

      {produit.isPending || !p ? (
        <div className="space-y-3">
          <Squelette className="aspect-[4/3] w-full" />
          <Squelette className="h-8 w-2/3" />
          <Squelette className="h-24 w-full" />
        </div>
      ) : (
        <>
          <nav aria-label="Fil d'Ariane" className="text-legende text-muted-foreground">
            <Link to={"/materiaux/" + p.categorie_slug} className="hover:underline">
              {p.categorie_nom as string}
            </Link>
            <ChevronRight className="mx-1 inline size-3.5" aria-hidden="true" />
            <Link to={"/fournisseurs/" + p.fournisseur_slug} className="hover:underline">
              {p.fournisseur_nom as string}
            </Link>
          </nav>

          <div className="mt-3 grid gap-6 lg:grid-cols-2">
            <div>
              {/* Une photo de materiau se regarde de pres : texture, alveoles,
                  etat des aretes. La vignette ne suffit pas. */}
              <button
                type="button"
                onClick={() => visionneuse.ouvrir(photoActive)}
                aria-label="Agrandir la photo"
                className="block w-full cursor-zoom-in"
              >
                <ImageProduit
                  src={photos[photoActive] ?? null}
                  alt={p.nom_affiche as string}
                  variante="original"
                  prioritaire
                  className="aspect-[4/3] w-full rounded-lg border border-border bg-muted object-cover"
                />
              </button>
              {photos.length > 1 ? (
                <ul className="mt-2 flex gap-2 overflow-x-auto">
                  {photos.map((url, index) => (
                    <li key={url}>
                      <button
                        type="button"
                        aria-label={`Voir la photo ${index + 1}`}
                        aria-current={index === photoActive}
                        onClick={() => setPhotoActive(index)}
                        className={
                          "block overflow-hidden rounded-xs border-2 " +
                          (index === photoActive ? "border-primary" : "border-transparent")
                        }
                      >
                        <ImageProduit
                          src={url}
                          alt=""
                          className="size-16 object-cover"
                          variante="vignette"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <h1 className="text-page">{p.nom_affiche as string}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-legende">
                <BadgeVerification
                  niveau={p.fournisseur_niveau as never}
                  verifieLe={p.fournisseur_verifie_le as string | null}
                />
                <Link to={"/fournisseurs/" + p.fournisseur_slug} className="lien-souligne">
                  {p.fournisseur_nom as string}
                </Link>
              </p>

              {p.materiau_slug && p.materiau_type_slug ? (
                <p className="mt-2 text-legende text-muted-foreground">
                  Référence commune :{" "}
                  <Link
                    to={`/materiaux/${p.categorie_slug}/${p.materiau_type_slug}/${p.materiau_slug}`}
                    className="lien-souligne"
                  >
                    {p.materiau_nom as string}
                  </Link>{" "}
                  — comparez les autres dépôts qui le vendent.
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-baseline gap-3">
                <Prix
                  montant={prixApplique}
                  unite={p.unite as never}
                  taille="grand"
                  fiscalite={p.fournisseur_assujetti_tva ? "HT" : "TTC"}
                />
                <Pastille ton={p.stock_statut === "en_stock" ? "succes" : p.stock_statut === "rupture" ? "danger" : "neutre"}>
                  {LIBELLE_STOCK[p.stock_statut as never]}
                </Pastille>
              </div>
              <p className="mt-1 text-[0.78rem] text-muted-foreground">
                Prix mis à jour le <span className="nombres">{formaterDate(p.prix_maj_le as string)}</span>
              </p>

              {p.description ? (
                <p className="mt-3 max-w-prose text-[0.9375rem]">{p.description as string}</p>
              ) : null}
            </div>
          </div>
        </>
      )}

      {p && ligneBase ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <SelecteurPoint />
            {/* V2 : le trajet du dépôt au chantier, puis le total qui apparaît.
                La formule détaillée reste juste en dessous, pour qui veut. */}
            {totalRendu !== null && (livraison?.statut === "estimee" || livraison?.statut === "offerte") ? (
              <Carte className="p-4">
                <p className="text-legende font-semibold">Livré à mon chantier</p>
                <RouteLivraison
                  variante="courbe"
                  depart={p.fournisseur_nom as string}
                  arrivee={point?.libelle ?? "mon chantier"}
                  distanceKm={livraison.detail.distanceRouteKm}
                  montant={totalRendu}
                  legende={`tout compris · ${formaterAriary(totalRendu / quantite)} / ${LIBELLE_UNITE[p.unite as never]} rendue`}
                  sousTitre={`${livraison.detail.vehicule?.nom ?? "camion"} · ${livraison.detail.rotations} voyage${livraison.detail.rotations > 1 ? "s" : ""}`}
                  className="mt-1"
                />
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className="part-barre bg-foreground" style={{ width: `${Math.round((totalProduits / totalRendu) * 100)}%` }} />
                  <span className="part-barre bg-primary" style={{ width: `${100 - Math.round((totalProduits / totalRendu) * 100)}%`, animationDelay: "3.5s" }} />
                </div>
                <div className="nombres mt-1.5 flex justify-between text-[0.78rem] text-muted-foreground">
                  <span><span className="mr-1.5 inline-block size-2 rounded-full bg-foreground" aria-hidden="true" />Matériaux {formaterAriary(totalProduits)}</span>
                  <span><span className="mr-1.5 inline-block size-2 rounded-full bg-primary" aria-hidden="true" />Livraison {coutLivraison === 0 ? "offerte" : formaterAriary(coutLivraison ?? 0)}</span>
                </div>
              </Carte>
            ) : null}
            {livraison ? (
              <SimulateurLivraison resultat={livraison} />
            ) : (
              <Squelette className="h-40 w-full" />
            )}
          </div>

          <Carte className="h-fit p-4">
            <h2 className="text-produit">Votre commande</h2>

            {/*
              Un macon connait la surface de son mur, pas le nombre de briques.
              Lui faire poser la division, c'est lui faire porter une erreur
              qu'on sait eviter. Le champ n'apparait que si la couverture du
              materiau est connue — proposer une conversion qu'on ne sait pas
              faire serait pire que ne rien proposer.
            */}
            {couvertureProduit ? (
              <div className="mt-3 rounded-md bg-muted p-3">
                <label htmlFor="surface-produit" className="text-legende font-semibold">
                  Surface à couvrir
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="surface-produit"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    value={surface}
                    onChange={(e) => {
                      const valeur = Math.max(0, Number(e.target.value));
                      setSurface(valeur);
                      if (valeur > 0) {
                        setQuantite(
                          quantitePourSurface(
                            valeur,
                            couvertureProduit.piecesParM2,
                            Number(p.quantite_min ?? 1),
                          ),
                        );
                      }
                    }}
                    className="cible-44 w-28 rounded-md border border-input bg-card px-3 text-courant"
                  />
                  <span className="text-courant text-muted-foreground">m²</span>
                </div>
                <p className="mt-1.5 text-legende text-muted-foreground">
                  <span className="nombres">
                    {couvertureProduit.piecesParM2.toFixed(2).replace(/\.?0+$/, "").replace(".", ",")}
                  </span>{" "}
                  {LIBELLE_UNITE[p.unite as never]} au m²
                  {couvertureProduit.source === "depot"
                    ? ", chiffre du dépôt"
                    : ", calculé sur les dimensions — hors joints"}
                  . La quantité ci-dessous s'ajuste ; vous pouvez la corriger.
                </p>
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="quantite-produit" className="text-legende font-semibold">
                Combien ?
              </label>
              <span className="text-legende text-muted-foreground">
                ({LIBELLE_UNITE[p.unite as never]}, minimum {String(p.quantite_min)})
              </span>
            </div>
            {presets.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Quantités courantes">
                {presets.map((q) => (
                  <button
                    key={q}
                    type="button"
                    aria-pressed={quantite === q}
                    onClick={() => setQuantite(q)}
                    className={
                      "nombres cible-44 min-w-[3.25rem] rounded-md border px-3 text-courant font-semibold " +
                      (quantite === q
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card hover:bg-muted")
                    }
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-1.5 flex items-center gap-2">
              <Bouton
                variante="tertiaire"
                taille="icone"
                aria-label="Diminuer la quantité"
                onClick={() => setQuantite((q) => Math.max(Number(p.quantite_min ?? 1), q - 1))}
              >
                <Minus className="size-4" aria-hidden="true" />
              </Bouton>
              <input
                id="quantite-produit"
                type="number"
                inputMode="numeric"
                min={Number(p.quantite_min ?? 1)}
                value={quantite}
                onChange={(e) => setQuantite(Math.max(Number(p.quantite_min ?? 1), Number(e.target.value) || 1))}
                className="nombres h-11 w-24 rounded-md border border-input bg-card px-3 text-center text-[1.0625rem] font-semibold"
              />
              <Bouton
                variante="tertiaire"
                taille="icone"
                aria-label="Augmenter la quantité"
                onClick={() => setQuantite((q) => q + 1)}
              >
                <Plus className="size-4" aria-hidden="true" />
              </Bouton>
            </div>

            {suivant ? (
              <p className="mt-2 rounded-md bg-primary-soft px-2.5 py-1.5 text-[0.78rem] text-primary-strong">
                À partir de <span className="nombres">{suivant.quantite_min}</span>{" "}
                {LIBELLE_UNITE[p.unite as never]}, le prix tombe à{" "}
                <span className="nombres font-semibold">{formaterAriary(suivant.prix_unitaire)}</span>.
              </p>
            ) : null}

            <dl className="mt-3 space-y-1 border-t border-border pt-3 text-legende">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Matériaux</dt>
                <dd className="nombres font-semibold">{formaterAriary(totalProduits)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Livraison</dt>
                <dd className="nombres font-semibold">
                  {livraison?.statut === "estimee"
                    ? formaterAriary(livraison.cout)
                    : livraison?.statut === "offerte"
                      ? "offerte"
                      : "—"}
                </dd>
              </div>
              {livraison?.statut === "estimee" || livraison?.statut === "offerte" ? (
                <div className="flex justify-between gap-2 border-t border-border pt-1.5">
                  <dt className="font-semibold">Rendu chantier</dt>
                  <dd>
                    <Prix
                      montant={totalProduits + (livraison.statut === "estimee" ? livraison.cout : 0)}
                      rendu
                      fiscalite={p.fournisseur_assujetti_tva ? "HT" : "TTC"}
                    />
                  </dd>
                </div>
              ) : null}
            </dl>

            <Bouton
              className="mt-3 hidden sm:flex"
              pleineLargeur
              disabled={p.stock_statut === "rupture"}
              onClick={() => {
                ajouter(ligneBase, quantite);
                toast.success("Ajouté au panier", { description: `${quantite} × ${p.nom_affiche}` });
              }}
            >
              {p.stock_statut === "rupture" ? "En rupture" : "Ajouter au panier"}
            </Bouton>
          </Carte>
        </div>
      ) : null}

      {p && ligneBase ? (
        <div className="fixed inset-x-0 bottom-[var(--barre-mobile)] z-30 border-t border-border bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Bouton
                variante="tertiaire"
                taille="icone"
                aria-label="Diminuer la quantité"
                onClick={() => setQuantite((q) => Math.max(Number(p.quantite_min ?? 1), q - 1))}
              >
                <Minus className="size-4" aria-hidden="true" />
              </Bouton>
              <span className="nombres w-10 text-center text-[1.0625rem] font-semibold" aria-live="polite">
                {quantite}
              </span>
              <Bouton
                variante="tertiaire"
                taille="icone"
                aria-label="Augmenter la quantité"
                onClick={() => setQuantite((q) => q + 1)}
              >
                <Plus className="size-4" aria-hidden="true" />
              </Bouton>
            </div>
            <Bouton
              className="flex-1"
              disabled={p.stock_statut === "rupture"}
              onClick={() => {
                ajouter(ligneBase, quantite);
                toast.success("Ajouté au panier");
              }}
            >
              {totalRendu !== null ? (
                <>
                  Commander · {formaterAriary(totalRendu)}
                  <span className="sr-only">rendu chantier</span>
                </>
              ) : (
                <>Ajouter · {formaterAriary(totalProduits)}</>
              )}
            </Bouton>
          </div>
        </div>
      ) : null}
      <Visionneuse
        photos={photos}
        index={visionneuse.index}
        ouvert={visionneuse.ouvert}
        onFermer={visionneuse.fermer}
        onIndex={visionneuse.changer}
        legende={p?.nom_affiche as string | undefined}
      />
    </div>
  );
}
