import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { listerFournisseurs, listerProduits, PAR_PAGE } from "@/lib/donnees/vitrine";
import { listerFamilles } from "@/lib/donnees/categories";
import { usePanier } from "@/lib/panier";
import { usePointLivraison } from "@/lib/point-livraison";
import { versCarte, versLignePanier } from "@/lib/adaptateurs";
import { haversine } from "@/lib/livraison";
import { CarteProduit } from "@/components/produit/CarteProduit";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { LigneCase } from "@/components/ui/checkbox";
import { Tiroir, TiroirContenu, TiroirDeclencheur, TiroirTitre } from "@/components/ui/drawer";
import { GrilleSquelettes } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";
import { cn } from "@/lib/utils";

/**
 * Recherche. Les filtres passent par un tiroir en mobile (AKORA-DESIGN §8) et
 * par une colonne collante en desktop (§9) — jamais par une colonne écrasée.
 */
export default function Recherche() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [saisie, setSaisie] = React.useState(q);
  const [famille, setFamille] = React.useState<string | null>(null);
  const [verifies, setVerifies] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const ajouter = usePanier((e) => e.ajouter);
  const { point } = usePointLivraison();

  React.useEffect(() => setSaisie(q), [q]);
  React.useEffect(() => setPage(0), [q, famille, verifies]);

  const familles = useQuery({ queryKey: ["familles"], queryFn: listerFamilles, staleTime: 30 * 60_000 });

  const produits = useQuery({
    queryKey: ["recherche-produits", q, famille, verifies, page],
    queryFn: () =>
      listerProduits({
        recherche: q,
        categorieSlug: famille ?? undefined,
        verifiesUniquement: verifies,
        page,
      }),
    enabled: q.trim().length >= 2 || famille !== null,
    staleTime: 60_000,
  });

  const fournisseurs = useQuery({
    queryKey: ["recherche-fournisseurs", q],
    queryFn: () => listerFournisseurs({ recherche: q, page: 0 }),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  });

  const distance = (lat: unknown, lng: unknown, coef: unknown) =>
    point && lat != null && lng != null
      ? haversine({ lat: Number(lat), lng: Number(lng) }, point) * Number(coef ?? 1.3)
      : null;

  const filtres = (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-legende font-semibold">Famille</legend>
        <ul className="mt-1.5 space-y-1">
          <li>
            <button
              type="button"
              onClick={() => setFamille(null)}
              className={cn(
                "min-h-11 w-full rounded-md px-2 text-left text-legende",
                famille === null ? "bg-primary-soft font-semibold text-primary-strong" : "hover:bg-muted",
              )}
            >
              Toutes
            </button>
          </li>
          {(familles.data ?? []).map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setFamille(f.slug)}
                className={cn(
                  "min-h-11 w-full rounded-md px-2 text-left text-legende",
                  famille === f.slug ? "bg-primary-soft font-semibold text-primary-strong" : "hover:bg-muted",
                )}
              >
                {f.nom}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
      <LigneCase
        id="filtre-verifies"
        etiquette="Fournisseurs vérifiés uniquement"
        checked={verifies}
        onCheckedChange={(c) => setVerifies(c === true)}
      />
    </div>
  );

  return (
    <div className="container py-6">
      <Seo titre={q ? "Recherche : " + q : "Recherche"} chemin="/recherche" indexable={false} />

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(saisie.trim() ? { q: saisie.trim() } : {});
        }}
      >
        <label htmlFor="recherche-page" className="sr-only">
          Rechercher un matériau ou un fournisseur
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Saisie
            id="recherche-page"
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Ciment, parpaing 15, tôle, sable"
            className="pl-9"
          />
        </div>
      </form>

      <div className="mt-3">
        <SelecteurPoint />
      </div>

      <div className="mt-3 lg:hidden">
        <Tiroir>
          <TiroirDeclencheur asChild>
            <Bouton variante="secondaire" taille="compact">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filtrer
            </Bouton>
          </TiroirDeclencheur>
          <TiroirContenu>
            <TiroirTitre>Filtres</TiroirTitre>
            <div className="mt-4">{filtres}</div>
          </TiroirContenu>
        </Tiroir>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">{filtres}</aside>

        <div aria-live="polite">
          {q.trim().length < 2 && famille === null ? (
            <EtatVide
              titre="Que cherchez-vous ?"
              phrase="Tapez au moins deux lettres, ou choisissez une famille de matériaux."
              action={
                <Bouton asChild variante="secondaire">
                  <Link to="/materiaux">Parcourir les familles</Link>
                </Bouton>
              }
            />
          ) : produits.isPending ? (
            <GrilleSquelettes nombre={8} />
          ) : produits.isError ? (
            <EtatErreur onReessayer={() => void produits.refetch()} />
          ) : (
            <>
              {(fournisseurs.data ?? []).length > 0 ? (
                <section className="mb-5">
                  <h2 className="text-section">Fournisseurs</h2>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {(fournisseurs.data ?? []).slice(0, 6).map((f) => (
                      <li key={f.id as string}>
                        <Link
                          to={"/fournisseurs/" + f.slug}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-legende hover:bg-muted"
                        >
                          <BadgeVerification niveau={f.niveau_verification as never} compact />
                          {f.raison_sociale as string}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <h2 className="text-section">
                Produits{" "}
                <span className="nombres font-normal text-muted-foreground">({produits.data.length})</span>
              </h2>

              {produits.data.length === 0 ? (
                <div className="mt-2">
                  <EtatVide
                    titre="Aucun produit ne correspond"
                    phrase="Essayez un mot plus court, ou retirez le filtre « vérifiés uniquement »."
                    action={
                      verifies ? (
                        <Bouton variante="secondaire" onClick={() => setVerifies(false)}>
                          Voir toutes les offres
                        </Bouton>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {produits.data.map((produit) => (
                      <CarteProduit
                        key={produit.id as string}
                        produit={versCarte(
                          produit,
                          distance(
                            produit.fournisseur_lat,
                            produit.fournisseur_lng,
                            produit.fournisseur_coef_sinuosite,
                          ),
                        )}
                        onAjouter={() => {
                          ajouter(versLignePanier(produit));
                          toast.success("Ajouté au panier");
                        }}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
