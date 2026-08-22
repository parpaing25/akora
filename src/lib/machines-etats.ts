import type { StatutCommande, StatutPaiement } from "./types-metier";

/**
 * Machines à états des commandes et des paiements (spec B9).
 *
 * ⚠️ L'AUTORITÉ EST EN BASE : les fonctions `transition_commande_valide` et
 * `transition_paiement_valide` sont appelées par des triggers, et un appel
 * direct à l'API REST se heurte à elles. Ce module en est le miroir côté
 * client — il sert à griser un bouton impossible, jamais à autoriser quoi que
 * ce soit. Les deux tables doivent rester identiques ; les tests ci-contre
 * verrouillent celle-ci.
 */

export const TRANSITIONS_COMMANDE: Record<StatutCommande, StatutCommande[]> = {
  brouillon: ["envoyee", "annulee"],
  envoyee: ["vue", "refusee", "annulee"],
  vue: ["devis_envoye", "acceptee", "refusee", "annulee"],
  devis_envoye: ["acceptee", "refusee", "annulee"],
  acceptee: ["en_attente_paiement", "en_preparation", "annulee"],
  en_attente_paiement: ["payee", "acceptee", "annulee"],
  payee: ["en_preparation", "litige", "annulee"],
  en_preparation: ["en_livraison", "litige", "annulee"],
  en_livraison: ["livree", "litige"],
  livree: ["cloturee", "litige"],
  litige: ["livree", "cloturee", "annulee"],
  cloturee: [],
  annulee: [],
  refusee: [],
};

export const TRANSITIONS_PAIEMENT: Record<StatutPaiement, StatutPaiement[]> = {
  initie: ["en_attente_client", "echoue"],
  en_attente_client: ["en_verification", "confirme", "expire", "echoue"],
  en_verification: ["confirme", "rejete"],
  confirme: ["sequestre", "rembourse"],
  sequestre: ["libere", "rembourse"],
  libere: [],
  rembourse: [],
  rejete: [],
  expire: [],
  echoue: [],
};

export function transitionCommandePossible(depuis: StatutCommande, vers: StatutCommande): boolean {
  return TRANSITIONS_COMMANDE[depuis].includes(vers);
}

export function transitionPaiementPossible(depuis: StatutPaiement, vers: StatutPaiement): boolean {
  return TRANSITIONS_PAIEMENT[depuis].includes(vers);
}

/** États depuis lesquels plus rien ne bouge. */
export function estTerminalCommande(statut: StatutCommande): boolean {
  return TRANSITIONS_COMMANDE[statut].length === 0;
}

export function estTerminalPaiement(statut: StatutPaiement): boolean {
  return TRANSITIONS_PAIEMENT[statut].length === 0;
}

/** Les suites proposées au fournisseur, dans l'ordre où elles arrivent. */
export function suitesFournisseur(statut: StatutCommande): StatutCommande[] {
  const ordre: StatutCommande[] = [
    "vue",
    "acceptee",
    "en_preparation",
    "en_livraison",
    "livree",
    "refusee",
    "annulee",
  ];
  return ordre.filter((s) => transitionCommandePossible(statut, s));
}
