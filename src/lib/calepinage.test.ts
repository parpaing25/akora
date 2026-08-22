import { describe, expect, it } from "vitest";
import { calepinerDalle, hourdisParM2, type FormatHourdis } from "./calepinage";

/** Hourdis beton courant : franchit 60 cm entre poutrelles, 20 cm de pas. */
const H60x20: FormatHourdis = { slug: "hourdis-16", entraxeCm: 60, pasCm: 20, hauteurCm: 16 };
/** Hourdis terre cuite malgache : carre, 33 x 33. */
const H33x33: FormatHourdis = { slug: "hourdis-tc-15", entraxeCm: 33, pasCm: 33, hauteurCm: 15 };

describe("hourdisParM2", () => {
  it("retrouve les ratios publies", () => {
    // Notre referentiel annonce 8,33 pour le 60 x 20.
    expect(hourdisParM2(H60x20)).toBeCloseTo(8.33, 2);
    // Les briqueteries de Tana annoncent 9 pour le 33 x 33.
    expect(hourdisParM2(H33x33)).toBeCloseTo(9.18, 2);
  });
});

describe("calepinerDalle", () => {
  it("compte une poutrelle de plus qu'il n'y a de files", () => {
    // Il en faut une de chaque cote : quatre files demandent cinq poutrelles.
    const d = calepinerDalle({ porteeM: 4, largeurM: 2.4, format: H60x20 });
    expect(d.nbFiles).toBe(4);
    expect(d.nbPoutrelles).toBe(5);
  });

  it("arrondit la derniere file au superieur, meme incomplete", () => {
    // 4,00 / 0,60 = 6,67 : la septieme file existe, plus etroite.
    const d = calepinerDalle({ porteeM: 5.5, largeurM: 4, format: H60x20 });
    expect(d.nbFiles).toBe(7);
    expect(d.nbPoutrelles).toBe(8);
    expect(d.entraxeReelM).toBeCloseTo(0.571, 3);
  });

  it("le cas de 22 m2 : c'est la que le ratio decrochait", () => {
    const d = calepinerDalle({ porteeM: 5.5, largeurM: 4, format: H60x20 });
    // 5,50 / 0,20 = 27,5 → 28 hourdis par file, 7 files.
    expect(d.hourdisParFile).toBe(28);
    expect(d.nbHourdis).toBe(196);
    // Le ratio en annoncait 184 : on en aurait manque douze.
    expect(d.nbHourdisParRatio).toBe(184);
    expect(d.ecartHourdisPct).toBeGreaterThan(6);
    // Et 44 ml de poutrelles au lieu de 36,7 : vingt pour cent d'ecart.
    expect(d.mlPoutrelles).toBe(44);
    expect(d.mlPoutrellesParRatio).toBeCloseTo(36.67, 1);
    expect(d.ecartPoutrellesPct).toBeGreaterThan(19);
  });

  it("ne sous-estime JAMAIS le ratio", () => {
    // Propriete de fond : arrondir chaque file au superieur ne peut pas
    // donner moins que la multiplication. Si un jour c'est le cas, le
    // calepinage est faux.
    for (const format of [H60x20, H33x33]) {
      for (let portee = 2; portee <= 6; portee += 0.25) {
        for (let largeur = 2; largeur <= 8; largeur += 0.25) {
          const d = calepinerDalle({ porteeM: portee, largeurM: largeur, format });
          expect(d.nbHourdis).toBeGreaterThanOrEqual(d.nbHourdisParRatio - 1);
          expect(d.mlPoutrelles).toBeGreaterThanOrEqual(d.mlPoutrellesParRatio);
        }
      }
    }
  });

  it("tombe juste quand les dimensions sont des multiples exacts", () => {
    // 4,80 / 0,60 = 8 files pile, 6,00 / 0,20 = 30 hourdis pile.
    const d = calepinerDalle({ porteeM: 6, largeurM: 4.8, format: H60x20 });
    expect(d.nbFiles).toBe(8);
    expect(d.hourdisParFile).toBe(30);
    expect(d.nbHourdis).toBe(240);
    expect(d.entraxeReelM).toBeCloseTo(0.6, 6);
  });

  it("suit le format malgache 33 x 33", () => {
    const d = calepinerDalle({ porteeM: 4, largeurM: 3.3, format: H33x33 });
    expect(d.nbFiles).toBe(10);
    expect(d.hourdisParFile).toBe(13); // 4,00 / 0,33 = 12,1 → 13
    expect(d.nbHourdis).toBe(130);
  });

  it("rend zero sur une dalle vide, sans diviser par zero", () => {
    const d = calepinerDalle({ porteeM: 0, largeurM: 4, format: H60x20 });
    expect(d.nbHourdis).toBe(0);
    expect(d.entraxeReelM).toBe(0);
    expect(Number.isFinite(d.ecartHourdisPct)).toBe(true);
  });
});
