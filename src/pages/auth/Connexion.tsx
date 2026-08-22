import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { schemaConnexion, type ValeursConnexion } from "@/lib/validation";
import { Seo } from "@/components/Seo";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Carte } from "@/components/ui/card";

export default function Connexion() {
  const naviguer = useNavigate();
  const emplacement = useLocation();
  const retour = (emplacement.state as { retour?: string } | null)?.retour ?? "/compte";
  const [envoiEnCours, setEnvoiEnCours] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ValeursConnexion>({ resolver: zodResolver(schemaConnexion) });

  const soumettre = async (valeurs: ValeursConnexion) => {
    setEnvoiEnCours(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: valeurs.email,
      password: valeurs.motDePasse,
    });
    setEnvoiEnCours(false);
    if (error) {
      // On ne dit jamais si c'est l'e-mail ou le mot de passe qui est faux :
      // cela permettrait d'énumérer les comptes existants.
      toast.error("Connexion impossible", { description: "E-mail ou mot de passe incorrect." });
      return;
    }
    naviguer(retour, { replace: true });
  };

  return (
    <div className="container max-w-md py-10">
      <Seo titre="Se connecter" chemin="/connexion" indexable={false} />
      <h1 className="text-page">Se connecter</h1>
      <p className="mt-1 text-legende text-muted-foreground">
        Un compte est nécessaire pour payer en ligne et suivre vos commandes.
      </p>

      <Carte className="mt-5 p-4">
        <form onSubmit={handleSubmit(soumettre)} className="space-y-4" noValidate>
          <Champ etiquette="Adresse e-mail" erreur={errors.email?.message} obligatoire>
            {(attributs) => (
              <Saisie {...attributs} {...register("email")} type="email" autoComplete="email" inputMode="email" />
            )}
          </Champ>

          <Champ etiquette="Mot de passe" erreur={errors.motDePasse?.message} obligatoire>
            {(attributs) => (
              <Saisie {...attributs} {...register("motDePasse")} type="password" autoComplete="current-password" />
            )}
          </Champ>

          <Bouton type="submit" pleineLargeur disabled={envoiEnCours}>
            {envoiEnCours ? "Connexion en cours" : "Se connecter"}
          </Bouton>
        </form>
      </Carte>

      <div className="mt-4 flex flex-col gap-1 text-legende">
        <Link to="/mot-de-passe-oublie" className="lien-souligne">
          Mot de passe oublié
        </Link>
        <span className="text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link to="/inscription" className="lien-souligne">
            Créer un compte
          </Link>
        </span>
      </div>
    </div>
  );
}
