import * as React from "react";
import { Link, NavLink } from "react-router-dom";
import { MapPin, ShieldCheck, ShoppingCart } from "lucide-react";
import { usePointLivraison } from "@/lib/point-livraison";
import { usePanier, totalProduits } from "@/lib/panier";
import { formaterAriary } from "@/lib/format";
import { cn } from "@/lib/utils";

// Le tiroir du point de livraison (carte comprise) ne se charge qu'au clic.
const TiroirPointSeul = React.lazy(() =>
  import("@/components/livraison/SelecteurPoint").then((m) => ({ default: m.TiroirPointSeul })),
);

/**
 * Les deux colonnes latérales du site (03/09/2026, demande d'Andry : « les
 * barres latérales gauche et droite ne doivent pas disparaître lorsqu'on
 * entre dans les matériaux ou autre »).
 *
 * Elles vivaient dans l'accueil seul : dès qu'on cliquait une famille, la
 * navigation et le panier disparaissaient, et il fallait remonter au fil pour
 * les retrouver. Elles appartiennent à la COQUILLE, comme l'en-tête — et elles
 * restent en vue au défilement (`sticky`).
 *
 * ⚠ Largeurs calculées, pas choisies. Rail gauche 260 px dès 1024 px ; rail
 *   droit 340 px dès 1280 px seulement : à 1024 px, les deux ensemble ne
 *   laisseraient que 372 px à une page de matériaux, moins qu'un téléphone.
 *   À 1280 la colonne centrale garde 592 px ; à 1920, 1 128 px.
 */
export const LIENS_NAVIGATION = [
  { vers: "/", intitule: "Mon fil", exact: true },
  { vers: "/materiaux", intitule: "Matériaux" },
  { vers: "/fournisseurs", intitule: "Fournisseurs" },
  { vers: "/transporteurs", intitule: "Transporteurs" },
  { vers: "/prix", intitule: "Prix du marché" },
  { vers: "/demandes/nouvelle", intitule: "Je cherche un matériau" },
  { vers: "/compte/favoris", intitule: "Favoris" },
  { vers: "/calculateurs", intitule: "Calculateurs" },
  { vers: "/compte/commandes", intitule: "Mes commandes" },
] as const;

export function RailGauche({ className }: { className?: string }) {
  return (
    <nav aria-label="Navigation du site" className={cn("flex flex-col gap-4", className)}>
      <ul className="carte p-2">
        {LIENS_NAVIGATION.map((lien) => (
          <li key={lien.vers}>
            <NavLink
              to={lien.vers}
              end={"exact" in lien && lien.exact}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-courant",
                  isActive ? "bg-primary-soft font-semibold text-primary-strong" : "hover:bg-muted",
                )
              }
            >
              {lien.intitule}
            </NavLink>
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
  );
}

export function RailDroit({ className }: { className?: string }) {
  const { point } = usePointLivraison();
  const [tiroirMonte, setTiroirMonte] = React.useState(false);
  const [tiroirOuvert, setTiroirOuvert] = React.useState(false);
  const ouvrirTiroir = () => {
    setTiroirMonte(true);
    setTiroirOuvert(true);
  };

  return (
    <aside aria-label="Panier et repères" className={cn("flex flex-col gap-4", className)}>
      <RecapPanier />

      <div className="carte p-4">
        <p className="text-produit">Livraison à {point ? point.libelle : "définir"}</p>
        <p className="mb-3 mt-1 text-legende text-muted-foreground">
          Le fil et les prix rendus sont calculés depuis ce point.
        </p>
        <button
          type="button"
          onClick={ouvrirTiroir}
          className="cible-44 flex w-full items-center justify-center gap-2 rounded-md border border-foreground text-courant font-semibold"
        >
          <MapPin className="size-4" aria-hidden="true" />
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

      {tiroirMonte ? (
        <React.Suspense fallback={null}>
          <TiroirPointSeul ouvert={tiroirOuvert} onOuvertChange={setTiroirOuvert} />
        </React.Suspense>
      ) : null}
    </aside>
  );
}

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
      <p className="mt-1 text-[0.75rem] text-muted-foreground">
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
