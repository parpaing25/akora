import * as React from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { ENV } from "@/lib/env";
import { schemaMotDePasseOublie, type ValeursMotDePasseOublie } from "@/lib/validation";
import { Seo } from "@/components/Seo";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Carte } from "@/components/ui/card";

export default function MotDePasseOublie() {
  const [envoye, setEnvoye] = React.useState(false);
  const [envoiEnCours, setEnvoiEnCours] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ValeursMotDePasseOublie>({ resolver: zodResolver(schemaMotDePasseOublie) });

  const soumettre = async (valeurs: ValeursMotDePasseOublie) => {
    setEnvoiEnCours(true);
    await supabase.auth.resetPasswordForEmail(valeurs.email, {
      redirectTo: ENV.siteUrl + "/compte/securite",
    });
    setEnvoiEnCours(false);
    // Réponse identique que le compte existe ou non : on n'aide personne à
    // deviner quelles adresses sont inscrites.
    setEnvoye(true);
  };

  return (
    <div className="container max-w-md py-10">
      <Seo titre="Mot de passe oublié" chemin="/mot-de-passe-oublie" indexable={false} />
      <h1 className="text-page">Mot de passe oublié</h1>

      {envoye ? (
        <Carte className="mt-5 p-4">
          <p className="text-[0.9375rem]">
            Si un compte existe avec cette adresse, un lien de réinitialisation vient de partir.
          </p>
          <p className="mt-2 text-legende text-muted-foreground">
            Le lien est valable une heure. Pensez à regarder dans les courriers indésirables.
          </p>
        </Carte>
      ) : (
        <Carte className="mt-5 p-4">
          <form onSubmit={handleSubmit(soumettre)} className="space-y-4" noValidate>
            <Champ etiquette="Adresse e-mail" erreur={errors.email?.message} obligatoire>
              {(attributs) => (
                <Saisie {...attributs} {...register("email")} type="email" autoComplete="email" inputMode="email" />
              )}
            </Champ>
            <Bouton type="submit" pleineLargeur disabled={envoiEnCours}>
              {envoiEnCours ? "Envoi en cours" : "Recevoir un lien"}
            </Bouton>
          </form>
        </Carte>
      )}

      <p className="mt-4 text-legende">
        <Link to="/connexion" className="lien-souligne">
          Revenir à la connexion
        </Link>
      </p>
    </div>
  );
}
