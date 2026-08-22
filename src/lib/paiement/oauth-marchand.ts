import {
  env,
  PaiementNonConfigure,
  type DemandePaiement,
  type EtatPaiement,
  type Operateur,
  type PrestatairePaiement,
  type ReponseInitiation,
  type ResultatWebhook,
  type StatutDistant,
} from "./types.ts";

/**
 * Squelette commun aux trois API marchandes (MVola, Orange Money, Airtel
 * Money). Elles suivent la même mécanique : OAuth2 `client_credentials`,
 * création de transaction, attente du webhook de confirmation, et
 * interrogation de statut en secours.
 *
 * AUCUNE URL N'EST ÉCRITE ICI. Elles viennent des variables d'environnement,
 * parce que les contrats marchands ne sont pas obtenus et que deviner une
 * adresse d'API serait exactement la donnée inventée qu'interdit la règle A2.8.
 *
 * Chaque appel réseau est isolé dans UNE fonction marquée, qui lève une erreur
 * explicite tant que les identifiants manquent.
 */
export abstract class PrestataireOAuth implements PrestatairePaiement {
  abstract readonly operateur: Operateur;
  /** Préfixe des variables d'environnement, ex. « MVOLA ». */
  protected abstract readonly prefixe: string;

  protected variable(suffixe: string): string | undefined {
    return env(this.prefixe + "_" + suffixe);
  }

  protected manquants(): string[] {
    return (["BASE_URL", "CLIENT_ID", "CLIENT_SECRET"] as const)
      .filter((cle) => !this.variable(cle))
      .map((cle) => this.prefixe + "_" + cle);
  }

  get disponible(): boolean {
    return this.manquants().length === 0;
  }

  protected exigerConfiguration(): { base: string; id: string; secret: string } {
    const manquants = this.manquants();
    if (manquants.length) throw new PaiementNonConfigure(this.operateur, manquants);
    return {
      base: this.variable("BASE_URL") as string,
      id: this.variable("CLIENT_ID") as string,
      secret: this.variable("CLIENT_SECRET") as string,
    };
  }

  /** À BRANCHER : identifiants marchands. Jeton OAuth2. */
  protected async jeton(): Promise<string> {
    const { base, id, secret } = this.exigerConfiguration();
    const chemin = this.variable("TOKEN_PATH") ?? "/oauth/token";
    const reponse = await fetch(new URL(chemin, base).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(id + ":" + secret),
      },
      body: "grant_type=client_credentials",
    });
    if (!reponse.ok) throw new Error(this.operateur + " : jeton refusé (" + reponse.status + ").");
    const corps = (await reponse.json()) as { access_token?: string };
    if (!corps.access_token) throw new Error(this.operateur + " : jeton absent de la réponse.");
    return corps.access_token;
  }

  /** À BRANCHER : identifiants marchands. Création de la transaction. */
  async initier(demande: DemandePaiement): Promise<ReponseInitiation> {
    const { base } = this.exigerConfiguration();
    const jeton = await this.jeton();
    const chemin = this.variable("TRANSACTION_PATH") ?? "/transactions";
    const reponse = await fetch(new URL(chemin, base).toString(), {
      method: "POST",
      headers: {
        Authorization: "Bearer " + jeton,
        "Content-Type": "application/json",
        "X-Correlation-ID": demande.reference,
      },
      body: JSON.stringify(this.corpsTransaction(demande)),
    });
    const brut = await reponse.json().catch(() => null);
    if (!reponse.ok) {
      return { statut: "echoue", referenceExterne: null, erreur: "HTTP " + reponse.status, brut };
    }
    return {
      statut: "en_attente_client",
      referenceExterne: this.extraireReferenceExterne(brut),
      instructions: "Validez le paiement sur votre téléphone, puis revenez sur cette page.",
      brut,
    };
  }

  /** À BRANCHER : identifiants marchands. Interrogation de secours. */
  async verifierStatut(reference: string): Promise<EtatPaiement> {
    const { base } = this.exigerConfiguration();
    const jeton = await this.jeton();
    const chemin = (this.variable("STATUS_PATH") ?? "/transactions/{reference}").replace(
      "{reference}",
      encodeURIComponent(reference),
    );
    const reponse = await fetch(new URL(chemin, base).toString(), {
      headers: { Authorization: "Bearer " + jeton },
    });
    const brut = await reponse.json().catch(() => null);
    if (!reponse.ok) return { statut: "inconnu", referenceExterne: reference, brut };
    return {
      statut: this.lireStatut(brut),
      referenceExterne: this.extraireReferenceExterne(brut) ?? reference,
      brut,
    };
  }

  /**
   * Sans secret partagé, `signatureValide` reste false — et l'appelant refuse
   * de créditer. Un webhook non signé ne fait JAMAIS avancer un paiement.
   */
  async traiterWebhook(payload: unknown, signature: string | null): Promise<ResultatWebhook> {
    const secret = this.variable("WEBHOOK_SECRET");
    const corps = (payload ?? {}) as Record<string, unknown>;
    const valide = secret ? await this.verifierSignature(payload, signature, secret) : false;
    return {
      idEvenement: String(corps["id"] ?? corps["eventId"] ?? corps["transactionId"] ?? ""),
      signatureValide: valide,
      reference: this.extraireReference(corps),
      statut: this.lireStatut(corps),
      referenceExterne: this.extraireReferenceExterne(corps),
    };
  }

  /** HMAC-SHA256 du corps, comparé en temps constant. */
  protected async verifierSignature(
    payload: unknown,
    signature: string | null,
    secret: string,
  ): Promise<boolean> {
    if (!signature) return false;
    const cle = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const calcule = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(JSON.stringify(payload)));
    const hexa = [...new Uint8Array(calcule)].map((o) => o.toString(16).padStart(2, "0")).join("");
    if (hexa.length !== signature.length) return false;
    let ecart = 0;
    for (let i = 0; i < hexa.length; i++) ecart |= hexa.charCodeAt(i) ^ signature.charCodeAt(i);
    return ecart === 0;
  }

  protected abstract corpsTransaction(demande: DemandePaiement): Record<string, unknown>;
  protected abstract lireStatut(brut: unknown): StatutDistant;

  protected extraireReferenceExterne(brut: unknown): string | null {
    const o = (brut ?? {}) as Record<string, unknown>;
    const valeur = o["transactionId"] ?? o["serverCorrelationId"] ?? o["txnId"] ?? o["id"];
    return valeur == null ? null : String(valeur);
  }

  protected extraireReference(corps: Record<string, unknown>): string | null {
    const valeur = corps["correlationId"] ?? corps["clientCorrelationId"] ?? corps["reference"];
    return valeur == null ? null : String(valeur);
  }
}
