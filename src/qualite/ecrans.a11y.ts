import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";

import Connexion from "@/pages/auth/Connexion";
import Inscription from "@/pages/auth/Inscription";
import MotDePasseOublie from "@/pages/auth/MotDePasseOublie";
import Verification from "@/pages/contenu/Verification";
import DevenirFournisseur from "@/pages/contenu/DevenirFournisseur";
import Conditions from "@/pages/contenu/Conditions";
import Confidentialite from "@/pages/contenu/Confidentialite";
import Contact from "@/pages/contenu/Contact";
import Calculateurs from "@/pages/public/Calculateurs";
import MateriauxFamille from "@/pages/public/MateriauxFamille";
import TypeMateriau from "@/pages/public/TypeMateriau";
import { FournisseurAuth } from "@/hooks/useAuth";
import { FournisseurInfobulle } from "@/components/ui/tooltip";

/**
 * Passe axe-core (recette F, AKORA-DESIGN §12).
 *
 * Rendu STATIQUE : les effets ne tournent pas, donc aucune requête réseau.
 * On audite la structure — étiquettes, rôles, hiérarchie des titres, noms
 * accessibles — qui est justement ce qui se casse sans qu'on le voie.
 *
 * Limite assumée : jsdom ne calcule pas les couleurs, donc la règle de
 * contraste n'est pas évaluée ici. Elle l'a été à la conception, sur les
 * tokens (AKORA-DESIGN §1) : muted-foreground donne 5,4:1 sur le fond.
 */
/**
 * Force la disposition « grand écran » le temps d'un rendu.
 *
 * Inscription et Connexion n'ont pas la même ARBORESCENCE selon la largeur :
 * écran scindé au-delà de 1024 px, parcours en deux étapes en dessous. Sans ce
 * leurre, la moitié du design ne serait jamais auditée — et c'est justement
 * celle qui porte le panneau latéral et la grille à deux colonnes.
 *
 * On ne remplace que `matchMedia`, que jsdom n'implémente pas : toucher à
 * l'objet `window` entier casserait le reste de l'environnement de test.
 */
function enGrandEcran<T>(rendu: () => T): T {
  const fenetre = globalThis.window as (Window & typeof globalThis) | undefined;
  if (!fenetre) return rendu();
  const precedent = fenetre.matchMedia;
  fenetre.matchMedia = ((requete: string) => ({
    matches: true,
    media: requete,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  try {
    return rendu();
  } finally {
    fenetre.matchMedia = precedent;
  }
}

const ECRANS: [string, React.ComponentType, boolean?][] = [
  ["Connexion", Connexion],
  ["Connexion — écran scindé", Connexion, true],
  ["Inscription", Inscription],
  ["Inscription — écran scindé", Inscription, true],
  ["Mot de passe oublié", MotDePasseOublie],
  ["Que veut dire vérifié", Verification],
  ["Devenir fournisseur", DevenirFournisseur],
  ["Conditions d'utilisation", Conditions],
  ["Politique de confidentialité", Confidentialite],
  ["Contact", Contact],
  ["Calculateurs", Calculateurs],
  ["Matériaux — types d'une famille", MateriauxFamille],
  ["Matériaux — formats d'un type", TypeMateriau],
  ["Matériaux — formats, écran large", TypeMateriau, true],
];

function html(Ecran: React.ComponentType): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return renderToString(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          FournisseurAuth,
          null,
          // Même enveloppe qu'en production (main.tsx) : sans le fournisseur
          // d'infobulles, le badge de vérification ne peut pas se rendre.
          React.createElement(FournisseurInfobulle, null, React.createElement(Ecran)),
        ),
      ),
    ),
  );
}

describe("accessibilité des écrans", () => {
  for (const [nom, Ecran, grandEcran] of ECRANS) {
    it(`${nom} : aucune violation critique ni sérieuse`, async () => {
      const rendu = grandEcran ? enGrandEcran(() => html(Ecran)) : html(Ecran);
      document.body.innerHTML = `<main id="racine">${rendu}</main>`;
      const resultat = await axe.run(document.body, {
        // Le contraste ne se calcule pas en jsdom ; les régions supposent la
        // coquille complète, qui n'est pas montée ici.
        rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
      });
      const graves = resultat.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      if (graves.length > 0) {
        console.error(
          nom,
          graves.map((v) => `${v.id} (${v.impact}) : ${v.nodes.length} nœud(s) — ${v.help}`),
        );
      }
      expect(graves.map((v) => v.id)).toEqual([]);
    });
  }
});
