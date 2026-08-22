import type { Unite } from "./types-metier";
import { calepinerMur, calepinerToiture } from "./calepinage";

/**
 * Calculateurs de métré (spec B11).
 *
 * Module PUR : aucun ratio n'est écrit en dur. Ils arrivent en paramètre,
 * lus depuis la table `ratios_metre` — l'admin les ajuste, les calculateurs
 * suivent, sans redéploiement.
 *
 * Chaque résultat est une ESTIMATION, hors chutes et pertes, avec une marge de
 * sécurité explicite. On ne prétend pas remplacer un métreur : on évite à un
 * maçon de commander 300 parpaings pour un mur qui en demande 430.
 */

export type Ratios = Record<string, number>;

export interface LigneMetre {
  cle: string;
  libelle: string;
  quantite: number;
  unite: Unite;
  /** Référence du catalogue commun, pour remplir le panier. */
  materiauSlug: string | null;
}

export interface ResultatMetre {
  lignes: LigneMetre[];
  margePct: number;
  /** Ce que le calcul ne couvre pas. Toujours affiché. */
  reserves: string[];
}

const MARGE_DEFAUT = 5;

function ratio(ratios: Ratios, calculateur: string, cle: string, defaut: number): number {
  const valeur = ratios[`${calculateur}.${cle}`];
  return Number.isFinite(valeur) ? (valeur as number) : defaut;
}

/** Arrondi à l'unité entière supérieure : on ne commande pas 12,4 parpaings. */
function entierSup(valeur: number): number {
  return Math.ceil(valeur - 1e-9);
}

/** Arrondi au dixième pour les volumes, qui se commandent au demi-mètre cube près. */
function dixieme(valeur: number): number {
  return Math.ceil(valeur * 10 - 1e-9) / 10;
}

function avecMarge(valeur: number, margePct: number): number {
  return valeur * (1 + margePct / 100);
}

/* ── 1. Mur en parpaings ─────────────────────────────────────────────────── */

export interface EntreeMur {
  longueurM: number;
  hauteurM: number;
  /** Surface totale des portes et fenêtres, en m². */
  ouverturesM2?: number;
  /** Épaisseur du bloc, pour choisir la référence. */
  epaisseurCm: 10 | 15 | 20;
}

export function murParpaings(entree: EntreeMur, ratios: Ratios, margePct = MARGE_DEFAUT): ResultatMetre {
  // Un mur se monte en RANGEES entieres : la derniere compte pour une rangee
  // complete meme ecretee, et chaque rangee demande son compte de blocs
  // arrondi au superieur. Multiplier la surface par un ratio sous-estime de
  // quelques pour cent — et quelques pour cent d'un mur, c'est une demi-journee
  // d'arret (cf. `calepinage.ts`).
  // Les dimensions du bloc arrivent des ratios, comme tout le reste : ce
  // module ne code AUCUNE valeur en dur, sinon l'admin ne peut plus rien
  // ajuster sans redeploiement.
  const calepinage = calepinerMur({
    longueurM: entree.longueurM,
    hauteurM: entree.hauteurM,
    blocLongueurCm: ratio(ratios, "mur_parpaing", "bloc_longueur_cm", 40),
    blocHauteurCm: ratio(ratios, "mur_parpaing", "bloc_hauteur_cm", 20),
    ouverturesM2: entree.ouverturesM2 ?? 0,
  });
  const surface = calepinage.surfaceNetteM2;
  const mortierParM2 = ratio(ratios, "mur_parpaing", "mortier_m3_par_m2", 0.02);
  const cimentParM3 = ratio(ratios, "mortier", "ciment_kg_par_m3", 350);
  const sableParM3 = ratio(ratios, "mortier", "sable_m3_par_m3", 1.1);

  const mortier = surface * mortierParM2;

  return {
    margePct,
    lignes: [
      {
        cle: "blocs",
        libelle: `Parpaings creux ${entree.epaisseurCm}`,
        quantite: entierSup(avecMarge(calepinage.nbBlocs, margePct)),
        unite: "piece",
        materiauSlug: `parpaing-creux-${entree.epaisseurCm}`,
      },
      {
        cle: "ciment",
        libelle: "Ciment (sacs de 50 kg)",
        quantite: entierSup(avecMarge((mortier * cimentParM3) / 50, margePct)),
        unite: "sac",
        materiauSlug: "ciment-cem2-325-50kg",
      },
      {
        cle: "sable",
        libelle: "Sable de rivière",
        quantite: dixieme(avecMarge(mortier * sableParM3, margePct)),
        unite: "m3",
        materiauSlug: "sable-de-riviere",
      },
    ],
    reserves: [
      `Surface de mur retenue : ${surface.toFixed(1).replace(".", ",")} m², ouvertures déduites.`,
      `Calepinage : ${calepinage.blocsParRangee} blocs sur ${calepinage.nbRangees} rangées` +
        (calepinage.blocsDeduits > 0 ? `, moins ${calepinage.blocsDeduits} pour les ouvertures.` : "."),
      "Hors chaînages, linteaux et fondations.",
    ],
  };
}

/* ── 2. Dalle en hourdis ─────────────────────────────────────────────────── */

export interface EntreeDalle {
  surfaceM2: number;
  hauteurHourdisCm: 12 | 16 | 20;
}

export function dalleHourdis(entree: EntreeDalle, ratios: Ratios, margePct = MARGE_DEFAUT): ResultatMetre {
  const surface = Math.max(0, entree.surfaceM2);
  const poutrelles = ratio(ratios, "dalle_hourdis", "poutrelles_ml_par_m2", 1.67);
  const hourdis = ratio(ratios, "dalle_hourdis", "hourdis_par_m2", 8.33);
  const table = ratio(ratios, "dalle_hourdis", "table_compression_m3_par_m2", 0.04);
  const treillis = ratio(ratios, "dalle_hourdis", "treillis_m2_par_m2", 1.05);

  return {
    margePct,
    lignes: [
      {
        cle: "poutrelles",
        libelle: "Poutrelles béton précontraint",
        quantite: entierSup(avecMarge(surface * poutrelles, margePct)),
        unite: "ml",
        materiauSlug: "poutrelle-beton",
      },
      {
        cle: "hourdis",
        libelle: `Hourdis ${entree.hauteurHourdisCm}`,
        quantite: entierSup(avecMarge(surface * hourdis, margePct)),
        unite: "piece",
        materiauSlug: `hourdis-${entree.hauteurHourdisCm}`,
      },
      {
        cle: "beton",
        libelle: "Béton dosé à 350 (table de compression)",
        quantite: dixieme(avecMarge(surface * table, margePct)),
        unite: "m3",
        materiauSlug: "beton-350",
      },
      {
        cle: "treillis",
        libelle: "Treillis soudé",
        quantite: dixieme(avecMarge(surface * treillis, margePct)),
        unite: "m2",
        materiauSlug: "treillis-soude-6-150",
      },
    ],
    reserves: [
      "Hors étaiement, coffrage de rive et armatures de chaînage.",
      "Vérifiez la portée admissible des poutrelles avec votre fournisseur.",
    ],
  };
}

/* ── 3. Béton dosé à 350 ─────────────────────────────────────────────────── */

export interface EntreeBeton {
  volumeM3: number;
}

export function beton350(entree: EntreeBeton, ratios: Ratios, margePct = MARGE_DEFAUT): ResultatMetre {
  const volume = Math.max(0, entree.volumeM3);
  const ciment = ratio(ratios, "beton_350", "ciment_kg_par_m3", 350);
  const sable = ratio(ratios, "beton_350", "sable_m3_par_m3", 0.4);
  const gravillon = ratio(ratios, "beton_350", "gravillon_m3_par_m3", 0.8);
  const eau = ratio(ratios, "beton_350", "eau_l_par_m3", 175);

  return {
    margePct,
    lignes: [
      {
        cle: "ciment",
        libelle: "Ciment (sacs de 50 kg)",
        quantite: entierSup(avecMarge((volume * ciment) / 50, margePct)),
        unite: "sac",
        materiauSlug: "ciment-cem2-425-50kg",
      },
      {
        cle: "sable",
        libelle: "Sable de rivière",
        quantite: dixieme(avecMarge(volume * sable, margePct)),
        unite: "m3",
        materiauSlug: "sable-de-riviere",
      },
      {
        cle: "gravillon",
        libelle: "Gravillon 5/15",
        quantite: dixieme(avecMarge(volume * gravillon, margePct)),
        unite: "m3",
        materiauSlug: "gravillon-5-15",
      },
      {
        cle: "eau",
        libelle: "Eau",
        quantite: entierSup(volume * eau),
        unite: "piece",
        materiauSlug: null,
      },
    ],
    reserves: [
      "Dosage 350 kg/m³, usage courant en élévation.",
      "L'eau n'est pas vendue sur Akora : elle figure pour le dosage.",
      "Au-delà de 3 m³, le béton prêt à l'emploi en toupie revient souvent moins cher.",
    ],
  };
}

/* ── 4. Chape et enduit ──────────────────────────────────────────────────── */

export interface EntreeChape {
  surfaceM2: number;
  epaisseurCm: number;
  type: "chape" | "enduit";
}

export function chapeEnduit(entree: EntreeChape, ratios: Ratios, margePct = MARGE_DEFAUT): ResultatMetre {
  const surface = Math.max(0, entree.surfaceM2);
  const epaisseur = Math.max(
    0,
    entree.epaisseurCm ||
      ratio(ratios, "chape_enduit", entree.type === "chape" ? "chape_ep_cm" : "enduit_ep_cm", 2),
  );
  const ciment = ratio(ratios, "chape_enduit", "ciment_kg_par_m3", 300);
  const sable = ratio(ratios, "chape_enduit", "sable_m3_par_m3", 1.1);
  const mortier = (surface * epaisseur) / 100;

  return {
    margePct,
    lignes: [
      {
        cle: "ciment",
        libelle: "Ciment (sacs de 50 kg)",
        quantite: entierSup(avecMarge((mortier * ciment) / 50, margePct)),
        unite: "sac",
        materiauSlug: "ciment-cem2-325-50kg",
      },
      {
        cle: "sable",
        libelle: entree.type === "enduit" ? "Sable fin" : "Sable de rivière",
        quantite: dixieme(avecMarge(mortier * sable, margePct)),
        unite: "m3",
        materiauSlug: entree.type === "enduit" ? "sable-fin" : "sable-de-riviere",
      },
    ],
    reserves: [
      `Volume de mortier retenu : ${mortier.toFixed(2).replace(".", ",")} m³ pour ${epaisseur} cm d'épaisseur.`,
      "Un enduit se fait souvent en deux passes : comptez l'épaisseur totale.",
    ],
  };
}

/* ── 5. Toiture en tôles ─────────────────────────────────────────────────── */

export interface EntreeToiture {
  /** Surface DE COUVERTURE, pente comprise — pas la surface au sol. */
  surfaceM2: number;
  longueurToleM: 2 | 3;
  faitageM?: number;
  /**
   * Longueur du batiment, perpendiculaire a la pente. Sans elle, le compte des
   * toles reste une approximation : une tole se pose ENTIERE, et le nombre de
   * rangees depend du rampant, pas de la surface.
   */
  longueurBatimentM?: number;
}

export function toitureToles(entree: EntreeToiture, ratios: Ratios, margePct = MARGE_DEFAUT): ResultatMetre {
  const surface = Math.max(0, entree.surfaceM2);
  const cle = entree.longueurToleM === 3 ? "tole_3m_par_m2" : "tole_2m_par_m2";
  const tolesParM2 = ratio(ratios, "toiture_tole", cle, entree.longueurToleM === 3 ? 0.47 : 0.7);
  const chevrons = ratio(ratios, "toiture_tole", "chevrons_ml_par_m2", 1.67);
  const pannes = ratio(ratios, "toiture_tole", "pannes_ml_par_m2", 0.83);
  const faitiere = ratio(ratios, "toiture_tole", "faitiere_ml_par_ml", 1.05);

  // Une tole se pose ENTIERE : le compte depend du rampant et de la longueur
  // du batiment, pas de la seule surface. Avec les deux dimensions on
  // calepine ; sans elles, on garde le ratio et on le dit dans les reserves.
  const longueurBatiment = entree.longueurBatimentM ?? 0;
  const calepinage =
    longueurBatiment > 0 && surface > 0
      ? calepinerToiture({
          longueurM: longueurBatiment,
          rampantM: surface / longueurBatiment,
          toleLongueurM: entree.longueurToleM,
          // Largeur utile d'une tole ondulee, recouvrement d'onde deduit :
          // c'est la valeur que porte le ratio du referentiel.
          largeurUtileM: 1 / (tolesParM2 * entree.longueurToleM),
        })
      : null;

  const lignes: LigneMetre[] = [
    {
      cle: "toles",
      libelle: `Tôles ondulées de ${entree.longueurToleM} m`,
      quantite: entierSup(
        avecMarge(calepinage ? calepinage.nbToles : surface * tolesParM2, margePct),
      ),
      unite: "piece",
      materiauSlug: entree.longueurToleM === 3 ? "tole-ondulee-030-3m" : "tole-ondulee-025-2m",
    },
    {
      cle: "chevrons",
      libelle: "Chevrons 6 × 8, 4 m",
      quantite: entierSup(avecMarge((surface * chevrons) / 4, margePct)),
      unite: "piece",
      materiauSlug: "chevron-60x80-4m",
    },
    {
      cle: "pannes",
      libelle: "Madriers de panne, 4 m",
      quantite: entierSup(avecMarge((surface * pannes) / 4, margePct)),
      unite: "piece",
      materiauSlug: "madrier-75x225-4m",
    },
  ];

  if (entree.faitageM && entree.faitageM > 0) {
    lignes.push({
      cle: "faitieres",
      libelle: "Faîtières galvanisées de 2 m",
      quantite: entierSup(avecMarge((entree.faitageM * faitiere) / 2, margePct)),
      unite: "piece",
      materiauSlug: "faitiere-galva-2m",
    });
  }

  return {
    margePct,
    lignes,
    reserves: [
      "Surface de COUVERTURE, pente comprise — pas la surface au sol.",
      calepinage
        ? `Calepinage : ${calepinage.tolesParRangee} tôles sur ${calepinage.nbRangees} rangée${calepinage.nbRangees > 1 ? "s" : ""}.`
        : "Sans la longueur du bâtiment, le compte des tôles reste approché : une tôle se pose entière, et le nombre de rangées dépend du rampant.",
      "Hors visserie et fixations : la quincaillerie n'est pas au catalogue d'Akora.",
    ],
  };
}
