import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Drapeaux et réglages pilotés depuis la base (table `parametres`, audit R-05
 * et C-05, 06/09/2026) : bandeau d'incident, part d'exposition d'une nouveauté.
 * Une ligne SQL change le site en cinq minutes, sans déploiement.
 */
export function useParametre<T>(cle: string, defaut: T) {
  const requete = useQuery({
    queryKey: ["parametre", cle],
    queryFn: async () => {
      const { data, error } = await supabase.from("parametres").select("valeur").eq("cle", cle).maybeSingle();
      if (error) throw error;
      return (data?.valeur as T | undefined) ?? defaut;
    },
    staleTime: 5 * 60_000,
    retry: 0,
  });
  return requete.data ?? defaut;
}
