import { describe, it, expect } from "vitest";
import { construireLigne, trierLignes, demonstration, type LigneComparateur } from "./comparateur";
import type { ResultatLivraison, Vehicule } from "./livraison";
import type { ProduitPublic } from "./donnees/vitrine";

const VEHICULE: Vehicule = {
  id: "v", nom: "Camion", capacite_m3: 8, capacite_kg: 5000,
  prix_par_km: 2000, forfait_base: 10_000, km_inclus: 0, prix_minimum: 0,
  facturer_aller_retour: false,
};

function produit(p: Partial<Record<string, unknown>>): ProduitPublic {
  return {
    id: "p", slug: "s", nom_affiche: "X", prix_unitaire: 1000, prix_promo: null,
    unite: "piece", quantite_min: 1, poids_kg_unite: 10, volume_m3_unite: 0.01,
    stock_statut: "en_stock", photos: [], fournisseur_id: "f", fournisseur_slug: "fs",
    fournisseur_nom: "F", fournisseur_niveau: "verifie", fournisseur_note: 4,
    ...p,
  } as unknown as ProduitPublic;
}

function estimee(cout: number, distance: number): ResultatLivraison {
  return {
    statut: "estimee", cout,
    detail: {
      distanceVolKm: distance / 1.3, coefSinuosite: 1.3, distanceRouteKm: distance,
      volumeTotalM3: 1, poidsTotalKg: 100, vehicule: VEHICULE, rotations: 1,
      kmFactures: distance, majorationPct: 0, zone: null, formule: "",
    },
  };
}

describe("ligne de comparateur", () => {
  it("additionne produits et livraison, et ramène au prix par unité rendue", () => {
    const l = construireLigne(produit({ prix_unitaire: 1400 }), [], 100, estimee(29_000, 14.5));
    expect(l.totalProduits).toBe(140_000);
    expect(l.rendu).toBe(169_000);
    expect(l.renduParUnite).toBe(1690);
  });

  it("applique les paliers avant tout calcul", () => {
    const l = construireLigne(
      produit({ prix_unitaire: 1400 }),
      [{ quantite_min: 100, prix_unitaire: 1350 }],
      100,
      estimee(29_000, 14.5),
    );
    expect(l.prixUnitaire).toBe(1350);
    expect(l.rendu).toBe(135_000 + 29_000);
  });

  it("laisse le rendu à null quand la livraison n'est pas estimable", () => {
    const horsZone: ResultatLivraison = { statut: "hors_zone", distanceRouteKm: 90, rayonMaxKm: 40 };
    const l = construireLigne(produit({}), [], 10, horsZone);
    expect(l.rendu).toBeNull();
    expect(l.distanceKm).toBe(90);
  });

  it("compte la livraison offerte comme un rendu à zéro de transport", () => {
    const socle = estimee(0, 8);
    if (socle.statut !== "estimee") throw new Error("socle inattendu");
    const offerte: ResultatLivraison = {
      statut: "offerte",
      cout: 0,
      detail: socle.detail,
      conditionFranco: "commande de 1 000 000 Ar ou plus",
    };
    const l = construireLigne(produit({ prix_unitaire: 2000 }), [], 10, offerte);
    expect(l.rendu).toBe(20_000);
  });
});

describe("tri", () => {
  const lignes: LigneComparateur[] = [
    construireLigne(produit({ id: "cher-depot", prix_unitaire: 1500 }), [], 100, estimee(10_000, 5)),
    construireLigne(produit({ id: "pas-cher-depot", prix_unitaire: 1200 }), [], 100, estimee(60_000, 40)),
    construireLigne(produit({ id: "hors-zone", prix_unitaire: 900 }), [], 100, {
      statut: "hors_zone", distanceRouteKm: 200, rayonMaxKm: 40,
    }),
  ];

  it("classe par prix rendu, pas par prix au dépôt", () => {
    const tri = trierLignes(lignes, "rendu");
    expect(tri[0]!.produit.id).toBe("cher-depot"); // 160 000 contre 180 000
    expect(tri[1]!.produit.id).toBe("pas-cher-depot");
  });

  it("relègue toujours les offres non estimables en fin de liste", () => {
    for (const critere of ["rendu", "prix_unitaire", "distance", "note", "verification"] as const) {
      expect(trierLignes(lignes, critere).at(-1)!.produit.id).toBe("hors-zone");
    }
  });

  it("sait aussi trier par prix au dépôt quand on le demande", () => {
    expect(trierLignes(lignes, "prix_unitaire")[0]!.produit.id).toBe("pas-cher-depot");
  });
});

describe("démonstration pédagogique", () => {
  it("oppose le moins cher au dépôt et le moins cher rendu", () => {
    const lignes = [
      construireLigne(produit({ id: "a", prix_unitaire: 1500 }), [], 100, estimee(10_000, 5)),
      construireLigne(produit({ id: "b", prix_unitaire: 1200 }), [], 100, estimee(60_000, 40)),
    ];
    const d = demonstration(lignes);
    expect(d?.moinsCherDepot.produit.id).toBe("b");
    expect(d?.moinsCherRendu.produit.id).toBe("a");
    expect(d?.ecart).toBe(20_000);
  });

  it("ne démontre rien quand c'est le même fournisseur ou qu'il n'y en a qu'un", () => {
    const seule = [construireLigne(produit({ id: "a" }), [], 10, estimee(1000, 2))];
    expect(demonstration(seule)).toBeNull();
    const memeGagnant = [
      construireLigne(produit({ id: "a", prix_unitaire: 1000 }), [], 10, estimee(1000, 2)),
      construireLigne(produit({ id: "b", prix_unitaire: 2000 }), [], 10, estimee(5000, 9)),
    ];
    expect(demonstration(memeGagnant)).toBeNull();
  });
});
