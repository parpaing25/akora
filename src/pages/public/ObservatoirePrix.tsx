import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Seo } from "@/components/Seo";
import { listerFamilles } from "@/lib/donnees/categories";
import { chercherLocalites, type Localite } from "@/lib/donnees/localites";
import { lireObservatoire } from "@/lib/donnees/prix-marche";
import { formaterAriary, formaterDate } from "@/lib/format";
import { Saisie } from "@/components/ui/input";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";
import { cn } from "@/lib/utils";

/**
 * L'observatoire des prix : /prix.
 *
 * Ce que vaut un matériau, région par région — médiane, min, max, nombre de
 * dépôts. Deux sources : les offres actives du site, et les relevés anonymisés
 * de la veille Akora sur les annonces publiques. La MÉDIANE, jamais la
 * moyenne : un prix de gros fausse une moyenne, pas une médiane.
 *
 * Un chiffre appuyé sur moins de trois dépôts est marqué « indicatif » : il
 * s'affiche, mais il ne se présente pas comme une référence (règle du bot).
 */
export default function ObservatoirePrix() {
  const [famille, setFamille] = React.useState<string | null>(null);
  const [localite, setLocalite] = React.useState<Localite | null>(null);
  const [saisieLieu, setSaisieLieu] = React.useState("");

  const familles = useQuery({ queryKey: ["familles"], queryFn: listerFamilles, staleTime: 30 * 60_000 });

  const lieux = useQuery({
    queryKey: ["localites-observatoire", saisieLieu],
    queryFn: () => chercherLocalites(saisieLieu, 8),
    enabled: saisieLieu.trim().length >= 2,
    staleTime: 5 * 60_000,
  });

  const lignes = useQuery({
    queryKey: ["observatoire", famille, localite?.slug ?? null],
    queryFn: () => lireObservatoire(famille, localite?.slug ?? null),
    staleTime: 5 * 60_000,
  });

  const chemin = "/prix";
  const titreLieu = localite ? localite.nom : "Madagascar";

  return (
    <div className="container py-6">
      <Seo
        titre={`Prix des matériaux de construction à ${titreLieu}`}
        chemin={chemin}
        description={`Prix du marché des matériaux de gros œuvre à ${titreLieu} : médiane, minimum et maximum par matériau, relevés sur les offres actives et la veille Akora.`}
      />

      <h1 className="text-page">Prix du marché — {titreLieu}</h1>
      <p className="mt-1 max-w-2xl text-legende text-muted-foreground">
        Médiane, minimum et maximum par matériau, calculés sur les offres actives d'Akora et les
        relevés anonymisés de notre veille. Un chiffre appuyé sur moins de trois dépôts est marqué
        « indicatif ».
      </p>

      {/* ── Choix du lieu ─────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setLocalite(null);
            setSaisieLieu("");
          }}
          className={cn(
            "min-h-9 rounded-full px-3.5 text-legende",
            localite === null
              ? "bg-foreground font-semibold text-background"
              : "border border-border bg-card",
          )}
        >
          Tout Madagascar
        </button>
        {localite ? (
          <span className="flex min-h-9 items-center gap-2 rounded-full bg-primary-soft px-3.5 text-legende font-semibold text-primary-strong">
            {localite.nom}
            <button type="button" onClick={() => setLocalite(null)} aria-label={`Retirer ${localite.nom}`}>
              ×
            </button>
          </span>
        ) : null}
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Saisie
            type="search"
            value={saisieLieu}
            onChange={(e) => setSaisieLieu(e.target.value)}
            placeholder="Région, commune ou quartier"
            aria-label="Chercher une région, une commune ou un quartier"
            className="pl-9"
          />
        </div>
      </div>
      {saisieLieu.trim().length >= 2 && (lieux.data ?? []).length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Lieux trouvés">
          {(lieux.data ?? []).map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => {
                  setLocalite(l);
                  setSaisieLieu("");
                }}
                className="min-h-9 rounded-full border border-border bg-card px-3.5 text-legende hover:bg-muted"
              >
                {l.nom} <span className="text-muted-foreground">· {l.type}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── Familles ──────────────────────────────────────────────────── */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Filtrer par famille">
        <button
          type="button"
          aria-pressed={famille === null}
          onClick={() => setFamille(null)}
          className={cn(
            "min-h-9 shrink-0 rounded-full px-3.5 text-legende",
            famille === null ? "bg-foreground font-semibold text-background" : "border border-border bg-card",
          )}
        >
          Toutes
        </button>
        {(familles.data ?? []).map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={famille === f.slug}
            onClick={() => setFamille(f.slug)}
            className={cn(
              "min-h-9 shrink-0 rounded-full px-3.5 text-legende",
              famille === f.slug ? "bg-foreground font-semibold text-background" : "border border-border bg-card",
            )}
          >
            {f.nom}
          </button>
        ))}
      </div>

      {/* ── Le tableau ────────────────────────────────────────────────── */}
      <div className="mt-4" aria-live="polite">
        {lignes.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Squelette key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : lignes.isError ? (
          <EtatErreur onReessayer={() => void lignes.refetch()} />
        ) : (lignes.data ?? []).length === 0 ? (
          <EtatVide
            titre={`Aucun prix relevé ${localite ? "à " + localite.nom : "pour l'instant"}`}
            phrase="L'observatoire se remplit au fil des offres publiées et de la veille Akora. Élargissez le lieu, ou revenez bientôt."
          />
        ) : (
          <>
          {/* ── Téléphone : une carte par matériau ──────────────────────────
              ⚠ Le tableau impose 640 px : à 390 il DÉBORDAIT, « Min – max »
                et « Dépôts » coupés, et la page entière défilait de côté.
                Un tableau de six colonnes ne se lit pas sur un téléphone ;
                on empile ce qu'il dit, dans le même ordre d'importance :
                le matériau, la médiane en gros, puis le reste en légende. */}
          <ul className="divide-y divide-border/60 sm:hidden" aria-label="Prix par matériau">
            {(lignes.data ?? []).map((ligne) => (
              <li key={ligne.materiau_ref_id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    to={`/prix/${ligne.materiau_slug}/${localite?.slug ?? "madagascar"}`}
                    className="cible-44 inline-flex items-center font-semibold hover:underline"
                  >
                    {ligne.materiau_nom}
                  </Link>
                  <p className="nombres text-legende text-muted-foreground">
                    {formaterAriary(ligne.prix_min)} – {formaterAriary(ligne.prix_max)} · {ligne.nb_depots}{" "}
                    dépôt{ligne.nb_depots > 1 ? "s" : ""} · {formaterDate(ligne.dernier_releve)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="nombres text-[1.125rem] font-bold text-primary-strong">
                    {formaterAriary(ligne.prix_median)}
                  </p>
                  <p className="text-legende text-muted-foreground">/ {ligne.unite}</p>
                  {ligne.fiable ? null : (
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[0.75rem] font-medium text-muted-foreground">
                      indicatif
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] border-collapse text-legende">
              <caption className="sr-only">
                Prix du marché par matériau à {titreLieu} : médiane, minimum, maximum, nombre de
                dépôts et date du dernier relevé.
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-[0.8125rem] uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-semibold">Matériau</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Médiane</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Min – max</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Dépôts</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Relevé</th>
                  <th scope="col" className="py-2 font-semibold">
                    <span className="sr-only">Fiabilité</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(lignes.data ?? []).map((ligne) => (
                  <tr key={ligne.materiau_ref_id} className="ligne-survol border-b border-border/60">
                    <td className="py-2.5 pr-3">
                      <Link
                        to={`/prix/${ligne.materiau_slug}/${localite?.slug ?? "madagascar"}`}
                        className="font-semibold hover:underline"
                      >
                        {ligne.materiau_nom}
                      </Link>
                      <span className="ml-1.5 text-muted-foreground">/ {ligne.unite}</span>
                    </td>
                    <td className="nombres py-2.5 pr-3 text-right font-bold text-primary-strong">
                      {formaterAriary(ligne.prix_median)}
                    </td>
                    <td className="nombres py-2.5 pr-3 text-right text-muted-foreground">
                      {formaterAriary(ligne.prix_min)} – {formaterAriary(ligne.prix_max)}
                    </td>
                    <td className="nombres py-2.5 pr-3 text-right">{ligne.nb_depots}</td>
                    <td className="nombres py-2.5 pr-3">{formaterDate(ligne.dernier_releve)}</td>
                    <td className="py-2.5">
                      {ligne.fiable ? null : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.75rem] font-medium text-muted-foreground">
                          indicatif
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <div className="mt-6 max-w-2xl rounded-md border border-border bg-muted/40 p-4 text-legende text-muted-foreground">
        <p className="font-semibold text-foreground">D'où viennent ces chiffres ?</p>
        <p className="mt-1">
          Des offres actives publiées sur Akora et des prix relevés par notre veille sur les
          annonces publiques, anonymisés — jamais un nom, jamais un numéro. Pour chaque dépôt, seul
          son dernier prix compte. Ces prix s'entendent <strong>au dépôt, hors livraison</strong> :
          pour comparer livraison comprise, ouvrez un matériau et indiquez où livrer.
        </p>
      </div>
    </div>
  );
}
