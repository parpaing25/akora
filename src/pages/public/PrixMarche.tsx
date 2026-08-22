import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageTexte } from "@/components/PageTexte";
import { filAriane } from "@/components/Seo";
import { lireMateriauParSlug } from "@/lib/donnees/materiaux";
import { chercherLocalites } from "@/lib/donnees/localites";
import { listerFamilles } from "@/lib/donnees/categories";
import { lirePrixMarche } from "@/lib/donnees/prix-marche";
import { LIBELLE_UNITE } from "@/lib/types-metier";
import { formaterAriary, formaterDate } from "@/lib/format";
import { Carte } from "@/components/ui/card";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";
import { Bouton } from "@/components/ui/button";
import NonTrouve from "@/pages/NonTrouve";

/**
 * Page « prix du marché » : /prix/ciment/antananarivo.
 *
 * Construite depuis la vue `prix_marche`, publiée seulement à partir de trois
 * offres actives. En dessous du seuil, la page le dit et renvoie au
 * comparateur plutôt que d'afficher un chiffre qui n'en est pas un.
 */
export default function PrixMarche() {
  const { materiau: slugMateriau, ville } = useParams<{ materiau: string; ville: string }>();

  const materiau = useQuery({
    queryKey: ["materiau", slugMateriau],
    queryFn: () => lireMateriauParSlug(slugMateriau as string),
    enabled: Boolean(slugMateriau),
    staleTime: 30 * 60_000,
  });

  const localite = useQuery({
    queryKey: ["localite-slug", ville],
    queryFn: async () => {
      const trouvees = await chercherLocalites(String(ville).replace(/-/g, " "), 10);
      return trouvees.find((l) => l.slug === ville) ?? trouvees[0] ?? null;
    },
    enabled: Boolean(ville),
    staleTime: 30 * 60_000,
  });

  const prix = useQuery({
    queryKey: ["prix-marche", materiau.data?.id, localite.data?.id],
    queryFn: () => lirePrixMarche(materiau.data?.id as string, localite.data?.id as string),
    enabled: Boolean(materiau.data?.id && localite.data?.id),
    staleTime: 30 * 60_000,
  });

  const familles = useQuery({
    queryKey: ["familles"],
    queryFn: listerFamilles,
    staleTime: 30 * 60_000,
  });

  if ((materiau.isSuccess && !materiau.data) || (localite.isSuccess && !localite.data)) return <NonTrouve />;

  // Le lien vers le comparateur a besoin du slug de la famille, pas de son id.
  const familleSlug = (familles.data ?? []).find((f) => f.id === materiau.data?.categorie_id)?.slug;
  const lienComparateur =
    familleSlug && slugMateriau ? "/materiaux/" + familleSlug + "/" + slugMateriau : "/materiaux";

  const nom = materiau.data?.nom ?? "";
  const lieu = localite.data?.nom ?? "";
  const unite = materiau.data ? LIBELLE_UNITE[materiau.data.unite_defaut] : "";

  return (
    <PageTexte
      titre={nom && lieu ? `Prix du ${nom.toLowerCase()} à ${lieu}` : "Prix du marché"}
      chemin={"/prix/" + slugMateriau + "/" + ville}
      description={
        nom && lieu
          ? `Prix constatés du ${nom.toLowerCase()} à ${lieu} : minimum, médiane et maximum, relevés sur les offres actives d'Akora.`
          : undefined
      }
      donneesStructurees={filAriane([
        { nom: "Accueil", chemin: "/" },
        { nom: "Matériaux", chemin: "/materiaux" },
        { nom: nom || String(slugMateriau), chemin: "/prix/" + slugMateriau + "/" + ville },
      ])}
    >
      {materiau.isPending || prix.isPending ? (
        <Squelette className="h-40 w-full" />
      ) : !prix.data ? (
        <div className="not-prose">
          <EtatVide
            titre="Pas encore assez d'offres pour publier un prix"
            phrase="Akora ne publie une statistique qu'à partir de trois offres actives. En dessous, ce ne serait pas un prix de marché mais la vitrine d'un seul dépôt."
            action={
              <Bouton asChild>
                <Link to={"/materiaux"}>Voir les offres disponibles</Link>
              </Bouton>
            }
          />
        </div>
      ) : (
        <>
          <div className="not-prose grid grid-cols-3 gap-3">
            {[
              { libelle: "Le moins cher", valeur: Number(prix.data.prix_min) },
              { libelle: "Médiane", valeur: Number(prix.data.prix_median) },
              { libelle: "Le plus cher", valeur: Number(prix.data.prix_max) },
            ].map((tuile, index) => (
              <Carte key={tuile.libelle} className="p-3">
                <p
                  className={
                    "nombres text-[1.125rem] font-bold tracking-tight " +
                    (index === 1 ? "text-primary" : "text-foreground")
                  }
                >
                  {formaterAriary(tuile.valeur)}
                </p>
                <p className="mt-0.5 text-[0.78rem] text-muted-foreground">
                  {tuile.libelle} / {unite}
                </p>
              </Carte>
            ))}
          </div>

          <p className="mt-4">
            Relevé sur <strong className="nombres">{prix.data.nb_offres}</strong> offres actives à{" "}
            {lieu}, mis à jour le{" "}
            <span className="nombres">{formaterDate(prix.data.dernier_releve)}</span>.
          </p>

          <h2>Ces prix sont ceux du dépôt</h2>
          <p>
            Ils ne comprennent <strong>pas la livraison</strong>. Entre un dépôt à 5 km et un dépôt à
            40 km, le transport peut représenter plus que l'écart de prix affiché ci-dessus. C'est
            précisément pour ça qu'Akora existe.
          </p>
          <p className="not-prose mt-4">
            <Bouton asChild taille="large">
              <Link to={lienComparateur}>Comparer au prix rendu chantier</Link>
            </Bouton>
          </p>
        </>
      )}
    </PageTexte>
  );
}
