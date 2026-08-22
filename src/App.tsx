import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Coquille } from "@/components/layout/Coquille";
import { RouteProtegee } from "@/components/RouteProtegee";
import { Squelette } from "@/components/ui/skeleton";

/** Sonner n'entre dans le chunk d'entree pour rien : on le charge apres coup. */
const Toaster = lazy(() => import("@/components/ui/toaster").then((m) => ({ default: m.Toaster })));
import Accueil from "@/pages/Accueil";

/**
 * Routeur complet (spec D1).
 *
 * Toutes les routes sont en `React.lazy` SAUF l'accueil, qui porte le LCP et
 * ne doit pas attendre un second aller-retour reseau (A4).
 */
const NonTrouve = lazy(() => import("@/pages/NonTrouve"));
const DemandeNouvelle = lazy(() => import("@/pages/public/DemandeNouvelle"));
const Connexion = lazy(() => import("@/pages/auth/Connexion"));
const Inscription = lazy(() => import("@/pages/auth/Inscription"));
const MotDePasseOublie = lazy(() => import("@/pages/auth/MotDePasseOublie"));
const VerificationEmail = lazy(() => import("@/pages/auth/VerificationEmail"));
const RetourOAuth = lazy(() => import("@/pages/auth/RetourOAuth"));

// ── Espace fournisseur (etape 3) ─────────────────────────────────────────
const CoquillePro = lazy(() =>
  import("@/components/pro/CoquillePro").then((m) => ({ default: m.CoquillePro })),
);
const ProTableauDeBord = lazy(() => import("@/pages/pro/TableauDeBord"));
const ProVerification = lazy(() => import("@/pages/pro/Verification"));
const ProPublier = lazy(() => import("@/pages/pro/Publier"));
const ProCatalogue = lazy(() => import("@/pages/pro/Catalogue"));
const ProProduitEditeur = lazy(() => import("@/pages/pro/ProduitEditeur"));
const ProLivraison = lazy(() => import("@/pages/pro/Livraison"));
const ProVitrine = lazy(() => import("@/pages/pro/Vitrine"));
const ProCommandes = lazy(() => import("@/pages/pro/Commandes"));
const ProPortefeuille = lazy(() => import("@/pages/pro/Portefeuille"));
const ProAvis = lazy(() => import("@/pages/pro/Avis"));
const ProStatistiques = lazy(() => import("@/pages/pro/Statistiques"));

// ── Espace acheteur ──────────────────────────────────────────────────────
const CoquilleCompte = lazy(() =>
  import("@/components/compte/CoquilleCompte").then((m) => ({ default: m.CoquilleCompte })),
);
const CompteProfil = lazy(() => import("@/pages/compte/Profil"));
const CompteCommandes = lazy(() => import("@/pages/compte/MesCommandes"));
const ComptePaiements = lazy(() => import("@/pages/compte/MesPaiements"));
const CompteFavoris = lazy(() => import("@/pages/compte/Favoris"));
const CompteAdresses = lazy(() => import("@/pages/compte/Adresses"));
const CompteSecurite = lazy(() => import("@/pages/compte/Securite"));

// ── Administration (etape 9) ─────────────────────────────────────────────
const CoquilleAdmin = lazy(() =>
  import("@/components/admin/CoquilleAdmin").then((m) => ({ default: m.CoquilleAdmin })),
);
const AdminVerifications = lazy(() => import("@/pages/admin/Verifications"));
const AdminMateriaux = lazy(() => import("@/pages/admin/MateriauxDemandes"));
const AdminPaiements = lazy(() => import("@/pages/admin/PaiementsAdmin"));
const AdminLitiges = lazy(() => import("@/pages/admin/Litiges"));
const AdminVersements = lazy(() => import("@/pages/admin/Versements"));
const AdminReferentiels = lazy(() => import("@/pages/admin/Referentiels"));
const AdminModeration = lazy(() => import("@/pages/admin/Moderation"));
const AdminAudit = lazy(() => import("@/pages/admin/Audit"));

// ── Calculateurs, prix et contenu editorial (etape 10) ───────────────────
const Calculateurs = lazy(() => import("@/pages/public/Calculateurs"));
const CalculateurDetail = lazy(() => import("@/pages/public/CalculateurDetail"));
const PrixMarche = lazy(() => import("@/pages/public/PrixMarche"));
const Guides = lazy(() => import("@/pages/contenu/Guides"));
const PageVerification = lazy(() => import("@/pages/contenu/Verification"));
const DevenirFournisseur = lazy(() => import("@/pages/contenu/DevenirFournisseur"));
const APropos = lazy(() => import("@/pages/contenu/APropos"));
const Contact = lazy(() => import("@/pages/contenu/Contact"));
const Conditions = lazy(() => import("@/pages/contenu/Conditions"));
const Confidentialite = lazy(() => import("@/pages/contenu/Confidentialite"));
const MentionsLegales = lazy(() => import("@/pages/contenu/MentionsLegales"));

// ── Vitrine publique, comparateur, panier et commande (etapes 4, 6, 7) ───
const Materiaux = lazy(() => import("@/pages/public/Materiaux"));
const MateriauxFamille = lazy(() => import("@/pages/public/MateriauxFamille"));
const TypeMateriau = lazy(() => import("@/pages/public/TypeMateriau"));
const Comparateur = lazy(() => import("@/pages/public/Comparateur"));
const Fournisseurs = lazy(() => import("@/pages/public/Fournisseurs"));
const FournisseurFiche = lazy(() => import("@/pages/public/FournisseurFiche"));
const LivraisonFournisseur = lazy(() => import("@/pages/public/LivraisonFournisseur"));
const ProduitFiche = lazy(() => import("@/pages/public/ProduitFiche"));
const Recherche = lazy(() => import("@/pages/public/Recherche"));
const Panier = lazy(() => import("@/pages/public/Panier"));
const Commander = lazy(() => import("@/pages/public/Commander"));
const CommandeSuivi = lazy(() => import("@/pages/public/CommandeSuivi"));
const Paiement = lazy(() => import("@/pages/public/Paiement"));

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

export default function App() {
  return (
    <Suspense fallback={<Attente />}>
      <Toaster />
      <Routes>
        {/*
          Les pages d'authentification vivent HORS de la coquille : elles
          occupent l'écran entier — panneau latérite à gauche, formulaire à
          droite — et l'en-tête du site n'a rien à y faire. Un menu « Panier »
          au-dessus d'un formulaire d'inscription invite à partir ailleurs.
        */}
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/inscription" element={<Inscription />} />
        <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
        <Route path="/verification-email" element={<VerificationEmail />} />
        <Route path="/auth/retour" element={<RetourOAuth />} />

        <Route element={<Coquille />}>
          <Route index element={<Accueil />} />

          <Route path="materiaux" element={<Materiaux />} />
          {/*
            Trois niveaux : la famille ouvre ses TYPES, le type ouvre ses
            FORMATS, le format ouvre le comparateur. Une URL par niveau, toutes
            indexables — une page par type vaut mieux qu'une liste unique de 92
            références mélangées.
          */}
          <Route path="materiaux/:famille" element={<MateriauxFamille />} />
          <Route path="materiaux/:famille/:type" element={<TypeMateriau />} />
          <Route path="materiaux/:famille/:type/:format" element={<Comparateur />} />
          <Route path="fournisseurs" element={<Fournisseurs />} />
          <Route path="fournisseurs/:slug" element={<FournisseurFiche />} />
          <Route path="fournisseurs/:slug/livraison" element={<LivraisonFournisseur />} />
          <Route path="fournisseurs/:slug/:produitSlug" element={<ProduitFiche />} />
          <Route path="recherche" element={<Recherche />} />
          <Route path="panier" element={<Panier />} />
          <Route path="commander" element={<Commander />} />
          <Route path="commande/:numero" element={<CommandeSuivi />} />
          <Route path="paiement/:numero" element={<Paiement />} />

          <Route path="demandes/nouvelle" element={<DemandeNouvelle />} />
          <Route path="calculateurs" element={<Calculateurs />} />
          <Route path="calculateurs/:type" element={<CalculateurDetail />} />
          <Route path="prix/:materiau/:ville" element={<PrixMarche />} />
          <Route path="guides/:slug" element={<Guides />} />
          <Route path="verification" element={<PageVerification />} />
          <Route path="devenir-fournisseur" element={<DevenirFournisseur />} />
          <Route path="a-propos" element={<APropos />} />
          <Route path="contact" element={<Contact />} />
          <Route path="conditions-utilisation" element={<Conditions />} />
          <Route path="politique-confidentialite" element={<Confidentialite />} />
          <Route path="mentions-legales" element={<MentionsLegales />} />

          <Route
            path="compte"
            element={
              <RouteProtegee>
                <CoquilleCompte />
              </RouteProtegee>
            }
          >
            <Route index element={<CompteProfil />} />
            <Route path="commandes" element={<CompteCommandes />} />
            <Route path="paiements" element={<ComptePaiements />} />
            <Route path="favoris" element={<CompteFavoris />} />
            <Route path="adresses" element={<CompteAdresses />} />
            <Route path="securite" element={<CompteSecurite />} />
          </Route>

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
            <Route path="publier" element={<ProPublier />} />
            <Route path="catalogue" element={<ProCatalogue />} />
            <Route path="catalogue/nouveau" element={<ProProduitEditeur />} />
            <Route path="catalogue/:id" element={<ProProduitEditeur />} />
            <Route path="livraison" element={<ProLivraison />} />
            <Route path="vitrine" element={<ProVitrine />} />
            <Route path="commandes" element={<ProCommandes />} />
            <Route path="commandes/:id" element={<ProCommandes />} />
            <Route path="portefeuille" element={<ProPortefeuille />} />
            <Route path="avis" element={<ProAvis />} />
            <Route path="statistiques" element={<ProStatistiques />} />
          </Route>

          <Route
            path="admin"
            element={
              <RouteProtegee role="admin">
                <CoquilleAdmin />
              </RouteProtegee>
            }
          >
            <Route index element={<AdminVerifications />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="materiaux" element={<AdminMateriaux />} />
            <Route path="paiements" element={<AdminPaiements />} />
            <Route path="litiges" element={<AdminLitiges />} />
            <Route path="versements" element={<AdminVersements />} />
            <Route path="referentiels" element={<AdminReferentiels />} />
            <Route path="moderation" element={<AdminModeration />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>

          <Route path="*" element={<NonTrouve />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
