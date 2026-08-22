import { useQueries } from "@tanstack/react-query";
import * as React from "react";
import { calculerLivraison, type LigneACharger, type ResultatLivraison } from "@/lib/livraison";
import { listerVehicules, listerZones } from "@/lib/donnees/transport";
import { coordonnees, usePointLivraison } from "@/lib/point-livraison";

/**
 * Calcule la livraison pour un fournisseur donné, au point de livraison
 * mémorisé de l'acheteur.
 *
 * Le barème (véhicules, zones) est mis en cache 15 minutes : il ne change
 * qu'à la main, et le recharger à chaque frappe du curseur de quantité
 * coûterait cher en egress pour rien. Le calcul, lui, est local et instantané.
 */
export interface EntreeLivraison {
  fournisseurId: string;
  rayonMaxKm: number;
  coefSinuosite: number | null;
  depart: { lat: number; lng: number } | null;
  lignes: LigneACharger[];
  montantProduits: number;
}

export function useLivraison(entrees: readonly EntreeLivraison[]): Map<string, ResultatLivraison> {
  const { point } = usePointLivraison();
  const arrivee = coordonnees(point);
  const ids = entrees.map((e) => e.fournisseurId);

  const baremes = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["bareme", id],
      queryFn: async () => ({
        vehicules: await listerVehicules(id),
        zones: await listerZones(id),
      }),
      staleTime: 15 * 60_000,
    })),
  });

  return React.useMemo(() => {
    const resultats = new Map<string, ResultatLivraison>();
    entrees.forEach((entree, index) => {
      const bareme = baremes[index]?.data;
      if (!bareme) return;
      resultats.set(
        entree.fournisseurId,
        calculerLivraison({
          depart: entree.depart,
          arrivee,
          rayonMaxKm: entree.rayonMaxKm,
          coefSinuosite: entree.coefSinuosite,
          vehicules: bareme.vehicules,
          zones: bareme.zones,
          lignes: entree.lignes,
          montantProduits: entree.montantProduits,
        }),
      );
    });
    return resultats;
    // `baremes` est un tableau recréé à chaque rendu : on ne dépend que des
    // données réellement chargées.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(entrees), arrivee?.lat, arrivee?.lng, baremes.map((b) => b.dataUpdatedAt).join(",")]);
}

/** Cas courant : un seul fournisseur. */
export function useLivraisonUnique(entree: EntreeLivraison | null): ResultatLivraison | null {
  const resultats = useLivraison(entree ? [entree] : []);
  return entree ? (resultats.get(entree.fournisseurId) ?? null) : null;
}
