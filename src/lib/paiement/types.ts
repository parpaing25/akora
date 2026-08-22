/**
 * Contrat commun aux prestataires de paiement mobile money.
 *
 * Ce module est partagé TEL QUEL entre le navigateur et les Edge Functions :
 * aucune dépendance, aucun secret, et des imports en `.ts` explicites pour
 * que Deno les résolve.
 *
 * ⚠️ Aucune URL d'API n'est écrite en dur nulle part (règle A2.8). Elles
 * viennent toutes de variables d'environnement, côté serveur uniquement.
 */

/** Recopie l'énumération Postgres `operateur_paiement`. Vérifié par un test. */
export type Operateur = "mvola" | "orange_money" | "airtel_money";

export interface DemandePaiement {
  /** Notre référence interne : sert aussi de clé d'idempotence. */
  reference: string;
  /** Montant en Ariary ENTIER. Toujours recalculé depuis la commande. */
  montant: number;
  /** Numéro payeur, forme canonique `+2613XXXXXXXX`. */
  msisdn: string;
  numeroCommande: string;
  libelle: string;
  urlRetour?: string;
}

export interface ReponseInitiation {
  /** `en_attente_client` : la balle est chez le payeur. `echoue` : rien n'est parti. */
  statut: "en_attente_client" | "echoue";
  referenceExterne: string | null;
  /** Marche à suivre affichée à l'acheteur (mode manuel, USSD…). */
  instructions?: string;
  urlRedirection?: string | null;
  erreur?: string;
  brut?: unknown;
}

export type StatutDistant = "en_attente" | "confirme" | "rejete" | "expire" | "inconnu";

export interface EtatPaiement {
  statut: StatutDistant;
  referenceExterne: string | null;
  brut?: unknown;
}

export interface ResultatWebhook {
  /** Identifiant unique de l'événement, pour rejeter les rejeux. */
  idEvenement: string;
  signatureValide: boolean;
  /** Notre référence, extraite du corps. */
  reference: string | null;
  statut: StatutDistant;
  referenceExterne: string | null;
}

export interface PrestatairePaiement {
  readonly operateur: Operateur;
  /**
   * `false` tant que les identifiants marchands ne sont pas configurés.
   * L'interface s'en sert pour ne PAS proposer un moyen de paiement qui
   * échouerait à la première frappe.
   */
  readonly disponible: boolean;
  initier(demande: DemandePaiement): Promise<ReponseInitiation>;
  verifierStatut(reference: string): Promise<EtatPaiement>;
  traiterWebhook(payload: unknown, signature: string | null): Promise<ResultatWebhook>;
}

/** Lecture d'environnement qui fonctionne en Deno comme dans le navigateur. */
export function env(nom: string): string | undefined {
  const global = globalThis as { Deno?: { env: { get(cle: string): string | undefined } } };
  return global.Deno?.env.get(nom);
}

export class PaiementNonConfigure extends Error {
  constructor(operateur: Operateur, manquants: string[]) {
    super(
      `Le paiement ${operateur} n'est pas branché : ${manquants.join(", ")} manquent. ` +
        "Les identifiants marchands se règlent dans les secrets des Edge Functions.",
    );
    this.name = "PaiementNonConfigure";
  }
}
