import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Truck, MapPin } from "lucide-react";
import { Seo } from "@/components/Seo";
import {
  listerTransporteurs,
  LIBELLE_CATEGORIE_VEHICULE,
  type TransporteurPublic,
  type VehiculeTransporteur,
} from "@/lib/donnees/transporteurs";
import { formaterAriary } from "@/lib/format";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
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

  const transporteurs = useQuery({
    queryKey: ["transporteurs"],
    queryFn: listerTransporteurs,
    staleTime: 5 * 60_000,
  });

  const filtres = React.useMemo(() => {
    const tous = transporteurs.data ?? [];
    if (!categorie) return tous;
    return tous.filter((t) => t.vehicules.some((v) => v.categorie === categorie));
  }, [transporteurs.data, categorie]);

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

      <h1 className="text-page">Transporteurs</h1>
      <p className="mt-1 max-w-2xl text-legende text-muted-foreground">
        Des camions pour le sable, les gravillons, les briques, le bois — avec la capacité et le
        tarif que chaque transporteur annonce. Le prix rendu chantier se calcule sur sa page.
      </p>

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
            {filtres.map((t) => (
              <li key={t.id}>
                <CarteTransporteur transporteur={t} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 rounded-lg bg-foreground p-5 text-background">
        <p className="text-produit">Vous transportez des matériaux ?</p>
        <p className="mt-1 max-w-xl text-legende text-background/75">
          Inscrivez vos camions — capacité, zone, tarif au kilomètre — et recevez les demandes des
          chantiers proches de chez vous. C'est gratuit.
        </p>
        <Link
          to="/devenir-fournisseur"
          className="cible-44 mt-3 inline-flex items-center rounded-md bg-background px-4 text-courant font-bold text-foreground"
        >
          Inscrire mes camions
        </Link>
      </div>
    </div>
  );
}

function CarteTransporteur({ transporteur: t }: { transporteur: TransporteurPublic }) {
  return (
    <Carte className="carte-vivante flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-produit">
            <Link to={`/fournisseurs/${t.slug}`} className="hover:underline">
              {t.raison_sociale}
            </Link>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-legende text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {t.localite_nom ?? "Lieu non renseigné"}
            {t.nature === "mixte" ? " · vend aussi des matériaux" : ""}
          </p>
        </div>
        <BadgeVerification niveau={t.niveau_verification as never} compact />
      </div>

      <ul className="mt-3 flex-1 space-y-2">
        {t.vehicules.length === 0 ? (
          <li className="text-legende text-muted-foreground">Flotte non détaillée.</li>
        ) : (
          t.vehicules.map((v, index) => <Vehicule key={index} vehicule={v} />)
        )}
      </ul>

      <div className="mt-3 flex gap-2">
        <Bouton asChild taille="compact" pleineLargeur>
          <Link to={`/fournisseurs/${t.slug}/livraison`}>Simuler un transport</Link>
        </Bouton>
        <Bouton asChild variante="secondaire" taille="compact" pleineLargeur>
          <Link to={`/fournisseurs/${t.slug}`}>Voir la fiche</Link>
        </Bouton>
      </div>
    </Carte>
  );
}

function Vehicule({ vehicule: v }: { vehicule: VehiculeTransporteur }) {
  const traits: string[] = [];
  if (v.nb_roues) traits.push(`${v.nb_roues} roues`);
  if (v.capacite_m3) traits.push(`${v.capacite_m3} m³`);
  if (v.capacite_kg) traits.push(v.capacite_kg >= 1000 ? `${v.capacite_kg / 1000} t` : `${v.capacite_kg} kg`);
  if (v.marque) traits.push(v.marque);

  const tarif =
    v.forfait_base && v.forfait_base > 0
      ? `${formaterAriary(v.forfait_base)} le voyage`
      : v.prix_par_km && v.prix_par_km > 0
        ? `${formaterAriary(v.prix_par_km)} / km`
        : null;

  return (
    <li className="rounded-md border border-border bg-muted/30 p-2.5">
      <p className="flex items-center gap-1.5 text-legende font-semibold">
        <Truck className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {v.categorie ? (LIBELLE_CATEGORIE_VEHICULE[v.categorie] ?? v.categorie) : (v.nom ?? "Camion")}
      </p>
      {traits.length > 0 ? (
        <p className="nombres mt-0.5 text-[0.78rem] text-muted-foreground">{traits.join(" · ")}</p>
      ) : (
        <p className="mt-0.5 text-[0.78rem] text-muted-foreground">Capacité à confirmer par téléphone.</p>
      )}
      {tarif ? <p className="nombres mt-0.5 text-[0.78rem] font-semibold">{tarif}</p> : null}
    </li>
  );
}
