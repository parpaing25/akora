import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Point } from "./livraison";

/**
 * Le point de livraison de l'acheteur, mémorisé d'une visite à l'autre.
 *
 * C'est la donnée la plus structurante du site : sans elle, aucun prix rendu
 * chantier n'existe. On la garde côté client (localStorage), jamais en base
 * pour un visiteur — un point de livraison n'a pas à créer une ligne serveur.
 * Un acheteur connecté peut l'enregistrer comme adresse de chantier, et c'est
 * un geste explicite.
 */
export interface PointLivraison {
  lat: number;
  lng: number;
  /** Ce qu'on affiche : « Livrer à Ambohidratrimo · modifier ». */
  libelle: string;
  localiteId: string | null;
  /** D'où vient le point, pour savoir quoi réafficher. */
  origine: "localite" | "position" | "carte" | "adresse";
}

interface EtatPoint {
  point: PointLivraison | null;
  definir: (point: PointLivraison) => void;
  effacer: () => void;
}

export const usePointLivraison = create<EtatPoint>()(
  persist(
    (set) => ({
      point: null,
      definir: (point) => set({ point }),
      effacer: () => set({ point: null }),
    }),
    {
      name: "akora-point-livraison",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Coordonnées seules, pour les passer au calculateur. */
export function coordonnees(point: PointLivraison | null): Point | null {
  return point ? { lat: point.lat, lng: point.lng } : null;
}
