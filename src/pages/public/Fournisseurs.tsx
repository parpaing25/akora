import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Seo } from "@/components/Seo";
import { listerDepots, type TriAnnuaire } from "@/lib/donnees/annuaire";
import { listerFamilles } from "@/lib/donnees/categories";
import { usePointLivraison } from "@/lib/point-livraison";
import { CarteDepot } from "@/components/fournisseur/CarteDepot";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";

/**
 * L'annuaire des depots.
 *
 * On ne cherche pas un fournisseur par son nom — le connaitre d'avance
 * supposerait qu'on n'ait pas besoin de l'annuaire. On cherche qui vend un
 * materiau, pres de son chantier, et qui livre jusque-la. D'ou le filtrage par
 * FAMILLE de materiau vendu, et le filtre « livre chez moi », qui compare la
 * distance au rayon declare par le depot.
 *
 * Le filtrage par famille se fait en SQL ; la recherche libre, elle, reste
 * dans le navigateur : elle porte sur une liste deja chargee, et un
 * aller-retour par frappe ne se justifie pas.
 */
const TRIS: [TriAnnuaire, string][] = [
  ["distance", "Distance croissante"],
  ["note", "Mieux notés"],
  ["offres", "Plus grand catalogue"],
  ["nom", "Ordre alphabétique"],
];

function sansAccent(valeur: string): string {
  return valeur.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export default function Fournisseurs() {
  const { point } = usePointLivraison();
  const [famille, setFamille] = React.useState<string | null>(null);
  const [verifies, setVerifies] = React.useState(false);
  const [livreChezMoi, setLivreChezMoi] = React.useState(false);
  const [tri, setTri] = React.useState<TriAnnuaire>("distance");
  const [recherche, setRecherche] = React.useState("");

  const familles = useQuery({
    queryKey: ["familles"],
    queryFn: listerFamilles,
    staleTime: 30 * 60_000,
  });

  const depots = useQuery({
    queryKey: ["annuaire", point?.lat, point?.lng, famille, verifies, livreChezMoi, tri],
    queryFn: () =>
      listerDepots({
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
        famille,
        verifiesSeulement: verifies,
        livreChezMoi,
        tri,
      }),
    staleTime: 5 * 60_000,
  });

  // Sans point de livraison, trier par distance n'a pas de sens : on retombe
  // sur le catalogue, qui est au moins une information reelle.
  React.useEffect(() => {
    if (!point && tri === "distance") setTri("offres");
  }, [point, tri]);

  const liste = React.useMemo(() => {
    const tous = depots.data ?? [];
    const terme = sansAccent(recherche.trim());
    if (!terme) return tous;
    return tous.filter((d) =>
      sansAccent(
        [d.raison_sociale, d.metier ?? "", d.localite_nom ?? "", ...d.familles, ...d.types].join(" "),
      ).includes(terme),
    );
  }, [depots.data, recherche]);

  const tous = depots.data ?? [];
  const nbVerifies = tous.filter(
    (d) => d.niveau_verification === "verifie" || d.niveau_verification === "partenaire",
  ).length;
  const nbProches = tous.filter((d) => d.distance_km != null && d.distance_km <= 25).length;

  return (
    <div className="container py-6">
      <Seo
        titre="Fournisseurs de matériaux"
        chemin="/fournisseurs"
        description="L'annuaire des dépôts, briqueteries, carrières et scieries de Madagascar : ce qu'ils vendent, à partir de combien, et jusqu'où ils livrent."
      />

      <div className="carte p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 max-w-2xl">
            <h1 className="text-page">Fournisseurs</h1>
            <p className="mt-1 text-legende text-muted-foreground">
              Le badge n'est pas décoratif : carte fiscale, carte statistique, registre du commerce,
              pièce du gérant et photo du dépôt ont été examinés.{" "}
              <Link to="/verification" className="lien-souligne font-semibold">
                Ce que ça veut dire exactement
              </Link>
            </p>
          </div>
          <dl className="flex shrink-0 gap-6">
            <div>
              <dd className="nombres text-[1.375rem] font-bold">{tous.length}</dd>
              <dt className="text-legende text-muted-foreground">dépôts référencés</dt>
            </div>
            <div>
              <dd className="nombres text-[1.375rem] font-bold text-secondary-strong">{nbVerifies}</dd>
              <dt className="text-legende text-muted-foreground">vérifiés</dt>
            </div>
            {point ? (
              <div>
                <dd className="nombres text-[1.375rem] font-bold">{nbProches}</dd>
                <dt className="text-legende text-muted-foreground">à moins de 25 km</dt>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <Champ etiquette="Chercher un dépôt">
            {(attributs) => (
              <div className="flex min-h-11 items-center rounded-md border border-input bg-card">
                <Search size={16} className="ml-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Saisie
                  {...attributs}
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Nom du dépôt, commune, matériau vendu…"
                  className="border-0 bg-transparent focus-visible:ring-0"
                />
              </div>
            )}
          </Champ>
          <Champ etiquette="Trier par">
            {(attributs) => (
              <select
                {...attributs}
                value={tri}
                onChange={(e) => setTri(e.target.value as TriAnnuaire)}
                className="cible-44 w-full rounded-md border border-input bg-card px-3 text-courant"
              >
                {TRIS.filter(([valeur]) => valeur !== "distance" || point).map(([valeur, libelle]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))}
              </select>
            )}
          </Champ>
        </div>

        <div className="mt-4">
          <p className="nombres mb-2 text-[0.66rem] uppercase tracking-wider text-muted-foreground">
            Ce qu'ils vendent
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par famille de matériau">
            <button
              type="button"
              aria-pressed={famille === null}
              onClick={() => setFamille(null)}
              className={
                "min-h-9 rounded-full px-3.5 text-legende " +
                (famille === null
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "border border-border bg-card")
              }
            >
              Tout <span className="nombres">{tous.length}</span>
            </button>
            {(familles.data ?? []).map((f) => (
              <button
                key={f.slug}
                type="button"
                aria-pressed={famille === f.slug}
                onClick={() => setFamille(famille === f.slug ? null : f.slug)}
                className={
                  "min-h-9 rounded-full px-3.5 text-legende " +
                  (famille === f.slug
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "border border-border bg-card")
                }
              >
                {f.nom}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            aria-pressed={verifies}
            onClick={() => setVerifies((v) => !v)}
            className={
              "min-h-9 rounded-full px-3.5 text-legende " +
              (verifies ? "border border-secondary bg-secondary-soft font-semibold" : "border border-border bg-card")
            }
          >
            Vérifiés uniquement
          </button>
          <button
            type="button"
            aria-pressed={livreChezMoi}
            disabled={!point}
            onClick={() => setLivreChezMoi((v) => !v)}
            className={
              "min-h-9 rounded-full px-3.5 text-legende disabled:opacity-50 " +
              (livreChezMoi ? "border border-primary bg-primary-soft font-semibold" : "border border-border bg-card")
            }
          >
            Livre chez moi
          </button>
          <p className="ml-auto text-legende text-muted-foreground" aria-live="polite">
            <span className="nombres">{liste.length}</span> dépôt{liste.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="mt-3">
          <SelecteurPoint />
        </div>
      </div>

      {depots.isLoading ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Squelette key={i} className="h-80 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      {depots.isError ? (
        <div className="mt-5">
          <EtatErreur
            message="L'annuaire n'a pas pu être chargé."
            onReessayer={() => void depots.refetch()}
          />
        </div>
      ) : null}

      {depots.isSuccess && liste.length === 0 ? (
        <div className="mt-5">
          <EtatVide
            titre={
              tous.length === 0
                ? "Aucun dépôt référencé pour l'instant"
                : "Aucun dépôt ne correspond à ces filtres"
            }
            phrase={
              tous.length === 0
                ? "Akora ouvre avec ses premiers fournisseurs. Vous vendez des matériaux de gros œuvre ? La place est libre."
                : "Élargissez le rayon, retirez un filtre, ou cherchez une autre famille de matériau."
            }
          />
        </div>
      ) : null}

      <div className="entree mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {liste.map((depot) => (
          <CarteDepot key={depot.id} depot={depot} />
        ))}
      </div>

      <div className="carte mt-6 flex flex-wrap items-center justify-between gap-3 border-dashed p-4">
        <p className="max-w-xl text-legende text-muted-foreground">
          Vous tenez un dépôt, une briqueterie, une carrière ou une scierie ? Publiez votre stock
          dans le fil et recevez des commandes payées.
        </p>
        <Link
          to="/devenir-fournisseur"
          className="cible-44 flex shrink-0 items-center rounded-md bg-primary px-4 text-courant font-bold text-primary-foreground"
        >
          Devenir fournisseur
        </Link>
      </div>
    </div>
  );
}
