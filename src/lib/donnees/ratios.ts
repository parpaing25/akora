import { supabase } from "@/integrations/supabase/client";
import type { Ratios } from "@/lib/calculateurs";

/**
 * Ratios de métré, lus en base. Les calculateurs n'en codent aucun en dur
 * (spec B11) : l'admin les ajuste, les résultats suivent.
 */
export async function chargerRatios(): Promise<Ratios> {
  const { data, error } = await supabase.from("ratios_metre").select("calculateur, cle, valeur");
  if (error) throw error;
  const ratios: Ratios = {};
  for (const ligne of data ?? []) {
    ratios[`${ligne.calculateur}.${ligne.cle}`] = Number(ligne.valeur);
  }
  return ratios;
}

/** Marge de sécurité par défaut, également paramétrable. */
export function margeParDefaut(ratios: Ratios): number {
  return ratios["general.marge_defaut_pct"] ?? 5;
}
