import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import {
  schemaMotDePasseOublie,
  schemaReinitialisation,
  type ValeursMotDePasseOublie,
  type ValeursReinitialisation,
} from "@/lib/validation";
import { demanderCodeMotDePasse, reinitialiserMotDePasse } from "@/lib/donnees/otp";
import { ChampMotDePasse } from "@/components/auth/ChampMotDePasse";
import { SaisieCode, LONGUEUR_CODE } from "@/components/ui/saisie-code";
import { Seo } from "@/components/Seo";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { LogoAkora } from "@/components/marque/LogoAkora";

/**
 * Mot de passe oublié, en deux temps : on demande un code, on l'échange
 * contre un nouveau mot de passe.
 *
 * Le lien natif de Supabase a été abandonné pour la même raison qu'à
 * l'inscription : il part d'un domaine inconnu du destinataire et finit en
 * indésirables. Un code à six chiffres, lui, se recopie.
 *
 * Le premier écran répond exactement pareil que l'adresse soit inscrite ou
 * non — jusqu'au délai d'attente d'une minute. Sans cela, ce formulaire
 * deviendrait un annuaire des comptes existants.
 */
const DELAI_RENVOI_S = 60;

export default function MotDePasseOublie() {
  const naviguer = useNavigate();
  const [email, setEmail] = React.useState("");
  const [etape, setEtape] = React.useState<"adresse" | "code" | "fini">("adresse");
  const [enCours, setEnCours] = React.useState(false);
  const [secondes, setSecondes] = React.useState(DELAI_RENVOI_S);

  const formulaireAdresse = useForm<ValeursMotDePasseOublie>({
    resolver: zodResolver(schemaMotDePasseOublie),
  });
  const formulaireCode = useForm<ValeursReinitialisation>({
    resolver: zodResolver(schemaReinitialisation),
    defaultValues: { code: "", motDePasse: "" },
  });

  React.useEffect(() => {
    if (etape !== "code") return;
    setSecondes(DELAI_RENVOI_S);
    const minuteur = window.setInterval(() => setSecondes((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(minuteur);
  }, [etape]);

  const demander = async (valeurs: ValeursMotDePasseOublie) => {
    setEnCours(true);
    try {
      await demanderCodeMotDePasse(valeurs.email);
      setEmail(valeurs.email);
      setEtape("code");
    } catch (erreur) {
      toast.error("Envoi impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  const renvoyer = async () => {
    try {
      await demanderCodeMotDePasse(email);
      setSecondes(DELAI_RENVOI_S);
      toast.success("Nouveau code envoyé");
    } catch (erreur) {
      toast.error("Envoi impossible", { description: (erreur as Error).message });
    }
  };

  const reinitialiser = async (valeurs: ValeursReinitialisation) => {
    setEnCours(true);
    try {
      await reinitialiserMotDePasse(email, valeurs.code, valeurs.motDePasse);
      setEtape("fini");
    } catch (erreur) {
      toast.error("Réinitialisation impossible", { description: (erreur as Error).message });
      formulaireCode.setValue("code", "");
    } finally {
      setEnCours(false);
    }
  };

  const code = formulaireCode.watch("code");
  const motDePasse = formulaireCode.watch("motDePasse");

  return (
    <div className="flex min-h-[100dvh] flex-col bg-muted/40 px-5 py-8">
      <Seo titre="Mot de passe oublié" chemin="/mot-de-passe-oublie" indexable={false} />

      <Link to="/" className="mb-7 flex justify-center" aria-label="Akora — accueil">
        <LogoAkora variante="logo" className="h-9 w-auto" />
      </Link>

      <div className="carte mx-auto w-full max-w-md p-5">
        {etape === "adresse" ? (
          <>
            <h1 className="text-section">Mot de passe oublié</h1>
            <p className="mb-5 mt-1 text-legende text-muted-foreground">
              Indiquez votre adresse : nous vous envoyons un code à six chiffres.
            </p>
            <form onSubmit={formulaireAdresse.handleSubmit(demander)} className="space-y-4" noValidate>
              <Champ
                etiquette="Adresse e-mail"
                erreur={formulaireAdresse.formState.errors.email?.message}
                obligatoire
              >
                {(attributs) => (
                  <Saisie
                    {...attributs}
                    {...formulaireAdresse.register("email")}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="vous@exemple.mg"
                  />
                )}
              </Champ>
              <button
                type="submit"
                disabled={enCours}
                className="cible-44 w-full rounded-md bg-primary px-4 text-[1rem] font-bold text-primary-foreground transition-colors hover:bg-primary-strong disabled:opacity-60"
              >
                {enCours ? "Envoi en cours" : "Recevoir mon code"}
              </button>
            </form>
          </>
        ) : null}

        {etape === "code" ? (
          <>
            <h1 className="text-section">Choisissez un nouveau mot de passe</h1>
            <p className="mb-5 mt-1 text-legende text-muted-foreground">
              Si un compte existe avec <strong className="text-foreground">{email}</strong>, un code
              à six chiffres vient d'y partir. Il est valable quinze minutes.
            </p>

            <form onSubmit={formulaireCode.handleSubmit(reinitialiser)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <p className="text-legende font-semibold">Code reçu par e-mail</p>
                <SaisieCode
                  valeur={code}
                  onChange={(v) => formulaireCode.setValue("code", v, { shouldValidate: v.length === LONGUEUR_CODE })}
                  desactive={enCours}
                  idPrefixe="code-mdp"
                />
                {formulaireCode.formState.errors.code?.message ? (
                  <p role="alert" className="text-center text-[0.78rem] text-destructive-strong">
                    {formulaireCode.formState.errors.code.message}
                  </p>
                ) : null}
              </div>

              <ChampMotDePasse
                etiquette="Nouveau mot de passe"
                valeur={motDePasse}
                erreur={formulaireCode.formState.errors.motDePasse?.message}
                enregistrement={formulaireCode.register("motDePasse")}
              />

              <button
                type="submit"
                disabled={enCours}
                className="cible-44 w-full rounded-md bg-primary px-4 text-[1rem] font-bold text-primary-foreground transition-colors hover:bg-primary-strong disabled:opacity-60"
              >
                {enCours ? "Enregistrement" : "Changer mon mot de passe"}
              </button>
            </form>

            <p className="mt-4 text-center text-legende text-muted-foreground" aria-live="polite">
              {secondes > 0 ? (
                <>
                  Pas reçu ? Vous pourrez en redemander un dans{" "}
                  <span className="nombres">{secondes}</span> s.
                </>
              ) : (
                <button type="button" onClick={() => void renvoyer()} className="lien-souligne">
                  Renvoyer le code
                </button>
              )}
            </p>
            <p className="mt-2 text-center text-[0.72rem] text-muted-foreground">
              Regardez aussi dans les courriers indésirables.
            </p>
          </>
        ) : null}

        {etape === "fini" ? (
          <div className="text-center">
            <MailCheck size={36} className="mx-auto mb-3 text-success-strong" aria-hidden="true" />
            <h1 className="text-section">Mot de passe changé</h1>
            <p className="mb-5 mt-1 text-legende text-muted-foreground">
              Vos sessions ouvertes ailleurs ont été fermées. Connectez-vous avec votre nouveau mot
              de passe.
            </p>
            <button
              type="button"
              onClick={() => naviguer("/connexion", { replace: true })}
              className="cible-44 w-full rounded-md bg-primary px-4 text-[1rem] font-bold text-primary-foreground transition-colors hover:bg-primary-strong"
            >
              Se connecter
            </button>
          </div>
        ) : null}
      </div>

      {etape !== "fini" ? (
        <p className="mt-4 text-center text-courant">
          <Link to="/connexion" className="lien-souligne">
            Revenir à la connexion
          </Link>
        </p>
      ) : null}
    </div>
  );
}
