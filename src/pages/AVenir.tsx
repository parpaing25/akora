import { useLocation } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { EtatVide } from "@/components/ui/etats";
import { Bouton } from "@/components/ui/button";
import { Link } from "react-router-dom";

/**
 * Écran provisoire des routes dont l'étape de construction n'est pas encore
 * atteinte (voir la partie E de la spec). Il n'existe QUE pendant le chantier :
 * chaque étape le remplace par la vraie page. Il n'affiche aucune donnée.
 */
export default function AVenir() {
  const { pathname } = useLocation();
  return (
    <div className="container py-10">
      <Seo titre="Page en construction" chemin={pathname} indexable={false} />
      <EtatVide
        titre="Cette page arrive"
        phrase="Elle fait partie d'une étape de construction qui n'est pas encore livrée."
        action={
          <Bouton asChild variante="secondaire">
            <Link to="/">Revenir à l'accueil</Link>
          </Bouton>
        }
      />
    </div>
  );
}
