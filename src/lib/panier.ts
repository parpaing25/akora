import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { prixUnitaireApplicable, type Palier } from "./paliers";
import type { NiveauVerification, StatutStock, Unite } from "./types-metier";

/**
 * Panier multi-fournisseurs, ENTIÈREMENT côté client (B8).
 *
 * Aucune table serveur, aucune requête : un panier abandonné ne doit rien
 * coûter en egress. Les prix mémorisés ici sont indicatifs — au moment de
 * commander, le serveur recalcule tout depuis la base et fige un instantané
 * dans `lignes_commande`.
 */

export interface LignePanier {
  produitId: string;
  slug: string;
  nomAffiche: string;
  photo: string | null;
  unite: Unite;
  prixUnitaire: number;
  paliers: Palier[];
  quantite: number;
  quantiteMin: number;
  /** Indispensables au choix du véhicule (B6 étape 3). */
  poidsKgUnite: number;
  volumeM3Unite: number;
  stock: StatutStock;
  fournisseurId: string;
  fournisseurSlug: string;
  fournisseurNom: string;
  fournisseurNiveau: NiveauVerification;
}

export interface GroupeFournisseur {
  fournisseurId: string;
  fournisseurSlug: string;
  fournisseurNom: string;
  fournisseurNiveau: NiveauVerification;
  lignes: LignePanier[];
  montantProduits: number;
  poidsTotalKg: number;
  volumeTotalM3: number;
}

interface EtatPanier {
  lignes: LignePanier[];
  ajouter: (ligne: Omit<LignePanier, "quantite">, quantite?: number) => void;
  definirQuantite: (produitId: string, quantite: number) => void;
  retirer: (produitId: string) => void;
  viderFournisseur: (fournisseurId: string) => void;
  vider: () => void;
}

export const usePanier = create<EtatPanier>()(
  persist(
    (set) => ({
      lignes: [],

      ajouter: (ligne, quantite) =>
        set((etat) => {
          const ajout = Math.max(quantite ?? ligne.quantiteMin ?? 1, ligne.quantiteMin ?? 1);
          const existante = etat.lignes.find((l) => l.produitId === ligne.produitId);
          if (existante) {
            return {
              lignes: etat.lignes.map((l) =>
                l.produitId === ligne.produitId ? { ...l, quantite: l.quantite + ajout } : l,
              ),
            };
          }
          return { lignes: [...etat.lignes, { ...ligne, quantite: ajout }] };
        }),

      definirQuantite: (produitId, quantite) =>
        set((etat) => ({
          lignes: etat.lignes
            .map((l) => (l.produitId === produitId ? { ...l, quantite: Math.max(0, Math.trunc(quantite)) } : l))
            .filter((l) => l.quantite > 0),
        })),

      retirer: (produitId) => set((etat) => ({ lignes: etat.lignes.filter((l) => l.produitId !== produitId) })),

      viderFournisseur: (fournisseurId) =>
        set((etat) => ({ lignes: etat.lignes.filter((l) => l.fournisseurId !== fournisseurId) })),

      vider: () => set({ lignes: [] }),
    }),
    {
      name: "akora-panier",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (etat) => ({ lignes: etat.lignes }),
    },
  ),
);

/* ── Sélecteurs purs, testables sans le store ─────────────────────────────── */

/** Prix unitaire d'une ligne, paliers appliqués. */
export function prixLigne(ligne: LignePanier): number {
  return prixUnitaireApplicable(ligne.prixUnitaire, ligne.paliers, ligne.quantite);
}

/** Total d'une ligne, en Ariary entier. */
export function totalLignePanier(ligne: LignePanier): number {
  return Math.round(prixLigne(ligne) * ligne.quantite);
}

/** Nombre d'articles (somme des quantités), pour la pastille de la barre. */
export function nombreArticles(lignes: readonly LignePanier[]): number {
  return lignes.reduce((somme, l) => somme + l.quantite, 0);
}

/**
 * Scission par fournisseur : c'est elle qui produit UNE commande par
 * fournisseur au moment de valider (B8). L'ordre suit la première apparition,
 * pour que l'affichage ne saute pas d'un rendu à l'autre.
 */
export function grouperParFournisseur(lignes: readonly LignePanier[]): GroupeFournisseur[] {
  const groupes = new Map<string, GroupeFournisseur>();
  for (const ligne of lignes) {
    let groupe = groupes.get(ligne.fournisseurId);
    if (!groupe) {
      groupe = {
        fournisseurId: ligne.fournisseurId,
        fournisseurSlug: ligne.fournisseurSlug,
        fournisseurNom: ligne.fournisseurNom,
        fournisseurNiveau: ligne.fournisseurNiveau,
        lignes: [],
        montantProduits: 0,
        poidsTotalKg: 0,
        volumeTotalM3: 0,
      };
      groupes.set(ligne.fournisseurId, groupe);
    }
    groupe.lignes.push(ligne);
    groupe.montantProduits += totalLignePanier(ligne);
    groupe.poidsTotalKg += ligne.poidsKgUnite * ligne.quantite;
    groupe.volumeTotalM3 += ligne.volumeM3Unite * ligne.quantite;
  }
  return [...groupes.values()];
}

/** Total général, tous fournisseurs confondus (hors livraison). */
export function totalProduits(lignes: readonly LignePanier[]): number {
  return lignes.reduce((somme, l) => somme + totalLignePanier(l), 0);
}
