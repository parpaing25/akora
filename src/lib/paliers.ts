/**
 * Paliers dégressifs : « à partir de N unités, le prix unitaire tombe à P ».
 *
 * Module pur et testable. Aucune requête réseau ici — la même fonction sert au
 * comparateur, au panier et, côté serveur, au recalcul du montant d'une
 * commande (le client n'est jamais l'autorité sur un montant, règle A3).
 */

export interface Palier {
  quantite_min: number;
  prix_unitaire: number;
}

/**
 * Prix unitaire applicable pour une quantité donnée.
 * On retient le palier au seuil le plus élevé qui soit atteint. Un palier plus
 * cher qu'un palier inférieur serait une erreur de saisie du fournisseur : on
 * ne le corrige pas ici (c'est une contrainte CHECK en base), on l'applique tel
 * quel pour rester prévisible.
 */
export function prixUnitaireApplicable(
  prixDeBase: number,
  paliers: readonly Palier[] | null | undefined,
  quantite: number,
): number {
  if (!paliers || paliers.length === 0) return prixDeBase;
  let meilleur = prixDeBase;
  let seuilRetenu = 0;
  for (const palier of paliers) {
    if (quantite >= palier.quantite_min && palier.quantite_min >= seuilRetenu) {
      seuilRetenu = palier.quantite_min;
      meilleur = palier.prix_unitaire;
    }
  }
  return meilleur;
}

/** Total d'une ligne, en Ariary entier. Aucun flottant conservé. */
export function totalLigne(
  prixDeBase: number,
  paliers: readonly Palier[] | null | undefined,
  quantite: number,
): number {
  return Math.round(prixUnitaireApplicable(prixDeBase, paliers, quantite) * quantite);
}

/** Le prochain palier atteignable, pour inciter sans mentir. */
export function prochainPalier(
  paliers: readonly Palier[] | null | undefined,
  quantite: number,
): Palier | null {
  if (!paliers || paliers.length === 0) return null;
  const suivants = paliers.filter((p) => p.quantite_min > quantite).sort((a, b) => a.quantite_min - b.quantite_min);
  return suivants[0] ?? null;
}
