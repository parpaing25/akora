import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo, filAriane } from "@/components/Seo";
import { listerFormats, type FormatVitrine } from "@/lib/donnees/referentiel";
import { useLivraison } from "@/hooks/useLivraison";
import { usePointLivraison } from "@/lib/point-livraison";
import { formaterAriary } from "@/lib/format";
import { RechercheMateriaux } from "@/components/materiaux/RechercheMateriaux";
import { useGrandEcran } from "@/hooks/useGrandEcran";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur } from "@/components/ui/etats";
import NonTrouve from "@/pages/NonTrouve";

/**
 * Niveau 3 — les FORMATS d'un type, cote a cote.
 *
 * La colonne « rendu dès » est la raison d'etre de cette page : a la piece, un
 * hourdis 20 coute a peine plus qu'un 12 ; livre, il coute bien plus, parce
 * qu'il remplit le camion deux fois plus vite. Comparer les prix au depot,
 * c'est comparer des chiffres qui ne veulent rien dire.
 *
 * L'estimation part de l'offre la MOINS CHERE de chaque format — celle qui
 * fixe le « dès ». Le calcul est pur : aucun aller-retour reseau, seuls les
 * baremes du depot sont charges.
 */
const QUANTITE_REFERENCE = 100;

export default function TypeMateriau() {
  const { famille: familleSlug, type: typeSlug } = useParams<{ famille: string; type: string }>();
  const { point } = usePointLivraison();
  const grandEcran = useGrandEcran();

  const formats = useQuery({
    queryKey: ["formats", typeSlug],
    queryFn: () => listerFormats(typeSlug as string),
    enabled: Boolean(typeSlug),
    staleTime: 10 * 60_000,
  });

  const liste = React.useMemo(() => formats.data ?? [], [formats.data]);

  // Une entree de livraison par format qui a une offre : la meme fonction que
  // le panier et le simulateur, jamais une copie.
  const entrees = React.useMemo(
    () =>
      liste
        .filter((f) => f.offre_fournisseur_id && f.prix_des != null)
        .map((f) => ({
          fournisseurId: `${f.offre_fournisseur_id}::${f.id}`,
          rayonMaxKm: Number(f.offre_rayon_max_km ?? 0),
          coefSinuosite: f.offre_coef_sinuosite,
          depart:
            f.offre_lat != null && f.offre_lng != null
              ? { lat: Number(f.offre_lat), lng: Number(f.offre_lng) }
              : null,
          lignes: [
            {
              quantite: QUANTITE_REFERENCE,
              poids_kg_unite: Number(f.poids_kg_unite),
              volume_m3_unite: Number(f.volume_m3_unite),
            },
          ],
          montantProduits: Number(f.prix_des) * QUANTITE_REFERENCE,
        })),
    [liste],
  );

  const livraisons = useLivraison(entrees);

  /** Prix rendu à l'unité, ou null si on ne peut pas l'estimer honnêtement. */
  const rendu = React.useCallback(
    (f: FormatVitrine): { parUnite: number; rotations: number } | null => {
      if (!f.offre_fournisseur_id || f.prix_des == null) return null;
      const resultat = livraisons.get(`${f.offre_fournisseur_id}::${f.id}`);
      if (!resultat) return null;
      const cout = resultat.statut === "estimee" ? resultat.cout : resultat.statut === "offerte" ? 0 : null;
      if (cout === null) return null;
      return {
        parUnite: (Number(f.prix_des) * QUANTITE_REFERENCE + cout) / QUANTITE_REFERENCE,
        rotations: resultat.statut === "estimee" || resultat.statut === "offerte" ? resultat.detail.rotations : 1,
      };
    },
    [livraisons],
  );

  if (formats.isSuccess && liste.length === 0) return <NonTrouve />;

  const premier = liste[0];
  const nomType = premier?.type_nom ?? "…";
  const nomFamille = premier?.famille_nom ?? "Matériaux";

  const entete = (
    <>
      <nav
        aria-label="Fil d'Ariane"
        className="mb-2 flex flex-wrap items-center gap-2 text-legende text-muted-foreground"
      >
        <Link to="/materiaux" className="lien-souligne">
          Matériaux
        </Link>
        <span aria-hidden="true">›</span>
        <Link to={`/materiaux/${familleSlug}`} className="lien-souligne">
          {nomFamille}
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-foreground">{nomType}</span>
      </nav>

      <h1 className="text-page">{nomType}</h1>
      <p className="mt-1 max-w-2xl text-legende text-muted-foreground">
        <span className="nombres">{liste.length}</span> format
        {liste.length > 1 ? "s" : ""} au référentiel
        {point ? (
          <>
            {" · "}
            <span className="font-semibold text-primary">prix rendu à {point.libelle}</span>
          </>
        ) : (
          " · indiquez où livrer pour voir le prix rendu chantier"
        )}
      </p>

      <div className="mt-4 max-w-xl">
        <RechercheMateriaux
          portee={typeSlug}
          etiquette={`Chercher un format de ${nomType.toLowerCase()}`}
          placeholder="12, 15, 20…"
        />
      </div>
    </>
  );

  const explication = (
    <p className="carte mt-5 border-l-4 border-l-primary p-4 text-legende leading-relaxed text-muted-foreground">
      <strong className="font-semibold text-foreground">
        Le prix rendu dépend du volume, pas seulement du prix à la pièce.
      </strong>{" "}
      Un hourdis 20 remplit le camion deux fois plus vite qu'un 12 : à quantité égale, il faut plus
      de rotations. La colonne « rendu dès » en tient déjà compte, pour{" "}
      <span className="nombres">{QUANTITE_REFERENCE}</span> pièces livrées
      {point ? ` à ${point.libelle}` : ""}.
    </p>
  );

  if (formats.isLoading) {
    return (
      <div className="container py-6">
        <Squelette className="h-8 w-1/3" />
        <Squelette className="mt-4 h-64 w-full" />
      </div>
    );
  }

  if (formats.isError) {
    return (
      <div className="container py-6">
        <EtatErreur
          message="Les formats n'ont pas pu être chargés."
          onReessayer={() => void formats.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="container py-6">
      <Seo
        titre={`${nomType} — prix et fournisseurs`}
        chemin={`/materiaux/${familleSlug}/${typeSlug}`}
        description={`Tous les formats de ${nomType.toLowerCase()} disponibles à Madagascar, avec le prix rendu chantier calculé depuis votre adresse.`}
        donneesStructurees={filAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Matériaux", chemin: "/materiaux" },
          { nom: nomFamille, chemin: `/materiaux/${familleSlug}` },
          { nom: nomType, chemin: `/materiaux/${familleSlug}/${typeSlug}` },
        ])}
      />
      {entete}

      {grandEcran ? (
        <div className="carte mt-5 overflow-x-auto p-0">
          <table className="w-full min-w-[52rem] border-collapse">
            <caption className="sr-only">
              Formats de {nomType}, prix au dépôt et prix rendu chantier
            </caption>
            <thead>
              <tr className="bg-foreground text-background">
                <th scope="col" className="px-4 py-3 text-left text-legende font-semibold">Format</th>
                <th scope="col" className="px-4 py-3 text-left text-legende font-semibold">Dimensions</th>
                <th scope="col" className="px-4 py-3 text-left text-legende font-semibold">Poids · volume</th>
                <th scope="col" className="px-4 py-3 text-right text-legende font-semibold">Prix dépôt dès</th>
                <th scope="col" className="px-4 py-3 text-right text-legende font-semibold">
                  Rendu dès · {QUANTITE_REFERENCE} pcs
                </th>
                <th scope="col" className="px-4 py-3 text-left text-legende font-semibold">Offres</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {liste.map((f) => {
                const estimation = rendu(f);
                return (
                  <tr key={f.id} className="ligne-survol border-t border-border">
                    <th scope="row" className="px-4 py-3 text-left align-top">
                      <span className="block text-courant font-semibold">{f.libelle_court ?? f.nom}</span>
                      {f.note ? (
                        <span className="block text-[0.75rem] text-muted-foreground">{f.note}</span>
                      ) : null}
                    </th>
                    <td className="nombres px-4 py-3 align-top text-legende text-muted-foreground">
                      {f.dimensions ?? "—"}
                    </td>
                    <td className="nombres px-4 py-3 align-top text-legende text-muted-foreground">
                      {Number(f.poids_kg_unite)} kg · {Number(f.volume_m3_unite)} m³
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      {f.prix_des != null ? (
                        <span className="nombres text-courant font-semibold">
                          {formaterAriary(f.prix_des)}
                        </span>
                      ) : f.prix_indicatif_min != null ? (
                        // Une fourchette relevee publiquement, pas une offre :
                        // elle ne se commande pas et n'entre dans aucun calcul
                        // de prix rendu. Elle dit l'ordre de grandeur, et d'ou
                        // il vient.
                        <span title={f.prix_indicatif_source ?? undefined}>
                          <span className="nombres block text-courant text-muted-foreground">
                            {formaterAriary(f.prix_indicatif_min)} à{" "}
                            {formaterAriary(f.prix_indicatif_max ?? f.prix_indicatif_min)}
                          </span>
                          <span className="block text-[0.75rem] text-muted-foreground">
                            indicatif, relevé le{" "}
                            {f.prix_indicatif_le
                              ? new Date(f.prix_indicatif_le).toLocaleDateString("fr-FR")
                              : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      <Link
                        to={`/prix/${f.slug}/madagascar`}
                        className="lien-souligne mt-0.5 block text-[0.75rem]"
                      >
                        Prix du marché
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      {estimation ? (
                        <>
                          <span className="nombres block text-produit text-primary">
                            {formaterAriary(estimation.parUnite)}
                          </span>
                          <span className="block text-[0.75rem] text-muted-foreground">
                            / {f.unite} rendue · {estimation.rotations} rotation
                            {estimation.rotations > 1 ? "s" : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-legende text-muted-foreground">
                          {f.nb_offres === 0
                            ? "Aucune offre"
                            : point
                              ? "Livraison à convenir"
                              : "Indiquez où livrer"}
                        </span>
                      )}
                    </td>
                    <td className="nombres px-4 py-3 align-top text-legende text-muted-foreground">
                      {f.nb_offres} · dont {f.nb_offres_verifiees} vérifiées
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <Link
                        to={`/materiaux/${familleSlug}/${typeSlug}/${f.slug}`}
                        className={
                          "cible-44 inline-flex items-center rounded-md px-3.5 text-courant font-semibold " +
                          (f.nb_offres > 0
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground")
                        }
                      >
                        Comparer
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {liste.map((f) => {
            const estimation = rendu(f);
            return (
              <li key={f.id} className="carte carte-vivante p-4">
                <p className="text-produit">{f.libelle_court ?? f.nom}</p>
                <p className="nombres text-legende text-muted-foreground">
                  {f.dimensions ?? "—"} · {Number(f.poids_kg_unite)} kg · {Number(f.volume_m3_unite)} m³
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border p-2.5">
                    <p className="text-[0.75rem] text-muted-foreground">
                      {f.prix_des != null ? "Dépôt dès" : "Indicatif"}
                    </p>
                    <p className="nombres text-produit">
                      {f.prix_des != null
                        ? formaterAriary(f.prix_des)
                        : f.prix_indicatif_min != null
                          ? `${formaterAriary(f.prix_indicatif_min)}–${formaterAriary(f.prix_indicatif_max ?? f.prix_indicatif_min)}`
                          : "—"}
                    </p>
                  </div>
                  <div className="rounded-md border border-primary bg-primary-soft p-2.5">
                    <p className="text-[0.75rem] text-muted-foreground">
                      Rendu dès · {QUANTITE_REFERENCE} pcs
                    </p>
                    <p className="nombres text-produit text-primary">
                      {estimation ? formaterAriary(estimation.parUnite) : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="nombres text-legende text-muted-foreground">
                    {f.nb_offres} offre{f.nb_offres > 1 ? "s" : ""} · {f.nb_offres_verifiees} vérifiée
                    {f.nb_offres_verifiees > 1 ? "s" : ""}
                  </p>
                  <Link
                    to={`/materiaux/${familleSlug}/${typeSlug}/${f.slug}`}
                    className={
                      "cible-44 flex items-center rounded-md px-3.5 text-courant font-semibold " +
                      (f.nb_offres > 0
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground")
                    }
                  >
                    Comparer
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {explication}
    </div>
  );
}
