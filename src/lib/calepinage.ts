/**
 * Calepinage d'une dalle en hourdis.
 *
 * ── Le defaut que ce module corrige ──────────────────────────────────────
 * Multiplier une surface par un ratio « pieces au m2 » donne un nombre qui ne
 * correspond a AUCUNE dalle constructible. Une dalle se pose en files
 * entieres : chaque file de hourdis demande une poutrelle de plus, et la
 * derniere file compte autant que les autres meme si elle deborde.
 *
 * Sur 22 m2 (5,50 x 4,00 m) avec des hourdis 60 x 20 :
 *   · par ratio    : 22 x 8,33 = 184 hourdis, 22 x 1,67 = 37 ml de poutrelles
 *   · par calepinage : 7 files x 28 = 196 hourdis, 8 poutrelles x 5,50 = 44 ml
 *
 * Soit 6 % de hourdis et 20 % de poutrelles en moins dans le premier cas. Un
 * macon qui commande sur cette base retourne au depot. L'ecart n'est pas une
 * imprecision : c'est la difference entre un metre carre theorique et une
 * dalle qu'on peut poser.
 *
 * ── Les deux dimensions du hourdis ───────────────────────────────────────
 * `entraxeCm` est la dimension qui franchit l'espace entre deux poutrelles :
 * c'est elle qui fixe leur ecartement. `pasCm` est la dimension le long de la
 * poutrelle : c'est le pas de pose. Un hourdis 60 x 20 donne 0,60 et 0,20 ;
 * un 33 x 33 malgache donne 0,33 et 0,33 — d'ou les 9 pieces au m2 qu'annonce
 * une briqueterie de Tana, contre 8,33 pour le format 60 x 20.
 *
 * Module PUR : aucun acces reseau, aucun React, entierement testable.
 */

export interface FormatHourdis {
  /** Slug de la reference, pour retrouver les offres. */
  slug: string;
  /** Franchit l'espace entre deux poutrelles. Donne l'entraxe. */
  entraxeCm: number;
  /** Le long de la poutrelle. Donne le pas de pose. */
  pasCm: number;
  hauteurCm: number;
}

export interface EntreeCalepinage {
  /** Sens des poutrelles, en metres. C'est la portee : elles y sont d'un seul tenant. */
  porteeM: number;
  /** Perpendiculaire aux poutrelles, en metres. */
  largeurM: number;
  format: FormatHourdis;
}

export interface Calepinage {
  surfaceM2: number;
  /** Espaces entre poutrelles : une file de hourdis par espace. */
  nbFiles: number;
  /** Une de plus que les files : il en faut une de chaque cote. */
  nbPoutrelles: number;
  /** Longueur MINIMALE de chaque poutrelle : elles ne se raboutent pas. */
  longueurPoutrelleM: number;
  mlPoutrelles: number;
  hourdisParFile: number;
  nbHourdis: number;
  /** Entraxe reel apres repartition, en metres. Toujours <= entraxe nominal. */
  entraxeReelM: number;
  /** Ce que donnerait le ratio par m2, pour montrer l'ecart. */
  nbHourdisParRatio: number;
  mlPoutrellesParRatio: number;
  /** Ecart du calepinage sur le ratio, en pourcentage. */
  ecartHourdisPct: number;
  ecartPoutrellesPct: number;
}

/** Arrondi superieur robuste aux erreurs de virgule flottante. */
function entierSup(valeur: number): number {
  return Math.ceil(valeur - 1e-9);
}

export function calepinerDalle(entree: EntreeCalepinage): Calepinage {
  const portee = Math.max(0, entree.porteeM);
  const largeur = Math.max(0, entree.largeurM);
  const entraxe = entree.format.entraxeCm / 100;
  const pas = entree.format.pasCm / 100;
  const surfaceM2 = portee * largeur;

  if (portee <= 0 || largeur <= 0 || entraxe <= 0 || pas <= 0) {
    return {
      surfaceM2: 0,
      nbFiles: 0,
      nbPoutrelles: 0,
      longueurPoutrelleM: 0,
      mlPoutrelles: 0,
      hourdisParFile: 0,
      nbHourdis: 0,
      entraxeReelM: 0,
      nbHourdisParRatio: 0,
      mlPoutrellesParRatio: 0,
      ecartHourdisPct: 0,
      ecartPoutrellesPct: 0,
    };
  }

  // Une file de hourdis par espace entre poutrelles. La derniere file est
  // souvent plus etroite ; elle se comble au beton, mais elle a demande sa
  // poutrelle et ses hourdis comme les autres.
  const nbFiles = entierSup(largeur / entraxe);
  const nbPoutrelles = nbFiles + 1;
  const hourdisParFile = entierSup(portee / pas);
  const nbHourdis = nbFiles * hourdisParFile;
  const mlPoutrelles = nbPoutrelles * portee;

  // Ce qu'aurait donne le ratio, pour que l'ecart soit visible et non subi.
  const hourdisParM2 = 1 / (entraxe * pas);
  const mlParM2 = 1 / entraxe;
  const nbHourdisParRatio = entierSup(surfaceM2 * hourdisParM2);
  const mlPoutrellesParRatio = surfaceM2 * mlParM2;

  return {
    surfaceM2,
    nbFiles,
    nbPoutrelles,
    longueurPoutrelleM: portee,
    mlPoutrelles,
    hourdisParFile,
    nbHourdis,
    entraxeReelM: largeur / nbFiles,
    nbHourdisParRatio,
    mlPoutrellesParRatio,
    ecartHourdisPct:
      nbHourdisParRatio > 0 ? ((nbHourdis - nbHourdisParRatio) / nbHourdisParRatio) * 100 : 0,
    ecartPoutrellesPct:
      mlPoutrellesParRatio > 0
        ? ((mlPoutrelles - mlPoutrellesParRatio) / mlPoutrellesParRatio) * 100
        : 0,
  };
}

/** Le ratio theorique du format, pour l'afficher a titre indicatif. */
export function hourdisParM2(format: FormatHourdis): number {
  const entraxe = format.entraxeCm / 100;
  const pas = format.pasCm / 100;
  if (entraxe <= 0 || pas <= 0) return 0;
  return 1 / (entraxe * pas);
}
