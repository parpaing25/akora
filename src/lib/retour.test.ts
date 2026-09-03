import { describe, expect, it } from "vitest";
import { retourInterne } from "./retour";

/**
 * Une destination de retour vient de l'URL, donc de n'importe qui. Ce qui
 * passe ici finit dans `navigate()` : chaque refus est un hameçonnage évité.
 */
describe("retourInterne", () => {
  it("accepte un chemin interne ordinaire", () => {
    expect(retourInterne("/compte")).toBe("/compte");
    expect(retourInterne("/materiaux/agglomeres?tri=prix")).toBe("/materiaux/agglomeres?tri=prix");
    expect(retourInterne("/fournisseurs/hourdis-mg/livraison")).toBe("/fournisseurs/hourdis-mg/livraison");
  });

  it("refuse les URL absolues et protocol-relative", () => {
    expect(retourInterne("https://piege.example")).toBeNull();
    expect(retourInterne("//piege.example")).toBeNull();
    expect(retourInterne("/\\piege.example")).toBeNull();
  });

  it("refuse un antislash où qu'il soit — react-router le lit comme une barre", () => {
    // CVE-2025-68470 : « /x\piege.example » devenait « /x//piege.example ».
    expect(retourInterne("/x\\piege.example")).toBeNull();
    expect(retourInterne("/compte\\..\\\\piege.example")).toBeNull();
  });

  it("refuse une double barre, un schéma déguisé et une remontée de dossier", () => {
    expect(retourInterne("/x//piege.example")).toBeNull();
    expect(retourInterne("/javascript:alert(1)")).toBeNull();
    expect(retourInterne("/../admin")).toBeNull();
    expect(retourInterne("/compte/../admin")).toBeNull();
    expect(retourInterne("/compte/..")).toBeNull();
  });

  it("refuse le vide, le nul et un chemin sans barre", () => {
    expect(retourInterne(null)).toBeNull();
    expect(retourInterne("")).toBeNull();
    expect(retourInterne("compte")).toBeNull();
  });
});
