import { describe, expect, it } from "vitest";
import {
  calepinerDalle,
  calepinerMur,
  calepinerToiture,
  hourdisParM2,
  type FormatHourdis,
} from "./calepinage";

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

describe("calepinerMur", () => {
  const BLOC = { blocLongueurCm: 40, blocHauteurCm: 20 };

  it("monte le mur en rangees entieres", () => {
    // 4,00 / 0,40 = 10 blocs ; 2,50 / 0,20 = 12,5 → 13 rangees.
    const m = calepinerMur({ longueurM: 4, hauteurM: 2.5, ...BLOC });
    expect(m.blocsParRangee).toBe(10);
    expect(m.nbRangees).toBe(13);
    expect(m.nbBlocs).toBe(130);
    // Le ratio en annoncait 125 : cinq de moins, et le mur s'arrete.
    expect(m.nbBlocsParRatio).toBe(125);
    expect(m.ecartPct).toBeCloseTo(4, 0);
  });

  it("deduit les ouvertures a l'unite INFERIEURE", () => {
    // Une baie de 2 m2 vaut 25 blocs pile ; une de 2,1 m2 en vaut 26,25 et
    // on n'en deduit que 26 — mieux vaut deux blocs de trop qu'un chantier
    // arrete pour deux blocs.
    const m = calepinerMur({ longueurM: 4, hauteurM: 2.5, ouverturesM2: 2.1, ...BLOC });
    expect(m.blocsDeduits).toBe(26);
    expect(m.nbBlocs).toBe(104);
  });

  it("ne deduit jamais plus que le mur ne contient", () => {
    const m = calepinerMur({ longueurM: 2, hauteurM: 2, ouverturesM2: 999, ...BLOC });
    expect(m.nbBlocs).toBe(0);
  });

  it("rend zero sur un mur vide", () => {
    expect(calepinerMur({ longueurM: 0, hauteurM: 2.5, ...BLOC }).nbBlocs).toBe(0);
  });
});

describe("calepinerToiture", () => {
  const TOLE = { toleLongueurM: 2, largeurUtileM: 0.8 };

  it("pose les toles entieres, en rangees", () => {
    // Rampant 4,50 m → 3 rangees de 2 m ; longueur 8 m → 10 toles par rangee.
    const t = calepinerToiture({ longueurM: 8, rampantM: 4.5, ...TOLE });
    expect(t.nbRangees).toBe(3);
    expect(t.tolesParRangee).toBe(10);
    expect(t.nbToles).toBe(30);
    // Le ratio : 36 m2 / 1,6 = 22,5 → 23. Sept toles de moins.
    expect(t.nbTolesParRatio).toBe(23);
    expect(t.ecartPct).toBeGreaterThan(30);
  });

  it("tombe juste quand tout est multiple", () => {
    const t = calepinerToiture({ longueurM: 8, rampantM: 4, ...TOLE });
    expect(t.nbToles).toBe(20);
    expect(t.nbTolesParRatio).toBe(20);
  });

  it("ne sous-estime jamais le ratio", () => {
    for (let longueur = 3; longueur <= 20; longueur += 0.5) {
      for (let rampant = 2; rampant <= 8; rampant += 0.5) {
        const t = calepinerToiture({ longueurM: longueur, rampantM: rampant, ...TOLE });
        expect(t.nbToles).toBeGreaterThanOrEqual(t.nbTolesParRatio);
      }
    }
  });

  it("rend zero sur une toiture vide", () => {
    expect(calepinerToiture({ longueurM: 0, rampantM: 4, ...TOLE }).nbToles).toBe(0);
  });
});
