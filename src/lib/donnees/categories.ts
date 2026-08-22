import { supabase } from "@/integrations/supabase/client";

/**
 * Les 8 familles de gros œuvre (spec B3). Elles vivent en base, dans
 * `categories` : ce module ne fait que les lire. Aucune liste en dur ici —
 * l'application n'invente pas de référentiel.
 */
export interface Categorie {
  id: string;
  slug: string;
  nom: string;
  nom_mg: string | null;
  icone: string | null;
  ordre: number;
  parent_id: string | null;
}

export async function listerFamilles(): Promise<Categorie[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, nom, nom_mg, icone, ordre, parent_id")
    .is("parent_id", null)
    .eq("active", true)
    .order("ordre", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Categorie[];
}

export async function lireFamille(slug: string): Promise<Categorie | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, nom, nom_mg, icone, ordre, parent_id")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Categorie) ?? null;
}
