/**
 * Validation d'une destination de retour (`?retour=…`, `state.retour`).
 *
 * Ces valeurs viennent de l'URL, donc de n'importe qui : un lien forgé
 * `?retour=https://piege.example` ou `?retour=//piege.example` transformerait
 * nos pages d'authentification en tremplin d'hameçonnage — l'utilisateur voit
 * partir un lien akora.fonenako.mg et atterrit ailleurs, connecté nulle part.
 *
 * On n'accepte donc QUE des chemins internes : premier caractère « / », et
 * surtout pas « // » ni « /\ » — les navigateurs lisent ces deux formes comme
 * des URL absolues vers un autre domaine (protocol-relative).
 *
 * ⚠ AUCUN ANTISLASH, NULLE PART (03/09/2026, CVE-2025-68470 et son
 *   contournement). react-router normalise « \ » en « / » AVANT de router :
 *   un antislash placé plus loin dans le chemin peut refaire un « // » que le
 *   test du deuxième caractère ne voit pas. Et pas de schéma déguisé, pas de
 *   retour à la ligne, pas de « /../ » : un chemin interne n'a besoin d'aucun
 *   de ces caractères. Ce qui passe ici finit dans `navigate()` — chaque refus
 *   est un hameçonnage évité.
 */
export function retourInterne(brut: string | null | undefined): string | null {
  if (!brut) return null;
  if (!brut.startsWith("/")) return null;
  const deuxieme = brut.charAt(1);
  if (deuxieme === "/" || deuxieme === "\\") return null;
  if (/[\\\r\n\t]/.test(brut)) return null;
  if (/^\/+[^/?#]*:/.test(brut)) return null;
  if (brut.includes("//")) return null;
  if (/\/\.\.?(\/|$|\?)/.test(brut)) return null;
  return brut;
}
