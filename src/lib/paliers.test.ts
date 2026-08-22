import { describe, it, expect } from "vitest";
import { prixUnitaireApplicable, totalLigne, prochainPalier, type Palier } from "./paliers";

const PALIERS: Palier[] = [
  { quantite_min: 100, prix_unitaire: 1350 },
  { quantite_min: 500, prix_unitaire: 1280 },
  { quantite_min: 1000, prix_unitaire: 1200 },
];

describe("paliers dégressifs", () => {
  it("applique le prix de base sous le premier seuil", () => {
    expect(prixUnitaireApplicable(1400, PALIERS, 1)).toBe(1400);
    expect(prixUnitaireApplicable(1400, PALIERS, 99)).toBe(1400);
  });

  it("applique le palier exactement au seuil", () => {
    expect(prixUnitaireApplicable(1400, PALIERS, 100)).toBe(1350);
    expect(prixUnitaireApplicable(1400, PALIERS, 500)).toBe(1280);
    expect(prixUnitaireApplicable(1400, PALIERS, 1000)).toBe(1200);
  });

  it("retient toujours le seuil le plus élevé atteint, quel que soit l'ordre de saisie", () => {
    const desordre: Palier[] = [
      { quantite_min: 1000, prix_unitaire: 1200 },
      { quantite_min: 100, prix_unitaire: 1350 },
      { quantite_min: 500, prix_unitaire: 1280 },
    ];
    expect(prixUnitaireApplicable(1400, desordre, 750)).toBe(1280);
    expect(prixUnitaireApplicable(1400, desordre, 5000)).toBe(1200);
  });

  it("sans palier, renvoie le prix de base", () => {
    expect(prixUnitaireApplicable(1400, [], 10_000)).toBe(1400);
    expect(prixUnitaireApplicable(1400, null, 10_000)).toBe(1400);
  });

  it("calcule un total entier en Ariary", () => {
    expect(totalLigne(1400, PALIERS, 100)).toBe(135_000);
    expect(totalLigne(1400, PALIERS, 7)).toBe(9_800);
  });

  it("annonce le prochain palier atteignable", () => {
    expect(prochainPalier(PALIERS, 80)).toEqual({ quantite_min: 100, prix_unitaire: 1350 });
    expect(prochainPalier(PALIERS, 500)).toEqual({ quantite_min: 1000, prix_unitaire: 1200 });
    expect(prochainPalier(PALIERS, 1200)).toBeNull();
  });
});
