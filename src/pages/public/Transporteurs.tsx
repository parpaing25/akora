import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { Seo } from "@/components/Seo";
import {
  listerTransporteurs,
  LIBELLE_CATEGORIE_VEHICULE,
  type TransporteurPublic,
  type VehiculeTransporteur,
} from "@/lib/donnees/transporteurs";
import { formaterAriary } from "@/lib/format";
import { haversine } from "@/lib/livraison";
import { usePointLivraison } from "@/lib/point-livraison";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { IllustrationCamion } from "@/components/motion/IllustrationCamion";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { Carte } from "@/components/ui/card";
import { GrilleSquelettes } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";
import { Bouton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * L'annuaire des transporteurs : /transporteurs.
 *
 * Trouver un camion pour ses gravillons doit être aussi simple que trouver un
 * parpaing. Un transporteur est un fournisseur comme un autre — sa marchandise
 * est sa benne. Chaque camion affiche ce que son propriétaire a annoncé :
 * catégorie, « X roues », capacité, tarif. Jamais de capacité déduite du
 * nombre de roues (règle A2.8 : aucune donnée inventée).
 */
export default function Transporteurs() {
  const [categorie, setCategorie] = React.useState<string | null>(null);
  const { point } = usePointLivraison();

  const transporteurs = useQuery({
    queryKey: ["transporteurs"],
    queryFn: listerTransporteurs,
    staleTime: 5 * 60_000,
  });

  // Distance route jusqu'au chantier (même règle que partout : vol d'oiseau
  // × coefficient de sinuosité 1,3), puis les plus proches d'abord. Sans
  // point ni coordonnées, pas de distance — et pas d'invention.
  const filtres = React.useMemo(() => {
    const tous = (transporteurs.data ?? []).map((t) => ({
      t,
      distance:
        point && t.lat != null && t.lng != null
          ? haversine({ lat: Number(t.lat), lng: Number(t.lng) }, point) * 1.3
          : null,
    }));
    const retenus = categorie
      ? tous.filter(({ t }) => t.vehicules.some((v) => v.categorie === categorie))
      : tous;
    return retenus.sort((a, b) => (a.distance ?? 9e9) - (b.distance ?? 9e9));
  }, [transporteurs.data, categorie, point]);

  const categoriesPresentes = React.useMemo(() => {
    const vues = new Set<string>();
    for (const t of transporteurs.data ?? [])
      for (const v of t.vehicules) if (v.categorie) vues.add(v.categorie);
    return [...vues].sort();
  }, [transporteurs.data]);

  return (
    <div className="container py-6">
      <Seo
        titre="Transporteurs de matériaux à Madagascar"
        chemin="/transporteurs"
        description="Camions bennes, plateaux et semi-remorques pour livrer sable, gravillons, briques et bois : les transporteurs référencés par Akora, avec capacité et tarifs annoncés."
      />

      <h1 className="text-page">Un camion ?</h1>
      <p className="mt-1 max-w-2xl text-legende text-muted-foreground">
        {point ? "Les plus proches de votre chantier d'abord." : "Dites où livrer : les plus proches d'abord, avec le prix du voyage."}
      </p>
      <div className="mt-3">
        <SelecteurPoint compact />
      </div>

      {categoriesPresentes.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Filtrer par type de camion">
          <button
            type="button"
            aria-pressed={categorie === null}
            onClick={() => setCategorie(null)}
            className={cn(
              "min-h-9 shrink-0 rounded-full px-3.5 text-legende",
              categorie === null ? "bg-foreground font-semibold text-background" : "border border-border bg-card",
            )}
          >
            Tous
          </button>
          {categoriesPresentes.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={categorie === c}
              onClick={() => setCategorie(c)}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3.5 text-legende",
                categorie === c ? "bg-foreground font-semibold text-background" : "border border-border bg-card",
              )}
            >
              {LIBELLE_CATEGORIE_VEHICULE[c] ?? c}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4" aria-live="polite">
        {transporteurs.isPending ? (
          <GrilleSquelettes nombre={4} />
        ) : transporteurs.isError ? (
          <EtatErreur onReessayer={() => void transporteurs.refetch()} />
        ) : filtres.length === 0 ? (
          <EtatVide
            titre="Les premiers transporteurs arrivent"
            phrase="Akora référence les transporteurs comme les dépôts : fiche, camions, tarifs annoncés. Vous avez une benne, un plateau, une citerne ? Votre place est ici — l'inscription est gratuite."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Bouton asChild>
                  <Link to="/devenir-fournisseur">J'ai un camion — m'inscrire</Link>
                </Bouton>
                <Bouton asChild variante="secondaire">
                  <Link to="/demandes/nouvelle">Je cherche un transport</Link>
                </Bouton>
              </div>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtres.map(({ t, distance }, index) => (
              <li key={t.id} className="entree" style={{ animationDelay: `${80 * index}ms` }}>
                <CarteTransporteur transporteur={t} distanceKm={distance} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* L'invitation bondit à l'arrivée : un transporteur qui passe par ici
          doit la voir sans la chercher. */}
      <div className="bondir mt-8 flex flex-wrap items-center gap-4 rounded-lg bg-foreground p-5 text-background shadow">
        <Truck className="size-7 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-produit">Vous avez un camion ?</p>
          <p className="text-legende text-background/75">Gratuit, en deux minutes.</p>
        </div>
        <Link
          to="/devenir-fournisseur"
          className="cible-44 inline-flex shrink-0 items-center rounded-md bg-background px-4 text-courant font-bold text-foreground"
        >
          L'inscrire
        </Link>
      </div>
    </div>
  );
}

/**
 * Le prix d'UN voyage jusqu'au chantier, avec la formule du site
 * (lib/livraison.ts : km facturés = max(0, d − km inclus) × 2 si aller-retour ;
 * coût = max(plancher, forfait + km × prix/km)). Rien sans distance connue.
 */
function prixDuVoyage(v: VehiculeTransporteur, distanceKm: number | null): number | null {
  if (distanceKm == null) return null;
  const forfait = Number(v.forfait_base ?? 0);
  const parKm = Number(v.prix_par_km ?? 0);
  if (forfait <= 0 && parKm <= 0) return null;
  const km = Math.max(0, distanceKm - Number(v.km_inclus ?? 0)) * (v.facturer_aller_retour ? 2 : 1);
  return Math.ceil(Math.max(Number(v.prix_minimum ?? 0), forfait + km * parKm) / 100) * 100;
}

function CarteTransporteur({
  transporteur: t,
  distanceKm,
}: {
  transporteur: TransporteurPublic;
  distanceKm: number | null;
}) {
  const principal = t.vehicules[0] ?? null;
  const prix = principal ? prixDuVoyage(principal, distanceKm) : null;

  return (
    <Carte className="carte-vivante flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <IllustrationCamion categorie={principal?.categorie} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-produit">
            <Link to={`/fournisseurs/${t.slug}`} className="truncate hover:underline">
              {t.raison_sociale}
            </Link>
            <BadgeVerification niveau={t.niveau_verification as never} compact />
          </p>
          <p className="nombres mt-0.5 text-legende text-muted-foreground">
            {t.localite_nom ?? "Lieu non renseigné"}
            {distanceKm != null ? ` · ${distanceKm.toFixed(1).replace(".", ",")} km` : ""}
          </p>
          {principal ? <Specs vehicule={principal} /> : null}
        </div>
      </div>

      {t.vehicules.length > 1 ? (
        <ul className="space-y-1.5 border-t border-border pt-2.5">
          {t.vehicules.slice(1).map((v, index) => (
            <li key={index} className="flex items-center gap-2 text-legende">
              <Truck className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="font-semibold">
                {v.categorie ? (LIBELLE_CATEGORIE_VEHICULE[v.categorie] ?? v.categorie) : (v.nom ?? "Camion")}
              </span>
              <Specs vehicule={v} inline />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="nombres min-w-0">
          {prix !== null ? (
            <>
              <p className="text-[1.375rem] font-extrabold leading-none text-primary">{formaterAriary(prix)}</p>
              <p className="mt-0.5 text-[0.78rem] text-muted-foreground">jusqu'à votre chantier · 1 voyage</p>
            </>
          ) : principal && (Number(principal.forfait_base) > 0 || Number(principal.prix_par_km) > 0) ? (
            <>
              <p className="text-[1.125rem] font-bold leading-none">
                {Number(principal.forfait_base) > 0
                  ? formaterAriary(Number(principal.forfait_base))
                  : `${formaterAriary(Number(principal.prix_par_km))} / km`}
              </p>
              <p className="mt-0.5 text-[0.78rem] text-muted-foreground">
                {Number(principal.forfait_base) > 0 ? "forfait de sortie" : "au kilomètre"} · dites où livrer
              </p>
            </>
          ) : (
            <p className="text-legende text-muted-foreground">Tarif à demander</p>
          )}
        </div>
        <Bouton asChild taille="compact">
          <Link to={`/fournisseurs/${t.slug}`}>Contacter</Link>
        </Bouton>
      </div>
    </Carte>
  );
}

function Specs({ vehicule: v, inline = false }: { vehicule: VehiculeTransporteur; inline?: boolean }) {
  const puces: string[] = [];
  if (v.categorie && !inline) puces.push(LIBELLE_CATEGORIE_VEHICULE[v.categorie] ?? v.categorie);
  if (v.nb_roues) puces.push(`${v.nb_roues} roues`);
  if (v.capacite_m3) puces.push(`${v.capacite_m3} m³`);
  if (v.capacite_kg) puces.push(Number(v.capacite_kg) >= 1000 ? `${Number(v.capacite_kg) / 1000} t` : `${v.capacite_kg} kg`);
  if (v.marque && !inline) puces.push(v.marque);
  if (puces.length === 0) {
    return <p className="mt-1 text-[0.78rem] text-muted-foreground">Capacité à confirmer par téléphone.</p>;
  }
  return (
    <span className={cn("flex flex-wrap gap-1.5", inline ? "" : "mt-1.5")}>
      {puces.map((puce) => (
        <span key={puce} className="nombres rounded-full bg-muted px-2 py-0.5 text-[0.75rem] font-semibold text-muted-foreground">
          {puce}
        </span>
      ))}
    </span>
  );
}
