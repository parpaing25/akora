import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { MapPin, Search, ShieldCheck, ShoppingCart } from "lucide-react";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import { usePointLivraison } from "@/lib/point-livraison";
import { usePanier, totalProduits } from "@/lib/panier";
import { formaterAriary } from "@/lib/format";
import { chargerFil, TAILLE_PAGE, type FiltreFil } from "@/lib/donnees/fil";

import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur } from "@/components/ui/etats";

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

const LIENS_NAVIGATION = [
  { vers: "/", intitule: "Mon fil" },
  { vers: "/materiaux", intitule: "Matériaux" },
  { vers: "/fournisseurs", intitule: "Fournisseurs" },
  { vers: "/transporteurs", intitule: "Transporteurs" },
  { vers: "/prix", intitule: "Prix du marché" },
  { vers: "/demandes/nouvelle", intitule: "Je cherche un matériau" },
  { vers: "/compte/favoris", intitule: "Favoris" },
  { vers: "/calculateurs", intitule: "Calculateurs" },
  { vers: "/compte/commandes", intitule: "Mes commandes" },
];

/**
 * Raccourcis pour les écrans SANS colonnes latérales (< 1024 px) : sans eux,
 * l'accueil mobile se réduisait au fil — ni Fournisseurs, ni Calculateurs,
 * ni demande d'achat n'étaient accessibles (audit 01/09).
 */
const RACCOURCIS_MOBILES = [
  { vers: "/fournisseurs", intitule: "Fournisseurs" },
  { vers: "/transporteurs", intitule: "Transporteurs" },
  { vers: "/prix", intitule: "Prix du marché" },
  { vers: "/calculateurs", intitule: "Calculateurs" },
  { vers: "/demandes/nouvelle", intitule: "Je cherche un matériau" },
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

      {/*
        Pleine largeur, et non le gabarit de 1400 px d'AKORA-DESIGN §9.
        Écart demandé et assumé : un fil se lit en colonnes, et sur un écran
        large les 1400 px laissaient deux bandes vides pendant que la colonne
        centrale étouffait. Le cap de 2100 px reste, parce qu'au-delà une ligne
        de texte devient illisible — on élargit les colonnes latérales, pas la
        lecture.
      */}
      <div className="mx-auto grid w-full max-w-[2100px] items-start gap-5 px-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)_340px] lg:px-6 2xl:grid-cols-[300px_minmax(0,1fr)_380px] 2xl:gap-6 2xl:px-8">
        {/* ── Colonne gauche : navigation ─────────────────────────────── */}
        <nav aria-label="Navigation du fil" className="hidden flex-col gap-4 lg:flex">
          <ul className="carte p-2">
            {LIENS_NAVIGATION.map((lien) => (
              <li key={lien.vers}>
                <Link
                  to={lien.vers}
                  aria-current={lien.vers === "/" ? "page" : undefined}
                  className={
                    "flex min-h-11 items-center gap-3 rounded-md px-3 text-courant " +
                    (lien.vers === "/"
                      ? "bg-primary-soft font-semibold text-primary-strong"
                      : "hover:bg-muted")
                  }
                >
                  {lien.intitule}
                </Link>
              </li>
            ))}
          </ul>

          <div className="rounded-lg bg-foreground p-4 text-background">
            <p className="mb-1.5 text-produit">Vous vendez des matériaux ?</p>
            <p className="mb-3 text-legende leading-relaxed text-background/75">
              Publiez votre stock dans le fil et recevez des commandes payées.
            </p>
            <Link
              to="/devenir-fournisseur"
              className="cible-44 flex items-center justify-center rounded-md bg-background text-courant font-bold text-foreground"
            >
              Devenir fournisseur
            </Link>
          </div>
        </nav>

        {/* ── Colonne centrale : le fil ───────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          {!session ? (
            <section className="rounded-lg bg-gradient-to-br from-primary to-primary-strong p-5 text-primary-foreground">
              <h1 className="text-section">Le prix rendu chantier, pas le prix au dépôt.</h1>
              <p className="mt-1.5 max-w-xl text-courant text-primary-foreground/90">
                Le sable le moins cher à la carrière n'est presque jamais le moins cher une fois
                livré. Ici, les dépôts vérifiés annoncent leur stock, et chaque prix est calculé
                livraison comprise depuis votre chantier.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/inscription"
                  className="cible-44 flex items-center rounded-md bg-background px-4 text-courant font-bold text-foreground"
                >
                  Créer un compte
                </Link>
                <Link
                  to="/materiaux"
                  className="cible-44 flex items-center rounded-md border border-primary-foreground/40 px-4 text-courant font-semibold"
                >
                  Voir les matériaux
                </Link>
              </div>
            </section>
          ) : null}

          <div className="carte p-3.5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Link
                to="/recherche"
                className="cible-44 flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-input bg-muted/60 px-4 text-courant text-muted-foreground"
              >
                <Search size={16} aria-hidden="true" />
                <span className="truncate">Chercher un matériau, un fournisseur…</span>
              </Link>
              {/* Ce bouton OUVRE le choix du point — il ne navigue plus vers
                  /materiaux en laissant croire qu'il fait autre chose. */}
              <button
                type="button"
                onClick={ouvrirTiroir}
                className="cible-44 flex shrink-0 items-center gap-2 rounded-full border border-primary/40 bg-primary-soft px-3.5 text-courant font-semibold"
              >
                <MapPin size={15} className="text-primary" aria-hidden="true" />
                {point ? point.libelle : "Choisir où livrer"}
              </button>
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

        {/* ── Colonne droite : panier et repères ──────────────────────── */}
        <aside aria-label="Panier et repères" className="hidden flex-col gap-4 lg:flex">
          <RecapPanier />

          <div className="carte p-4">
            <p className="text-produit">Livraison à {point ? point.libelle : "définir"}</p>
            <p className="mb-3 mt-1 text-legende text-muted-foreground">
              Le fil et les prix rendus sont calculés depuis ce point.
            </p>
            <button
              type="button"
              onClick={ouvrirTiroir}
              className="cible-44 flex w-full items-center justify-center rounded-md border border-foreground text-courant font-semibold"
            >
              {point ? "Changer de point" : "Choisir où livrer"}
            </button>
          </div>

          <div className="rounded-lg border border-primary/25 bg-primary-soft p-4">
            <p className="mb-1 flex items-center gap-2 text-produit">
              <ShieldCheck size={16} aria-hidden="true" />
              Le badge veut dire quelque chose
            </p>
            <p className="mb-2.5 text-legende leading-relaxed text-muted-foreground">
              NIF, STAT, RCS, identité du gérant et photo du dépôt contrôlés avant l'attribution.
            </p>
            <Link to="/verification" className="lien-souligne text-legende font-semibold">
              Que veut dire vérifié ?
            </Link>
          </div>
        </aside>
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
function RecapPanier() {
  const lignes = usePanier((etat) => etat.lignes);
  const montant = totalProduits(lignes);
  const fournisseurs = new Set(lignes.map((ligne) => ligne.fournisseurId)).size;

  if (lignes.length === 0) {
    return (
      <div className="carte p-4">
        <p className="flex items-center gap-2 text-produit">
          <ShoppingCart size={17} aria-hidden="true" /> Mon panier
        </p>
        <p className="mt-1 text-legende text-muted-foreground">Vide pour l'instant.</p>
      </div>
    );
  }

  return (
    <div className="carte p-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <p className="text-produit">Mon panier</p>
        <p className="text-legende text-muted-foreground">
          {fournisseurs} fournisseur{fournisseurs > 1 ? "s" : ""}
        </p>
      </div>
      <dl aria-live="polite" className="space-y-2 text-legende">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Produits</dt>
          <dd className="nombres">{formaterAriary(montant)}</dd>
        </div>
        <div className="flex justify-between gap-2 border-t border-border pt-2 text-courant font-bold">
          <dt>Total produits</dt>
          <dd className="nombres">{formaterAriary(montant)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[0.72rem] text-muted-foreground">
        La livraison s'ajoute au panier, une fois le point de chantier connu.
      </p>
      <Link
        to="/panier"
        className="cible-44 mt-3 flex items-center justify-center rounded-md bg-primary text-courant font-bold text-primary-foreground"
      >
        Voir mon panier
      </Link>
    </div>
  );
}
