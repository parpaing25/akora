import { Link } from "react-router-dom";
import { LogoAkora } from "@/components/marque/LogoAkora";

const COLONNES = [
  {
    titre: "Acheter",
    liens: [
      { to: "/materiaux", libelle: "Tous les matériaux" },
      { to: "/fournisseurs", libelle: "Annuaire des fournisseurs" },
      { to: "/transporteurs", libelle: "Trouver un camion" },
      { to: "/prix", libelle: "Prix du marché" },
      { to: "/demandes/nouvelle", libelle: "Publier une demande d'achat" },
      { to: "/calculateurs", libelle: "Calculateurs de métré" },
    ],
  },
  {
    titre: "Vendre",
    liens: [
      { to: "/devenir-fournisseur", libelle: "Devenir fournisseur" },
      { to: "/verification", libelle: "Que veut dire « vérifié » ?" },
      { to: "/guides/payer-mobile-money", libelle: "Paiement mobile money" },
      { to: "/guides/reception-livraison", libelle: "Réceptionner une livraison" },
      { to: "/guides/choisir-son-sable", libelle: "Bien choisir son sable" },
      { to: "/guides/combien-de-parpaings", libelle: "Compter ses parpaings" },
    ],
  },
  {
    titre: "Akora",
    liens: [
      { to: "/a-propos", libelle: "À propos" },
      { to: "/contact", libelle: "Contact" },
      { to: "/conditions-utilisation", libelle: "Conditions d'utilisation" },
      { to: "/politique-confidentialite", libelle: "Confidentialité" },
      { to: "/mentions-legales", libelle: "Mentions légales" },
    ],
  },
];

export function PiedDePage() {
  return (
    <footer className="mt-12 border-t border-border bg-card">
      <div className="container grid gap-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <LogoAkora variante="logo" className="h-9 w-auto" />
          <p className="mt-2 max-w-xs text-legende text-muted-foreground">
            Le prix rendu chantier, pas le prix au dépôt. Matériaux de gros œuvre, fournisseurs
            vérifiés, livraison calculée au kilomètre.
          </p>
        </div>

        {COLONNES.map((colonne) => (
          <nav key={colonne.titre} aria-label={colonne.titre}>
            <h2 className="text-legende font-semibold uppercase tracking-wide text-muted-foreground">
              {colonne.titre}
            </h2>
            <ul className="mt-2 space-y-1">
              {colonne.liens.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="inline-flex min-h-11 items-center text-legende hover:underline">
                    {l.libelle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <p className="container py-4 text-[0.78rem] text-muted-foreground">
          Akora — Antananarivo, Madagascar. Paiement par MVola, Orange Money et Airtel Money.
          Aucune donnée de carte bancaire n'est collectée.
        </p>
      </div>
    </footer>
  );
}
