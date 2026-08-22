/**
 * Arithmétique monétaire. Aucune dépendance : ce module est partagé TEL QUEL
 * entre le navigateur et les Edge Functions Deno, pour que le montant
 * recalculé côté serveur soit bit pour bit celui annoncé au client.
 *
 * L'Ariary est entier. Aucun calcul monétaire en flottant conservé.
 */

/** Arrondi à la centaine d'Ariary SUPÉRIEURE (spec B6 étape 4). */
export function arrondirCentaineSup(valeur: number): number {
  return Math.ceil(valeur / 100) * 100;
}

/** Arrondi à l'Ariary entier le plus proche. */
export function arrondirAriary(valeur: number): number {
  return Math.round(valeur);
}

/** Pourcentage d'un montant, arrondi à l'Ariary inférieur (jamais en défaveur du vendeur). */
export function pourcentage(montant: number, taux: number): number {
  return Math.floor((montant * taux) / 100);
}
