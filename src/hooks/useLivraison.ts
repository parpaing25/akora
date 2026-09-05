import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { calculerLivraison, type LigneACharger, type ResultatLivraison } from "@/lib/livraison";
import { listerBaremes } from "@/lib/donnees/transport";
import { coordonnees, usePointLivraison } from "@/lib/point-livraison";

/**
 * Calcule la livraison pour un fournisseur donné, au point de livraison
 * mémorisé de l'acheteur.
 *
 * Le barème (véhicules, zones) est mis en cache 15 minutes : il ne change
 * qu'à la main, et le recharger à chaque frappe du curseur de quantité
 * coûterait cher en egress pour rien. Le calcul, lui, est local et instantané.
 *
 * ⭐ 06/09/2026 (audit F-02, P-05) : UN SEUL appel pour tous les fournisseurs
 * de la page (`in`), au lieu de deux requêtes par carte — l'accueil en faisait
 * 12 (+ 12 préflights CORS) ; et la page type envoyait « uuid::format » comme
 * fournisseur_id → six HTTP 400 par page, prix rendu jamais affiché.
 */
export interface EntreeLivraison {
  /** Identifiant RÉEL du fournisseur (uuid) : c'est lui qui part en base. */
  fournisseurId: string;
  /**
   * Clé de rangement dans la Map rendue, quand une même page calcule plusieurs
   * lignes pour un même fournisseur (une par format sur la page type). Par
   * défaut : `fournisseurId`. Ne JAMAIS y mettre l'uuid composé.
   */
  cle?: string;
  rayonMaxKm: number;
  coefSinuosite: number | null;
  depart: { lat: number; lng: number } | null;
  lignes: LigneACharger[];
  montantProduits: number;
}

export function useLivraison(entrees: readonly EntreeLivraison[]): Map<string, ResultatLivraison> {
  const { point } = usePointLivraison();
  const arrivee = coordonnees(point);
  const ids = React.useMemo(
    () => [...new Set(entrees.map((e) => e.fournisseurId))].sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entrees.map((e) => e.fournisseurId).join(",")],
  );

  const baremes = useQuery({
    queryKey: ["baremes", ids.join(",")],
    queryFn: () => listerBaremes(ids),
    enabled: ids.length > 0,
    staleTime: 15 * 60_000,
  });

  return React.useMemo(() => {
    const resultats = new Map<string, ResultatLivraison>();
    const parFournisseur = baremes.data;
    if (!parFournisseur) return resultats;
    entrees.forEach((entree) => {
      const bareme = parFournisseur.get(entree.fournisseurId);
      if (!bareme) return;
      resultats.set(
        entree.cle ?? entree.fournisseurId,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(entrees), arrivee?.lat, arrivee?.lng, baremes.dataUpdatedAt]);
}

/** Cas courant : un seul fournisseur. */
export function useLivraisonUnique(entree: EntreeLivraison | null): ResultatLivraison | null {
  const resultats = useLivraison(entree ? [entree] : []);
  return entree ? (resultats.get(entree.fournisseurId) ?? null) : null;
}
