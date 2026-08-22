import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import { envoyerCode } from "@/lib/donnees/otp";
import { DialogueCode } from "@/components/auth/DialogueCode";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";

/**
 * Confirmation de l'adresse, hors du parcours d'inscription.
 *
 * On y atterrit quand le code n'a pas pu partir, ou quand quelqu'un revient
 * plus tard. Le signal lu ici est `profiles.email_verifie` — surtout pas
 * `email_confirmed_at`, que la confirmation automatique de Supabase remplit
 * dès l'inscription et qui ne prouve donc rien.
 */
export default function VerificationEmail() {
  const emplacement = useLocation();
  const { session, profil, utilisateur } = useAuth();
  const [dialogue, setDialogue] = React.useState(false);
  const [enCours, setEnCours] = React.useState(false);

  const email = (emplacement.state as { email?: string } | null)?.email ?? utilisateur?.email ?? "";
  const verifie = profil?.email_verifie === true;

  const demander = async () => {
    if (!utilisateur || !email) return;
    setEnCours(true);
    try {
      await envoyerCode(utilisateur.id, email);
      setDialogue(true);
    } catch (erreur) {
      toast.error("Envoi impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="container max-w-md py-10">
      <Seo titre="Confirmer votre adresse" chemin="/verification-email" indexable={false} />

      {verifie ? (
        <>
          <h1 className="text-page">Adresse confirmée</h1>
          <Carte className="mt-5 p-4">
            <p className="text-[0.9375rem]">
              Votre compte est actif. Vous pouvez commander et payer en ligne.
            </p>
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
          <h1 className="text-page">Confirmez votre adresse</h1>
          <Carte className="mt-5 p-4">
            <p className="text-[0.9375rem]">
              Un code à six chiffres part vers {email ? <strong>{email}</strong> : "votre adresse"}.
              Recopiez-le pour activer votre compte.
            </p>
            <p className="mt-2 text-legende text-muted-foreground">
              Sans adresse confirmée, vous pouvez consulter le site mais pas payer en ligne — le
              séquestre suppose de savoir à qui rendre l'argent en cas de litige.
            </p>

            {session ? (
              <Bouton className="mt-4" pleineLargeur disabled={enCours} onClick={() => void demander()}>
                {enCours ? "Envoi en cours" : "Recevoir mon code"}
              </Bouton>
            ) : (
              <Bouton asChild className="mt-4" pleineLargeur>
                <Link to="/connexion">Se connecter d'abord</Link>
              </Bouton>
            )}

            <p className="mt-2 text-[0.78rem] text-muted-foreground">
              Regardez aussi dans les courriers indésirables.
            </p>
          </Carte>
        </>
      )}

      {dialogue && utilisateur ? (
        <DialogueCode
          ouvert
          email={email}
          userId={utilisateur.id}
          onVerifie={() => {
            setDialogue(false);
            window.location.replace("/compte");
          }}
        />
      ) : null}
    </div>
  );
}
