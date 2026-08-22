import { prixUnitaireApplicable, type Palier } from "./paliers";
import type { ProduitPublic } from "./donnees/vitrine";
import type { ResultatLivraison } from "./livraison";

/**
 * Construction d'une ligne du comparateur « prix rendu chantier » (spec B7).
 *
 * Module pur : la même fonction sert au tableau, au tri et à l'encadré
 * pédagogique du bas — qui est généré depuis DEUX LIGNES RÉELLES, jamais
 * depuis un texte figé (AKORA-DESIGN §7).
 */
export interface LigneComparateur {
  produit: ProduitPublic;
  prixUnitaire: number;
  totalProduits: number;
  livraison: ResultatLivraison | null;
  /** `null` quand la livraison n'est pas estimable : on ne classe pas ce qu'on ignore. */
  rendu: number | null;
  renduParUnite: number | null;
  distanceKm: number | null;
}

export function construireLigne(
  produit: ProduitPublic,
  paliers: Palier[],
  quantite: number,
  livraison: ResultatLivraison | null,
): LigneComparateur {
  const base = Number(produit.prix_promo ?? produit.prix_unitaire);
  const prixUnitaire = prixUnitaireApplicable(base, paliers, quantite);
  const totalProduits = Math.round(prixUnitaire * quantite);

  let coutLivraison: number | null = null;
  let distanceKm: number | null = null;
  if (livraison?.statut === "estimee") {
    coutLivraison = livraison.cout;
    distanceKm = livraison.detail.distanceRouteKm;
  } else if (livraison?.statut === "offerte") {
    coutLivraison = 0;
    distanceKm = livraison.detail.distanceRouteKm;
  } else if (livraison?.statut === "hors_zone") {
    distanceKm = livraison.distanceRouteKm;
  }

  const rendu = coutLivraison === null ? null : totalProduits + coutLivraison;
  return {
    produit,
    prixUnitaire,
    totalProduits,
    livraison,
    rendu,
    renduParUnite: rendu === null ? null : Math.round(rendu / Math.max(1, quantite)),
    distanceKm,
  };
}

export type CritereTri = "rendu" | "prix_unitaire" | "distance" | "note" | "verification";

/**
 * Tri du comparateur. Les offres non estimables tombent TOUJOURS en fin de
 * liste, quel que soit le critère : une offre sans prix livré n'est pas
 * comparable, et la faire remonter parce qu'elle est peu chère au dépôt
 * serait exactement le piège que ce site combat.
 */
export function trierLignes(lignes: readonly LigneComparateur[], critere: CritereTri): LigneComparateur[] {
  const rang = { partenaire: 3, verifie: 2, en_cours: 1, non_verifie: 0 } as const;
  return [...lignes].sort((a, b) => {
    const aEstimable = a.rendu !== null;
    const bEstimable = b.rendu !== null;
    if (aEstimable !== bEstimable) return aEstimable ? -1 : 1;

    switch (critere) {
      case "prix_unitaire":
        return a.prixUnitaire - b.prixUnitaire;
      case "distance":
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      case "note":
        return Number(b.produit.fournisseur_note ?? 0) - Number(a.produit.fournisseur_note ?? 0);
      case "verification":
        return (
          (rang[b.produit.fournisseur_niveau as keyof typeof rang] ?? 0) -
          (rang[a.produit.fournisseur_niveau as keyof typeof rang] ?? 0)
        );
      default:
        return (a.rendu ?? Infinity) - (b.rendu ?? Infinity);
    }
  });
}

/**
 * L'encadré pédagogique du bas, construit sur les deux premières lignes
 * RÉELLES. Renvoie `null` s'il n'y a pas de quoi démontrer quoi que ce soit —
 * mieux vaut ne rien dire qu'illustrer avec un exemple inventé.
 */
export interface Demonstration {
  moinsCherDepot: LigneComparateur;
  moinsCherRendu: LigneComparateur;
  ecart: number;
}

export function demonstration(lignes: readonly LigneComparateur[]): Demonstration | null {
  const estimables = lignes.filter((l) => l.rendu !== null);
  if (estimables.length < 2) return null;
  const parDepot = [...estimables].sort((a, b) => a.prixUnitaire - b.prixUnitaire)[0] as LigneComparateur;
  const parRendu = [...estimables].sort((a, b) => (a.rendu ?? 0) - (b.rendu ?? 0))[0] as LigneComparateur;
  if (parDepot.produit.id === parRendu.produit.id) return null;
  return {
    moinsCherDepot: parDepot,
    moinsCherRendu: parRendu,
    ecart: (parDepot.rendu ?? 0) - (parRendu.rendu ?? 0),
  };
}
