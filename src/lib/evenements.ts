import { supabase } from "@/integrations/supabase/client";

/**
 * Événements d'entonnoir (audit R-02, 06/09/2026) — zéro traceur, zéro cookie.
 *
 * L'identifiant de session vit en `sessionStorage` : il meurt avec l'onglet,
 * personne n'est suivi d'une visite à l'autre, aucun consentement à demander.
 * La liste des noms est FERMÉE côté base (`enregistrer_evenement`) : un nom
 * inconnu est ignoré en silence. Les appels ne bloquent jamais l'interface et
 * n'échouent jamais visiblement.
 */
export type NomEvenement =
  | "voir_accueil"
  | "voir_type"
  | "voir_comparateur"
  | "voir_produit"
  | "ajouter_panier"
  | "ouvrir_commander"
  | "commande_envoyee"
  | "paiement_reference_saisie"
  | "voir_devenir_fournisseur"
  | "inscription"
  | "produit_publie"
  | "recherche"
  | "retour_page";

const CLE = "akora-session";

export function identifiantSession(): string {
  try {
    let id = sessionStorage.getItem(CLE);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      sessionStorage.setItem(CLE, id);
    }
    return id;
  } catch {
    return "sans-stockage-" + Math.random().toString(36).slice(2, 14);
  }
}

/** Émet un événement. Jamais de donnée personnelle dans `proprietes`. */
export function emettre(nom: NomEvenement, proprietes: Record<string, string | number | boolean | null> = {}): void {
  if (typeof window === "undefined") return;
  const page = window.location.pathname.replace(/\/[0-9a-f-]{36}/g, "/:id").slice(0, 120);
  void supabase
    // `as never` : la RPC est créée par la migration 20260906103000 ; relancer `npm run types:gen`
    // après son application pour retrouver le typage strict.
    .rpc("enregistrer_evenement" as never, { _nom: nom, _page: page, _proprietes: proprietes, _session_id: identifiantSession() } as never)
    .then(() => undefined, () => undefined);
}
