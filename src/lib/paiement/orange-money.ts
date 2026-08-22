import { PrestataireOAuth } from "./oauth-marchand.ts";
import type { DemandePaiement, Operateur, StatutDistant } from "./types.ts";

/**
 * Orange Money. Préfixe 032.
 *
 * Variables attendues : ORANGE_MONEY_BASE_URL, ORANGE_MONEY_CLIENT_ID,
 * ORANGE_MONEY_CLIENT_SECRET, ORANGE_MONEY_MERCHANT_ID,
 * ORANGE_MONEY_WEBHOOK_SECRET.
 */
export class OrangeMoney extends PrestataireOAuth {
  readonly operateur: Operateur = "orange_money";
  protected readonly prefixe = "ORANGE_MONEY";

  protected corpsTransaction(demande: DemandePaiement): Record<string, unknown> {
    return {
      merchant_key: this.variable("MERCHANT_ID") ?? "",
      currency: "MGA",
      order_id: demande.numeroCommande,
      amount: demande.montant,
      reference: demande.reference,
      subscriber_msisdn: demande.msisdn,
      return_url: demande.urlRetour,
      cancel_url: demande.urlRetour,
      notif_url: this.variable("WEBHOOK_URL"),
    };
  }

  protected lireStatut(brut: unknown): StatutDistant {
    const o = (brut ?? {}) as Record<string, unknown>;
    const statut = String(o["status"] ?? o["state"] ?? "").toUpperCase();
    if (statut === "SUCCESS" || statut === "SUCCESSFUL") return "confirme";
    if (statut === "FAILED" || statut === "CANCELLED") return "rejete";
    if (statut === "EXPIRED") return "expire";
    if (statut === "PENDING" || statut === "INITIATED") return "en_attente";
    return "inconnu";
  }
}
