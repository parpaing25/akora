import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Seo, filAriane } from "@/components/Seo";
import { lireMateriauParSlug } from "@/lib/donnees/materiaux";
import { listerPaliersGroupes, listerProduits } from "@/lib/donnees/vitrine";
import { construireLigne, demonstration, trierLignes, type CritereTri } from "@/lib/comparateur";
import { departFournisseur, versLignePanier } from "@/lib/adaptateurs";
import { useLivraison } from "@/hooks/useLivraison";
import { usePanier } from "@/lib/panier";
import { formaterAriary, formaterDistance } from "@/lib/format";
import { LIBELLE_UNITE } from "@/lib/types-metier";
import { cn } from "@/lib/utils";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { Prix } from "@/components/produit/Prix";
import { Bouton } from "@/components/ui/button";
import { Curseur } from "@/components/ui/slider";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";
import NonTrouve from "@/pages/NonTrouve";

const TRIS: { cle: CritereTri; libelle: string }[] = [
  { cle: "rendu", libelle: "Prix rendu" },
  { cle: "prix_unitaire", libelle: "Prix dépôt" },
  { cle: "distance", libelle: "Distance" },
  { cle: "note", libelle: "Note" },
  { cle: "verification", libelle: "Vérification" },
];

export default function Comparateur() {
  // Trois segments desormais : /materiaux/:famille/:type/:format. Le
  // comparateur reste le dernier niveau — celui ou les fournisseurs se font
  // face sur une meme reference.
  const { famille, type, format } = useParams<{ famille: string; type: string; format: string }>();
  const ajouter = usePanier((e) => e.ajouter);
  const [quantite, setQuantite] = React.useState(100);
  const [tri, setTri] = React.useState<CritereTri>("rendu");
  const [verifiesUniquement, setVerifies] = React.useState(false);

  const materiau = useQuery({
    queryKey: ["materiau", format],
    queryFn: () => lireMateriauParSlug(format as string),
    enabled: Boolean(format),
    staleTime: 30 * 60_000,
  });

  const produits = useQuery({
    queryKey: ["offres", materiau.data?.id, verifiesUniquement],
    queryFn: () => listerProduits({ materiauRefId: materiau.data?.id as string, verifiesUniquement }),
    enabled: Boolean(materiau.data?.id),
    staleTime: 60_000,
  });

  const paliers = useQuery({
    queryKey: ["paliers-offres", (produits.data ?? []).map((p) => p.id).join(",")],
    queryFn: () => listerPaliersGroupes((produits.data ?? []).map((p) => p.id as string)),
    enabled: (produits.data ?? []).length > 0,
    staleTime: 5 * 60_000,
  });

  const entrees = React.useMemo(
    () =>
      (produits.data ?? []).map((p) => ({
        fournisseurId: p.fournisseur_id as string,
        rayonMaxKm: Number(p.fournisseur_rayon_max_km ?? 40),
        coefSinuosite: p.fournisseur_coef_sinuosite == null ? null : Number(p.fournisseur_coef_sinuosite),
        depart: departFournisseur(p),
        lignes: [
          {
            quantite,
            poids_kg_unite: Number(p.poids_kg_unite),
            volume_m3_unite: Number(p.volume_m3_unite),
          },
        ],
        montantProduits: Math.round(Number(p.prix_promo ?? p.prix_unitaire) * quantite),
      })),
    [produits.data, quantite],
  );

  const livraisons = useLivraison(entrees);

  const lignes = React.useMemo(() => {
    const brutes = (produits.data ?? []).map((p) =>
      construireLigne(
        p,
        paliers.data?.get(p.id as string) ?? [],
        quantite,
        livraisons.get(p.fournisseur_id as string) ?? null,
      ),
    );
    return trierLignes(brutes, tri);
  }, [produits.data, paliers.data, quantite, livraisons, tri]);

  const demo = React.useMemo(() => demonstration(lignes), [lignes]);
  const unite = materiau.data ? LIBELLE_UNITE[materiau.data.unite_defaut] : "";

  if (materiau.isSuccess && !materiau.data) return <NonTrouve />;

  return (
    <div className="container py-6">
      {materiau.data ? (
        <Seo
          titre={materiau.data.nom}
          chemin={`/materiaux/${famille}/${type}/${format}`}
          description={`Comparez ${lignes.length} fournisseur(s) de ${materiau.data.nom.toLowerCase()} au prix rendu chantier, livraison comprise.`}
          donneesStructurees={filAriane([
            { nom: "Accueil", chemin: "/" },
            { nom: "Matériaux", chemin: "/materiaux" },
            { nom: String(famille), chemin: `/materiaux/${famille}` },
            { nom: String(type), chemin: `/materiaux/${famille}/${type}` },
            { nom: materiau.data.nom, chemin: `/materiaux/${famille}/${type}/${format}` },
          ])}
        />
      ) : null}

      <nav aria-label="Fil d'Ariane" className="text-legende text-muted-foreground">
        <Link to="/materiaux" className="hover:underline">
          Matériaux
        </Link>
        <ChevronRight className="mx-1 inline size-3.5" aria-hidden="true" />
        <Link to={`/materiaux/${famille}`} className="hover:underline">
          {famille}
        </Link>
        <ChevronRight className="mx-1 inline size-3.5" aria-hidden="true" />
        <Link to={`/materiaux/${famille}/${type}`} className="hover:underline">
          {type}
        </Link>
      </nav>

      <h1 className="mt-1 text-page">{materiau.data?.nom ?? <Squelette className="h-8 w-72" />}</h1>
      <p className="mt-1 text-legende text-muted-foreground" aria-live="polite">
        <span className="nombres">{lignes.length}</span> offre{lignes.length > 1 ? "s" : ""} · prix rendu
        chantier, livraison comprise
      </p>

      <div className="mt-3">
        <SelecteurPoint />
      </div>

      <div className="mt-3 rounded-md bg-muted p-3">
        <label htmlFor="quantite-comparateur" className="text-legende font-semibold">
          Quantité : <span className="nombres">{quantite}</span> {unite}
        </label>
        <Curseur
          id="quantite-comparateur"
          className="mt-1"
          min={1}
          max={2000}
          step={quantite < 100 ? 1 : 10}
          value={[quantite]}
          onValueChange={(v) => setQuantite(v[0] ?? 1)}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TRIS.map((t) => (
            <button
              key={t.cle}
              type="button"
              onClick={() => setTri(t.cle)}
              aria-pressed={tri === t.cle}
              className={cn(
                "min-h-11 rounded-full border px-3 text-legende font-semibold",
                tri === t.cle
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {t.libelle}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setVerifies((v) => !v)}
            aria-pressed={verifiesUniquement}
            className={cn(
              "min-h-11 rounded-full border px-3 text-legende font-semibold",
              verifiesUniquement
                ? "border-secondary bg-secondary-soft text-secondary-strong"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            Vérifiés uniquement
          </button>
        </div>
      </div>

      {produits.isPending ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Squelette key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : produits.isError ? (
        <div className="mt-4">
          <EtatErreur onReessayer={() => void produits.refetch()} />
        </div>
      ) : lignes.length === 0 ? (
        <div className="mt-4">
          <EtatVide
            titre="Aucun fournisseur ne vend encore ce matériau"
            phrase={
              verifiesUniquement
                ? "Le filtre « vérifiés uniquement » écarte peut-être des offres."
                : "Revenez bientôt : le catalogue se remplit dépôt par dépôt."
            }
            action={
              verifiesUniquement ? (
                <Bouton variante="secondaire" onClick={() => setVerifies(false)}>
                  Voir toutes les offres
                </Bouton>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-4 w-full overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full border-collapse text-legende">
              <caption className="sr-only">
                Comparaison des fournisseurs au prix rendu chantier pour {quantite} {unite}
              </caption>
              <thead className="bg-foreground text-background [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-foreground">
                    Fournisseur
                  </th>
                  <th scope="col">Prix dépôt</th>
                  <th scope="col">Distance</th>
                  <th scope="col">Véhicule</th>
                  <th scope="col">Livraison</th>
                  <th scope="col">Rendu chantier</th>
                  <th scope="col">
                    <span className="sr-only">Ajouter</span>
                  </th>
                </tr>
              </thead>
              <tbody className="[&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle [&_tr]:border-t [&_tr]:border-border">
                {lignes.map((ligne, index) => (
                  <LigneOffre
                    key={ligne.produit.id as string}
                    ligne={ligne}
                    premiere={index === 0 && ligne.rendu !== null}
                    quantite={quantite}
                    unite={unite}
                    onAjouter={() => {
                      ajouter(
                        versLignePanier(ligne.produit, paliers.data?.get(ligne.produit.id as string) ?? []),
                        quantite,
                      );
                      toast.success("Ajouté au panier");
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {demo ? (
            <aside className="carte filet-primaire mt-4 p-4">
              <h2 className="text-produit">Le moins cher au dépôt n'est pas le moins cher rendu chantier</h2>
              <p className="mt-1 max-w-prose text-legende">
                Pour {quantite} {unite},{" "}
                <strong>{demo.moinsCherDepot.produit.fournisseur_nom as string}</strong> affiche le prix
                le plus bas au dépôt —{" "}
                <span className="nombres">{formaterAriary(demo.moinsCherDepot.prixUnitaire)}</span> le{" "}
                {unite}. Une fois livré, c'est pourtant{" "}
                <strong>{demo.moinsCherRendu.produit.fournisseur_nom as string}</strong> qui revient le
                moins cher :{" "}
                <span className="nombres font-semibold text-primary">
                  {formaterAriary(demo.moinsCherRendu.rendu ?? 0)}
                </span>{" "}
                contre <span className="nombres">{formaterAriary(demo.moinsCherDepot.rendu ?? 0)}</span>.
                Soit <span className="nombres font-semibold">{formaterAriary(demo.ecart)}</span> d'écart,
                entièrement dû au transport.
              </p>
            </aside>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Une ligne du tableau. Extraite pour garder le tableau lisible. */
function LigneOffre({
  ligne,
  premiere,
  quantite,
  unite,
  onAjouter,
}: {
  ligne: ReturnType<typeof construireLigne>;
  premiere: boolean;
  quantite: number;
  unite: string;
  onAjouter: () => void;
}) {
  const p = ligne.produit;
  const l = ligne.livraison;
  return (
    <tr className={cn(premiere && "bg-primary-soft")}>
      <th
        scope="row"
        className={cn(
          "sticky left-0 z-10 px-3 py-2.5 text-left font-normal",
          premiere ? "bg-primary-soft" : "bg-card",
        )}
      >
        <span className="flex items-center gap-1.5">
          <BadgeVerification niveau={p.fournisseur_niveau as never} compact />
          <Link to={"/fournisseurs/" + p.fournisseur_slug} className="font-semibold hover:underline">
            {p.fournisseur_nom as string}
          </Link>
        </span>
        <span className="mt-0.5 block text-[0.78rem] text-muted-foreground">{p.nom_affiche as string}</span>
      </th>
      <td data-nombre="">{formaterAriary(ligne.prixUnitaire)}</td>
      <td data-nombre="">{ligne.distanceKm == null ? "—" : formaterDistance(ligne.distanceKm)}</td>
      <td className="text-muted-foreground">
        {l?.statut === "estimee" || l?.statut === "offerte"
          ? l.detail.vehicule.nom + (l.detail.rotations > 1 ? " ×" + l.detail.rotations : "")
          : "—"}
      </td>
      <td data-nombre="">
        {l?.statut === "offerte" ? (
          <span className="font-semibold text-success-strong">Offerte</span>
        ) : l?.statut === "estimee" ? (
          formaterAriary(l.cout)
        ) : l?.statut === "hors_zone" ? (
          <span className="text-accent-strong">Hors zone</span>
        ) : l?.statut === "retrait_sur_place" ? (
          <span className="text-muted-foreground">Retrait</span>
        ) : (
          "—"
        )}
      </td>
      <td>
        {ligne.rendu === null ? (
          <span className="text-muted-foreground">à négocier</span>
        ) : (
          <span className="block">
            <Prix montant={ligne.rendu} rendu taille="normal" />
            <span className="nombres block text-[0.78rem] text-muted-foreground">
              {formaterAriary(ligne.renduParUnite ?? 0)} / {unite} rendu
            </span>
          </span>
        )}
      </td>
      <td>
        <div className="flex justify-end">
          <button
            type="button"
            aria-label={"Ajouter " + quantite + " " + unite + " chez " + p.fournisseur_nom}
            className="inline-flex cible-44 items-center justify-center rounded-md bg-primary text-primary-foreground shadow hover:bg-primary/90"
            onClick={onAjouter}
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}
