/**
 * Combien de pieces couvrent un metre carre.
 *
 * Un macon connait la surface de son mur, pas le nombre de briques. Lui faire
 * poser la division, c'est lui faire porter une erreur qu'on sait eviter — et
 * une erreur de comptage se paie en aller-retour au depot.
 *
 * Deux sources, dans cet ordre :
 *
 *   1. Le chiffre PUBLIE par le depot (`caracteristiques.pieces_par_m2`). Il
 *      tient compte des joints reels et de la maniere dont on pose chez lui.
 *      C'est lui qui fait foi : Hourdis MG annonce 12 briques au m2 la ou la
 *      geometrie en donne 12,5, parce que le joint mange la difference.
 *
 *   2. Les dimensions de pose de la reference, a defaut. Geometrique, donc
 *      legerement optimiste puisque hors joints — on le dit a l'ecran.
 *
 * Module PUR : aucun acces reseau, entierement testable.
 */

export type SourceCouverture = "depot" | "dimensions";

export interface Couverture {
  piecesParM2: number;
  source: SourceCouverture;
}

/**
 * `caracteristiques` est un JSON libre : on n'y fait confiance qu'apres
 * verification. Une valeur absurde vaut mieux ignoree qu'appliquee.
 */
function depuisLeDepot(caracteristiques: unknown): number | null {
  if (!caracteristiques || typeof caracteristiques !== "object") return null;
  const brut = (caracteristiques as Record<string, unknown>).pieces_par_m2;
  const valeur = typeof brut === "string" ? Number(brut) : brut;
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) return null;
  // Au-dela de 500 pieces au m2 ou en dessous de 0,01, c'est une saisie
  // fautive, pas un materiau.
  if (valeur < 0.01 || valeur > 500) return null;
  return valeur;
}

function depuisLesDimensions(longueurCm: unknown, largeurCm: unknown): number | null {
  const longueur = Number(longueurCm);
  const largeur = Number(largeurCm);
  if (!Number.isFinite(longueur) || !Number.isFinite(largeur)) return null;
  if (longueur <= 0 || largeur <= 0) return null;
  return 1 / ((longueur / 100) * (largeur / 100));
}

export function couverture(produit: {
  caracteristiques?: unknown;
  materiau_longueur_cm?: unknown;
  materiau_largeur_cm?: unknown;
}): Couverture | null {
  const publie = depuisLeDepot(produit.caracteristiques);
  if (publie !== null) return { piecesParM2: publie, source: "depot" };

  const geometrique = depuisLesDimensions(produit.materiau_longueur_cm, produit.materiau_largeur_cm);
  if (geometrique !== null) return { piecesParM2: geometrique, source: "dimensions" };

  return null;
}

/** La quantite a commander pour une surface. Jamais en dessous du minimum. */
export function quantitePourSurface(
  surfaceM2: number,
  piecesParM2: number,
  quantiteMin = 1,
): number {
  if (!(surfaceM2 > 0) || !(piecesParM2 > 0)) return 0;
  // On ne commande pas 12,4 briques : l'arrondi va vers le haut, toujours.
  return Math.max(Math.ceil(surfaceM2 * piecesParM2 - 1e-9), quantiteMin);
}
