import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";

import { FournisseurAuth } from "@/hooks/useAuth";
import { FournisseurInfobulle } from "@/components/ui/tooltip";
import type { LigneCommande } from "@/lib/donnees/commandes";
import type { DemandePourDepot } from "@/lib/donnees/demandes";

/**
 * Passe axe-core des écrans fournisseur refaits le 03/09/2026 (cockpit et
 * clients). Comme pour l'administration : cache react-query pré-rempli, donc
 * l'écran CHARGÉ est audité, pas un squelette. La fiche du dépôt arrive par
 * le contexte d'`Outlet`, comme en production (CoquillePro).
 */
vi.mock("@/lib/donnees/demandes", async (importer) => ({
  ...(await importer<typeof import("@/lib/donnees/demandes")>()),
  demandesPourMonDepot: vi.fn(),
}));

const FICHE = {
  id: "f-1",
  raison_sociale: "Hourdis MG",
  lat: -18.9,
  lng: 47.5,
  nb_commandes_cloturees: 4,
  niveau_verification: "verifie",
  statut: "actif",
};

const COMMANDES = [
  { id: "c1", acheteur_id: "u1", nom_contact: "Rakoto J.", telephone_contact: "034 12 345 67", email_contact: null, montant_total: 480_000, statut: "envoyee", created_at: "2026-09-02T10:00:00Z" },
  { id: "c2", acheteur_id: "u1", nom_contact: "Rakoto", telephone_contact: "034 12 345 67", email_contact: null, montant_total: 1_200_000, statut: "livree", created_at: "2026-08-20T10:00:00Z" },
  { id: "c3", acheteur_id: null, nom_contact: "Hanta", telephone_contact: "033 00 000 00", email_contact: null, montant_total: 90_000, statut: "cloturee", created_at: "2026-08-10T10:00:00Z" },
] as unknown as LigneCommande[];

const DEMANDES: DemandePourDepot[] = [
  {
    id: "d1",
    libelle_lieu: "Ankadindramamy",
    localite_nom: "Antananarivo",
    distance_km: 6.4,
    date_souhaitee: "2026-09-10",
    note: null,
    created_at: "2026-09-01T08:00:00Z",
    expire_le: "2026-09-15T08:00:00Z",
    lignes: [{ id: "l1", materiau_ref_id: "m1", nom: "Hourdis 20×20×53", quantite: 400, unite: "piece" }],
  } as unknown as DemandePourDepot,
];

function html(Ecran: React.ComponentType): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, enabled: false } } });
  client.setQueryData(["mes-produits", FICHE.id], [
    { id: "p1", statut: "actif", nom_affiche: "Hourdis 20×20×53", prix_unitaire: 4800, prix_promo: null, unite: "piece", stock_statut: "en_stock", prix_maj_le: "2026-09-01T10:00:00Z" },
    { id: "p2", statut: "en_attente_materiau", nom_affiche: "Sable de rivière", prix_unitaire: 65000, prix_promo: null, unite: "m3", stock_statut: "sur_commande", prix_maj_le: "2026-08-20T10:00:00Z" },
  ]);
  client.setQueryData(["documents", FICHE.id], []);
  client.setQueryData(["vehicules", FICHE.id], []);
  client.setQueryData(["commandes-pro", FICHE.id], COMMANDES);
  client.setQueryData(["demandes-pour-depot", FICHE.id], DEMANDES);
  client.setQueryData(["abonnes", FICHE.id], 3);
  client.setQueryData(["vues-7j", FICHE.id, 2], 27);
  return renderToString(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/pro"] },
        React.createElement(
          FournisseurAuth,
          null,
          React.createElement(
            FournisseurInfobulle,
            null,
            React.createElement(
              Routes,
              null,
              React.createElement(
                Route,
                { path: "/pro", element: React.createElement(Outlet, { context: FICHE }) },
                React.createElement(Route, { index: true, element: React.createElement(Ecran) }),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

describe("accessibilité des écrans fournisseur", () => {
  const ECRANS: [string, () => Promise<{ default: React.ComponentType }>, string][] = [
    ["Cockpit du dépôt", () => import("@/pages/pro/TableauDeBord"), "Rakoto J."],
    ["Clients", () => import("@/pages/pro/Clients"), "Hanta"],
    ["Catalogue", () => import("@/pages/pro/Catalogue"), "Hourdis 20×20×53"],
  ];
  for (const [nom, charger, temoin] of ECRANS) {
    it(`${nom} : rendu chargé, aucune violation critique ni sérieuse`, async () => {
      const { default: Ecran } = await charger();
      const rendu = html(Ecran);
      expect(rendu).toContain(temoin);
      document.body.innerHTML = `<main id="racine">${rendu}</main>`;
      const resultat = await axe.run(document.body, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
        rules: { "color-contrast": { enabled: false } },
      });
      const graves = resultat.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(graves.map((v) => `${v.id} : ${v.nodes.map((n) => n.html.slice(0, 80)).join(" | ")}`)).toEqual([]);
    });
  }
});
