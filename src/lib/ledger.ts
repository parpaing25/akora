/**
 * Reconstitution d'un solde depuis le ledger.
 *
 * Le principe non négociable (spec B10) : le solde d'un portefeuille doit être
 * exactement la somme de ses écritures. Aucune mise à jour de solde sans
 * écriture correspondante. Les lignes sont immuables ; on corrige par un
 * `ajustement`, jamais en réécrivant le passé.
 */

export type TypeEcriture =
  | "credit_sequestre"
  | "liberation"
  | "commission"
  | "retrait"
  | "remboursement"
  | "ajustement";

export interface EcritureLedger {
  id: number;
  type: TypeEcriture;
  /** Signé : positif crédite, négatif débite. */
  montant: number;
  solde_apres: number;
}

/** Le solde tel que les écritures le racontent. */
export function soldeDepuisLedger(ecritures: readonly EcritureLedger[]): number {
  return ecritures.reduce((somme, e) => somme + e.montant, 0);
}

export interface AnomalieLedger {
  ecriture: EcritureLedger;
  attendu: number;
  constate: number;
}

/**
 * Vérifie la chaîne : chaque `solde_apres` doit valoir le solde précédent plus
 * le montant de la ligne. Une rupture signale qu'un solde a bougé sans
 * écriture — c'est-à-dire un bug qu'il faut voir tout de suite.
 */
export function verifierChaine(ecritures: readonly EcritureLedger[]): AnomalieLedger[] {
  const ordonnees = [...ecritures].sort((a, b) => a.id - b.id);
  const anomalies: AnomalieLedger[] = [];
  let courant = 0;
  for (const ecriture of ordonnees) {
    courant += ecriture.montant;
    if (ecriture.solde_apres !== courant) {
      anomalies.push({ ecriture, attendu: courant, constate: ecriture.solde_apres });
      courant = ecriture.solde_apres; // on repart du réel pour ne pas cascader
    }
  }
  return anomalies;
}

/** Écart entre le solde stocké et celui du ledger. Zéro est la seule valeur acceptable. */
export function ecartSolde(soldeStocke: number, ecritures: readonly EcritureLedger[]): number {
  return soldeStocke - soldeDepuisLedger(ecritures);
}
