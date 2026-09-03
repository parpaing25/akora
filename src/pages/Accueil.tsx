import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { MapPin, Search } from "lucide-react";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import { usePointLivraison } from "@/lib/point-livraison";
import { chargerFil, TAILLE_PAGE, type FiltreFil } from "@/lib/donnees/fil";

import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur } from "@/components/ui/etats";
import { TuilesFamilles } from "@/components/accueil/TuilesFamilles";

/**
 * La carte du fil est chargée À LA DEMANDE.
 *
 * Elle traîne derrière elle tout le calcul de livraison — c'est ce qui donne
 * le prix rendu chantier — et pesait 17 Ko gzip sur le chunk d'entrée, alors
 * qu'elle ne s'affiche jamais avant que le fil ne soit revenu du serveur. Son
 * chargement se superpose donc à cette requête : rien n'est perdu, et le
 * premier affichage s'allège d'autant.
 */
const CartePublication = React.lazy(() =>
  import("@/components/fil/CartePublication").then((m) => ({ default: m.CartePublication })),
);

// Le tiroir du point de livraison (carte comprise) ne se charge qu'au clic.
const TiroirPointSeul = React.lazy(() =>
  import("@/components/livraison/SelecteurPoint").then((m) => ({ default: m.TiroirPointSeul })),
);

/**
 * Accueil : un FIL, pas une vitrine.
 *
 * Un dépôt de matériaux n'a pas un catalogue stable — il a du stock qui
 * arrive, un camion qui part demain, un prix qui baisse jusqu'à samedi. Une
 * page vitrine ne dit rien de tout cela ; un fil, si.
 *
 * Chargée en dur (pas en lazy) : c'est la page du LCP. Le bandeau d'accroche
 * reste rendu immédiatement, sans image ni requête, pour que le premier
 * affichage n'attende pas le réseau — sur une 3G, un fil vide pendant deux
 * secondes ressemble à une panne.
 *
 * Aucun Realtime (règle A2.7) : le fil se rafraîchit au retour de focus.
 */

const FILTRES: [FiltreFil, string][] = [
  ["proche", "Près de moi"],
  ["verifies", "Vérifiés"],
  ["baisses", "Baisses de prix"],
  ["suivis", "Suivis"],
];


/**
 * Raccourcis pour les écrans SANS colonnes latérales (< 1024 px) : sans eux,
 * l'accueil mobile se réduisait au fil — ni Fournisseurs, ni Calculateurs,
 * ni demande d'achat n'étaient accessibles (audit 01/09).
 */
/**
 * ⚠ TROIS, PAS CINQ (03/09/2026). L'accueil mobile empilait quatre zones de
 *   choix avant la première publication : huit tuiles, la recherche, cinq
 *   raccourcis, quatre filtres. « Fournisseurs » est dans le pied de page et à
 *   deux gestes des tuiles ; « Je cherche un matériau » doublait le bouton
 *   « Je cherche… » juste au-dessus. Restent les trois entrées que rien
 *   d'autre ne porte à l'écran.
 */
const RACCOURCIS_MOBILES = [
  { vers: "/prix", intitule: "Prix du marché" },
  { vers: "/transporteurs", intitule: "Transporteurs" },
  { vers: "/calculateurs", intitule: "Calculateurs" },
];

export default function Accueil() {
  const [parametres, setParametres] = useSearchParams();
  const { session } = useAuth();
  const { point } = usePointLivraison();
  // Tiroir du point de livraison : monté au premier clic seulement.
  const [tiroirMonte, setTiroirMonte] = React.useState(false);
  const [tiroirOuvert, setTiroirOuvert] = React.useState(false);
  const ouvrirTiroir = () => {
    setTiroirMonte(true);
    setTiroirOuvert(true);
  };

  const filtreBrut = parametres.get("f");
  const filtre: FiltreFil = FILTRES.some(([v]) => v === filtreBrut)
    ? (filtreBrut as FiltreFil)
    : "proche";

  const fil = useInfiniteQuery({
    queryKey: ["fil", filtre],
    queryFn: ({ pageParam }) => chargerFil({ curseur: pageParam, filtre }),
    initialPageParam: null as string | null,
    getNextPageParam: (derniere) =>
      derniere.length === TAILLE_PAGE ? (derniere[derniere.length - 1]?.publie_le ?? null) : null,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const publications = React.useMemo(() => fil.data?.pages.flat() ?? [], [fil.data]);

  return (
    <>
      <Seo
        titre="Akora"
        chemin="/"
        description="Le fil des dépôts de matériaux à Madagascar : stock du jour, baisses de prix, tournées de livraison. Comparez au prix rendu chantier, livraison comprise."
      />

      {/* ⭐ Les colonnes latérales sont dans la COQUILLE depuis le 03/09/2026 :
          elles suivent le visiteur sur toutes les pages. Ici, seulement le
          fil. Le `px-4` sous lg : la coquille ne pose la grille et ses marges
          qu'à partir de 1024 px. */}
      <div className="px-4 py-4 lg:px-0 lg:py-0">
        {/* ── Colonne centrale : le fil ───────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          {/*
            V2 (02/09/2026) : une question, un geste. Tout prix affiché dépend
            du point de livraison — c'est donc la PREMIÈRE chose qu'on demande,
            en gros, avant toute phrase. Le point respire tant qu'il manque.
          */}
          <section className="entree">
            <p className="text-legende text-muted-foreground">Salama !</p>
            <h1 className="mt-0.5 text-[1.625rem] font-extrabold leading-tight tracking-tight">
              {point ? "Livrer à votre chantier" : "Où livrer ?"}
            </h1>
            <button
              type="button"
              onClick={ouvrirTiroir}
              className={
                "mt-3 flex min-h-[3.75rem] w-full items-center gap-3 rounded-lg px-4 text-left text-[1.0625rem] font-bold shadow " +
                (point
                  ? "border border-primary/40 bg-primary-soft text-foreground"
                  : "pulse-point bg-primary text-primary-foreground")
              }
            >
              <MapPin size={24} className={point ? "shrink-0 text-primary" : "shrink-0"} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{point ? point.libelle : "Mon chantier"}</span>
              <span className="shrink-0 text-legende font-semibold opacity-85">
                {point ? "Changer" : "Choisir"}
              </span>
            </button>
            {!session && !point ? (
              <p className="mt-2 text-legende text-muted-foreground">
                Chaque prix est calculé livraison comprise, depuis votre chantier.
              </p>
            ) : null}
          </section>

          <TuilesFamilles />

          <div className="carte p-3.5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Link
                to="/recherche"
                className="cible-44 flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-input bg-muted/60 px-4 text-courant text-muted-foreground"
              >
                <Search size={16} aria-hidden="true" />
                <span className="truncate">Chercher un matériau, un fournisseur…</span>
              </Link>
              {/* Le point de livraison a son grand bouton en tête de page (V2) :
                  ici, le raccourci vers la demande d'achat. */}
              <Link
                to="/demandes/nouvelle"
                className="cible-44 flex shrink-0 items-center rounded-full border border-primary/40 bg-primary-soft px-3.5 text-courant font-semibold text-primary-strong"
              >
                Je cherche…
              </Link>
            </div>

            <ul className="mt-3 flex gap-2 overflow-x-auto pb-0.5 lg:hidden" aria-label="Raccourcis">
              {RACCOURCIS_MOBILES.map((r) => (
                <li key={r.vers} className="shrink-0">
                  <Link
                    to={r.vers}
                    className="flex min-h-9 items-center rounded-full border border-border bg-card px-3.5 text-legende font-medium hover:bg-muted"
                  >
                    {r.intitule}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Filtrer le fil">
              {FILTRES.map(([valeur, intitule]) => (
                <button
                  key={valeur}
                  type="button"
                  aria-pressed={filtre === valeur}
                  onClick={() => {
                    const suite = new URLSearchParams(parametres);
                    if (valeur === "proche") suite.delete("f");
                    else suite.set("f", valeur);
                    setParametres(suite, { replace: true });
                  }}
                  className={
                    "min-h-9 shrink-0 rounded-full px-3.5 text-legende " +
                    (filtre === valeur
                      ? "bg-foreground font-semibold text-background"
                      : "border border-border bg-card")
                  }
                >
                  {intitule}
                </button>
              ))}
            </div>
          </div>

          {fil.isLoading
            ? [0, 1, 2].map((index) => (
                <div key={index} className="carte p-4" aria-busy="true">
                  <div className="mb-3 flex gap-3">
                    <Squelette className="size-11 shrink-0 rounded-md" />
                    <div className="flex-1 space-y-2 pt-1">
                      <Squelette className="h-3 w-2/5" />
                      <Squelette className="h-3 w-1/4" />
                    </div>
                  </div>
                  <Squelette className="aspect-[16/9] w-full" />
                </div>
              ))
            : null}

          {fil.isError ? (
            <EtatErreur
              message="Le fil n'a pas pu être chargé. Vérifiez votre connexion, puis réessayez."
              onReessayer={() => void fil.refetch()}
            />
          ) : null}

          {publications.length > 0 ? (
            <React.Suspense fallback={<Squelette className="h-64 w-full rounded-lg" />}>
              {publications.map((publication) => (
                <CartePublication key={publication.id} publication={publication} />
              ))}
            </React.Suspense>
          ) : null}

          {!fil.isLoading && !fil.isError && publications.length === 0 ? (
            <FilVide filtre={filtre} />
          ) : null}

          {fil.hasNextPage ? (
            <button
              type="button"
              onClick={() => void fil.fetchNextPage()}
              disabled={fil.isFetchingNextPage}
              className="cible-44 rounded-lg border border-border bg-card text-courant font-semibold disabled:opacity-60"
            >
              {fil.isFetchingNextPage ? "Chargement…" : "Voir plus"}
            </button>
          ) : null}
        </div>

      </div>

      {tiroirMonte ? (
        <React.Suspense fallback={null}>
          <TiroirPointSeul ouvert={tiroirOuvert} onOuvertChange={setTiroirOuvert} />
        </React.Suspense>
      ) : null}
    </>
  );
}

/**
 * Fil vide.
 *
 * Cet écran comptera longtemps : tant qu'aucun dépôt n'a publié, le fil est
 * vide, et un fil vide sans explication ressemble à un site cassé. On dit donc
 * franchement ce qui manque, et on propose la seule chose utile — aller voir
 * les matériaux, ou faire entrer un dépôt.
 */
function FilVide({ filtre }: { filtre: FiltreFil }) {
  const { session } = useAuth();

  if (filtre !== "proche") {
    return (
      <div className="carte border-dashed p-8 text-center">
        <p className="text-produit">Rien avec ce filtre</p>
        <p className="mx-auto mt-1 max-w-sm text-legende text-muted-foreground">
          {filtre === "suivis"
            ? session
              ? "Vous ne suivez encore aucun dépôt. Suivez-en un depuis sa page, et ses annonces arriveront ici."
              : "Connectez-vous pour suivre des dépôts et retrouver leurs annonces ici."
            : filtre === "verifies"
              ? "Aucune annonce de dépôt vérifié pour l'instant."
              : "Aucune baisse de prix annoncée pour l'instant."}
        </p>
        <Link
          to="/?f=proche"
          className="cible-44 mt-4 inline-flex items-center rounded-md border border-foreground px-4 text-courant font-semibold"
        >
          Voir tout le fil
        </Link>
      </div>
    );
  }

  return (
    <div className="carte border-dashed p-8 text-center">
      <p className="text-produit">Le fil est encore vide</p>
      <p className="mx-auto mt-1 max-w-md text-legende leading-relaxed text-muted-foreground">
        Akora ouvre avec ses premiers dépôts. Dès qu'un fournisseur annonce du stock, une baisse de
        prix ou une tournée de livraison, cela apparaît ici — avec le prix rendu à votre chantier,
        pas le prix au dépôt.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link
          to="/materiaux"
          className="cible-44 flex items-center rounded-md bg-primary px-4 text-courant font-bold text-primary-foreground"
        >
          Parcourir les matériaux
        </Link>
        <Link
          to="/demandes/nouvelle"
          className="cible-44 flex items-center rounded-md border border-foreground px-4 text-courant font-semibold"
        >
          Je cherche un matériau
        </Link>
        <Link
          to="/devenir-fournisseur"
          className="cible-44 flex items-center rounded-md border border-foreground px-4 text-courant font-semibold"
        >
          Vous vendez des matériaux ?
        </Link>
      </div>
    </div>
  );
}

/** Le panier, toujours visible sur grand écran : c'est la raison d'être du fil. */
