import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Coquille } from "@/components/layout/Coquille";
import { RouteProtegee } from "@/components/RouteProtegee";
import { Squelette } from "@/components/ui/skeleton";
import Accueil from "@/pages/Accueil";
import type { RoleApplicatif } from "@/lib/types-metier";

/**
 * Routeur complet (spec D1).
 *
 * Toutes les routes sont en `React.lazy` SAUF l'accueil, qui porte le LCP et
 * ne doit pas attendre un second aller-retour reseau (A4).
 *
 * Les pages « AVenir » appartiennent a une etape de construction non encore
 * livree (partie E) ; chaque etape les remplace par la vraie page.
 */
const AVenir = lazy(() => import("@/pages/AVenir"));
const NonTrouve = lazy(() => import("@/pages/NonTrouve"));
const Connexion = lazy(() => import("@/pages/auth/Connexion"));
const Inscription = lazy(() => import("@/pages/auth/Inscription"));
const MotDePasseOublie = lazy(() => import("@/pages/auth/MotDePasseOublie"));
const VerificationEmail = lazy(() => import("@/pages/auth/VerificationEmail"));

const PUBLIQUES = [
  "materiaux",
  "materiaux/:categorie",
  "materiaux/:categorie/:refSlug",
  "fournisseurs",
  "fournisseurs/:slug",
  "fournisseurs/:slug/:produitSlug",
  "recherche",
  "panier",
  "commander",
  "commande/:numero",
  "paiement/:numero",
  "calculateurs",
  "calculateurs/:type",
  "prix/:materiau/:ville",
  "guides/:slug",
  "verification",
  "devenir-fournisseur",
  "a-propos",
  "contact",
  "conditions-utilisation",
  "politique-confidentialite",
  "mentions-legales",
];

const ACHETEUR = ["compte", "compte/commandes", "compte/paiements", "compte/favoris", "compte/adresses", "compte/securite"];

const PRO = [
  "pro",
  "pro/verification",
  "pro/catalogue",
  "pro/catalogue/nouveau",
  "pro/catalogue/:id",
  "pro/livraison",
  "pro/commandes",
  "pro/commandes/:id",
  "pro/portefeuille",
  "pro/vitrine",
  "pro/avis",
  "pro/statistiques",
];

const ADMIN = [
  "admin",
  "admin/verifications",
  "admin/materiaux",
  "admin/paiements",
  "admin/litiges",
  "admin/versements",
  "admin/referentiels",
  "admin/moderation",
  "admin/audit",
];

/** Squelette de transition. Jamais de spinner plein ecran (§5). */
function Attente() {
  return (
    <div className="container space-y-3 py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement de la page</span>
      <Squelette className="h-8 w-1/2" />
      <Squelette className="h-4 w-3/4" />
      <Squelette className="h-64 w-full" />
    </div>
  );
}

function routesProtegees(chemins: string[], role?: RoleApplicatif) {
  return chemins.map((chemin) => (
    <Route
      key={chemin}
      path={chemin}
      element={
        <RouteProtegee role={role}>
          <AVenir />
        </RouteProtegee>
      }
    />
  ));
}

export default function App() {
  return (
    <Suspense fallback={<Attente />}>
      <Routes>
        <Route element={<Coquille />}>
          <Route index element={<Accueil />} />
          {PUBLIQUES.map((chemin) => (
            <Route key={chemin} path={chemin} element={<AVenir />} />
          ))}

          <Route path="connexion" element={<Connexion />} />
          <Route path="inscription" element={<Inscription />} />
          <Route path="mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="verification-email" element={<VerificationEmail />} />

          {routesProtegees(ACHETEUR)}
          {routesProtegees(PRO, "fournisseur")}
          {routesProtegees(ADMIN, "admin")}

          <Route path="*" element={<NonTrouve />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
