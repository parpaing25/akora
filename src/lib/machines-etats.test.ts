import { describe, it, expect } from "vitest";
import {
  TRANSITIONS_COMMANDE,
  TRANSITIONS_PAIEMENT,
  estTerminalCommande,
  estTerminalPaiement,
  suitesFournisseur,
  transitionCommandePossible,
  transitionPaiementPossible,
} from "./machines-etats";
import type { StatutCommande, StatutPaiement } from "./types-metier";

describe("machine à états des paiements", () => {
  it("suit le chemin nominal de la spec B9", () => {
    const chemin: StatutPaiement[] = ["initie", "en_attente_client", "en_verification", "confirme", "sequestre", "libere"];
    for (let i = 0; i < chemin.length - 1; i++) {
      expect(transitionPaiementPossible(chemin[i]!, chemin[i + 1]!)).toBe(true);
    }
  });

  it("interdit les sauts d'étape", () => {
    expect(transitionPaiementPossible("initie", "sequestre")).toBe(false);
    expect(transitionPaiementPossible("en_attente_client", "libere")).toBe(false);
    expect(transitionPaiementPossible("confirme", "libere")).toBe(false);
  });

  it("interdit tout retour en arrière", () => {
    expect(transitionPaiementPossible("sequestre", "confirme")).toBe(false);
    expect(transitionPaiementPossible("confirme", "en_attente_client")).toBe(false);
    expect(transitionPaiementPossible("libere", "sequestre")).toBe(false);
  });

  it("connaît les cinq états terminaux", () => {
    const terminaux: StatutPaiement[] = ["libere", "rembourse", "rejete", "expire", "echoue"];
    for (const statut of terminaux) expect(estTerminalPaiement(statut)).toBe(true);
    for (const statut of ["initie", "en_attente_client", "en_verification", "confirme", "sequestre"] as StatutPaiement[]) {
      expect(estTerminalPaiement(statut)).toBe(false);
    }
  });

  it("permet le remboursement depuis confirmé comme depuis séquestre", () => {
    expect(transitionPaiementPossible("confirme", "rembourse")).toBe(true);
    expect(transitionPaiementPossible("sequestre", "rembourse")).toBe(true);
  });

  it("ne laisse aucun état sans définition", () => {
    const tous: StatutPaiement[] = [
      "initie", "en_attente_client", "en_verification", "confirme", "sequestre",
      "libere", "rembourse", "rejete", "expire", "echoue",
    ];
    for (const statut of tous) expect(TRANSITIONS_PAIEMENT[statut]).toBeDefined();
  });
});

describe("machine à états des commandes", () => {
  it("suit le chemin nominal jusqu'à la clôture", () => {
    const chemin: StatutCommande[] = [
      "brouillon", "envoyee", "vue", "acceptee", "en_attente_paiement",
      "payee", "en_preparation", "en_livraison", "livree", "cloturee",
    ];
    for (let i = 0; i < chemin.length - 1; i++) {
      expect(transitionCommandePossible(chemin[i]!, chemin[i + 1]!)).toBe(true);
    }
  });

  it("refuse de clôturer une commande qui n'a pas été livrée", () => {
    expect(transitionCommandePossible("envoyee", "cloturee")).toBe(false);
    expect(transitionCommandePossible("payee", "cloturee")).toBe(false);
    expect(transitionCommandePossible("en_livraison", "cloturee")).toBe(false);
  });

  it("ne rouvre jamais une commande clôturée, annulée ou refusée", () => {
    for (const statut of ["cloturee", "annulee", "refusee"] as StatutCommande[]) {
      expect(estTerminalCommande(statut)).toBe(true);
      expect(TRANSITIONS_COMMANDE[statut]).toHaveLength(0);
    }
  });

  it("laisse ouvrir un litige à partir du moment où de l'argent est engagé", () => {
    for (const statut of ["payee", "en_preparation", "en_livraison", "livree"] as StatutCommande[]) {
      expect(transitionCommandePossible(statut, "litige")).toBe(true);
    }
    expect(transitionCommandePossible("envoyee", "litige")).toBe(false);
  });

  it("permet de revenir à « acceptée » quand un paiement échoue", () => {
    expect(transitionCommandePossible("en_attente_paiement", "acceptee")).toBe(true);
  });

  it("propose au fournisseur les suites réellement possibles, dans l'ordre", () => {
    expect(suitesFournisseur("envoyee")).toEqual(["vue", "refusee", "annulee"]);
    expect(suitesFournisseur("payee")).toEqual(["en_preparation", "annulee"]);
    expect(suitesFournisseur("en_livraison")).toEqual(["livree"]);
    expect(suitesFournisseur("cloturee")).toEqual([]);
  });
});
