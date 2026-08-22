import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Bouton } from "@/components/ui/button";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur } from "@/components/ui/etats";
import { listerFamilles } from "@/lib/donnees/categories";
import { iconeFamille } from "@/lib/icones-familles";

/**
 * Accueil. Chargée en dur (pas en lazy) : c'est la page du LCP.
 * Le bandeau est un dégradé latérite — le seul dégradé autorisé (§1) — donc
 * aucune image n'est sur le chemin critique du premier rendu.
 */
export default function Accueil() {
  const familles = useQuery({ queryKey: ["familles"], queryFn: listerFamilles, staleTime: 30 * 60_000 });

  return (
    <>
      <Seo
        titre="Akora"
        chemin="/"
        description="Comparez les fournisseurs de matériaux de construction au prix rendu chantier. Livraison calculée depuis votre adresse, paiement MVola, Orange Money, Airtel Money."
      />

      <section className="bg-gradient-to-br from-primary to-primary-strong text-primary-foreground">
        <div className="container py-10 lg:py-16">
          <h1 className="max-w-2xl text-page">Le prix rendu chantier, pas le prix au dépôt.</h1>
          <p className="mt-3 max-w-xl text-[1.0625rem] leading-relaxed text-primary-foreground/90">
            Le sable le moins cher à la carrière n'est presque jamais le moins cher une fois livré.
            Akora compare les fournisseurs vérifiés matériau par matériau, livraison comprise,
            depuis l'adresse de votre chantier.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Bouton asChild taille="large" variante="secondaire">
              <Link to="/materiaux">
                Comparer les matériaux
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Bouton>
            <Bouton
              asChild
              taille="large"
              variante="fantome"
              className="border border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/devenir-fournisseur">Vendre sur Akora</Link>
            </Bouton>
          </div>
        </div>
      </section>

      <section className="container py-8" aria-labelledby="titre-familles">
        <h2 id="titre-familles" className="text-section">
          Les huit familles de gros œuvre
        </h2>
        <p className="mt-1 text-legende text-muted-foreground">
          Akora ne vend que du gros œuvre. Ni quincaillerie, ni plomberie, ni finitions.
        </p>

        {familles.isPending ? (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Squelette key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : familles.isError ? (
          <div className="mt-4">
            <EtatErreur onReessayer={() => void familles.refetch()} />
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {familles.data.map((famille) => {
              const Icone = iconeFamille(famille.icone);
              return (
                <li key={famille.id}>
                  <Link
                    to={"/materiaux/" + famille.slug}
                    className="carte filet-primaire flex h-full min-h-24 flex-col justify-between p-3 hover:bg-muted/40"
                  >
                    <Icone className="size-5 text-primary" aria-hidden="true" />
                    <span className="mt-2 text-produit leading-snug">{famille.nom}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="container pb-10" aria-labelledby="titre-methode">
        <h2 id="titre-methode" className="text-section">
          Comment ça marche
        </h2>
        <ol className="mt-4 grid gap-3 lg:grid-cols-3">
          {[
            {
              Icone: MapPin,
              titre: "1. Dites où livrer",
              texte:
                "Cherchez votre commune, utilisez votre position ou pointez sur la carte. Sans coordonnées, Akora n'estime rien plutôt que d'inventer un prix.",
            },
            {
              Icone: ShieldCheck,
              titre: "2. Comparez rendu chantier",
              texte:
                "Chaque offre affiche le prix du matériau, la livraison calculée au kilomètre et le total livré, ramené au prix par unité rendue.",
            },
            {
              Icone: Wallet,
              titre: "3. Payez, l'argent est retenu",
              texte:
                "Vous payez par mobile money. Akora garde la somme en séquestre et ne la verse au fournisseur qu'après votre confirmation de livraison.",
            },
          ].map((etape) => (
            <li key={etape.titre} className="carte p-4">
              <etape.Icone className="size-5 text-primary" aria-hidden="true" />
              <h3 className="mt-2 text-produit">{etape.titre}</h3>
              <p className="mt-1 text-legende text-muted-foreground">{etape.texte}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
