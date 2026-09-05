# Correctif F-03 — aucune confirmation de commande hors écran (P1)

**Constat** : `commande-creer/index.ts:217-231` notifie le fournisseur **en base** (`rpc notifier` → table `notifications`, lue dans `/pro`) ; `envoyer-push` (cron chaque minute) relaie vers les navigateurs abonnés — **0 abonné** au 05/09. Rien ne part vers l'acheteur, rien ne part par courriel vers le fournisseur. Un dépôt qui n'ouvre pas `/pro` ce jour-là ne sait pas qu'on lui a commandé ; un acheteur n'a aucune preuve (barème 2.8 : « email/notification de confirmation reçu » fait partie de la ligne [P0], et « emails transactionnels : tous listés » −10).

`_courriel.ts` sait envoyer (nodemailer, secrets `SMTP_*`), mais n'est appelé que par `envoyer-code` et `mot-de-passe-code`. Préalable : `11-auth-smtp-configuration.md` (sans secrets SMTP, `envoyer()` répond 503 et la commande passe quand même — c'est voulu).

**Effort** : 2 h.

---

## 1. `supabase/functions/_courriel.ts` — un gabarit de commande

```ts
/** Ligne de tableau HTML sûre : tout texte venu de l'utilisateur est échappé. */
function echapper(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

export interface RecapCommande {
  numero: string;
  fournisseur: string;
  lignes: { designation: string; quantite: number; unite: string; total: number }[];
  montantProduits: number;
  montantLivraison: number | null;
  montantTotal: number;
  modePaiement: string;
  lienSuivi: string;      // https://akora.fonenako.mg/commande/AK-…?j=…
  contact?: { nom: string; telephone: string; adresse?: string | null };  // pour le fournisseur
}

const ariary = (n: number) => new Intl.NumberFormat("fr-MG", { maximumFractionDigits: 0 }).format(n) + " Ar";

export function gabaritCommande(r: RecapCommande, destinataire: "acheteur" | "fournisseur"): { sujet: string; texte: string; html: string } {
  const titre = destinataire === "acheteur"
    ? `Votre commande ${r.numero} est envoyée à ${r.fournisseur}`
    : `Nouvelle commande ${r.numero} sur Akora`;
  const lignesTexte = r.lignes.map((l) => `- ${l.designation} × ${l.quantite} ${l.unite} : ${ariary(l.total)}`).join("\n");
  const livraison = r.montantLivraison == null ? "à confirmer par le fournisseur" : ariary(r.montantLivraison);
  const texte = [
    titre, "",
    lignesTexte, "",
    `Matériaux : ${ariary(r.montantProduits)}`, `Livraison : ${livraison}`, `Total : ${ariary(r.montantTotal)}`,
    `Paiement : ${r.modePaiement}`, "",
    destinataire === "fournisseur" && r.contact
      ? `Client : ${r.contact.nom} — ${r.contact.telephone}${r.contact.adresse ? " — " + r.contact.adresse : ""}`
      : "Le fournisseur vous appelle pour confirmer le créneau de livraison.",
    "", `Suivi : ${r.lienSuivi}`, "", "Akora — le prix rendu chantier, pas le prix au dépôt.",
  ].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:${SABLE};font-family:Inter,Arial,sans-serif;color:${ENCRE}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid ${BORDURE};border-radius:8px">
    <tr><td style="background:${LATERITE};color:#fff;padding:16px 20px;font-size:18px;font-weight:700">${echapper(titre)}</td></tr>
    <tr><td style="padding:20px">
      <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">
        ${r.lignes.map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid ${BORDURE}">${echapper(l.designation)}<br><span style="color:#666">${l.quantite} ${echapper(l.unite)}</span></td><td align="right" style="padding:6px 0;border-bottom:1px solid ${BORDURE};white-space:nowrap">${ariary(l.total)}</td></tr>`).join("")}
        <tr><td style="padding:8px 0">Matériaux</td><td align="right">${ariary(r.montantProduits)}</td></tr>
        <tr><td style="padding:4px 0">Livraison</td><td align="right">${echapper(livraison)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700">Total</td><td align="right" style="font-weight:700">${ariary(r.montantTotal)}</td></tr>
      </table>
      <p style="margin:16px 0 0">Paiement : <strong>${echapper(r.modePaiement)}</strong></p>
      ${destinataire === "fournisseur" && r.contact ? `<p style="margin:12px 0 0">Client : <strong>${echapper(r.contact.nom)}</strong> — <a href="tel:${echapper(r.contact.telephone)}">${echapper(r.contact.telephone)}</a>${r.contact.adresse ? "<br>" + echapper(r.contact.adresse) : ""}</p>` : `<p style="margin:12px 0 0">Le fournisseur vous appelle pour confirmer le créneau de livraison.</p>`}
      <p style="margin:20px 0 0"><a href="${echapper(r.lienSuivi)}" style="display:inline-block;background:${LATERITE};color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:600">${destinataire === "acheteur" ? "Suivre ma commande" : "Voir la commande"}</a></p>
    </td></tr>
    <tr><td style="padding:12px 20px;color:#666;font-size:12px;border-top:1px solid ${BORDURE}">Akora — le prix rendu chantier, pas le prix au dépôt. Cet e-mail est envoyé automatiquement à la création de la commande.</td></tr>
  </table></td></tr></table></body></html>`;
  return { sujet: titre, texte, html };
}
```

## 2. `supabase/functions/commande-creer/index.ts` — après `creees.push({...})`

```ts
import { envoyer, gabaritCommande } from "../_courriel.ts";
…
    // ── Courriels de confirmation : best-effort, jamais bloquants ──────────
    const SITE = Deno.env.get("SITE_URL") ?? "https://akora.fonenako.mg";
    const recap = {
      numero: commande.numero,
      fournisseur: String(premier.fournisseur_nom),
      lignes: lignesCommande.map((l) => ({
        designation: l.designation_snapshot, quantite: l.quantite, unite: l.unite_snapshot, total: l.total_ligne,
      })),
      montantProduits,
      montantLivraison: estimable ? montantLivraison : null,
      montantTotal: montantProduits + montantLivraison,
      modePaiement: mode === "a_la_livraison" ? "à la livraison" : "mobile money (séquestre Akora)",
      lienSuivi: `${SITE}/commande/${commande.numero}?j=${commande.jeton_suivi}`,
    };
    const envois: Promise<unknown>[] = [];
    if (corps.email_contact) {
      envois.push(envoyer({ destinataire: corps.email_contact, ...gabaritCommande(recap, "acheteur") }));
    }
    if (fournisseur?.owner_id) {
      const { data: proprietaire } = await client.auth.admin.getUserById(fournisseur.owner_id);
      if (proprietaire?.user?.email) {
        envois.push(envoyer({
          destinataire: proprietaire.user.email,
          ...gabaritCommande({
            ...recap,
            lienSuivi: `${SITE}/pro/commandes/${commande.id}`,
            contact: { nom: corps.nom_contact.trim(), telephone: corps.telephone_contact, adresse: corps.adresse_libre ?? null },
          }, "fournisseur"),
        }));
      }
    }
    // On attend les envois (≤ 2) mais on ne fait JAMAIS échouer la commande sur un SMTP.
    const resultats = await Promise.allSettled(envois);
    for (const r of resultats) if (r.status === "fulfilled" && (r.value as { ok: boolean }).ok === false) console.warn("courriel commande non parti :", r.value);
```

Le lien de suivi pour l'acheteur porte le jeton (correctif 04) : un acheteur connecté peut l'ignorer, un invité en a besoin.

## 3. Liste des courriels transactionnels (barème 2.8) — état après correctif

| Événement | Destinataire | Fonction | Existe |
|---|---|---|---|
| Code de vérification d'e-mail | acheteur/fournisseur | `envoyer-code` | oui |
| Code de réinitialisation | utilisateur | `mot-de-passe-code` | oui |
| **Commande créée** | acheteur (si e-mail) + fournisseur | `commande-creer` | **ajouté** |
| Paiement confirmé par l'admin | acheteur + fournisseur | `paiement-webhook` / admin | **manque** (P2, même gabarit, 1 h) |
| Commande livrée / séquestre libéré | acheteur / fournisseur | trigger `commandes` → pg_net → fonction | manque (P2) |
| Litige ouvert / arbitré | les deux | — | manque (P2) |
| Vérification acceptée / refusée | fournisseur | `/admin/verifications` | manque (P2) |

SMS : aucun fournisseur SMS n'est branché ; pour une audience téléphone-first c'est le canal manquant (proposition dans `05-plan-ia.md` § WhatsApp).

## 4. Vérification

Délivrabilité à tester **à la main** après configuration SMTP : une commande de test avec un Gmail, un Outlook.com et une boîte Yahoo → réception, dossier (boîte ou spam), rendu du tableau, lien de suivi qui ouvre la commande. Score https://www.mail-tester.com ≥ 8.

## Commit

```
feat(commande): courriel de confirmation à l'acheteur et au fournisseur, gabarit commun, jamais bloquant
```
Fichiers : `supabase/functions/_courriel.ts`, `supabase/functions/commande-creer/index.ts`.
