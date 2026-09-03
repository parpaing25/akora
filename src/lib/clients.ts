import type { LigneCommande } from "@/lib/donnees/commandes";

/**
 * Les clients d'un dépôt, déduits de ses commandes.
 *
 * ⚠ AUCUNE TABLE « CLIENTS » : un client est quelqu'un qui a commandé, et la
 *   commande porte déjà son nom et son téléphone (nom_contact,
 *   telephone_contact) — que le dépôt voit de toute façon pour livrer. On
 *   n'expose donc rien de plus que ce que le dépôt possède déjà, et on ne lit
 *   jamais `profiles` (réservé à son propriétaire).
 *
 * Un même acheteur peut commander sans compte (acheteur_id nul) : la clé de
 * regroupement est alors le téléphone normalisé, puis le courriel.
 */
export interface Client {
  cle: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  nbCommandes: number;
  /** Ce qu'il a réellement payé : commandes payées, livrées ou clôturées. */
  total: number;
  derniereLe: string;
  dernierStatut: string;
  /** Vrai s'il a au moins une commande encore ouverte (à traiter). */
  enCours: boolean;
}

/** Les statuts où l'argent est acquis ou en séquestre — ce qui compte comme vendu. */
export const STATUTS_VENDUS = new Set(["payee", "en_preparation", "en_livraison", "livree", "cloturee"]);

/** Les statuts où le dépôt a encore quelque chose à faire. */
export const STATUTS_A_TRAITER = new Set([
  "envoyee",
  "vue",
  "devis_envoye",
  "acceptee",
  "en_attente_paiement",
  "payee",
  "en_preparation",
  "en_livraison",
]);

export const LIBELLE_STATUT: Record<string, string> = {
  brouillon: "brouillon",
  envoyee: "nouvelle",
  vue: "vue",
  devis_envoye: "devis envoyé",
  acceptee: "acceptée",
  en_attente_paiement: "attend le paiement",
  payee: "payée",
  en_preparation: "en préparation",
  en_livraison: "en livraison",
  livree: "livrée",
  cloturee: "clôturée",
  annulee: "annulée",
  refusee: "refusée",
  litige: "en litige",
};

function normaliserTelephone(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const chiffres = brut.replace(/\D/g, "");
  if (chiffres.length < 9) return null;
  // 261 34 12 345 67 et 034 12 345 67 sont le même numéro.
  return chiffres.startsWith("261") ? "0" + chiffres.slice(3) : chiffres;
}

export function cleClient(c: Pick<LigneCommande, "acheteur_id" | "telephone_contact" | "email_contact">): string {
  return (
    (c.acheteur_id && `u:${c.acheteur_id}`) ||
    (normaliserTelephone(c.telephone_contact) && `t:${normaliserTelephone(c.telephone_contact)}`) ||
    (c.email_contact && `e:${c.email_contact.trim().toLowerCase()}`) ||
    "anonyme"
  );
}

/**
 * Regroupe les commandes par client, du plus récent au plus ancien.
 * Les commandes « anonyme » (ni compte, ni téléphone, ni courriel) sont
 * écartées : on ne peut rien en faire, ni les rappeler, ni les compter deux fois.
 */
export function regrouperClients(commandes: readonly LigneCommande[]): Client[] {
  const parCle = new Map<string, Client>();
  for (const c of commandes) {
    const cle = cleClient(c);
    if (cle === "anonyme") continue;
    const vendu = STATUTS_VENDUS.has(c.statut) ? Number(c.montant_total ?? 0) : 0;
    const existant = parCle.get(cle);
    if (!existant) {
      parCle.set(cle, {
        cle,
        nom: (c.nom_contact ?? "").trim() || "Client sans nom",
        telephone: c.telephone_contact ?? null,
        email: c.email_contact ?? null,
        nbCommandes: 1,
        total: vendu,
        derniereLe: c.created_at,
        dernierStatut: c.statut,
        enCours: STATUTS_A_TRAITER.has(c.statut),
      });
      continue;
    }
    existant.nbCommandes += 1;
    existant.total += vendu;
    existant.enCours = existant.enCours || STATUTS_A_TRAITER.has(c.statut);
    if (c.created_at > existant.derniereLe) {
      existant.derniereLe = c.created_at;
      existant.dernierStatut = c.statut;
      if ((c.nom_contact ?? "").trim()) existant.nom = c.nom_contact!.trim();
      existant.telephone = c.telephone_contact ?? existant.telephone;
      existant.email = c.email_contact ?? existant.email;
    }
  }
  return [...parCle.values()].sort((a, b) => (a.derniereLe < b.derniereLe ? 1 : -1));
}

/** Le lien WhatsApp d'un numéro malgache, ou null s'il n'est pas composable. */
export function lienWhatsApp(telephone: string | null): string | null {
  const n = normaliserTelephone(telephone);
  if (!n) return null;
  return `https://wa.me/261${n.replace(/^0/, "")}`;
}
