import { PrestataireOAuth } from "./oauth-marchand.ts";
import type { DemandePaiement, Operateur, StatutDistant } from "./types.ts";

/**
 * Airtel Money. Préfixe 033.
 *
 * Variables attendues : AIRTEL_MONEY_BASE_URL, AIRTEL_MONEY_CLIENT_ID,
 * AIRTEL_MONEY_CLIENT_SECRET, AIRTEL_MONEY_WEBHOOK_SECRET.
 */
export class AirtelMoney extends PrestataireOAuth {
  readonly operateur: Operateur = "airtel_money";
  protected readonly prefixe = "AIRTEL_MONEY";

  protected corpsTransaction(demande: DemandePaiement): Record<string, unknown> {
    return {
      reference: demande.libelle,
      subscriber: { country: "MG", currency: "MGA", msisdn: demande.msisdn.replace("+261", "") },
      transaction: { amount: demande.montant, country: "MG", currency: "MGA", id: demande.reference },
    };
  }

  protected lireStatut(brut: unknown): StatutDistant {
    const o = (brut ?? {}) as Record<string, unknown>;
    const donnees = (o["data"] ?? o) as Record<string, unknown>;
    const transaction = (donnees["transaction"] ?? donnees) as Record<string, unknown>;
    const statut = String(transaction["status"] ?? "").toUpperCase();
    if (statut === "TS" || statut === "SUCCESS") return "confirme";
    if (statut === "TF" || statut === "FAILED") return "rejete";
    if (statut === "TE" || statut === "EXPIRED") return "expire";
    if (statut === "TIP" || statut === "PENDING") return "en_attente";
    return "inconnu";
  }
}
