import type {
  DemandePaiement,
  Operateur,
  EtatPaiement,
  PrestatairePaiement,
  ReponseInitiation,
  ResultatWebhook,
} from "./types.ts";
import { env } from "./types.ts";

/**
 * Paiement par RÉFÉRENCE SAISIE — actif dès le premier jour (spec B9).
 *
 * Aucune API marchande n'est nécessaire : l'acheteur voit le numéro marchand
 * d'Akora et le montant exact, paie depuis son téléphone, puis recopie la
 * référence reçue par SMS. Le paiement passe en `en_verification` et un
 * administrateur le confirme. Tant qu'il n'est pas confirmé, la commande
 * n'avance pas.
 *
 * Ce n'est pas un pis-aller : c'est exactement comme ça que la majorité des
 * transactions se règlent aujourd'hui à Madagascar. Le branchement des API
 * marchandes rendra le pas manuel optionnel, il ne le remplacera pas.
 */
export class ReferenceManuelle implements PrestatairePaiement {
  constructor(public readonly operateur: Operateur) {}

  /** Toujours disponible : c'est le mode de repli du produit. */
  readonly disponible = true;

  /** Numéro marchand d'Akora pour cet opérateur, réglé côté serveur. */
  private numeroMarchand(): string | null {
    const cles: Record<string, string> = {
      mvola: "AKORA_MSISDN_MVOLA",
      orange_money: "AKORA_MSISDN_ORANGE",
      airtel_money: "AKORA_MSISDN_AIRTEL",
    };
    return env(cles[this.operateur] ?? "") ?? null;
  }

  initier(demande: DemandePaiement): Promise<ReponseInitiation> {
    const numero = this.numeroMarchand();
    if (!numero) {
      return Promise.resolve({
        statut: "echoue",
        referenceExterne: null,
        erreur:
          "Le numéro marchand Akora de cet opérateur n'est pas encore renseigné. Choisissez un autre opérateur, ou le paiement à la livraison.",
      });
    }
    return Promise.resolve({
      statut: "en_attente_client",
      referenceExterne: null,
      instructions: [
        `Envoyez ${demande.montant} Ar au ${numero}.`,
        `Indiquez « ${demande.numeroCommande} » en motif si votre opérateur le permet.`,
        "Recopiez ensuite la référence reçue par SMS dans le champ ci-dessous.",
      ].join("\n"),
    });
  }

  /**
   * Il n'y a rien à interroger : la confirmation est humaine. On renvoie
   * « en attente » plutôt que d'inventer un statut.
   */
  verifierStatut(reference: string): Promise<EtatPaiement> {
    return Promise.resolve({ statut: "en_attente", referenceExterne: reference });
  }

  /** Aucun webhook dans ce mode. */
  traiterWebhook(): Promise<ResultatWebhook> {
    return Promise.resolve({
      idEvenement: "",
      signatureValide: false,
      reference: null,
      statut: "inconnu",
      referenceExterne: null,
    });
  }
}
