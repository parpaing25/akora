/**
 * Vocabulaire métier d'Akora, côté client.
 *
 * Les unions ci-dessous ne sont PAS écrites à la main : elles sont dérivées
 * des énumérations Postgres via le fichier généré
 * src/integrations/supabase/types.ts (règle A7). Si une énumération change en
 * base, `npm run types:gen` suffit — et les tables de libellés ci-dessous
 * cessent de compiler tant qu'on ne les a pas mises à jour. C'est voulu :
 * un statut sans libellé doit casser le build, pas s'afficher en brut.
 */
import type { Database } from "@/integrations/supabase/types";

type Enumerations = Database["public"]["Enums"];

export type RoleApplicatif = Enumerations["app_role"];
export type StatutFournisseur = Enumerations["statut_fournisseur"];
export type NiveauVerification = Enumerations["niveau_verification"];
export type StatutDocument = Enumerations["statut_document"];
export type TypeDocument = Enumerations["type_document"];
export type StatutStock = Enumerations["stock_statut"];
export type StatutProduit = Enumerations["statut_produit"];
export type StatutCommande = Enumerations["statut_commande"];
export type ModePaiement = Enumerations["mode_paiement"];
export type OperateurPaiement = Enumerations["operateur_paiement"];
export type StatutPaiement = Enumerations["statut_paiement"];
export type Unite = Enumerations["unite"];
export type StatutDemandeMateriau = Enumerations["statut_demande_materiau"];
export type StatutRetrait = Enumerations["statut_retrait"];
export type StatutLitige = Enumerations["statut_litige"];
export type TypeEcriture = Enumerations["type_ecriture"];
export type TypeClient = Enumerations["type_client"];
export type RoleInterne = Enumerations["role_interne"];
export type TypeLocalite = Enumerations["type_localite"];
export type StatutModeration = Enumerations["statut_moderation"];

/** Libellés d'affichage, au singulier. Le pluriel est géré à l'affichage. */
export const LIBELLE_UNITE: Record<Unite, string> = {
  piece: "pièce",
  sac: "sac",
  m3: "m3",
  tonne: "tonne",
  m2: "m2",
  ml: "ml",
  botte: "botte",
  chargement: "chargement",
  palette: "palette",
};

export const LIBELLE_STOCK: Record<StatutStock, string> = {
  en_stock: "En stock",
  sur_commande: "Sur commande",
  rupture: "Rupture",
};

export const LIBELLE_COMMANDE: Record<StatutCommande, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée au fournisseur",
  vue: "Vue par le fournisseur",
  devis_envoye: "Devis envoyé",
  acceptee: "Acceptée",
  en_attente_paiement: "En attente de paiement",
  payee: "Payee",
  en_preparation: "En préparation",
  en_livraison: "En livraison",
  livree: "Livrée",
  cloturee: "Clôturée",
  annulee: "Annulée",
  refusee: "Refusée",
  litige: "Litige en cours",
};

export const LIBELLE_PAIEMENT: Record<StatutPaiement, string> = {
  initie: "Initié",
  en_attente_client: "En attente de votre paiement",
  en_verification: "En vérification",
  confirme: "Confirmé",
  sequestre: "Sous séquestre",
  libere: "Libéré au fournisseur",
  rembourse: "Remboursé",
  rejete: "Rejeté",
  expire: "Expiré",
  echoue: "Échoué",
};

export const LIBELLE_MODE_PAIEMENT: Record<ModePaiement, string> = {
  en_ligne_integral: "Paiement intégral en ligne",
  en_ligne_acompte: "Acompte en ligne, solde à la livraison",
  a_la_livraison: "Paiement à la livraison",
};

export const LIBELLE_DOCUMENT: Record<TypeDocument, string> = {
  nif: "Carte fiscale (NIF)",
  stat: "Carte statistique (STAT)",
  rcs: "Registre du commerce (RCS)",
  cin_gerant: "CIN du gérant (recto/verso)",
  photo_depot: "Photo de l'enseigne et du dépôt",
  photo_camion: "Photo des véhicules et carte grise",
  numero_versement: "Numéro mobile money de versement",
};

/** Les six pièces exigées pour passer `verifie` (spec B5). */
export const DOCUMENTS_OBLIGATOIRES: readonly TypeDocument[] = [
  "nif",
  "stat",
  "rcs",
  "cin_gerant",
  "photo_depot",
  "numero_versement",
];

/* ── Vues d'affichage ──────────────────────────────────────────────────── */

/** Ce qu'une carte produit a besoin de savoir. Rien de plus : aucune PII. */
export interface ProduitCarte {
  id: string;
  slug: string;
  nomAffiche: string;
  photo: string | null;
  prixUnitaire: number;
  prixPromo: number | null;
  unite: Unite;
  stock: StatutStock;
  fournisseurId: string;
  fournisseurSlug: string;
  fournisseurNom: string;
  fournisseurNiveau: NiveauVerification;
  /** Renseignée seulement si un point de livraison est fixé (§5). */
  distanceKm?: number | null;
}
