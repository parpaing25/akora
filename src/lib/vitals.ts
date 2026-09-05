import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { supabase } from "@/integrations/supabase/client";

/**
 * Vitals terrain (audit P-08 / R-01, 06/09/2026).
 *
 * Le laboratoire donnait LCP 4,2–4,9 s en 4G simulée ; personne ne savait ce
 * que voit un vrai client Telma en 3G. Une visite sur quatre envoie ses cinq
 * mesures dans `vitals` (aucune donnée personnelle : page, valeur, note,
 * type de connexion, famille d'appareil). Le p75 hebdomadaire se lit dans la
 * vue `rapport_vitals_7j` — c'est LA mesure que demandent les seuils Core Web
 * Vitals (75e percentile terrain).
 */
const PART_ECHANTILLON = 0.25;

function envoyer(m: Metric) {
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
  const ua = navigator.userAgent;
  void supabase
    // `as never` : RPC créée par la migration 20260906103000 ; `npm run types:gen` ensuite.
    .rpc("enregistrer_vital" as never, {
      _page: location.pathname.replace(/\/[0-9a-f-]{36}/g, "/:id").slice(0, 120),
      _nom: m.name,
      _valeur: Math.round(m.value * 1000) / 1000,
      _note: m.rating,
      _connexion: nav.connection?.effectiveType ?? null,
      _appareil: /Android/.test(ua) ? "android" : /iPhone|iPad/.test(ua) ? "ios" : "autre",
    } as never)
    .then(() => undefined, () => undefined);
}

export function mesurerVitals() {
  try {
    if (Math.random() > PART_ECHANTILLON) return;
    onLCP(envoyer);
    onINP(envoyer);
    onCLS(envoyer);
    onFCP(envoyer);
    onTTFB(envoyer);
  } catch {
    // Un navigateur sans PerformanceObserver ne mesure rien : rien à faire.
  }
}
