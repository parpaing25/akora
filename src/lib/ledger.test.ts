import { describe, it, expect } from "vitest";
import { ecartSolde, soldeDepuisLedger, verifierChaine, type EcritureLedger } from "./ledger";

/** Une vente de 500 000 Ar, livraison comprise, avec 3 % de commission. */
const VENTE: EcritureLedger[] = [
  { id: 1, type: "liberation", montant: 500_000, solde_apres: 500_000 },
  { id: 2, type: "commission", montant: -13_500, solde_apres: 486_500 },
];

describe("solde reconstitué depuis le ledger", () => {
  it("vaut la somme des écritures", () => {
    expect(soldeDepuisLedger(VENTE)).toBe(486_500);
    expect(soldeDepuisLedger([])).toBe(0);
  });

  it("survit à un retrait puis à un remboursement", () => {
    const suite: EcritureLedger[] = [
      ...VENTE,
      { id: 3, type: "retrait", montant: -400_000, solde_apres: 86_500 },
      { id: 4, type: "remboursement", montant: -50_000, solde_apres: 36_500 },
      { id: 5, type: "ajustement", montant: 1_000, solde_apres: 37_500 },
    ];
    expect(soldeDepuisLedger(suite)).toBe(37_500);
    expect(verifierChaine(suite)).toEqual([]);
  });

  it("détecte une rupture de chaîne : un solde a bougé sans écriture", () => {
    const truque: EcritureLedger[] = [
      { id: 1, type: "liberation", montant: 500_000, solde_apres: 500_000 },
      // Quelqu'un a crédité 100 000 Ar sans laisser de trace.
      { id: 2, type: "commission", montant: -13_500, solde_apres: 586_500 },
    ];
    const anomalies = verifierChaine(truque);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]!.attendu).toBe(486_500);
    expect(anomalies[0]!.constate).toBe(586_500);
  });

  it("ne cascade pas : une seule rupture ne fait pas dérailler tout le reste", () => {
    const suite: EcritureLedger[] = [
      { id: 1, type: "liberation", montant: 100_000, solde_apres: 100_000 },
      { id: 2, type: "commission", montant: -3_000, solde_apres: 99_000 },
      { id: 3, type: "retrait", montant: -50_000, solde_apres: 49_000 },
    ];
    expect(verifierChaine(suite)).toHaveLength(1);
  });

  it("mesure l'écart entre le solde stocké et le ledger — zéro est la seule valeur acceptable", () => {
    expect(ecartSolde(486_500, VENTE)).toBe(0);
    expect(ecartSolde(500_000, VENTE)).toBe(13_500);
  });

  it("reste juste sur un ledger désordonné : le tri se fait sur l'identifiant", () => {
    const desordre: EcritureLedger[] = [
      { id: 2, type: "commission", montant: -13_500, solde_apres: 486_500 },
      { id: 1, type: "liberation", montant: 500_000, solde_apres: 500_000 },
    ];
    expect(verifierChaine(desordre)).toEqual([]);
    expect(soldeDepuisLedger(desordre)).toBe(486_500);
  });
});
