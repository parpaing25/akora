import { arrondirCentaineSup } from "./argent.ts";

/**
 * Calcul du coût de livraison (spec B6).
 *
 * Module PUR : aucune requête réseau, aucun accès au store, aucun composant.
 * C'est ce qui permet de le tester exhaustivement, et de le rejouer tel quel
 * côté serveur au moment de créer une commande — le client ne doit jamais être
 * l'autorité sur un montant (règle A3).
 *
 * Ce que le module ne fait JAMAIS : inventer un prix. Hors zone, sans
 * coordonnées ou sans véhicule, il le dit et rend la main.
 */

/** Coefficient global par défaut, surchargeable par fournisseur (B6 étape 2). */
export const COEF_SINUOSITE_DEFAUT = 1.3;

export interface Point {
  lat: number;
  lng: number;
}

export interface Vehicule {
  id: string;
  nom: string;
  capacite_m3: number;
  capacite_kg: number;
  prix_par_km: number;
  forfait_base: number;
  km_inclus: number;
  prix_minimum: number;
  facturer_aller_retour: boolean;
}

export interface Zone {
  id: string;
  nom: string;
  rayon_km: number;
  seuil_franco: number | null;
  rayon_franco_km: number | null;
  majoration_pct: number;
}

export interface LigneACharger {
  quantite: number;
  poids_kg_unite: number;
  volume_m3_unite: number;
}

export interface DemandeLivraison {
  depart: Point | null;
  arrivee: Point | null;
  rayonMaxKm: number;
  coefSinuosite?: number | null;
  vehicules: readonly Vehicule[];
  zones: readonly Zone[];
  lignes: readonly LigneACharger[];
  /** Montant des produits, pour le franco de port. */
  montantProduits: number;
}

/** Le détail affiché sous le coût : le simulateur ne montre jamais un chiffre nu (§6). */
export interface DetailLivraison {
  distanceVolKm: number;
  coefSinuosite: number;
  distanceRouteKm: number;
  volumeTotalM3: number;
  poidsTotalKg: number;
  vehicule: Vehicule;
  rotations: number;
  kmFactures: number;
  majorationPct: number;
  zone: Zone | null;
  /** La formule appliquée, telle quelle, pour le pliant « Comment ce prix est calculé ? ». */
  formule: string;
}

export type ResultatLivraison =
  | { statut: "estimee"; cout: number; detail: DetailLivraison }
  | { statut: "offerte"; cout: 0; detail: DetailLivraison; conditionFranco: string }
  | { statut: "hors_zone"; distanceRouteKm: number; rayonMaxKm: number }
  | { statut: "retrait_sur_place" }
  | { statut: "coordonnees_manquantes" }
  | { statut: "panier_vide" };

const RAYON_TERRE_KM = 6371.0088;

/** Distance à vol d'oiseau, en kilomètres. */
export function haversine(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Volume et poids embarqués, additionnés ligne à ligne (B6 étape 3). */
export function chargeTotale(lignes: readonly LigneACharger[]): { volumeM3: number; poidsKg: number } {
  let volumeM3 = 0;
  let poidsKg = 0;
  for (const ligne of lignes) {
    volumeM3 += ligne.quantite * ligne.volume_m3_unite;
    poidsKg += ligne.quantite * ligne.poids_kg_unite;
  }
  return { volumeM3, poidsKg };
}

/**
 * Choix du véhicule et nombre de rotations.
 *
 * On retient le PLUS PETIT véhicule qui passe en une fois. « Plus petit » se
 * lit d'abord sur le volume, puis sur la charge : c'est le volume qui sature
 * en premier sur des matériaux légers et encombrants (tôles, hourdis), et la
 * charge sur des matériaux denses (sable, fers).
 */
export function choisirVehicule(
  vehicules: readonly Vehicule[],
  volumeM3: number,
  poidsKg: number,
): { vehicule: Vehicule; rotations: number } | null {
  if (vehicules.length === 0) return null;

  const tries = [...vehicules].sort(
    (a, b) => a.capacite_m3 - b.capacite_m3 || a.capacite_kg - b.capacite_kg,
  );

  const suffisant = tries.find((v) => v.capacite_m3 >= volumeM3 && v.capacite_kg >= poidsKg);
  if (suffisant) return { vehicule: suffisant, rotations: 1 };

  // Aucun véhicule ne passe en une fois : on prend le plus grand et on
  // compte les rotations nécessaires.
  const plusGrand = tries[tries.length - 1] as Vehicule;
  const rotations = Math.max(
    1,
    Math.ceil(Math.max(volumeM3 / plusGrand.capacite_m3, poidsKg / plusGrand.capacite_kg)),
  );
  return { vehicule: plusGrand, rotations };
}

/**
 * Zone applicable : la plus petite dont le rayon couvre la distance.
 * Au-delà de toutes les zones déclarées, aucune majoration ni franco ne
 * s'applique — mais la livraison reste calculable tant qu'on est dans le
 * rayon maximum du fournisseur.
 */
export function choisirZone(zones: readonly Zone[], distanceRouteKm: number): Zone | null {
  const couvrantes = zones
    .filter((z) => distanceRouteKm <= z.rayon_km)
    .sort((a, b) => a.rayon_km - b.rayon_km);
  return couvrantes[0] ?? null;
}

/** Formate un nombre pour la formule affichée : virgule française, pas d'exposant. */
function n(valeur: number, decimales = 2): string {
  return valeur.toFixed(decimales).replace(/\.?0+$/, "").replace(".", ",") || "0";
}

/**
 * Calcul complet. Renvoie soit un coût avec son détail, soit la raison
 * précise pour laquelle il n'y a rien à afficher.
 */
export function calculerLivraison(demande: DemandeLivraison): ResultatLivraison {
  const { depart, arrivee, vehicules, zones, lignes, montantProduits, rayonMaxKm } = demande;

  if (lignes.length === 0) return { statut: "panier_vide" };

  // Sans véhicule déclaré, il n'y a pas de livraison à vendre.
  if (vehicules.length === 0) return { statut: "retrait_sur_place" };

  // Sans coordonnées des deux côtés, on n'estime rien (B6 étape 1).
  if (!depart || !arrivee) return { statut: "coordonnees_manquantes" };

  const distanceVolKm = haversine(depart, arrivee);
  const coefSinuosite = demande.coefSinuosite ?? COEF_SINUOSITE_DEFAUT;
  const distanceRouteKm = distanceVolKm * coefSinuosite;

  if (distanceRouteKm > rayonMaxKm) {
    return { statut: "hors_zone", distanceRouteKm, rayonMaxKm };
  }

  const { volumeM3, poidsKg } = chargeTotale(lignes);
  const choix = choisirVehicule(vehicules, volumeM3, poidsKg);
  if (!choix) return { statut: "retrait_sur_place" };

  const { vehicule, rotations } = choix;
  const zone = choisirZone(zones, distanceRouteKm);
  const majorationPct = zone?.majoration_pct ?? 0;

  const kmFactures =
    Math.max(0, distanceRouteKm - vehicule.km_inclus) * (vehicule.facturer_aller_retour ? 2 : 1);

  const coutBrut =
    Math.max(vehicule.prix_minimum, vehicule.forfait_base + kmFactures * vehicule.prix_par_km) *
    rotations *
    (1 + majorationPct / 100);

  const cout = arrondirCentaineSup(coutBrut);

  const formule = [
    `distance route = ${n(distanceVolKm)} km a vol d'oiseau x ${n(coefSinuosite)} = ${n(distanceRouteKm)} km`,
    `km factures = max(0 ; ${n(distanceRouteKm)} - ${n(vehicule.km_inclus)})` +
      (vehicule.facturer_aller_retour ? " x 2 (aller-retour)" : "") +
      ` = ${n(kmFactures)} km`,
    `cout = max(${vehicule.prix_minimum} ; ${vehicule.forfait_base} + ${n(kmFactures)} x ${vehicule.prix_par_km})` +
      (rotations > 1 ? ` x ${rotations} rotations` : "") +
      (majorationPct !== 0 ? ` x (1 + ${n(majorationPct)} %)` : "") +
      ` = ${cout} Ar`,
  ].join("\n");

  const detail: DetailLivraison = {
    distanceVolKm,
    coefSinuosite,
    distanceRouteKm,
    volumeTotalM3: volumeM3,
    poidsTotalKg: poidsKg,
    vehicule,
    rotations,
    kmFactures,
    majorationPct,
    zone,
    formule,
  };

  // Franco de port : les deux conditions doivent être remplies ensemble.
  if (
    zone &&
    zone.seuil_franco != null &&
    zone.rayon_franco_km != null &&
    montantProduits >= zone.seuil_franco &&
    distanceRouteKm <= zone.rayon_franco_km
  ) {
    return {
      statut: "offerte",
      cout: 0,
      detail,
      conditionFranco: `commande de ${zone.seuil_franco} Ar ou plus, a moins de ${n(zone.rayon_franco_km)} km`,
    };
  }

  return { statut: "estimee", cout, detail };
}
