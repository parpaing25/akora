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

// ── Espace fournisseur (etape 3) ─────────────────────────────────────────
const CoquillePro = lazy(() =>
  import("@/components/pro/CoquillePro").then((m) => ({ default: m.CoquillePro })),
);
const ProTableauDeBord = lazy(() => import("@/pages/pro/TableauDeBord"));
const ProVerification = lazy(() => import("@/pages/pro/Verification"));
const ProCatalogue = lazy(() => import("@/pages/pro/Catalogue"));
const ProProduitEditeur = lazy(() => import("@/pages/pro/ProduitEditeur"));
const ProLivraison = lazy(() => import("@/pages/pro/Livraison"));
const ProVitrine = lazy(() => import("@/pages/pro/Vitrine"));

// ── Vitrine publique, comparateur, panier et commande (etapes 4, 6, 7) ───
const Materiaux = lazy(() => import("@/pages/public/Materiaux"));
const MateriauxFamille = lazy(() => import("@/pages/public/MateriauxFamille"));
const Comparateur = lazy(() => import("@/pages/public/Comparateur"));
const Fournisseurs = lazy(() => import("@/pages/public/Fournisseurs"));
const FournisseurFiche = lazy(() => import("@/pages/public/FournisseurFiche"));
const ProduitFiche = lazy(() => import("@/pages/public/ProduitFiche"));
const Recherche = lazy(() => import("@/pages/public/Recherche"));
const Panier = lazy(() => import("@/pages/public/Panier"));
const Commander = lazy(() => import("@/pages/public/Commander"));
const CommandeSuivi = lazy(() => import("@/pages/public/CommandeSuivi"));
const Paiement = lazy(() => import("@/pages/public/Paiement"));

const PUBLIQUES = [
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

/** Sous-routes de l'espace pro pas encore construites (etapes 7 a 9). */
const PRO_A_VENIR = ["commandes", "commandes/:id", "portefeuille", "avis", "statistiques"];

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

          <Route path="materiaux" element={<Materiaux />} />
          <Route path="materiaux/:categorie" element={<MateriauxFamille />} />
          <Route path="materiaux/:categorie/:refSlug" element={<Comparateur />} />
          <Route path="fournisseurs" element={<Fournisseurs />} />
          <Route path="fournisseurs/:slug" element={<FournisseurFiche />} />
          <Route path="fournisseurs/:slug/:produitSlug" element={<ProduitFiche />} />
          <Route path="recherche" element={<Recherche />} />
          <Route path="panier" element={<Panier />} />
          <Route path="commander" element={<Commander />} />
          <Route path="commande/:numero" element={<CommandeSuivi />} />
          <Route path="paiement/:numero" element={<Paiement />} />

          {PUBLIQUES.map((chemin) => (
            <Route key={chemin} path={chemin} element={<AVenir />} />
          ))}

          <Route path="connexion" element={<Connexion />} />
          <Route path="inscription" element={<Inscription />} />
          <Route path="mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="verification-email" element={<VerificationEmail />} />

          {routesProtegees(ACHETEUR)}

          <Route
            path="pro"
            element={
              <RouteProtegee role="fournisseur">
                <CoquillePro />
              </RouteProtegee>
            }
          >
            <Route index element={<ProTableauDeBord />} />
            <Route path="verification" element={<ProVerification />} />
            <Route path="catalogue" element={<ProCatalogue />} />
            <Route path="catalogue/nouveau" element={<ProProduitEditeur />} />
            <Route path="catalogue/:id" element={<ProProduitEditeur />} />
            <Route path="livraison" element={<ProLivraison />} />
            <Route path="vitrine" element={<ProVitrine />} />
            {PRO_A_VENIR.map((chemin) => (
              <Route key={chemin} path={chemin} element={<AVenir />} />
            ))}
          </Route>

          {routesProtegees(ADMIN, "admin")}

          <Route path="*" element={<NonTrouve />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
