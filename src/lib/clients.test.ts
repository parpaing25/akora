import { describe, expect, it } from "vitest";
import { cleClient, lienWhatsApp, regrouperClients } from "./clients";
import type { LigneCommande } from "@/lib/donnees/commandes";

function commande(partiel: Partial<LigneCommande>): LigneCommande {
  return {
    acheteur_id: null,
    nom_contact: "Client",
    telephone_contact: null,
    email_contact: null,
    montant_total: 0,
    statut: "envoyee",
    created_at: "2026-09-01T10:00:00Z",
    ...partiel,
  } as LigneCommande;
}

describe("cleClient", () => {
  it("préfère le compte, puis le téléphone normalisé, puis le courriel", () => {
    expect(cleClient(commande({ acheteur_id: "u1", telephone_contact: "034 12 345 67" }))).toBe("u:u1");
    expect(cleClient(commande({ telephone_contact: "+261 34 12 345 67" }))).toBe("t:0341234567");
    expect(cleClient(commande({ telephone_contact: "034 12 345 67" }))).toBe("t:0341234567");
    expect(cleClient(commande({ email_contact: " Rakoto@Example.mg " }))).toBe("e:rakoto@example.mg");
    expect(cleClient(commande({}))).toBe("anonyme");
  });
});

describe("regrouperClients", () => {
  it("regroupe par client, additionne ce qui est vendu, garde la dernière commande en tête", () => {
    const clients = regrouperClients([
      commande({ telephone_contact: "034 12 345 67", nom_contact: "Rakoto", montant_total: 100_000, statut: "livree", created_at: "2026-08-01T10:00:00Z" }),
      commande({ telephone_contact: "+261 34 12 345 67", nom_contact: "Rakoto J.", montant_total: 50_000, statut: "envoyee", created_at: "2026-09-02T10:00:00Z" }),
      commande({ telephone_contact: "033 00 000 00", nom_contact: "Hanta", montant_total: 700_000, statut: "annulee", created_at: "2026-08-15T10:00:00Z" }),
    ]);
    expect(clients).toHaveLength(2);
    // Le nom de la commande la plus récente ; « envoyee » n'est pas encore
    // vendu ; une commande annulée ne vend rien.
    expect(clients[0]).toMatchObject({
      nom: "Rakoto J.",
      nbCommandes: 2,
      total: 100_000,
      enCours: true,
      dernierStatut: "envoyee",
    });
    expect(clients[1]).toMatchObject({ nom: "Hanta", total: 0, enCours: false });
  });

  it("écarte ce qu'on ne peut ni rappeler ni compter", () => {
    expect(regrouperClients([commande({ nom_contact: "" })])).toEqual([]);
  });
});

describe("lienWhatsApp", () => {
  it("compose un numéro malgache, refuse le reste", () => {
    expect(lienWhatsApp("034 12 345 67")).toBe("https://wa.me/261341234567");
    expect(lienWhatsApp("+261 34 12 345 67")).toBe("https://wa.me/261341234567");
    expect(lienWhatsApp("12")).toBeNull();
    expect(lienWhatsApp(null)).toBeNull();
  });
});
