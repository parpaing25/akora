import * as React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { MapPin, Search, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePanier, nombreProduits } from "@/lib/panier";
import { usePointLivraison } from "@/lib/point-livraison";
import { Bouton } from "@/components/ui/button";
import { Saisie } from "@/components/ui/input";
import { LogoAkora } from "@/components/marque/LogoAkora";
// Chargés à la demande : un visiteur non connecté ne les voit jamais, et ils
// tiraient Radix et le canal Realtime dans le chunk d'entrée.
const Notifications = React.lazy(() =>
  import("./Notifications").then((m) => ({ default: m.Notifications })),
);
const MenuCompte = React.lazy(() => import("./MenuCompte"));
// Le tiroir du point de livraison traîne la carte et Radix : il n'est monté
// qu'au premier clic, jamais au chargement de l'en-tête.
const TiroirPointSeul = React.lazy(() =>
  import("@/components/livraison/SelecteurPoint").then((m) => ({ default: m.TiroirPointSeul })),
);

/*
 * `desLg` : visible seulement à partir de 1024 px. La nav apparaît dès 768 px
 * (audit 01/09 : entre 640 et 1023 px il n'y avait AUCUNE navigation), mais à
 * cette largeur on ne montre que l'essentiel.
 */
const LIENS = [
  { to: "/materiaux", libelle: "Matériaux", desLg: false },
  { to: "/fournisseurs", libelle: "Fournisseurs", desLg: false },
  { to: "/transporteurs", libelle: "Transporteurs", desLg: false },
  { to: "/prix", libelle: "Prix du marché", desLg: true },
  { to: "/calculateurs", libelle: "Calculateurs", desLg: true },
  { to: "/verification", libelle: "Vérifié ?", desLg: true },
];

/**
 * Le point de livraison, toujours à portée de main : tout prix affiché sur le
 * site en dépend, et il fallait jusqu'ici retrouver une page qui l'expose.
 * Bouton léger ; le tiroir (carte comprise) ne se charge qu'au premier clic.
 */
function PointEnTete() {
  const { point } = usePointLivraison();
  const [monte, setMonte] = React.useState(false);
  const [ouvert, setOuvert] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMonte(true);
          setOuvert(true);
        }}
        className="hidden cible-44 items-center gap-1.5 rounded-md px-2 text-legende font-semibold text-foreground hover:bg-muted md:inline-flex"
        aria-label={point ? `Point de livraison : ${point.libelle}. Modifier` : "Choisir où livrer"}
      >
        <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="hidden max-w-[9rem] truncate xl:inline">
          {point ? point.libelle : "Où livrer ?"}
        </span>
      </button>
      {monte ? (
        <React.Suspense fallback={null}>
          <TiroirPointSeul ouvert={ouvert} onOuvertChange={setOuvert} />
        </React.Suspense>
      ) : null}
    </>
  );
}

export function EnTete() {
  const { session } = useAuth();
  const lignes = usePanier((etat) => etat.lignes);
  // Le nombre de PRODUITS, pas la somme des quantites : 1 200 briques
  // saturaient la pastille des le premier ajout.
  const articles = nombreProduits(lignes);
  const naviguer = useNavigate();
  const [recherche, setRecherche] = React.useState("");

  const soumettre = (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const q = recherche.trim();
    naviguer(q ? "/recherche?q=" + encodeURIComponent(q) : "/recherche");
  };

  const libellePanier = "Panier, " + articles + (articles > 1 ? " produits" : " produit");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="container flex min-h-[3.5rem] items-center gap-3">
        <Link to="/" className="flex shrink-0 items-center" aria-label="Akora, accueil">
          <LogoAkora variante="logo" prioritaire className="h-9 w-auto" />
        </Link>

        <nav aria-label="Sections" className="hidden md:flex md:items-center md:gap-1">
          {LIENS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "min-h-11 items-center rounded-md px-3 text-legende font-semibold",
                  l.desLg ? "hidden lg:inline-flex" : "inline-flex",
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted",
                )
              }
            >
              {l.libelle}
            </NavLink>
          ))}
        </nav>

        <form role="search" onSubmit={soumettre} className="ml-auto hidden max-w-md flex-1 sm:block">
          <label htmlFor="recherche-entete" className="sr-only">
            Rechercher un matériau ou un fournisseur
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Saisie
              id="recherche-entete"
              type="search"
              value={recherche}
              onChange={(evenement) => setRecherche(evenement.target.value)}
              placeholder="Ciment, parpaing 15, tôle"
              className="pl-9"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <PointEnTete />
          <Link
            to="/panier"
            className="relative hidden cible-44 items-center justify-center rounded-md text-foreground hover:bg-muted sm:inline-flex"
            aria-label={libellePanier}
          >
            <ShoppingCart className="size-5" aria-hidden="true" />
            {articles > 0 ? (
              <span
                aria-hidden="true"
                className="nombres absolute right-1 top-1 min-w-[1.1rem] rounded-full bg-primary px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-primary-foreground"
              >
                {articles}
              </span>
            ) : null}
          </Link>

          {session ? (
            <React.Suspense fallback={<span className="cible-44" aria-hidden="true" />}>
              <Notifications />
              <MenuCompte />
            </React.Suspense>
          ) : (
            <>
              <Bouton variante="fantome" taille="compact" asChild className="hidden sm:inline-flex">
                <Link to="/connexion">Se connecter</Link>
              </Bouton>
              <Bouton taille="compact" asChild>
                <Link to="/inscription">Créer un compte</Link>
              </Bouton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
