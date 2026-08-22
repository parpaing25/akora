import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ENV } from "@/lib/env";
import { schemaInscription, type ValeursInscription } from "@/lib/validation";
import { useAntiAbus } from "@/hooks/useAntiAbus";
import { envoyerCode } from "@/lib/donnees/otp";
import { DialogueCode } from "@/components/auth/DialogueCode";
import { Seo } from "@/components/Seo";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Carte } from "@/components/ui/card";
import { GroupeRadio, OptionRadio } from "@/components/ui/radio-group";
import { LigneCase } from "@/components/ui/checkbox";

/**
 * Inscription acheteur OU fournisseur.
 *
 * Le rôle demandé n'est PAS écrit ici dans `user_roles` : le client n'a aucun
 * droit d'écriture sur cette table (règle A3). Il est transmis dans les
 * métadonnées du compte, et c'est un trigger `SECURITY DEFINER` côté base qui
 * crée le profil et attribue le rôle. Écrire un rôle depuis le navigateur,
 * ce serait offrir « admin » à qui le demande.
 */
export default function Inscription() {
  const naviguer = useNavigate();
  const antiAbus = useAntiAbus();
  const [envoiEnCours, setEnvoiEnCours] = React.useState(false);
  const [aVerifier, setAVerifier] = React.useState<{ userId: string; email: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ValeursInscription>({
    resolver: zodResolver(schemaInscription),
    defaultValues: { profil: "acheteur" },
  });

  const profil = watch("profil");

  const soumettre = async (valeurs: ValeursInscription) => {
    const refus = antiAbus.verifier();
    if (refus) {
      toast.error(refus);
      return;
    }
    setEnvoiEnCours(true);
    const { data, error } = await supabase.auth.signUp({
      email: valeurs.email,
      password: valeurs.motDePasse,
      options: {
        emailRedirectTo: ENV.siteUrl + "/verification-email",
        data: {
          nom_complet: valeurs.nomComplet,
          telephone: valeurs.telephone,
          profil_demande: valeurs.profil,
          raison_sociale: valeurs.raisonSociale ?? null,
        },
      },
    });
    if (error) {
      setEnvoiEnCours(false);
      toast.error("Inscription impossible", { description: error.message });
      return;
    }

    // Le compte existe ; il reste à prouver que l'adresse est bien la sienne.
    const utilisateur = data.user;
    if (!utilisateur) {
      setEnvoiEnCours(false);
      naviguer("/verification-email", { replace: true, state: { email: valeurs.email } });
      return;
    }
    try {
      await envoyerCode(utilisateur.id, valeurs.email);
      setAVerifier({ userId: utilisateur.id, email: valeurs.email });
    } catch (erreur) {
      // Le compte est créé : on ne le perd pas parce que le mail n'est pas
      // parti. L'utilisateur pourra redemander un code depuis son espace.
      toast.error("Code non envoyé", { description: (erreur as Error).message });
      naviguer("/verification-email", { replace: true, state: { email: valeurs.email } });
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="container max-w-md py-10">
      <Seo titre="Créer un compte" chemin="/inscription" indexable={false} />
      <h1 className="text-page">Créer un compte</h1>
      <p className="mt-1 text-legende text-muted-foreground">
        Gratuit. Nécessaire pour payer en ligne, suivre ses commandes et voir les numéros des
        fournisseurs.
      </p>

      <Carte className="mt-5 p-4">
        <form onSubmit={handleSubmit(soumettre)} className="space-y-4" noValidate>
          <input type="text" {...antiAbus.proprietesLeurre} readOnly={false} />

          <fieldset>
            <legend className="text-legende font-semibold">Je viens pour</legend>
            <GroupeRadio
              className="mt-1.5"
              value={profil}
              onValueChange={(v) => setValue("profil", v as ValeursInscription["profil"])}
            >
              <OptionRadio
                id="profil-acheteur"
                valeur="acheteur"
                titre="Acheter des matériaux"
                detail="Particulier, maçon, tâcheron ou entreprise de BTP."
              />
              <OptionRadio
                id="profil-fournisseur"
                valeur="fournisseur"
                titre="Vendre des matériaux"
                detail="Dépôt, briqueterie, carrière, scierie, cimenterie."
              />
            </GroupeRadio>
          </fieldset>

          <Champ etiquette="Nom et prénom" erreur={errors.nomComplet?.message} obligatoire>
            {(attributs) => <Saisie {...attributs} {...register("nomComplet")} autoComplete="name" />}
          </Champ>

          {profil === "fournisseur" ? (
            <Champ
              etiquette="Raison sociale"
              aide="Le nom de votre entreprise, tel qu'il figure sur votre carte fiscale."
              erreur={errors.raisonSociale?.message}
              obligatoire
            >
              {(attributs) => <Saisie {...attributs} {...register("raisonSociale")} autoComplete="organization" />}
            </Champ>
          ) : null}

          <Champ etiquette="Adresse e-mail" erreur={errors.email?.message} obligatoire>
            {(attributs) => (
              <Saisie {...attributs} {...register("email")} type="email" autoComplete="email" inputMode="email" />
            )}
          </Champ>

          <Champ
            etiquette="Téléphone"
            aide="Format 034 12 345 67. Il sert à vous joindre pour la livraison."
            erreur={errors.telephone?.message}
            obligatoire
          >
            {(attributs) => (
              <Saisie {...attributs} {...register("telephone")} type="tel" autoComplete="tel" inputMode="tel" />
            )}
          </Champ>

          <Champ
            etiquette="Mot de passe"
            aide="8 caractères minimum, avec au moins une lettre et un chiffre."
            erreur={errors.motDePasse?.message}
            obligatoire
          >
            {(attributs) => (
              <Saisie {...attributs} {...register("motDePasse")} type="password" autoComplete="new-password" />
            )}
          </Champ>

          <Champ etiquette="Confirmer le mot de passe" erreur={errors.confirmation?.message} obligatoire>
            {(attributs) => (
              <Saisie {...attributs} {...register("confirmation")} type="password" autoComplete="new-password" />
            )}
          </Champ>

          <div>
            <LigneCase
              id="conditions"
              etiquette="J'accepte les conditions d'utilisation et la politique de confidentialité."
              onCheckedChange={(coche) => setValue("conditions", coche === true, { shouldValidate: true })}
            />
            {errors.conditions?.message ? (
              <p role="alert" className="text-[0.78rem] text-destructive-strong">
                {errors.conditions.message}
              </p>
            ) : null}
          </div>

          <Bouton type="submit" pleineLargeur disabled={envoiEnCours}>
            {envoiEnCours ? "Création en cours" : "Créer mon compte"}
          </Bouton>
        </form>
      </Carte>

      {aVerifier ? (
        <DialogueCode
          ouvert
          email={aVerifier.email}
          userId={aVerifier.userId}
          onVerifie={() => naviguer("/compte", { replace: true })}
        />
      ) : null}

      <p className="mt-4 text-legende text-muted-foreground">
        Déjà inscrit ?{" "}
        <Link to="/connexion" className="lien-souligne">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
