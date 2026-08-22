import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { schemaConnexion, type ValeursConnexion } from "@/lib/validation";
import { useGrandEcran } from "@/hooks/useGrandEcran";
import { BoutonGoogle, SeparateurOu } from "@/components/auth/BoutonGoogle";
import { PanneauMarque } from "@/components/auth/PanneauMarque";
import { Seo } from "@/components/Seo";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { LogoAkora } from "@/components/marque/LogoAkora";

/**
 * Connexion. Même habillage que l'inscription : écran scindé au-delà de
 * 1024 px, carte centrée en dessous. Les deux portes d'entrée se ressemblent,
 * sinon passer de l'une à l'autre donne l'impression de changer de site.
 */
export default function Connexion() {
  const naviguer = useNavigate();
  const emplacement = useLocation();
  const retour = (emplacement.state as { retour?: string } | null)?.retour ?? "/compte";
  const [envoiEnCours, setEnvoiEnCours] = React.useState(false);
  const grandEcran = useGrandEcran();

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

  const formulaire = (
    <form onSubmit={handleSubmit(soumettre)} className="space-y-4" noValidate>
      <Champ etiquette="Adresse e-mail" erreur={errors.email?.message} obligatoire>
        {(attributs) => (
          <Saisie
            {...attributs}
            {...register("email")}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="vous@exemple.mg"
          />
        )}
      </Champ>

      <Champ etiquette="Mot de passe" erreur={errors.motDePasse?.message} obligatoire>
        {(attributs) => (
          <Saisie {...attributs} {...register("motDePasse")} type="password" autoComplete="current-password" />
        )}
      </Champ>

      <button
        type="submit"
        disabled={envoiEnCours}
        className="cible-44 w-full rounded-md bg-primary px-4 text-[1rem] font-bold text-primary-foreground transition-colors hover:bg-primary-strong disabled:opacity-60"
      >
        {envoiEnCours ? "Connexion en cours" : "Se connecter"}
      </button>
    </form>
  );

  const liens = (
    <div className="mt-4 flex flex-col gap-1 text-courant">
      <Link to="/mot-de-passe-oublie" className="lien-souligne">
        Mot de passe oublié
      </Link>
      <span className="text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link to="/inscription" className="lien-souligne font-semibold">
          Créer un compte
        </Link>
      </span>
    </div>
  );

  if (grandEcran) {
    return (
      <>
        <Seo titre="Se connecter" chemin="/connexion" indexable={false} />
        <div className="flex min-h-[100dvh] items-center justify-center bg-muted/40 p-8">
          <div className="carte grid w-full max-w-[1080px] grid-cols-[420px_minmax(0,1fr)] overflow-hidden p-0">
            <PanneauMarque
              titre="Bon retour parmi nous."
              intro="Retrouvez vos comparaisons, vos commandes en cours et les numéros des fournisseurs vérifiés."
            />
            <div className="min-w-0 bg-card px-12 pb-9 pt-8">
              <p className="mb-6 text-right text-courant text-muted-foreground">
                Pas de compte ?{" "}
                <Link to="/inscription" className="lien-souligne font-semibold">
                  Créer un compte
                </Link>
              </p>
              <h1 className="mb-1.5 text-[1.6875rem] font-bold tracking-tight">Se connecter</h1>
              <p className="mb-6 text-courant text-muted-foreground">
                Un compte est nécessaire pour payer en ligne et suivre vos commandes.
              </p>

              <div className="mb-5 space-y-3">
                <BoutonGoogle retour={retour} intitule="Continuer avec Google" />
                <SeparateurOu />
              </div>

              {formulaire}
              {liens}

              <p className="mt-5 flex items-center gap-2.5 border-t border-border pt-5 text-legende text-muted-foreground">
                <ShieldCheck size={16} className="shrink-0 text-success-strong" aria-hidden="true" />
                Nous ne demandons jamais votre code secret mobile money.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-muted/40 px-5 py-8">
      <Seo titre="Se connecter" chemin="/connexion" indexable={false} />
      <Link to="/" className="mb-7 flex justify-center" aria-label="Akora — accueil">
        <LogoAkora variante="logo" className="h-9 w-auto" />
      </Link>

      <div className="carte mx-auto w-full max-w-md p-5">
        <h1 className="text-section">Se connecter</h1>
        <p className="mb-5 mt-1 text-legende text-muted-foreground">
          Un compte est nécessaire pour payer en ligne et suivre vos commandes.
        </p>

        <div className="mb-5 space-y-3">
          <BoutonGoogle retour={retour} intitule="Continuer avec Google" />
          <SeparateurOu />
        </div>

        {formulaire}
        {liens}
      </div>
    </div>
  );
}
