import { describe, it, expect } from "vitest";
import {
  calculerLivraison,
  choisirVehicule,
  choisirZone,
  chargeTotale,
  haversine,
  COEF_SINUOSITE_DEFAUT,
  type Vehicule,
  type Zone,
  type DemandeLivraison,
} from "./livraison";

/* Deux points sur le MEME meridien, distants de 0,1 degre de latitude :
   la distance a vol d'oiseau vaut 11,1195 km, et 14,4554 km apres le
   coefficient de sinuosite de 1,30. Toutes les valeurs attendues ci-dessous
   decoulent de ces deux nombres. */
const DEPOT = { lat: -18.8, lng: 47.5 };
const CHANTIER = { lat: -18.7, lng: 47.5 };
const DISTANCE_ROUTE = 14.4553604;

const CAMIONNETTE: Vehicule = {
  id: "v1",
  nom: "Camionnette 3 m3",
  capacite_m3: 3,
  capacite_kg: 1500,
  prix_par_km: 2000,
  forfait_base: 10_000,
  km_inclus: 5,
  prix_minimum: 20_000,
  facturer_aller_retour: false,
};

const CAMION: Vehicule = {
  id: "v2",
  nom: "Camion 8 m3",
  capacite_m3: 8,
  capacite_kg: 5000,
  prix_par_km: 3000,
  forfait_base: 20_000,
  km_inclus: 5,
  prix_minimum: 20_000,
  facturer_aller_retour: false,
};

function demande(surcharge: Partial<DemandeLivraison> = {}): DemandeLivraison {
  return {
    depart: DEPOT,
    arrivee: CHANTIER,
    rayonMaxKm: 40,
    coefSinuosite: 1.3,
    vehicules: [CAMIONNETTE, CAMION],
    zones: [],
    lignes: [{ quantite: 1, poids_kg_unite: 100, volume_m3_unite: 0.5 }],
    montantProduits: 500_000,
    ...surcharge,
  };
}

describe("distance", () => {
  it("mesure la distance a vol d'oiseau", () => {
    expect(haversine(DEPOT, CHANTIER)).toBeCloseTo(11.1195, 3);
    expect(haversine(DEPOT, DEPOT)).toBe(0);
  });

  it("applique le coefficient de sinuosite, 1,30 par defaut", () => {
    const r = calculerLivraison(demande({ coefSinuosite: null }));
    expect(r.statut).toBe("estimee");
    if (r.statut !== "estimee") return;
    expect(r.detail.coefSinuosite).toBe(COEF_SINUOSITE_DEFAUT);
    expect(r.detail.distanceRouteKm).toBeCloseTo(DISTANCE_ROUTE, 3);
  });
});

describe("charge et choix du vehicule", () => {
  it("additionne volume et poids ligne a ligne", () => {
    const { volumeM3, poidsKg } = chargeTotale([
      { quantite: 100, poids_kg_unite: 17, volume_m3_unite: 0.012 },
      { quantite: 20, poids_kg_unite: 50, volume_m3_unite: 0.033 },
    ]);
    expect(poidsKg).toBeCloseTo(1700 + 1000, 6);
    expect(volumeM3).toBeCloseTo(1.2 + 0.66, 6);
  });

  it("retient le vehicule JUSTE suffisant, pas le plus gros", () => {
    const choix = choisirVehicule([CAMIONNETTE, CAMION], 3, 1500);
    expect(choix?.vehicule.id).toBe("v1");
    expect(choix?.rotations).toBe(1);
  });

  it("passe au vehicule superieur des qu'une seule des deux limites saute", () => {
    // Le volume tient dans la camionnette, la charge non.
    expect(choisirVehicule([CAMIONNETTE, CAMION], 2, 1600)?.vehicule.id).toBe("v2");
    // Et l'inverse.
    expect(choisirVehicule([CAMIONNETTE, CAMION], 3.5, 900)?.vehicule.id).toBe("v2");
  });

  it("compte les rotations quand meme le plus grand ne suffit pas", () => {
    // 22 m3 dans 8 m3 : trois voyages.
    const choix = choisirVehicule([CAMIONNETTE, CAMION], 22, 4000);
    expect(choix?.vehicule.id).toBe("v2");
    expect(choix?.rotations).toBe(3);
  });

  it("compte les rotations sur la limite la plus contraignante", () => {
    // 9 m3 (2 voyages) mais 21 tonnes (5 voyages) : c'est 5.
    const choix = choisirVehicule([CAMION], 9, 21_000);
    expect(choix?.rotations).toBe(5);
  });

  it("ne choisit rien sans vehicule declare", () => {
    expect(choisirVehicule([], 1, 10)).toBeNull();
  });
});

describe("prix", () => {
  it("applique la formule et arrondit a la centaine superieure", () => {
    // 14,4554 - 5 = 9,4554 km factures ; 10 000 + 9,4554 x 2 000 = 28 910,72
    const r = calculerLivraison(demande());
    expect(r.statut).toBe("estimee");
    if (r.statut !== "estimee") return;
    expect(r.detail.kmFactures).toBeCloseTo(9.4554, 3);
    expect(r.cout).toBe(29_000);
    expect(r.detail.vehicule.id).toBe("v1");
  });

  it("ne facture rien quand les km inclus couvrent la distance", () => {
    const vehicule: Vehicule = { ...CAMIONNETTE, km_inclus: 50, forfait_base: 12_345, prix_minimum: 0 };
    const r = calculerLivraison(demande({ vehicules: [vehicule] }));
    expect(r.statut).toBe("estimee");
    if (r.statut !== "estimee") return;
    expect(r.detail.kmFactures).toBe(0);
    // Reste le forfait de base seul, arrondi a la centaine superieure.
    expect(r.cout).toBe(12_400);
  });

  it("double les kilometres quand le fournisseur facture l'aller-retour", () => {
    const vehicule: Vehicule = { ...CAMIONNETTE, facturer_aller_retour: true };
    const r = calculerLivraison(demande({ vehicules: [vehicule] }));
    expect(r.statut).toBe("estimee");
    if (r.statut !== "estimee") return;
    expect(r.detail.kmFactures).toBeCloseTo(18.9107, 3);
    expect(r.cout).toBe(47_900);
  });

  it("respecte le prix minimum", () => {
    const vehicule: Vehicule = { ...CAMIONNETTE, prix_minimum: 80_000 };
    const r = calculerLivraison(demande({ vehicules: [vehicule] }));
    expect(r.statut).toBe("estimee");
    if (r.statut !== "estimee") return;
    expect(r.cout).toBe(80_000);
  });

  it("multiplie par le nombre de rotations", () => {
    // 22 m3 : trois voyages du camion. 20 000 + 9,4554 x 3 000 = 48 366,08.
    const r = calculerLivraison(
      demande({ lignes: [{ quantite: 22, poids_kg_unite: 100, volume_m3_unite: 1 }] }),
    );
    expect(r.statut).toBe("estimee");
    if (r.statut !== "estimee") return;
    expect(r.detail.rotations).toBe(3);
    expect(r.cout).toBe(145_100);
  });

  it("applique la majoration de zone", () => {
    const zone: Zone = {
      id: "z1",
      nom: "Peripherie",
      rayon_km: 20,
      seuil_franco: null,
      rayon_franco_km: null,
      majoration_pct: 25,
    };
    const r = calculerLivraison(demande({ zones: [zone] }));
    expect(r.statut).toBe("estimee");
    if (r.statut !== "estimee") return;
    expect(r.detail.majorationPct).toBe(25);
    expect(r.cout).toBe(36_200);
  });

  it("retient la plus petite zone qui couvre la distance", () => {
    const proche: Zone = { id: "z1", nom: "Ville", rayon_km: 10, seuil_franco: null, rayon_franco_km: null, majoration_pct: 0 };
    const moyenne: Zone = { id: "z2", nom: "Peripherie", rayon_km: 20, seuil_franco: null, rayon_franco_km: null, majoration_pct: 25 };
    const loin: Zone = { id: "z3", nom: "Province", rayon_km: 100, seuil_franco: null, rayon_franco_km: null, majoration_pct: 60 };
    expect(choisirZone([loin, proche, moyenne], DISTANCE_ROUTE)?.id).toBe("z2");
    expect(choisirZone([proche], DISTANCE_ROUTE)).toBeNull();
  });
});

describe("cas particuliers", () => {
  const zoneFranco: Zone = {
    id: "z1",
    nom: "Ville",
    rayon_km: 30,
    seuil_franco: 1_000_000,
    rayon_franco_km: 20,
    majoration_pct: 0,
  };

  it("offre la livraison quand le franco est atteint", () => {
    const r = calculerLivraison(demande({ zones: [zoneFranco], montantProduits: 1_200_000 }));
    expect(r.statut).toBe("offerte");
    if (r.statut !== "offerte") return;
    expect(r.cout).toBe(0);
    expect(r.conditionFranco).toContain("1000000");
  });

  it("ne l'offre pas si le montant n'y est pas", () => {
    const r = calculerLivraison(demande({ zones: [zoneFranco], montantProduits: 999_999 }));
    expect(r.statut).toBe("estimee");
  });

  it("ne l'offre pas si le chantier est au-dela du rayon franco", () => {
    const zone: Zone = { ...zoneFranco, rayon_franco_km: 10 };
    const r = calculerLivraison(demande({ zones: [zone], montantProduits: 5_000_000 }));
    expect(r.statut).toBe("estimee");
  });

  it("refuse d'estimer hors du rayon maximum, sans inventer de prix", () => {
    const r = calculerLivraison(demande({ rayonMaxKm: 10 }));
    expect(r.statut).toBe("hors_zone");
    if (r.statut !== "hors_zone") return;
    expect(r.distanceRouteKm).toBeCloseTo(DISTANCE_ROUTE, 3);
    expect(r.rayonMaxKm).toBe(10);
  });

  it("annonce le retrait sur place sans vehicule declare", () => {
    expect(calculerLivraison(demande({ vehicules: [] })).statut).toBe("retrait_sur_place");
  });

  it("ne calcule rien sans coordonnees", () => {
    expect(calculerLivraison(demande({ arrivee: null })).statut).toBe("coordonnees_manquantes");
    expect(calculerLivraison(demande({ depart: null })).statut).toBe("coordonnees_manquantes");
  });

  it("ne calcule rien sur un panier vide", () => {
    expect(calculerLivraison(demande({ lignes: [] })).statut).toBe("panier_vide");
  });

  it("expose la formule appliquee, pour l'afficher telle quelle", () => {
    const r = calculerLivraison(demande());
    if (r.statut !== "estimee") throw new Error("estimation attendue");
    expect(r.detail.formule).toContain("distance route");
    expect(r.detail.formule).toContain("km factures");
    expect(r.detail.formule).toContain("cout");
  });
});
