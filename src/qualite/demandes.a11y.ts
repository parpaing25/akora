import { describe, expect, it } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Formulaire, VueDemande } from "@/pages/public/DemandeNouvelle";
import { CarteDemande } from "@/pages/pro/Demandes";
import type { DemandePourDepot, MaDemande } from "@/lib/donnees/demandes";
import { FournisseurInfobulle } from "@/components/ui/tooltip";

/**
 * Les écrans de la demande structurée (02/09/2026), rendus CONNECTÉ.
 *
 * La suite des écrans (`ecrans.a11y.ts`) rend sans session : elle n'audite
 * que la porte de connexion. Ici, les sous-composants sont rendus avec des
 * données d'exemple — le formulaire, la demande avec ses propositions, la
 * carte côté dépôt formulaire déplié — et audités par axe.
 *
 * Bonus : quand AKORA_APERCU pointe vers un dossier, le HTML rendu y est
 * écrit, pour être REGARDÉ dans un navigateur avec la feuille de style du
 * build (règle : un test vert ne dit rien de ce qui s'affiche).
 */
const DEMANDE: MaDemande = {
  id: "d1",
  statut: "ouverte",
  localite_id: null,
  localite_nom: "Ankadindramamy",
  lat: -18.89,
  lng: 47.56,
  libelle_lieu: "Ankadindramamy",
  date_souhaitee: "2026-09-10",
  note: "Accès camion 10 roues possible.",
  created_at: "2026-09-02T08:00:00Z",
  expire_le: "2026-09-16T08:00:00Z",
  lignes: [
    { id: "l1", materiau_ref_id: "m1", materiau_slug: "hourdis-tc-20", nom: "Hourdis 20×33×33", quantite: 100, unite: "piece", precision: null },
    { id: "l2", materiau_ref_id: "m2", materiau_slug: "sable-fin", nom: "Sable fin", quantite: 6, unite: "m3", precision: null },
  ],
  propositions: [
    {
      id: "p1", statut: "envoyee", livraison: 62000, delai_jours: 2, message: "Stock disponible dès demain.",
      created_at: "2026-09-02T09:00:00Z",
      fournisseur: { id: "f1", slug: "hourdis-mg", raison_sociale: "Hourdis MG", niveau_verification: "non_verifie", localite_nom: "Sabotsy Namehana", lat: null, lng: null },
      lignes: [{ ligne_id: "l1", prix_unitaire: 3400, disponible: true }, { ligne_id: "l2", prix_unitaire: null, disponible: false }],
    },
  ],
};

const POUR_DEPOT: DemandePourDepot = {
  id: "d1", libelle_lieu: "Ankadindramamy", localite_nom: "Ankadindramamy", distance_km: 9.8,
  date_souhaitee: "2026-09-10", note: "Accès camion 10 roues possible.", created_at: "2026-09-02T08:00:00Z",
  expire_le: "2026-09-16T08:00:00Z",
  lignes: [
    { id: "l1", materiau_ref_id: "m1", nom: "Hourdis 20×33×33", quantite: 100, unite: "piece", precision: null, mon_produit_id: "pr1", mon_prix: 3400 },
    { id: "l2", materiau_ref_id: "m2", nom: "Sable fin", quantite: 6, unite: "m3", precision: null, mon_produit_id: null, mon_prix: null },
  ],
  nb_correspondances: 1, deja_propose: false, statut_proposition: null,
};

const ECRANS: [string, React.ReactElement][] = [
  ["demande-formulaire", React.createElement(Formulaire, { onCree: () => {} })],
  ["demande-propositions", React.createElement(VueDemande, { demande: DEMANDE, onChange: () => {} })],
  ["pro-demande-proposer", React.createElement(CarteDemande, { demande: POUR_DEPOT, onPropose: () => {}, ouvertAuDepart: true })],
];

function html(element: React.ReactElement): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return renderToString(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(MemoryRouter, null, React.createElement(FournisseurInfobulle, null, element)),
    ),
  );
}

describe("demande structurée — écrans connectés", () => {
  const apercu = process.env.AKORA_APERCU;
  if (apercu) mkdirSync(apercu, { recursive: true });

  for (const [nom, element] of ECRANS) {
    it(`${nom} : aucune violation critique ni sérieuse`, async () => {
      const rendu = html(element);
      if (apercu) {
        writeFileSync(
          join(apercu, `${nom}.html`),
          `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="${process.env.AKORA_CSS ?? ""}"></head><body class="bg-background text-foreground"><div class="container py-6">${rendu}</div></body></html>`,
          "utf8",
        );
      }
      document.body.innerHTML = `<main id="racine">${rendu}</main>`;
      const resultat = await axe.run(document.body, {
        rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
      });
      const graves = resultat.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      if (graves.length > 0) {
        console.error(nom, graves.map((v) => `${v.id} (${v.impact}) : ${v.nodes.length} nœud(s) — ${v.help}`));
      }
      expect(graves).toHaveLength(0);
    });
  }
});
