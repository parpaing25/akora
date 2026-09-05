import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Info, Truck } from "lucide-react";
import { Seo, filAriane } from "@/components/Seo";
import { lireFournisseur, listerProduits } from "@/lib/donnees/vitrine";
import { useLivraisonUnique } from "@/hooks/useLivraison";
import { formaterAriary } from "@/lib/format";
import { couverture, quantitePourSurface } from "@/lib/couverture";
import { SimulateurLivraison } from "@/components/livraison/SimulateurLivraison";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { RevelerContact } from "@/components/marque/RevelerContact";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { Squelette } from "@/components/ui/skeleton";
import NonTrouve from "@/pages/NonTrouve";

/**
 * Simuler une livraison chez un depot.
 *
 * Elle repond a la question que tout le monde se pose et que personne
 * n'affiche : le prix annonce, c'est au depot ou chez moi ? Sur Akora c'est
 * AU DEPOT — et cette page le dit en toutes lettres avant de montrer le
 * moindre chiffre, parce que decouvrir la difference au moment de payer est
 * la meilleure facon de perdre un acheteur.
 *
 * Le calcul est celui du panier et de la fiche produit, pas une seconde
 * implementation : `useLivraison` et `SimulateurLivraison`, ecrits une fois.
 */
const nombre = (v: number, d = 0) => v.toFixed(d).replace(/\.0+$/, "").replace(".", ",");

export default function LivraisonFournisseur() {
  const { slug } = useParams<{ slug: string }>();
  const [produitId, setProduitId] = React.useState<string | null>(null);
  const [quantite, setQuantite] = React.useState(0);
  const [surface, setSurface] = React.useState(0);

  const fournisseur = useQuery({
    queryKey: ["fournisseur", slug],
    queryFn: () => lireFournisseur(slug as string),
    enabled: Boolean(slug),
    staleTime: 10 * 60_000,
  });

  const f = fournisseur.data as Record<string, unknown> | null | undefined;

  const produits = useQuery({
    queryKey: ["produits-fournisseur", f?.id],
    queryFn: () => listerProduits({ fournisseurId: f?.id as string }),
    enabled: Boolean(f?.id),
    staleTime: 5 * 60_000,
  });

  const catalogue = React.useMemo(
    () => (produits.data ?? []) as Record<string, unknown>[],
    [produits.data],
  );

  // Le premier produit sert de point de depart : arriver sur un simulateur
  // vide oblige a comprendre avant de pouvoir essayer.
  React.useEffect(() => {
    if (!produitId && catalogue.length > 0) {
      const premier = catalogue[0]!;
      setProduitId(premier.id as string);
      setQuantite(Number(premier.quantite_min ?? 1));
    }
  }, [catalogue, produitId]);

  const produit = catalogue.find((p) => p.id === produitId) ?? null;
  const couvertureProduit = React.useMemo(
    () => (produit && produit.unite === "piece" ? couverture(produit as never) : null),
    [produit],
  );

  const prix = produit ? Number(produit.prix_promo ?? produit.prix_unitaire) : 0;
  const montantProduits = prix * quantite;

  const livraison = useLivraisonUnique(
    produit && f
      ? {
          fournisseurId: f.id as string,
          rayonMaxKm: Number(f.rayon_max_km ?? 0),
          coefSinuosite: (f.coef_sinuosite as number | null) ?? null,
          depart:
            f.lat != null && f.lng != null ? { lat: Number(f.lat), lng: Number(f.lng) } : null,
          lignes: [
            {
              quantite,
              poids_kg_unite: Number(produit.poids_kg_unite ?? 0),
              volume_m3_unite: Number(produit.volume_m3_unite ?? 0),
            },
          ],
          montantProduits,
        }
      : null,
  );

  const coutLivraison =
    livraison?.statut === "estimee" ? livraison.cout : livraison?.statut === "offerte" ? 0 : null;
  const totalRendu = coutLivraison === null ? null : montantProduits + coutLivraison;

  if (fournisseur.isSuccess && !f) return <NonTrouve />;

  return (
    <div className="container max-w-5xl py-6">
      <Seo
        titre={`Simuler une livraison — ${(f?.raison_sociale as string) ?? "fournisseur"}`}
        chemin={`/fournisseurs/${slug}/livraison`}
        indexable={false}
        description="Calculez le prix rendu chantier : matériau plus livraison, depuis l'adresse de votre chantier."
        donneesStructurees={filAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Fournisseurs", chemin: "/fournisseurs" },
          { nom: (f?.raison_sociale as string) ?? "", chemin: `/fournisseurs/${slug}` },
          { nom: "Livraison", chemin: `/fournisseurs/${slug}/livraison` },
        ])}
      />

      <nav
        aria-label="Fil d'Ariane"
        className="mb-2 flex flex-wrap items-center gap-2 text-legende text-muted-foreground"
      >
        <Link to="/fournisseurs" className="lien-souligne">
          Fournisseurs
        </Link>
        <span aria-hidden="true">›</span>
        <Link to={`/fournisseurs/${slug}`} className="lien-souligne">
          {(f?.raison_sociale as string) ?? "…"}
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-foreground">Livraison</span>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-page">Simuler une livraison</h1>
        {f ? <BadgeVerification niveau={f.niveau_verification as never} /> : null}
      </div>
      <p className="mt-1 text-legende text-muted-foreground">
        Chez <span className="font-semibold text-foreground">{(f?.raison_sociale as string) ?? "…"}</span>
        {f?.localite_nom ? ` · ${f.localite_nom as string}` : ""}
      </p>

      {/*
        La reponse a la question que personne n'ose poser, avant tout chiffre.
        La decouvrir au moment de payer est la meilleure facon de perdre un
        acheteur — et de lui donner raison.
      */}
      <div className="filet-primaire carte mt-4 p-4">
        <p className="flex items-center gap-2 text-produit">
          <Info size={17} aria-hidden="true" />
          Les prix affichés sur Akora sont ceux du dépôt
        </p>
        <p className="mt-1 text-legende leading-relaxed text-muted-foreground">
          La livraison n'y est pas comprise : elle s'ajoute, et dépend de la distance, du poids et
          du volume à transporter. C'est exactement ce que cette page calcule. Le total obtenu est
          le <strong className="text-foreground">prix rendu chantier</strong> — le seul qui permette
          de comparer deux dépôts honnêtement.
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <div className="carte p-4">
            <h2 className="text-produit">Ce que vous voulez faire livrer</h2>

            {produits.isLoading ? (
              <Squelette className="mt-3 h-11 w-full" />
            ) : catalogue.length === 0 ? (
              <p className="mt-2 text-legende text-muted-foreground">
                Ce dépôt n'a pas encore publié de produit : il n'y a rien à simuler.
              </p>
            ) : (
              <>
                <label htmlFor="produit-simule" className="mt-3 block text-legende font-semibold">
                  Matériau
                </label>
                <select
                  id="produit-simule"
                  value={produitId ?? ""}
                  onChange={(e) => {
                    setProduitId(e.target.value);
                    const p = catalogue.find((c) => c.id === e.target.value);
                    setQuantite(Number(p?.quantite_min ?? 1));
                    setSurface(0);
                  }}
                  className="cible-44 mt-1.5 w-full rounded-md border border-input bg-card px-3 text-courant"
                >
                  {catalogue.map((p) => (
                    <option key={p.id as string} value={p.id as string}>
                      {p.nom_affiche as string} — {formaterAriary(Number(p.prix_promo ?? p.prix_unitaire))} /{" "}
                      {p.unite as string}
                    </option>
                  ))}
                </select>

                {couvertureProduit ? (
                  <div className="mt-3 rounded-md bg-muted p-3">
                    <label htmlFor="surface-simulee" className="text-legende font-semibold">
                      Surface à couvrir
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        id="surface-simulee"
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        value={surface}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value));
                          setSurface(v);
                          if (v > 0) {
                            setQuantite(
                              quantitePourSurface(
                                v,
                                couvertureProduit.piecesParM2,
                                Number(produit?.quantite_min ?? 1),
                              ),
                            );
                          }
                        }}
                        className="cible-44 w-28 rounded-md border border-input bg-card px-3 text-courant"
                      />
                      <span className="text-courant text-muted-foreground">m²</span>
                    </div>
                    <p className="mt-1.5 text-legende text-muted-foreground">
                      <span className="nombres">{nombre(couvertureProduit.piecesParM2, 2)}</span> au
                      m²{couvertureProduit.source === "depot" ? ", chiffre du dépôt" : ", hors joints"}.
                    </p>
                  </div>
                ) : null}

                <label htmlFor="quantite-simulee" className="mt-3 block text-legende font-semibold">
                  Quantité ({(produit?.unite as string) ?? "unité"})
                </label>
                <input
                  id="quantite-simulee"
                  type="number"
                  inputMode="numeric"
                  min={Number(produit?.quantite_min ?? 1)}
                  value={quantite}
                  onChange={(e) => setQuantite(Math.max(0, Number(e.target.value)))}
                  className="cible-44 mt-1.5 w-40 rounded-md border border-input bg-card px-3 text-courant"
                />
              </>
            )}
          </div>

          <div className="carte p-4">
            <h2 className="text-produit">Où livrer</h2>
            <div className="mt-3">
              <SelecteurPoint />
            </div>
          </div>
        </div>

        {/* ── Le résultat ────────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="carte overflow-hidden p-0">
            <div className="bg-foreground p-4 text-background">
              <p className="nombres text-[0.75rem] uppercase tracking-wider text-background/60">
                Prix rendu chantier
              </p>
              <p className="nombres mt-0.5 text-[1.75rem] font-bold leading-none">
                {totalRendu != null ? formaterAriary(totalRendu) : "—"}
              </p>
              {totalRendu != null && quantite > 0 ? (
                <p className="nombres mt-1 text-legende text-background/70">
                  soit {formaterAriary(totalRendu / quantite)} par {(produit?.unite as string) ?? "unité"} rendue
                </p>
              ) : null}
            </div>

            <dl className="divide-y divide-border">
              <div className="flex justify-between gap-2 px-4 py-2.5">
                <dt className="text-courant text-muted-foreground">Matériaux au dépôt</dt>
                <dd className="nombres text-courant font-semibold">{formaterAriary(montantProduits)}</dd>
              </div>
              <div className="flex justify-between gap-2 px-4 py-2.5">
                <dt className="text-courant text-muted-foreground">Livraison</dt>
                <dd className="nombres text-courant font-semibold">
                  {coutLivraison != null ? formaterAriary(coutLivraison) : "à convenir"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 bg-muted px-4 py-2.5">
                <dt className="text-courant font-bold">Total rendu</dt>
                <dd className="nombres text-produit text-primary">
                  {totalRendu != null ? formaterAriary(totalRendu) : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {livraison ? <SimulateurLivraison resultat={livraison} /> : null}

          <div className="carte p-4">
            <h2 className="flex items-center gap-2 text-produit">
              <Truck size={17} aria-hidden="true" />
              Parler au dépôt
            </h2>
            <p className="mb-3 mt-1 text-legende text-muted-foreground">
              Une livraison particulière, un accès difficile, une date précise : le dépôt répond
              mieux qu'une estimation.
            </p>
            {f ? <RevelerContact fournisseurId={f.id as string} /> : null}
          </div>

          <Link
            to={`/fournisseurs/${slug}`}
            className="cible-44 flex items-center justify-center rounded-md border border-foreground px-4 text-courant font-semibold"
          >
            Voir tout le catalogue
          </Link>
        </aside>
      </div>
    </div>
  );
}
