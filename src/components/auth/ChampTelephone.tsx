import type { UseFormRegisterReturn } from "react-hook-form";
import { Champ } from "@/components/ui/champ";
import { NOM_OPERATEUR, operateurProbable } from "@/lib/format";

/**
 * Téléphone malgache, avec l'indicatif +261 affiché en dur à gauche.
 *
 * L'indicatif hors du champ évite la moitié des saisies fautives : on tape
 * « 34 12 345 67 » comme on le dit, et la normalisation en +261 se fait dans le
 * schéma Zod, pas ici.
 *
 * La pastille d'opérateur n'apparaît qu'une fois le numéro complet et valide.
 * Elle ne décide de rien : beaucoup de gens paient depuis un autre numéro que
 * celui de contact, et l'opérateur reste modifiable au paiement.
 */
export function ChampTelephone({
  valeur,
  erreur,
  enregistrement,
  etiquette = "Téléphone",
}: {
  valeur: string;
  erreur?: string;
  enregistrement: UseFormRegisterReturn;
  etiquette?: string;
}) {
  const operateur = operateurProbable(valeur);

  return (
    <Champ
      etiquette={etiquette}
      aide={
        operateur
          ? `${NOM_OPERATEUR[operateur]}. Il sert à vous joindre pour la livraison ; l'opérateur reste modifiable au paiement.`
          : "Il sert à vous joindre pour la livraison. Exemple : 034 12 345 67."
      }
      erreur={erreur}
      obligatoire
    >
      {(attributs) => (
        <div className="flex min-h-11 items-center overflow-hidden rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
          <span
            className="nombres flex self-stretch items-center border-r border-border px-3 text-courant text-muted-foreground"
            aria-hidden="true"
          >
            +261
          </span>
          <input
            {...attributs}
            {...enregistrement}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="34 12 345 67"
            className="nombres min-h-11 min-w-0 flex-1 bg-transparent px-3 text-courant outline-none"
          />
          {operateur ? (
            <span className="mr-2.5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary-soft px-2.5 py-1 text-legende font-semibold text-secondary-strong">
              <span className="size-1.5 rounded-full bg-secondary" aria-hidden="true" />
              {NOM_OPERATEUR[operateur]}
            </span>
          ) : null}
        </div>
      )}
    </Champ>
  );
}
