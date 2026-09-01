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
 */
export function retourInterne(brut: string | null | undefined): string | null {
  if (!brut) return null;
  if (!brut.startsWith("/")) return null;
  const deuxieme = brut.charAt(1);
  if (deuxieme === "/" || deuxieme === "\\") return null;
  return brut;
}
