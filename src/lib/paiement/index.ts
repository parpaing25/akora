import { AirtelMoney } from "./airtel-money.ts";
import { Mvola } from "./mvola.ts";
import { OrangeMoney } from "./orange-money.ts";
import { ReferenceManuelle } from "./reference-manuelle.ts";
import type { Operateur, PrestatairePaiement } from "./types.ts";

/**
 * Choix du prestataire. Aucun opérateur n'est codé en dur dans un composant
 * (spec B9) : tout passe par ici.
 *
 * Tant que les identifiants marchands ne sont pas configurés, on retombe sur
 * la référence saisie — qui fonctionne dès le premier jour. Le branchement des
 * API se fera sans toucher une ligne d'interface.
 */
export function prestataire(operateur: Operateur): PrestatairePaiement {
  const marchand =
    operateur === "mvola" ? new Mvola() : operateur === "orange_money" ? new OrangeMoney() : new AirtelMoney();
  return marchand.disponible ? marchand : new ReferenceManuelle(operateur);
}

/** Le mode réellement utilisé, pour l'annoncer honnêtement à l'acheteur. */
export function modeActif(operateur: Operateur): "api" | "reference_manuelle" {
  return prestataire(operateur) instanceof ReferenceManuelle ? "reference_manuelle" : "api";
}

export { AirtelMoney, Mvola, OrangeMoney, ReferenceManuelle };
export * from "./types.ts";
