/**
 * Force d'un mot de passe, de 0 à 4.
 *
 * Volontairement grossier : ce n'est pas un audit de sécurité, c'est un
 * encouragement à faire mieux que « 12345678 ». La règle qui BLOQUE vit dans
 * `validation.ts` et, surtout, en base — huit caractères, une lettre, un
 * chiffre. Cette jauge, elle, ne refuse jamais rien : elle informe.
 *
 * Pure, sans réseau ni DOM : testable telle quelle.
 */
export const LIBELLES_FORCE = ["", "Faible", "Moyen", "Solide", "Très solide"] as const;

export function forceMotDePasse(valeur: string): 0 | 1 | 2 | 3 | 4 {
  if (!valeur) return 0;
  let note = 0;
  if (valeur.length >= 8) note += 1;
  if (valeur.length >= 12) note += 1;
  if (/[a-zA-ZÀ-ÿ]/.test(valeur) && /\d/.test(valeur)) note += 1;
  if (/[^a-zA-Z0-9À-ÿ]/.test(valeur)) note += 1;
  return Math.min(note, 4) as 0 | 1 | 2 | 3 | 4;
}

export function libelleForce(valeur: string): string {
  return LIBELLES_FORCE[forceMotDePasse(valeur)];
}
