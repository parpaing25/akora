import { describe, it, expect } from "vitest";
import {
  ESPACE_FINE,
  formaterAriary,
  formaterNombre,
  arrondirCentaineSup,
  telephoneValide,
  normaliserTelephone,
  formaterTelephone,
  operateurProbable,
  formaterDistance,
  slugifier,
} from "./format";

describe("argent", () => {
  it("sépare les milliers par une espace fine insécable", () => {
    expect(formaterNombre(1_250_000)).toBe(`1${ESPACE_FINE}250${ESPACE_FINE}000`);
    expect(formaterNombre(999)).toBe("999");
    expect(formaterNombre(1000)).toBe(`1${ESPACE_FINE}000`);
    expect(formaterNombre(0)).toBe("0");
  });

  it("affiche l'Ariary sans décimale", () => {
    expect(formaterAriary(1400)).toBe(`1${ESPACE_FINE}400${ESPACE_FINE}Ar`);
    // Une valeur non entière ne doit jamais produire de centimes affichés.
    expect(formaterAriary(1400.7)).toBe(`1${ESPACE_FINE}400${ESPACE_FINE}Ar`);
  });

  it("arrondit à la centaine supérieure", () => {
    expect(arrondirCentaineSup(12_301)).toBe(12_400);
    expect(arrondirCentaineSup(12_300)).toBe(12_300);
    expect(arrondirCentaineSup(1)).toBe(100);
    expect(arrondirCentaineSup(0)).toBe(0);
  });
});

describe("téléphone", () => {
  it("accepte les formes locale et internationale", () => {
    expect(telephoneValide("0341234567")).toBe(true);
    expect(telephoneValide("+261341234567")).toBe(true);
    expect(telephoneValide("034 12 345 67")).toBe(true);
  });

  it("refuse les numéros hors plage mobile", () => {
    expect(telephoneValide("0311234567")).toBe(false); // 031 n'existe pas
    expect(telephoneValide("034123456")).toBe(false); // un chiffre en moins
    expect(telephoneValide("020 22 123 45")).toBe(false); // fixe
    expect(telephoneValide("")).toBe(false);
  });

  it("normalise toujours vers +261", () => {
    expect(normaliserTelephone("0341234567")).toBe("+261341234567");
    expect(normaliserTelephone("+261 34 12 345 67")).toBe("+261341234567");
    expect(normaliserTelephone("bonjour")).toBeNull();
  });

  it("affiche au format +261 3X XX XXX XX", () => {
    expect(formaterTelephone("0341234567")).toBe("+261 34 12 345 67");
  });
});

describe("opérateur mobile money", () => {
  it("déduit l'opérateur du préfixe", () => {
    expect(operateurProbable("0321234567")).toBe("orange_money");
    expect(operateurProbable("0331234567")).toBe("airtel_money");
    expect(operateurProbable("0341234567")).toBe("mvola");
    expect(operateurProbable("0381234567")).toBe("mvola");
  });

  it("ne devine rien sur un préfixe inconnu ou un numéro invalide", () => {
    expect(operateurProbable("0391234567")).toBeNull();
    expect(operateurProbable("0311234567")).toBeNull();
  });
});

describe("divers", () => {
  it("formate la distance avec une virgule française", () => {
    expect(formaterDistance(12.44)).toBe(`12,4${ESPACE_FINE}km`);
  });

  it("produit des slugs sans accent ni majuscule", () => {
    expect(slugifier("Sable de rivière")).toBe("sable-de-riviere");
    expect(slugifier("Agglomérés & préfabriqués béton")).toBe("agglomeres-prefabriques-beton");
    expect(slugifier("  Ø12  ")).toBe("12");
  });
});
