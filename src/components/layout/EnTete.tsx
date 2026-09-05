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
        <Link to="/" className="flex min-h-11 shrink-0 items-center" aria-label="Akora, accueil">
          <LogoAkora variante="logo" prioritaire className="h-9 w-auto" />
        </Link>

        {/* ⚠ CALCULÉ (03/09/2026). À 1024 px, 960 px sont disponibles : logo
            120 + six liens 600 + icône 44 + panier, point et bouton 225 +
            espaces 36 = 1 025. Ça déborde. Les liens de section ne viennent
            donc qu'à partir de 1024 px, les secondaires (`desLg`) à partir de
            1280 px ; entre 768 et 1023 px, la barre basse porte la navigation,
            comme sur téléphone, et le rail gauche porte tout dès 1024 px. */}
        <nav aria-label="Sections" className="hidden shrink-0 lg:flex lg:items-center lg:gap-1">
          {LIENS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "min-h-11 items-center rounded-md px-3 text-legende font-semibold",
                  l.desLg ? "hidden xl:inline-flex" : "inline-flex",
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted",
                )
              }
            >
              {l.libelle}
            </NavLink>
          ))}
        </nav>

        {/* ⚠ `min-w-0` (03/09/2026) : sans lui, le champ garde sa largeur intrinsèque
            et l'en-tête DÉBORDE de 162 px à 1024 px — six liens, le champ, le
            point, le panier et deux boutons ne tiennent qu'à condition que le
            champ rétrécisse. Mesuré entre 1024 et 1279 px. */}
        {/* ⚠ CALCULÉ À 1024 px (03/09/2026) : logo 120 + six liens 540 + point 44
            + panier 44 + deux boutons 236 + espaces = 1 044 px AVANT le champ.
            Entre 768 et 1279 px, le champ devient donc une icône (44 px) et
            « Se connecter » s'efface — il reste sur la page d'inscription et
            dans le menu Compte. Dès 1280 px, tout revient. */}
        <Link
          to="/recherche"
          aria-label="Rechercher"
          className="ml-auto hidden cible-44 items-center justify-center rounded-md text-foreground hover:bg-muted md:inline-flex xl:hidden"
        >
          <Search className="size-5" aria-hidden="true" />
        </Link>
        <form role="search" onSubmit={soumettre} className="ml-auto hidden min-w-0 max-w-md flex-1 sm:block md:hidden xl:block">
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

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          <PointEnTete />
          <Link
            to="/panier"
            className="relative hidden cible-44 items-center justify-center rounded-md text-foreground hover:bg-muted sm:inline-flex"
            aria-label={libellePanier}
          >
            <ShoppingCart className="size-5" aria-hidden="true" />
            {articles > 0 ? (
              <span
                key={articles}
                aria-hidden="true"
                className="pop-compteur nombres absolute right-1 top-1 min-w-[1.1rem] rounded-full bg-primary px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-primary-foreground"
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
              <Bouton variante="fantome" taille="compact" asChild className="hidden sm:inline-flex md:hidden xl:inline-flex">
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
