import { describe, it, expect } from "vitest";
import {
  beton350,
  chapeEnduit,
  dalleHourdis,
  murParpaings,
  toitureToles,
  type Ratios,
} from "./calculateurs";

/** Les ratios du seed. Le module ne doit RIEN coder en dur. */
const RATIOS: Ratios = {
  "mur_parpaing.blocs_par_m2": 12.5,
  "mur_parpaing.mortier_m3_par_m2": 0.02,
  "mortier.ciment_kg_par_m3": 350,
  "mortier.sable_m3_par_m3": 1.1,
  "beton_350.ciment_kg_par_m3": 350,
  "beton_350.sable_m3_par_m3": 0.4,
  "beton_350.gravillon_m3_par_m3": 0.8,
  "beton_350.eau_l_par_m3": 175,
  "dalle_hourdis.poutrelles_ml_par_m2": 1.67,
  "dalle_hourdis.hourdis_par_m2": 8.33,
  "dalle_hourdis.table_compression_m3_par_m2": 0.04,
  "dalle_hourdis.treillis_m2_par_m2": 1.05,
  "chape_enduit.ciment_kg_par_m3": 300,
  "chape_enduit.sable_m3_par_m3": 1.1,
  "toiture_tole.tole_2m_par_m2": 0.7,
  "toiture_tole.chevrons_ml_par_m2": 1.67,
  "toiture_tole.pannes_ml_par_m2": 0.83,
  "toiture_tole.faitiere_ml_par_ml": 1.05,
};

const quantite = (resultat: { lignes: { cle: string; quantite: number }[] }, cle: string) =>
  resultat.lignes.find((l) => l.cle === cle)?.quantite;

describe("mur en parpaings", () => {
  it("déduit les ouvertures avant de compter les blocs", () => {
    // 10 m x 3 m = 30 m², moins 6 m² de portes et fenêtres = 24 m².
    const sansMarge = murParpaings(
      { longueurM: 10, hauteurM: 3, ouverturesM2: 6, epaisseurCm: 15 },
      RATIOS,
      0,
    );
    // 25 blocs par rangee x 15 rangees = 375, moins 75 pour les ouvertures.
    // Le ratio donnait le meme compte ici parce que les dimensions tombent
    // rondes ; ce n'est pas toujours le cas — cf. calepinage.test.ts.
    expect(quantite(sansMarge, "blocs")).toBe(300);
  });

  it("applique la marge de sécurité et arrondit à l'unité supérieure", () => {
    const avec = murParpaings({ longueurM: 10, hauteurM: 3, ouverturesM2: 6, epaisseurCm: 15 }, RATIOS, 5);
    expect(quantite(avec, "blocs")).toBe(315); // 300 x 1,05
  });

  it("pointe la bonne référence du catalogue selon l'épaisseur", () => {
    const mur20 = murParpaings({ longueurM: 4, hauteurM: 2.5, epaisseurCm: 20 }, RATIOS, 0);
    expect(mur20.lignes.find((l) => l.cle === "blocs")?.materiauSlug).toBe("parpaing-creux-20");
  });

  it("déduit ciment et sable du volume de mortier", () => {
    // 24 m² x 0,02 = 0,48 m³ de mortier ; 0,48 x 350 / 50 = 3,36 sacs.
    const r = murParpaings({ longueurM: 10, hauteurM: 3, ouverturesM2: 6, epaisseurCm: 15 }, RATIOS, 0);
    expect(quantite(r, "ciment")).toBe(4);
    expect(quantite(r, "sable")).toBeCloseTo(0.6, 5); // 0,48 x 1,1 arrondi au dixième sup
  });

  it("ne renvoie jamais de quantité négative sur une saisie absurde", () => {
    const r = murParpaings({ longueurM: 2, hauteurM: 2, ouverturesM2: 50, epaisseurCm: 10 }, RATIOS, 5);
    for (const ligne of r.lignes) expect(ligne.quantite).toBeGreaterThanOrEqual(0);
  });
});

describe("béton dosé à 350", () => {
  it("donne la composition d'un mètre cube", () => {
    const r = beton350({ volumeM3: 1 }, RATIOS, 0);
    expect(quantite(r, "ciment")).toBe(7); // 350 / 50
    expect(quantite(r, "sable")).toBeCloseTo(0.4, 5);
    expect(quantite(r, "gravillon")).toBeCloseTo(0.8, 5);
    expect(quantite(r, "eau")).toBe(175);
  });

  it("n'essaie pas de vendre de l'eau", () => {
    const r = beton350({ volumeM3: 2 }, RATIOS, 0);
    expect(r.lignes.find((l) => l.cle === "eau")?.materiauSlug).toBeNull();
  });

  it("prévient qu'une toupie revient souvent moins cher au-delà de 3 m3", () => {
    expect(beton350({ volumeM3: 5 }, RATIOS).reserves.join(" ")).toContain("toupie");
  });
});

describe("dalle en hourdis", () => {
  it("compte poutrelles, hourdis, béton de table et treillis", () => {
    const r = dalleHourdis({ surfaceM2: 100, hauteurHourdisCm: 16 }, RATIOS, 0);
    expect(quantite(r, "poutrelles")).toBe(167);
    expect(quantite(r, "hourdis")).toBe(833);
    expect(quantite(r, "beton")).toBeCloseTo(4, 5);
    expect(quantite(r, "treillis")).toBeCloseTo(105, 5);
    expect(r.lignes.find((l) => l.cle === "hourdis")?.materiauSlug).toBe("hourdis-16");
  });
});

describe("chape et enduit", () => {
  it("calcule le mortier depuis la surface et l'épaisseur", () => {
    // 50 m² x 5 cm = 2,5 m³ ; 2,5 x 300 / 50 = 15 sacs.
    const r = chapeEnduit({ surfaceM2: 50, epaisseurCm: 5, type: "chape" }, RATIOS, 0);
    expect(quantite(r, "ciment")).toBe(15);
    expect(quantite(r, "sable")).toBeCloseTo(2.8, 5);
  });

  it("oriente vers le sable fin pour un enduit, la rivière pour une chape", () => {
    const enduit = chapeEnduit({ surfaceM2: 20, epaisseurCm: 1.5, type: "enduit" }, RATIOS, 0);
    const chape = chapeEnduit({ surfaceM2: 20, epaisseurCm: 5, type: "chape" }, RATIOS, 0);
    expect(enduit.lignes.find((l) => l.cle === "sable")?.materiauSlug).toBe("sable-fin");
    expect(chape.lignes.find((l) => l.cle === "sable")?.materiauSlug).toBe("sable-de-riviere");
  });
});

describe("toiture en tôles", () => {
  it("compte tôles, chevrons et pannes", () => {
    const r = toitureToles({ surfaceM2: 100, longueurToleM: 2 }, RATIOS, 0);
    expect(quantite(r, "toles")).toBe(70);
    expect(quantite(r, "chevrons")).toBe(42); // 167 ml / 4 m
    expect(quantite(r, "pannes")).toBe(21); // 83 ml / 4 m
  });

  it("n'ajoute les faîtières que si un faîtage est saisi", () => {
    expect(toitureToles({ surfaceM2: 100, longueurToleM: 2 }, RATIOS, 0).lignes).toHaveLength(3);
    const avec = toitureToles({ surfaceM2: 100, longueurToleM: 2, faitageM: 10 }, RATIOS, 0);
    expect(avec.lignes).toHaveLength(4);
    expect(quantite(avec, "faitieres")).toBe(6); // 10,5 ml / 2 m
  });

  it("rappelle que la quincaillerie n'est pas au catalogue", () => {
    expect(toitureToles({ surfaceM2: 50, longueurToleM: 3 }, RATIOS).reserves.join(" ")).toContain(
      "quincaillerie",
    );
  });
});

describe("indépendance aux ratios", () => {
  it("suit les dimensions de bloc reglees par l'admin, sans rien coder en dur", () => {
    // Depuis le calepinage, ce sont les DIMENSIONS du bloc qui commandent le
    // compte, plus un ratio « pieces au m2 » — un mur se monte en rangees.
    // L'admin garde la main : il regle les dimensions.
    const grand: Ratios = { ...RATIOS, "mur_parpaing.bloc_longueur_cm": 50 };
    const r = murParpaings({ longueurM: 10, hauteurM: 3, epaisseurCm: 15 }, grand, 0);
    // 10 / 0,50 = 20 blocs par rangee, 3 / 0,20 = 15 rangees.
    expect(quantite(r, "blocs")).toBe(300);

    const standard = murParpaings({ longueurM: 10, hauteurM: 3, epaisseurCm: 15 }, RATIOS, 0);
    // 10 / 0,40 = 25 par rangee : le meme mur demande plus de blocs plus petits.
    expect(quantite(standard, "blocs")).toBe(375);
  });
});
