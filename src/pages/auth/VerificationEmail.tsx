import { Link, useLocation } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

/**
 * Écran d'attente après inscription, et point d'atterrissage du lien de
 * confirmation. Supabase pose la session dans l'URL : le client la détecte
 * tout seul (detectSessionInUrl), il n'y a rien à faire ici que constater.
 */
export default function VerificationEmail() {
  const emplacement = useLocation();
  const email = (emplacement.state as { email?: string } | null)?.email;
  const { session } = useAuth();

  return (
    <div className="container max-w-md py-10">
      <Seo titre="Vérifier votre e-mail" chemin="/verification-email" indexable={false} />

      {session?.user.email_confirmed_at ? (
        <>
          <h1 className="text-page">Adresse confirmée</h1>
          <Carte className="mt-5 p-4">
            <p className="text-[0.9375rem]">Votre compte est actif. Vous pouvez commander et payer en ligne.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Bouton asChild>
                <Link to="/materiaux">Voir les matériaux</Link>
              </Bouton>
              <Bouton asChild variante="secondaire">
                <Link to="/compte">Mon compte</Link>
              </Bouton>
            </div>
          </Carte>
        </>
      ) : (
        <>
          <h1 className="text-page">Vérifiez votre e-mail</h1>
          <Carte className="mt-5 p-4">
            <p className="text-[0.9375rem]">
              Un lien de confirmation vient de partir{email ? " vers " + email : ""}. Ouvrez-le depuis
              ce téléphone pour activer votre compte.
            </p>
            <p className="mt-2 text-legende text-muted-foreground">
              Sans e-mail confirmé, vous pouvez consulter le site mais pas payer en ligne. Regardez
              aussi dans les courriers indésirables.
            </p>
          </Carte>
        </>
      )}
    </div>
  );
}
