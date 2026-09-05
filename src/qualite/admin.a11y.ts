import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";

import { FournisseurAuth } from "@/hooks/useAuth";
import { FournisseurInfobulle } from "@/components/ui/tooltip";
import type { Activite, ChiffresDuJour, CompteAdmin, PointSerie } from "@/lib/donnees/pilotage";

/**
 * Passe axe-core des écrans d'administration (03/09/2026).
 *
 * ⚠ CES ÉCRANS NE SE RENDENT QU'AVEC DES DONNÉES : sans elles, on n'auditerait
 *   que des squelettes. Le cache de react-query est donc PRÉ-REMPLI avec des
 *   fixtures (setQueryData) — `useQuery` les rend de façon synchrone, et
 *   renderToString voit l'écran chargé, tableau et cartes compris. Aucune
 *   requête ne part : le module de données est remplacé.
 *
 * Volumes des fixtures : ceux de la base le 03/09 (7 comptes, 6 dépôts,
 * 40 produits), pour auditer un écran qui ressemble au vrai.
 */
vi.mock("@/lib/donnees/pilotage", async (importer) => {
  const reel = await importer<typeof import("@/lib/donnees/pilotage")>();
  return {
    ...reel,
    chiffresDuJour: vi.fn(),
    seriesAdmin: vi.fn(),
    listerUtilisateursAdmin: vi.fn(),
    activiteAdmin: vi.fn(),
    definirRoleAdmin: vi.fn(),
  };
});

const CHIFFRES: ChiffresDuJour = {
  utilisateurs: 7,
  utilisateurs_7j: 2,
  actifs_7j: 3,
  fournisseurs: { actif: 2, brouillon: 2, en_attente: 1, suspendu: 1 },
  fournisseurs_verifies: 1,
  produits_actifs: 12,
  produits_total: 40,
  commandes: { envoyee: 1, payee: 2 },
  commandes_7j: 3,
  volume_7j: 1_250_000,
  commissions_7j: 37_500,
  paiements_a_verifier: 1,
  litiges_ouverts: 0,
  retraits_a_traiter: 2,
  kyc_en_attente: 3,
  materiaux_demandes: 1,
  publications: 10,
  publications_signalees: 0,
  demandes_ouvertes: 0,
  releves_prix: 46,
  vues_7j: 8,
  avis_en_attente: 0,
  calcule_le: "2026-09-03T12:00:00Z",
};

const SERIES: PointSerie[] = Array.from({ length: 30 }, (_, i) => ({
  jour: `2026-08-${String(5 + (i % 26)).padStart(2, "0")}`,
  inscriptions: i % 4 === 0 ? 1 : 0,
  commandes: i % 7 === 0 ? 2 : 0,
  vues: (i * 3) % 5,
  volume: i % 7 === 0 ? 400_000 : 0,
}));

const COMPTES: CompteAdmin[] = [
  {
    id: "abe73060-3131-4509-b37e-cd8f58805401",
    email: "onjaniaina27@gmail.com",
    nom_complet: "Onja Andrianirina",
    telephone: "034 00 000 00",
    ville: "Antananarivo",
    type_client: "particulier",
    roles: ["acheteur", "admin", "fournisseur", "super_admin"],
    fournisseur: "Hourdis MG",
    fournisseur_statut: "actif",
    cree_le: "2026-08-22T10:00:00Z",
    derniere_connexion: "2026-09-03T08:00:00Z",
    email_verifie: true,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    email: "acheteur@example.mg",
    nom_complet: null,
    telephone: null,
    ville: null,
    type_client: null,
    roles: ["acheteur"],
    fournisseur: null,
    fournisseur_statut: null,
    cree_le: "2026-09-01T10:00:00Z",
    derniere_connexion: null,
    email_verifie: false,
  },
];

const ACTIVITE: Activite[] = [
  { id: 1, quand: "2026-09-02T07:52:40Z", acteur: "Onja Andrianirina", action: "document.valide", entite: "documents_fournisseur", entite_id: "5f1c…" },
  { id: 2, quand: "2026-09-01T18:00:00Z", acteur: "système", action: "fiche.publiee", entite: "fournisseurs", entite_id: null },
];

function html(Ecran: React.ComponentType): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["admin", "chiffres"], CHIFFRES);
  client.setQueryData(["admin", "series", 30], SERIES);
  client.setQueryData(["admin", "series", 7], SERIES.slice(0, 7));
  client.setQueryData(["admin", "activite"], ACTIVITE);
  client.setQueryData(["admin", "utilisateurs", ""], COMPTES);
  return renderToString(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(FournisseurAuth, null, React.createElement(FournisseurInfobulle, null, React.createElement(Ecran))),
      ),
    ),
  );
}

describe("accessibilité des écrans d'administration", () => {
  const ECRANS: [string, () => Promise<{ default: React.ComponentType }>][] = [
    ["Tableau de bord", () => import("@/pages/admin/TableauDeBord")],
    ["Utilisateurs", () => import("@/pages/admin/Utilisateurs")],
    ["Statistiques", () => import("@/pages/admin/Statistiques")],
  ];
  for (const [nom, charger] of ECRANS) {
    it(`${nom} : rendu chargé, aucune violation critique ni sérieuse`, async () => {
      const { default: Ecran } = await charger();
      const rendu = html(Ecran);
      // Le rendu n'est pas un squelette : les chiffres des fixtures sont là.
      expect(rendu).not.toContain("squelette");
      document.body.innerHTML = `<main id="racine">${rendu}</main>`;
      const resultat = await axe.run(document.body, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
        rules: { "color-contrast": { enabled: false } },
      });
      const graves = resultat.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(
        graves.map((v) => `${v.id} : ${v.nodes.map((n) => n.html.slice(0, 80)).join(" | ")}`),
      ).toEqual([]);
    });
  }
});
