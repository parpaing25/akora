import type { ProduitPublic } from "./donnees/vitrine";
import type { LignePanier } from "./panier";
import type { Palier } from "./paliers";
import type { ProduitCarte } from "./types-metier";

/**
 * Passage de la vue publique aux objets d'affichage.
 *
 * Un seul endroit fait cette conversion : sans ça, chaque écran réinvente sa
 * façon de lire une ligne de `produits_publics`, et le jour où la vue gagne
 * une colonne, il faut la chercher partout.
 */

export function versCarte(produit: ProduitPublic, distanceKm?: number | null): ProduitCarte {
  return {
    id: produit.id as string,
    slug: produit.slug as string,
    nomAffiche: produit.nom_affiche as string,
    photo: (produit.photos as string[] | null)?.[0] ?? null,
    prixUnitaire: Number(produit.prix_unitaire),
    prixPromo: produit.prix_promo == null ? null : Number(produit.prix_promo),
    unite: produit.unite as ProduitCarte["unite"],
    stock: produit.stock_statut as ProduitCarte["stock"],
    fournisseurId: produit.fournisseur_id as string,
    fournisseurSlug: produit.fournisseur_slug as string,
    fournisseurNom: produit.fournisseur_nom as string,
    fournisseurNiveau: produit.fournisseur_niveau as ProduitCarte["fournisseurNiveau"],
    distanceKm: distanceKm ?? null,
  };
}

/**
 * Ligne de panier. Le prix mémorisé ici est INDICATIF : au moment de
 * commander, le serveur recalcule tout depuis la base et fige un instantané.
 */
export function versLignePanier(
  produit: ProduitPublic,
  paliers: Palier[] = [],
): Omit<LignePanier, "quantite"> {
  return {
    produitId: produit.id as string,
    slug: produit.slug as string,
    nomAffiche: produit.nom_affiche as string,
    photo: (produit.photos as string[] | null)?.[0] ?? null,
    unite: produit.unite as LignePanier["unite"],
    prixUnitaire: Number(produit.prix_promo ?? produit.prix_unitaire),
    paliers,
    quantiteMin: Number(produit.quantite_min ?? 1),
    poidsKgUnite: Number(produit.poids_kg_unite),
    volumeM3Unite: Number(produit.volume_m3_unite),
    stock: produit.stock_statut as LignePanier["stock"],
    fournisseurId: produit.fournisseur_id as string,
    fournisseurSlug: produit.fournisseur_slug as string,
    fournisseurNom: produit.fournisseur_nom as string,
    fournisseurNiveau: produit.fournisseur_niveau as LignePanier["fournisseurNiveau"],
  };
}

/** Coordonnées du dépôt, ou `null` si le fournisseur ne les a pas posées. */
export function departFournisseur(produit: ProduitPublic): { lat: number; lng: number } | null {
  const lat = produit.fournisseur_lat;
  const lng = produit.fournisseur_lng;
  return lat == null || lng == null ? null : { lat: Number(lat), lng: Number(lng) };
}
