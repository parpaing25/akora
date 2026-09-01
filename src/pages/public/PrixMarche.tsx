import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageTexte } from "@/components/PageTexte";
import { filAriane } from "@/components/Seo";
import { lireFormat } from "@/lib/donnees/referentiel";
import { lireMateriauParSlug } from "@/lib/donnees/materiaux";
import { lireLocaliteParSlug } from "@/lib/donnees/localites";
import { lireObservatoire } from "@/lib/donnees/prix-marche";
import { LIBELLE_UNITE } from "@/lib/types-metier";
import { formaterAriary, formaterDate } from "@/lib/format";
import { Carte } from "@/components/ui/card";
import { Squelette } from "@/components/ui/skeleton";
import { AvertissementMetier, EtatVide } from "@/components/ui/etats";
import { Bouton } from "@/components/ui/button";
import NonTrouve from "@/pages/NonTrouve";

/**
 * Page « prix du marché » : /prix/ciment-42-5/antananarivo — ou
 * /prix/ciment-42-5/madagascar pour la statistique nationale.
 *
 * Construite depuis la RPC `observatoire_prix` : offres actives du site +
 * relevés anonymisés de la veille, médiane par matériau, remontée
 * quartier → commune → région. Moins de trois dépôts : le chiffre s'affiche
 * quand même, marqué « indicatif » — il ne sert pas d'argument. Faute de tout
 * relevé, la fourchette indicative sourcée du référentiel prend le relais.
 *
 * Le lieu se résout par slug EXACT : l'ancienne recherche floue affichait
 * silencieusement la mauvaise commune quand le slug manquait (audit 01/09).
 */
export default function PrixMarche() {
  const { materiau: slugMateriau, ville } = useParams<{ materiau: string; ville: string }>();
  const national = ville === "madagascar";

  const materiau = useQuery({
    queryKey: ["materiau", slugMateriau],
    queryFn: () => lireMateriauParSlug(slugMateriau as string),
    enabled: Boolean(slugMateriau),
    staleTime: 30 * 60_000,
  });

  const localite = useQuery({
    queryKey: ["localite-slug", ville],
    queryFn: () => lireLocaliteParSlug(String(ville)),
    enabled: Boolean(ville) && !national,
    staleTime: 30 * 60_000,
  });

  const observatoire = useQuery({
    queryKey: ["observatoire", null, national ? null : ville],
    queryFn: () => lireObservatoire(null, national ? null : (ville as string)),
    enabled: Boolean(slugMateriau) && (national || Boolean(localite.data)),
    staleTime: 5 * 60_000,
  });
  const prix = observatoire.data?.find((l) => l.materiau_slug === slugMateriau) ?? null;

  const format = useQuery({
    queryKey: ["format", slugMateriau],
    queryFn: () => lireFormat(slugMateriau as string),
    enabled: Boolean(slugMateriau),
    staleTime: 30 * 60_000,
  });

  if ((materiau.isSuccess && !materiau.data) || (!national && localite.isSuccess && !localite.data))
    return <NonTrouve />;

  // Le comparateur vit sous /materiaux/:famille/:type/:format. La famille
  // seule ne suffit plus : le format porte lui-meme les trois segments.
  const lienComparateur =
    format.data
      ? `/materiaux/${format.data.famille_slug}/${format.data.type_slug}/${format.data.slug}`
      : "/materiaux";

  const nom = materiau.data?.nom ?? "";
  const lieu = national ? "Madagascar" : (localite.data?.nom ?? "");
  const unite = materiau.data ? LIBELLE_UNITE[materiau.data.unite_defaut] : "";

  // Le repli : la fourchette indicative sourcée du référentiel (déjà affichée
  // sur la page du type), quand aucun relevé n'existe encore ici.
  const indicatif =
    format.data && format.data.prix_indicatif_min != null && format.data.prix_indicatif_max != null
      ? {
          min: Number(format.data.prix_indicatif_min),
          max: Number(format.data.prix_indicatif_max),
          source: format.data.prix_indicatif_source,
          date: format.data.prix_indicatif_le,
        }
      : null;

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
      {materiau.isPending || observatoire.isPending ? (
        <Squelette className="h-40 w-full" />
      ) : !prix && indicatif ? (
        <>
          <div className="not-prose grid grid-cols-2 gap-3">
            {[
              { libelle: "Fourchette basse", valeur: indicatif.min },
              { libelle: "Fourchette haute", valeur: indicatif.max },
            ].map((tuile) => (
              <Carte key={tuile.libelle} className="p-3">
                <p className="nombres text-[1.125rem] font-bold tracking-tight text-foreground">
                  {formaterAriary(tuile.valeur)}
                </p>
                <p className="mt-0.5 text-[0.78rem] text-muted-foreground">
                  {tuile.libelle} / {unite}
                </p>
              </Carte>
            ))}
          </div>
          <p className="mt-4">
            Aucun relevé de terrain ici pour l'instant : ceci est l'
            <strong>ordre de grandeur documenté publiquement</strong>
            {indicatif.source ? <> ({indicatif.source})</> : null}
            {indicatif.date ? (
              <>
                , au <span className="nombres">{formaterDate(indicatif.date)}</span>
              </>
            ) : null}
            . Dès que trois dépôts publient ou sont relevés, la vraie statistique prend sa place.
          </p>
          <p className="not-prose mt-4">
            <Bouton asChild taille="large">
              <Link to={lienComparateur}>Comparer les offres au prix rendu chantier</Link>
            </Bouton>
          </p>
        </>
      ) : !prix ? (
        <div className="not-prose">
          <EtatVide
            titre="Pas encore de prix relevé ici"
            phrase={`Aucune offre active et aucun relevé de veille pour ce matériau ${national ? "" : "à " + lieu} pour l'instant. L'observatoire se remplit au fil de la collecte.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Bouton asChild>
                  <Link to={"/prix"}>Voir l'observatoire complet</Link>
                </Bouton>
                <Bouton asChild variante="secondaire">
                  <Link to={"/materiaux"}>Voir les offres disponibles</Link>
                </Bouton>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {!prix.fiable ? (
            <div className="not-prose mb-3">
              <AvertissementMetier titre="Chiffre indicatif">
                Moins de trois dépôts relevés : ce prix s'affiche à titre indicatif, ce n'est pas
                encore une référence de marché.
              </AvertissementMetier>
            </div>
          ) : null}
          <div className="not-prose grid grid-cols-3 gap-3">
            {[
              { libelle: "Le moins cher", valeur: Number(prix.prix_min) },
              { libelle: "Médiane", valeur: Number(prix.prix_median) },
              { libelle: "Le plus cher", valeur: Number(prix.prix_max) },
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
            Relevé sur <strong className="nombres">{prix.nb_depots}</strong> dépôt
            {prix.nb_depots > 1 ? "s" : ""} {national ? "à travers Madagascar" : `à ${lieu}`} —
            offres actives d'Akora et veille anonymisée — mis à jour le{" "}
            <span className="nombres">{formaterDate(prix.dernier_releve)}</span>. Pour chaque
            dépôt, seul son dernier prix compte.
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
