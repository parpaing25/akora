import { PrestataireOAuth } from "./oauth-marchand.ts";
import type { DemandePaiement, Operateur, StatutDistant } from "./types.ts";

/**
 * MVola (Telma). Préfixes 034 et 038.
 *
 * Variables attendues côté serveur : MVOLA_BASE_URL, MVOLA_CLIENT_ID,
 * MVOLA_CLIENT_SECRET, MVOLA_PARTNER_NAME, MVOLA_WEBHOOK_SECRET, et
 * facultativement MVOLA_TOKEN_PATH / TRANSACTION_PATH / STATUS_PATH.
 * Tant qu'elles manquent, `disponible` vaut false et l'opérateur n'est pas
 * proposé — plutôt que d'échouer sous les doigts de l'acheteur.
 */
export class Mvola extends PrestataireOAuth {
  readonly operateur: Operateur = "mvola";
  protected readonly prefixe = "MVOLA";

  protected corpsTransaction(demande: DemandePaiement): Record<string, unknown> {
    return {
      amount: String(demande.montant),
      currency: "Ar",
      descriptionText: demande.libelle,
      requestingOrganisationTransactionReference: demande.reference,
      debitParty: [{ key: "msisdn", value: demande.msisdn.replace("+", "") }],
      creditParty: [{ key: "msisdn", value: (this.variable("PARTNER_MSISDN") ?? "").replace("+", "") }],
      metadata: [
        { key: "partnerName", value: this.variable("PARTNER_NAME") ?? "Akora" },
        { key: "orderNumber", value: demande.numeroCommande },
      ],
    };
  }

  protected lireStatut(brut: unknown): StatutDistant {
    const statut = String((brut as Record<string, unknown> | null)?.["status"] ?? "").toLowerCase();
    if (statut === "completed" || statut === "success") return "confirme";
    if (statut === "failed" || statut === "rejected") return "rejete";
    if (statut === "expired") return "expire";
    if (statut === "pending" || statut === "initiated") return "en_attente";
    return "inconnu";
  }
}
