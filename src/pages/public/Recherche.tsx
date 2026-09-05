import * as React from "react";
import { emettre } from "@/lib/evenements";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { listerFournisseurs, listerProduits, PAR_PAGE } from "@/lib/donnees/vitrine";
import { listerFamilles } from "@/lib/donnees/categories";
import { rechercherReferentiel, cheminResultat } from "@/lib/donnees/referentiel";
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

  /*
   * Le RÉFÉRENTIEL, en plus des offres. Avant : taper « hourdis » ici ne
   * rendait RIEN tant qu'aucun dépôt n'avait publié de hourdis, alors que
   * /materiaux en proposait six formats. Deux moteurs incompatibles — la
   * recherche principale ignorait le catalogue fermé (audit 01/09). Le RPC
   * comprend le malgache (« biriky ») et tolère les fautes.
   */
  const catalogue = useQuery({
    queryKey: ["recherche-referentiel", q],
    queryFn: () => rechercherReferentiel(q, null, 8),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
  });

  // Entonnoir (audit R-02) : les recherches sans résultat sont les matériaux à ajouter au catalogue.
  const compter = (d: unknown): number =>
    Array.isArray(d) ? d.length : Array.isArray((d as { lignes?: unknown[] } | null)?.lignes) ? (d as { lignes: unknown[] }).lignes.length : 0;
  const nbResultats = compter(produits.data) + compter(fournisseurs.data) + compter(catalogue.data);
  const recherchePrete = q.trim().length >= 2 && !produits.isPending && !fournisseurs.isPending && !catalogue.isPending;
  React.useEffect(() => {
    if (recherchePrete) emettre("recherche", { q: q.trim().slice(0, 60), nb_resultats: nbResultats });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, recherchePrete]);

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

      {/* ⚠ La page n'avait AUCUN h1 : le lecteur d'écran arrivait sur un champ
          sans savoir où. Sur téléphone c'est l'entrée « Recherche » de la barre
          basse — elle mérite son titre. */}
      <h1 className="mb-3 text-page">Rechercher</h1>

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
              {(catalogue.data ?? []).length > 0 ? (
                <section className="mb-5">
                  <h2 className="text-section">Dans le catalogue</h2>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {(catalogue.data ?? []).map((r) => (
                      <li key={r.kind + r.id}>
                        <Link
                          to={cheminResultat(r)}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-3 text-legende font-semibold text-primary-strong hover:bg-primary-soft/70"
                        >
                          {r.nom}
                          <span className="font-normal text-muted-foreground">
                            {r.kind === "famille"
                              ? "famille"
                              : r.kind === "type" && r.nb_formats
                                ? `${r.nb_formats} format${r.nb_formats > 1 ? "s" : ""}`
                                : r.famille_nom}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

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

              {/* Pas de compteur : la longueur de la page courante (20 max)
                  se faisait passer pour un total (audit 01/09). */}
              <h2 className="text-section">Produits</h2>

              {produits.data.length === 0 ? (
                <div className="mt-2">
                  <EtatVide
                    titre="Aucune offre publiée ne correspond"
                    phrase={
                      (catalogue.data ?? []).length > 0
                        ? "Le matériau existe au catalogue (ci-dessus), mais aucun dépôt n'a encore publié d'offre. Publiez une demande : les fournisseurs proches la verront."
                        : "Essayez un mot plus court, retirez un filtre — ou publiez une demande, les fournisseurs proches la verront."
                    }
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        <Bouton asChild>
                          <Link to="/demandes/nouvelle">Publier une demande</Link>
                        </Bouton>
                        {verifies ? (
                          <Bouton variante="secondaire" onClick={() => setVerifies(false)}>
                            Voir toutes les offres
                          </Bouton>
                        ) : null}
                      </div>
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
