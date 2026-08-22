import { describe, expect, it } from "vitest";
import { forceMotDePasse, libelleForce } from "./mot-de-passe";

describe("forceMotDePasse", () => {
  it("ne note rien tant qu'il n'y a rien", () => {
    expect(forceMotDePasse("")).toBe(0);
  });

  it("refuse d'encourager un mot de passe trop court", () => {
    // Court, même mélange : la longueur seule vaut un point, il n'y est pas.
    expect(forceMotDePasse("ab1")).toBe(1);
  });

  it("note la longueur minimale acceptée", () => {
    // 8 caractères, lettres et chiffres : c'est le plancher du formulaire.
    expect(forceMotDePasse("chantier")).toBe(1);
    expect(forceMotDePasse("chanti26")).toBe(2);
  });

  it("récompense la longueur autant que le mélange", () => {
    expect(forceMotDePasse("chantier2026")).toBe(3);
    expect(forceMotDePasse("chantier-2026")).toBe(4);
  });

  it("plafonne à quatre", () => {
    expect(forceMotDePasse("Un-Tres-Long-Mot-De-Passe-2026!")).toBe(4);
  });

  it("compte les lettres accentuées comme des lettres", () => {
    // Sans cela, « bétonnière2026 » passerait pour un mot de passe sans lettre.
    expect(forceMotDePasse("betonniere2026")).toBe(forceMotDePasse("bétonnière2026"));
  });

  it("donne un libellé à chaque niveau, et rien à zéro", () => {
    expect(libelleForce("")).toBe("");
    expect(libelleForce("chantier2026")).toBe("Solide");
    expect(libelleForce("chantier-2026")).toBe("Tres solide".replace("Tres", "Très"));
  });
});
