/**
 * Vocabulaire métier d'Akora, cote client.
 *
 * Ces unions reprennent MOT POUR MOT les énumérations Postgres déclarées dans
 * supabase/migrations. Les types de LIGNES, eux, ne sont jamais écrits à la
 * main : ils viennent de src/integrations/supabase/types.ts (généré).
 * Ce fichier ne décrit que le vocabulaire et les vues d'affichage.
 */

export type RoleApplicatif = "acheteur" | "fournisseur" | "admin";

export type StatutFournisseur = "brouillon" | "en_attente" | "actif" | "suspendu";

export type NiveauVerification = "non_verifie" | "en_cours" | "verifie" | "partenaire";

export type StatutDocument = "en_attente" | "valide" | "refuse";

export type TypeDocument =
  | "nif"
  | "stat"
  | "rcs"
  | "cin_gerant"
  | "photo_depot"
  | "photo_camion"
  | "numero_versement";

export type StatutStock = "en_stock" | "sur_commande" | "rupture";

export type StatutProduit = "brouillon" | "en_attente_materiau" | "actif" | "inactif";

export type StatutCommande =
  | "brouillon"
  | "envoyee"
  | "vue"
  | "devis_envoye"
  | "acceptee"
  | "en_attente_paiement"
  | "payee"
  | "en_preparation"
  | "en_livraison"
  | "livree"
  | "cloturee"
  | "annulee"
  | "refusee"
  | "litige";

export type ModePaiement = "en_ligne_integral" | "en_ligne_acompte" | "a_la_livraison";

export type OperateurPaiement = "mvola" | "orange_money" | "airtel_money";

export type StatutPaiement =
  | "initie"
  | "en_attente_client"
  | "en_verification"
  | "confirme"
  | "sequestre"
  | "libere"
  | "rembourse"
  | "rejete"
  | "expire"
  | "echoue";

export type Unite = "piece" | "sac" | "m3" | "tonne" | "m2" | "ml" | "botte" | "chargement" | "palette";

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
