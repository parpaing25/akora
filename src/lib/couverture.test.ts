import { describe, expect, it } from "vitest";
import { couverture, quantitePourSurface } from "./couverture";

describe("couverture", () => {
  it("prefere le chiffre publie par le depot a la geometrie", () => {
    // Hourdis MG annonce 12 briques au m2 ; la geometrie en donne 12,5.
    // C'est le depot qui a raison : le joint mange la difference.
    const c = couverture({
      caracteristiques: { pieces_par_m2: 12 },
      materiau_longueur_cm: 40,
      materiau_largeur_cm: 20,
    });
    expect(c).toEqual({ piecesParM2: 12, source: "depot" });
  });

  it("retombe sur les dimensions de pose quand le depot n'a rien publie", () => {
    const c = couverture({ materiau_longueur_cm: 40, materiau_largeur_cm: 20 });
    expect(c?.source).toBe("dimensions");
    expect(c?.piecesParM2).toBeCloseTo(12.5, 3);
  });

  it("retrouve les 9 hourdis au m2 du format 33 x 33", () => {
    const c = couverture({ materiau_longueur_cm: 33, materiau_largeur_cm: 33 });
    expect(c?.piecesParM2).toBeCloseTo(9.18, 2);
  });

  it("ignore une valeur absurde plutot que de l'appliquer", () => {
    // 5000 pieces au m2 : saisie fautive. On repart de la geometrie.
    const c = couverture({
      caracteristiques: { pieces_par_m2: 5000 },
      materiau_longueur_cm: 40,
      materiau_largeur_cm: 20,
    });
    expect(c?.source).toBe("dimensions");
  });

  it("accepte un nombre ecrit en texte, comme le rend parfois le JSON", () => {
    expect(couverture({ caracteristiques: { pieces_par_m2: "9" } })?.piecesParM2).toBe(9);
  });

  it("rend null quand rien ne permet de conclure", () => {
    expect(couverture({})).toBeNull();
    expect(couverture({ caracteristiques: {}, materiau_longueur_cm: 0 })).toBeNull();
  });
});

describe("quantitePourSurface", () => {
  it("arrondit toujours vers le haut : on ne commande pas 12,4 briques", () => {
    expect(quantitePourSurface(1, 12.5)).toBe(13);
    expect(quantitePourSurface(22, 9)).toBe(198);
  });

  it("ne descend jamais sous le minimum du depot", () => {
    expect(quantitePourSurface(0.5, 12, 12)).toBe(12);
  });

  it("tombe juste sur un compte exact, sans ajouter une piece", () => {
    expect(quantitePourSurface(2, 12)).toBe(24);
  });

  it("rend zero sur une surface vide", () => {
    expect(quantitePourSurface(0, 12)).toBe(0);
    expect(quantitePourSurface(10, 0)).toBe(0);
  });
});
