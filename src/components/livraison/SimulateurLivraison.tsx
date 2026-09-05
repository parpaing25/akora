import { Phone } from "lucide-react";
import type { ResultatLivraison } from "@/lib/livraison";
import { formaterAriary, formaterDistance } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Pliant, PliantContenu, PliantDeclencheur, PliantSection } from "@/components/ui/accordion";
import { AvertissementMetier } from "@/components/ui/etats";
import { Bouton } from "@/components/ui/button";

/**
 * LE bloc de livraison (AKORA-DESIGN §6). Écrit une fois, réutilisé partout :
 * fiche produit, comparateur, panier, tunnel de commande.
 *
 * Règle non négociable : ne JAMAIS afficher un coût de livraison nu. Le bloc
 * montre toujours la distance retenue, le véhicule, les rotations, puis le
 * coût — et le pliant déroule la formule telle qu'elle a été appliquée.
 * Un acheteur qui ne comprend pas d'où sort un prix de transport ne commande
 * pas ; il appelle, ou il part.
 */
export function SimulateurLivraison({
  resultat,
  telephoneFournisseur,
  className,
}: {
  resultat: ResultatLivraison;
  /** Pour le bouton d'appel du cas « hors zone ». */
  telephoneFournisseur?: string | null;
  className?: string;
}) {
  if (resultat.statut === "panier_vide") return null;

  if (resultat.statut === "coordonnees_manquantes") {
    return (
      <div className={cn("rounded-md bg-muted px-3 py-2.5 text-legende text-muted-foreground", className)}>
        Distance non calculable : indiquez où livrer, ou le dépôt n'a pas encore de position.
      </div>
    );
  }

  if (resultat.statut === "retrait_sur_place") {
    return (
      <div className={cn("rounded-md bg-muted px-3 py-2.5 text-legende", className)}>
        <strong>Retrait sur place uniquement.</strong> Ce fournisseur ne déclare aucun véhicule.
      </div>
    );
  }

  if (resultat.statut === "hors_zone") {
    return (
      <AvertissementMetier
        className={className}
        titre="Hors zone de livraison — à négocier avec le fournisseur"
        action={
          telephoneFournisseur ? (
            <Bouton asChild variante="secondaire" taille="compact">
              <a href={`tel:${telephoneFournisseur}`}>
                <Phone className="size-4" aria-hidden="true" />
                Appeler le fournisseur
              </a>
            </Bouton>
          ) : undefined
        }
      >
        Votre chantier est à <strong>{formaterDistance(resultat.distanceRouteKm)}</strong>, au-delà des{" "}
        {formaterDistance(resultat.rayonMaxKm)} desservis. Akora préfère ne rien annoncer plutôt
        qu'annoncer un prix qu'il ne peut pas tenir. Le paiement en ligne est indisponible sur
        cette commande.
      </AvertissementMetier>
    );
  }

  const { detail } = resultat;
  const offerte = resultat.statut === "offerte";

  return (
    <div className={cn("rounded-md border border-border bg-card", className)}>
      <dl className="divide-y divide-border text-legende">
        <Ligne intitule="Distance route retenue" valeur={formaterDistance(detail.distanceRouteKm)} />
        <Ligne intitule="Véhicule" valeur={detail.vehicule.nom} />
        <Ligne
          intitule="Rotations"
          valeur={detail.rotations === 1 ? "1 voyage" : `${detail.rotations} voyages`}
        />
        {detail.majorationPct !== 0 ? (
          <Ligne intitule={`Zone ${detail.zone?.nom ?? ""}`} valeur={`${detail.majorationPct} %`} />
        ) : null}
        <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
          <dt className="font-semibold">Livraison</dt>
          <dd
            className={cn(
              "nombres text-[1.125rem] font-bold tracking-tight",
              offerte ? "text-success-strong" : "text-foreground",
            )}
          >
            {offerte ? "Offerte" : formaterAriary(resultat.cout)}
          </dd>
        </div>
      </dl>

      {offerte ? (
        <p className="border-t border-border bg-success-soft px-3 py-2 text-[0.78rem] text-success-strong">
          Franco de port atteint : {resultat.conditionFranco}.
        </p>
      ) : null}

      <div className="border-t border-border px-3">
        <Pliant type="single" collapsible>
          <PliantSection value="formule">
            <PliantDeclencheur>Comment ce prix est calculé ?</PliantDeclencheur>
            <PliantContenu>
              <ol className="mb-2 list-decimal space-y-0.5 pl-4">
                <li>Distance à vol d'oiseau entre le dépôt et votre chantier.</li>
                <li>Multipliée par le coefficient de sinuosité ({detail.coefSinuosite}), car les routes ne sont pas droites.</li>
                <li>
                  Choix du plus petit véhicule qui passe : votre chargement fait{" "}
                  <span className="nombres">{detail.volumeTotalM3.toFixed(2)} m³</span> et{" "}
                  <span className="nombres">{Math.round(detail.poidsTotalKg)} kg</span>.
                </li>
                <li>Nombre de voyages nécessaires.</li>
                <li>Forfait, kilomètres facturés, prix plancher, majoration de zone.</li>
                <li>Arrondi à la centaine d'Ariary supérieure.</li>
              </ol>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xs bg-muted p-2 font-mono text-[0.75rem] text-foreground">
                {detail.formule}
              </pre>
            </PliantContenu>
          </PliantSection>
        </Pliant>
      </div>

      <p className="border-t border-border px-3 py-2 text-[0.78rem] text-muted-foreground">
        Estimation — le prix final est confirmé par le fournisseur.
      </p>
    </div>
  );
}

function Ligne({ intitule, valeur }: { intitule: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="text-muted-foreground">{intitule}</dt>
      <dd className="nombres text-right font-medium">{valeur}</dd>
    </div>
  );
}
