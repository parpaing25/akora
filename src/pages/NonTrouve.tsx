import { Link, useLocation } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { EtatVide } from "@/components/ui/etats";
import { Bouton } from "@/components/ui/button";

export default function NonTrouve() {
  const { pathname } = useLocation();
  return (
    <div className="container py-14">
      <Seo titre="Page introuvable" chemin={pathname} indexable={false} />
      <p className="nombres text-center text-[3rem] font-bold tracking-tight text-primary">404</p>
      <EtatVide
        titre="Cette page n'existe pas"
        phrase="Le lien est peut-être ancien, ou l'adresse comporte une faute."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Bouton asChild>
              <Link to="/materiaux">Voir les matériaux</Link>
            </Bouton>
            <Bouton asChild variante="secondaire">
              <Link to="/">Revenir à l'accueil</Link>
            </Bouton>
          </div>
        }
      />
    </div>
  );
}
