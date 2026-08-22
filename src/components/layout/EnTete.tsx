import * as React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Search, ShoppingCart, Menu, LogOut, LayoutDashboard, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePanier, nombreArticles } from "@/lib/panier";
import { Bouton } from "@/components/ui/button";
import { Saisie } from "@/components/ui/input";
import {
  Menu as MenuRacine,
  MenuContenu,
  MenuDeclencheur,
  MenuElement,
  MenuSeparateur,
} from "@/components/ui/dropdown-menu";
import { LogoAkora } from "@/components/marque/LogoAkora";

const LIENS = [
  { to: "/materiaux", libelle: "Matériaux" },
  { to: "/fournisseurs", libelle: "Fournisseurs" },
  { to: "/calculateurs", libelle: "Calculateurs" },
  { to: "/verification", libelle: "Vérifié ?" },
];

export function EnTete() {
  const { session, deconnexion, roles } = useAuth();
  const lignes = usePanier((etat) => etat.lignes);
  const articles = nombreArticles(lignes);
  const naviguer = useNavigate();
  const [recherche, setRecherche] = React.useState("");

  const soumettre = (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const q = recherche.trim();
    naviguer(q ? "/recherche?q=" + encodeURIComponent(q) : "/recherche");
  };

  const libellePanier = "Panier, " + articles + (articles > 1 ? " articles" : " article");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="container flex min-h-[3.5rem] items-center gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Akora, accueil">
          <LogoAkora className="size-8" />
          <span className="text-[1.05rem] font-bold tracking-tight">Akora</span>
        </Link>

        <nav aria-label="Sections" className="hidden lg:flex lg:items-center lg:gap-1">
          {LIENS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "inline-flex min-h-11 items-center rounded-md px-3 text-legende font-semibold",
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
                {articles > 99 ? "99+" : articles}
              </span>
            ) : null}
          </Link>

          {session ? (
            <MenuRacine>
              <MenuDeclencheur asChild>
                <Bouton variante="fantome" taille="icone" aria-label="Mon compte">
                  <Menu className="size-5" aria-hidden="true" />
                </Bouton>
              </MenuDeclencheur>
              <MenuContenu>
                <MenuElement asChild>
                  <Link to="/compte">Mon compte</Link>
                </MenuElement>
                <MenuElement asChild>
                  <Link to="/compte/commandes">Mes commandes</Link>
                </MenuElement>
                {roles.includes("fournisseur") ? (
                  <MenuElement asChild>
                    <Link to="/pro">
                      <LayoutDashboard className="size-4" aria-hidden="true" />
                      Espace fournisseur
                    </Link>
                  </MenuElement>
                ) : null}
                {roles.includes("admin") ? (
                  <MenuElement asChild>
                    <Link to="/admin">
                      <Shield className="size-4" aria-hidden="true" />
                      Administration
                    </Link>
                  </MenuElement>
                ) : null}
                <MenuSeparateur />
                <MenuElement onSelect={() => void deconnexion()}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Se déconnecter
                </MenuElement>
              </MenuContenu>
            </MenuRacine>
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
