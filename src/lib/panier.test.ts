import { describe, it, expect } from "vitest";
import { grouperParFournisseur, nombreArticles, totalProduits, totalLignePanier, type LignePanier } from "./panier";

function ligne(p: Partial<LignePanier> & { produitId: string; fournisseurId: string }): LignePanier {
  return {
    slug: "x",
    nomAffiche: "X",
    photo: null,
    unite: "piece",
    prixUnitaire: 1000,
    paliers: [],
    quantite: 1,
    quantiteMin: 1,
    poidsKgUnite: 10,
    volumeM3Unite: 0.01,
    stock: "en_stock",
    fournisseurSlug: "f",
    fournisseurNom: "F",
    fournisseurNiveau: "verifie",
    ...p,
  };
}

describe("panier multi-fournisseurs", () => {
  it("scinde en un groupe par fournisseur, dans l'ordre d'apparition", () => {
    const lignes = [
      ligne({ produitId: "a", fournisseurId: "f1" }),
      ligne({ produitId: "b", fournisseurId: "f2" }),
      ligne({ produitId: "c", fournisseurId: "f1" }),
    ];
    const groupes = grouperParFournisseur(lignes);
    expect(groupes.map((g) => g.fournisseurId)).toEqual(["f1", "f2"]);
    expect(groupes[0]!.lignes).toHaveLength(2);
  });

  it("cumule montant, poids et volume par fournisseur", () => {
    const groupes = grouperParFournisseur([
      ligne({ produitId: "a", fournisseurId: "f1", quantite: 100, prixUnitaire: 1400, poidsKgUnite: 18, volumeM3Unite: 0.0075 }),
      ligne({ produitId: "b", fournisseurId: "f1", quantite: 10, prixUnitaire: 42_000, poidsKgUnite: 50, volumeM3Unite: 0.033 }),
    ]);
    expect(groupes[0]!.montantProduits).toBe(100 * 1400 + 10 * 42_000);
    expect(groupes[0]!.poidsTotalKg).toBeCloseTo(100 * 18 + 10 * 50, 6);
    expect(groupes[0]!.volumeTotalM3).toBeCloseTo(100 * 0.0075 + 10 * 0.033, 6);
  });

  it("applique les paliers au total d'une ligne", () => {
    const l = ligne({
      produitId: "a",
      fournisseurId: "f1",
      quantite: 600,
      prixUnitaire: 1400,
      paliers: [
        { quantite_min: 100, prix_unitaire: 1350 },
        { quantite_min: 500, prix_unitaire: 1280 },
      ],
    });
    expect(totalLignePanier(l)).toBe(600 * 1280);
  });

  it("compte les articles et le total général", () => {
    const lignes = [
      ligne({ produitId: "a", fournisseurId: "f1", quantite: 3, prixUnitaire: 1000 }),
      ligne({ produitId: "b", fournisseurId: "f2", quantite: 2, prixUnitaire: 2500 }),
    ];
    expect(nombreArticles(lignes)).toBe(5);
    expect(totalProduits(lignes)).toBe(3000 + 5000);
  });
});
