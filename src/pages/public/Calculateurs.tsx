import { Link } from "react-router-dom";
import { Calculator, Layers, Blocks, Home, PaintRoller } from "lucide-react";
import { Seo, filAriane } from "@/components/Seo";

const OUTILS = [
  {
    slug: "mur-parpaings",
    titre: "Mur en parpaings",
    texte: "Combien de blocs, de ciment et de sable pour un mur de longueur et de hauteur données.",
    Icone: Blocks,
  },
  {
    slug: "dalle-hourdis",
    titre: "Dalle en hourdis",
    texte: "Poutrelles, hourdis, treillis et béton de table pour une dalle.",
    Icone: Layers,
  },
  {
    slug: "beton",
    titre: "Béton dosé à 350",
    texte: "La composition exacte d'un volume de béton : ciment, sable, gravillon, eau.",
    Icone: Calculator,
  },
  {
    slug: "chape-enduit",
    titre: "Chape et enduit",
    texte: "Le mortier nécessaire selon la surface et l'épaisseur.",
    Icone: PaintRoller,
  },
  {
    slug: "toiture",
    titre: "Toiture en tôles",
    texte: "Tôles, chevrons, pannes et faîtières pour une couverture.",
    Icone: Home,
  },
];

/** Les cinq calculateurs de métré (spec B11). */
export default function Calculateurs() {
  return (
    <div className="container py-6">
      <Seo
        titre="Calculateurs de métré"
        chemin="/calculateurs"
        description="Combien de parpaings pour votre mur, combien de ciment pour votre dalle. Cinq calculateurs qui remplissent votre panier au prix rendu chantier."
        donneesStructurees={filAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Calculateurs", chemin: "/calculateurs" },
        ])}
      />

      <h1 className="text-page">Calculateurs de métré</h1>
      <p className="mt-1 max-w-prose text-legende text-muted-foreground">
        Transformez un ouvrage en liste de courses, puis remplissez votre panier en un clic — au
        prix rendu chantier, pas au prix au dépôt. Ce sont des estimations, hors chutes et pertes,
        avec une marge de sécurité que vous réglez.
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {OUTILS.map((outil) => (
          <li key={outil.slug}>
            <Link
              to={"/calculateurs/" + outil.slug}
              className="carte filet-primaire flex h-full flex-col p-4 hover:bg-muted/40"
            >
              <outil.Icone className="size-5 text-primary" aria-hidden="true" />
              <h2 className="mt-2 text-produit">{outil.titre}</h2>
              <p className="mt-1 text-legende text-muted-foreground">{outil.texte}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
