import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ENV } from "@/lib/env";
import { schemaInscription, type ValeursInscription } from "@/lib/validation";
import { retourInterne } from "@/lib/retour";
import { useAntiAbus } from "@/hooks/useAntiAbus";
import { useGrandEcran } from "@/hooks/useGrandEcran";
import { envoyerCode } from "@/lib/donnees/otp";
import { DialogueCode } from "@/components/auth/DialogueCode";
import { BoutonGoogle, SeparateurOu } from "@/components/auth/BoutonGoogle";
import { PanneauMarque, BandeauMarque, ETAPES } from "@/components/auth/PanneauMarque";
import { VitrineAkora } from "@/components/auth/VitrineAkora";
import { ChampMotDePasse } from "@/components/auth/ChampMotDePasse";
import { ChampTelephone } from "@/components/auth/ChampTelephone";
import { Seo } from "@/components/Seo";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { LogoAkora } from "@/components/marque/LogoAkora";
import { GroupeRadio, OptionRadio } from "@/components/ui/radio-group";
import { LigneCase } from "@/components/ui/checkbox";

/**
 * Inscription acheteur OU fournisseur.
 *
 * Deux mises en page pour un seul formulaire : parcours en deux étapes sur
 * téléphone (le choix d'abord, les champs ensuite, action collante en bas),
 * écran scindé sur ordinateur (panneau latérite à gauche, champs à droite).
 * Une seule arborescence est rendue a la fois — cf. `useGrandEcran`.
 *
 * Le rôle demandé n'est PAS écrit ici dans `user_roles` : le client n'a aucun
 * droit d'écriture sur cette table (règle A3). Il voyage dans les métadonnées
 * du compte, et c'est un trigger `SECURITY DEFINER` côté base qui crée le
 * profil et attribue le rôle. Écrire un rôle depuis le navigateur, ce serait
 * offrir « admin » à qui le demande.
 */
export default function Inscription() {
  const naviguer = useNavigate();
  const [parametres] = useSearchParams();
  const antiAbus = useAntiAbus();
  const grandEcran = useGrandEcran();
  const [etape, setEtape] = React.useState<1 | 2>(1);
  const [envoiEnCours, setEnvoiEnCours] = React.useState(false);
  const [aVerifier, setAVerifier] = React.useState<{ userId: string; email: string } | null>(null);

  /*
   * `?profil=fournisseur` : arrivée depuis « Devenir fournisseur » ou une
   * fiche réservée du bot de prospection — le bon choix est déjà coché, il
   * reste à le confirmer. Ce n'est qu'une pré-sélection d'affichage : le rôle
   * réel reste attribué par le trigger côté base, comme toujours.
   *
   * `?retour=…` : où reconduire une fois l'adresse confirmée. Uniquement un
   * chemin interne (« /… ») — une URL absolue ou « //… » ferait de cette page
   * un tremplin d'hameçonnage (open redirect), cf. retourInterne().
   */
  const profilDemande = parametres.get("profil") === "fournisseur" ? "fournisseur" : "acheteur";
  const retour = retourInterne(parametres.get("retour"));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ValeursInscription>({
    resolver: zodResolver(schemaInscription),
    defaultValues: { profil: profilDemande },
    mode: "onBlur",
  });

  const profil = watch("profil");
  const telephone = watch("telephone") ?? "";
  const motDePasse = watch("motDePasse") ?? "";

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
      toast.error("Inscription impossible", {
        description: error.message.includes("already registered")
          ? "Un compte existe déjà avec cette adresse."
          : error.message,
      });
      return;
    }

    // Le compte existe ; il reste à prouver que l'adresse est bien la sienne.
    const utilisateur = data.user;
    if (!utilisateur) {
      setEnvoiEnCours(false);
      naviguer("/verification-email", { replace: true, state: { email: valeurs.email, retour } });
      return;
    }
    try {
      await envoyerCode(utilisateur.id, valeurs.email);
      setAVerifier({ userId: utilisateur.id, email: valeurs.email });
    } catch (erreur) {
      // Le compte est créé : on ne le perd pas parce que le mail n'est pas
      // parti. La page de vérification en redemandera un.
      toast.error("Code non envoyé", { description: (erreur as Error).message });
      naviguer("/verification-email", { replace: true, state: { email: valeurs.email, retour } });
    } finally {
      setEnvoiEnCours(false);
    }
  };

  /* ── Fragments ──────────────────────────────────────────────────────────
     Ce sont des ÉLÉMENTS et des fonctions de rendu, jamais des composants
     définis dans le corps du rendu : un composant déclaré ici serait recréé à
     chaque frappe, React démonterait l'ancien, et le champ perdrait le focus
     à chaque caractère. */

  const choixProfil = (compact: boolean) => (
    <fieldset className="m-0 border-0 p-0">
      <legend className="pb-2.5 text-legende font-semibold">Je viens pour</legend>
      <GroupeRadio
        className={compact ? "grid-cols-1" : "sm:grid-cols-2"}
        value={profil}
        onValueChange={(v) => setValue("profil", v as ValeursInscription["profil"])}
      >
        <OptionRadio
          id="profil-acheteur"
          valeur="acheteur"
          titre={compact ? "J'achète des matériaux" : "Acheter des matériaux"}
          detail="Particulier, maçon, tâcheron ou entreprise de BTP."
        />
        <OptionRadio
          id="profil-fournisseur"
          valeur="fournisseur"
          titre={compact ? "Je vends des matériaux" : "Vendre des matériaux"}
          detail="Dépôt, briqueterie, carrière, scierie, cimenterie."
        />
      </GroupeRadio>
    </fieldset>
  );

  const champNom = (
    <Champ etiquette="Nom et prénom" erreur={errors.nomComplet?.message} obligatoire>
      {(attributs) => (
        <Saisie {...attributs} {...register("nomComplet")} autoComplete="name" placeholder="Rakoto Jean" />
      )}
    </Champ>
  );

  const champRaisonSociale =
    profil === "fournisseur" ? (
      <Champ
        etiquette="Raison sociale"
        aide="Le nom de votre entreprise, tel qu'il figure sur votre carte fiscale."
        erreur={errors.raisonSociale?.message}
        obligatoire
      >
        {(attributs) => (
          <Saisie {...attributs} {...register("raisonSociale")} autoComplete="organization" />
        )}
      </Champ>
    ) : null;

  const champEmail = (
    <Champ
      etiquette="Adresse e-mail"
      aide="Pour vos reçus et la récupération de votre mot de passe."
      erreur={errors.email?.message}
      obligatoire
    >
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
  );

  const champTelephone = (
    <ChampTelephone valeur={telephone} erreur={errors.telephone?.message} enregistrement={register("telephone")} />
  );

  const champMotDePasse = (
    <ChampMotDePasse valeur={motDePasse} erreur={errors.motDePasse?.message} enregistrement={register("motDePasse")} />
  );

  const champConditions = (
    <div>
      <LigneCase
        id="conditions"
        etiquette={
          <>
            J'accepte les{" "}
            <Link to="/conditions-utilisation" className="lien-souligne">
              conditions d'utilisation
            </Link>{" "}
            et la{" "}
            <Link to="/politique-confidentialite" className="lien-souligne">
              politique de confidentialité
            </Link>
            , dont les règles de séquestre et de litige.
          </>
        }
        onCheckedChange={(coche) => setValue("conditions", coche === true, { shouldValidate: true })}
      />
      {errors.conditions?.message ? (
        <p role="alert" className="text-[0.78rem] text-destructive-strong">
          {errors.conditions.message}
        </p>
      ) : null}
    </div>
  );

  const dialogue = aVerifier ? (
    <DialogueCode
      ouvert
      email={aVerifier.email}
      userId={aVerifier.userId}
      onVerifie={() => naviguer(retour ?? "/compte", { replace: true })}
      onAbandon={() => {
        void supabase.auth.signOut().then(() => naviguer("/", { replace: true }));
      }}
    />
  ) : null;

  const leurre = <input type="text" {...antiAbus.proprietesLeurre} readOnly={false} />;

  /* ── Écran scindé, à partir de 1024 px ─────────────────────────────────── */

  if (grandEcran) {
    return (
      <form onSubmit={handleSubmit(soumettre)} noValidate className="relative">
        <Seo titre="Créer un compte" chemin="/inscription" indexable={false} />
        {leurre}

        <div className="flex min-h-[100dvh] items-center justify-center bg-muted/40 p-8">
          <div className="carte grid w-full max-w-[1280px] grid-cols-[460px_minmax(0,1fr)] overflow-hidden p-0">
            <PanneauMarque
              titre="Le prix rendu chantier, pas le prix au dépôt."
              intro="Un compte vous donne les numéros des fournisseurs vérifiés, le paiement Mvola, Orange Money et Airtel Money, et le suivi de vos livraisons."
            />

            <div className="min-w-0 bg-card px-12 pb-9 pt-8">
              <p className="mb-6 text-right text-courant text-muted-foreground">
                Déjà inscrit ?{" "}
                <Link to="/connexion" className="lien-souligne font-semibold">
                  Se connecter
                </Link>
              </p>

              <h1 className="mb-1.5 text-[1.6875rem] font-bold tracking-tight">Créer un compte</h1>
              <p className="mb-6 text-courant text-muted-foreground">
                Gratuit, deux minutes. Vous pourrez commander tout de suite.
              </p>

              <div className="mb-5 space-y-3">
                <BoutonGoogle retour={retour ?? "/compte"} intitule="S'inscrire avec Google" />
                <SeparateurOu />
              </div>

              <div className="mb-5">{choixProfil(false)}</div>

              <div className="grid grid-cols-2 gap-x-[18px] gap-y-4">
                {champNom}
                {champTelephone}
                {champRaisonSociale ? <div className="col-span-2">{champRaisonSociale}</div> : null}
                <div className="col-span-2">{champEmail}</div>
                <div className="col-span-2">{champMotDePasse}</div>
              </div>

              <div className="my-5">{champConditions}</div>

              <button
                type="submit"
                disabled={envoiEnCours}
                className="cible-44 w-full rounded-md bg-primary px-4 text-[1rem] font-bold text-primary-foreground transition-colors hover:bg-primary-strong disabled:opacity-60"
              >
                {envoiEnCours ? "Création en cours" : "Créer mon compte"}
              </button>

              <p className="mt-5 flex items-center gap-2.5 border-t border-border pt-5 text-legende text-muted-foreground">
                <ShieldCheck size={16} className="shrink-0 text-success-strong" aria-hidden="true" />
                Nous ne demandons jamais votre code secret mobile money, ni de numéro de carte
                bancaire.
              </p>
            </div>
          </div>
        </div>
        {dialogue}
      </form>
    );
  }

  /* ── Parcours mobile, en deux étapes ───────────────────────────────────── */

  return (
    <form onSubmit={handleSubmit(soumettre)} noValidate className="relative">
      <Seo titre="Créer un compte" chemin="/inscription" indexable={false} />
      {leurre}

      {etape === 1 ? (
        <div className="flex min-h-[100dvh] flex-col bg-background">
          <BandeauMarque
            surtitre="ÉTAPE 1 SUR 2"
            titre="Vous venez acheter ou vendre ?"
            intro="On adapte la suite : adresses de chantier pour acheter, dossier de vérification pour vendre."
          />

          <div className="flex-1 space-y-3 px-5 py-5">
            {/* ⭐ LA VITRINE (03/09/2026) : trois promesses qu'on fait glisser
                du pouce, chacune avec son geste — le camion, le badge,
                l'anneau du séquestre. Avant le bouton Google : on dit ce
                qu'un compte apporte avant de demander d'en créer un. */}
            <VitrineAkora etapes={ETAPES} className="mb-1" />
            <BoutonGoogle retour={retour ?? "/compte"} intitule="S'inscrire avec Google" />
            <SeparateurOu />
            {choixProfil(true)}
            <p className="rounded-md bg-muted px-3.5 py-3 text-legende leading-relaxed text-muted-foreground">
              Vous pourrez faire les deux plus tard avec le même compte.
            </p>
          </div>

          <div className="sticky bottom-0 border-t border-border bg-background px-5 pb-4 pt-3">
            <button
              type="button"
              onClick={() => setEtape(2)}
              className="min-h-[52px] w-full rounded-md bg-primary text-[1.03125rem] font-bold text-primary-foreground"
            >
              Continuer
            </button>
            <p className="mt-2.5 text-center text-courant text-muted-foreground">
              Déjà inscrit ?{" "}
              <Link to="/connexion" className="lien-souligne font-semibold">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[100dvh] flex-col bg-background">
          <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
            <button
              type="button"
              onClick={() => setEtape(1)}
              aria-label="Revenir à l'étape précédente"
              className="flex size-10 items-center justify-center rounded-md border border-border"
            >
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            <div className="flex-1">
              <p className="text-produit">Vos informations</p>
              <p className="text-legende text-muted-foreground">
                Étape 2 sur 2 · {profil === "acheteur" ? "achat" : "vente"}
              </p>
            </div>
            <LogoAkora className="size-7" />
          </header>
          <div className="h-1 bg-border">
            <div className="h-full w-[62%] bg-primary" />
          </div>

          <div className="flex-1 space-y-4 px-4 py-5">
            {champNom}
            {champRaisonSociale}
            {champTelephone}
            {champEmail}
            {champMotDePasse}
            {champConditions}
          </div>

          <div className="sticky bottom-0 border-t border-border bg-background px-4 pb-4 pt-3">
            <button
              type="submit"
              disabled={envoiEnCours}
              className="min-h-[52px] w-full rounded-md bg-primary text-[1.03125rem] font-bold text-primary-foreground disabled:opacity-60"
            >
              {envoiEnCours ? "Création en cours" : "Créer mon compte"}
            </button>
            <p className="mt-2 text-center text-legende text-muted-foreground">
              Aucune carte bancaire n'est demandée.
            </p>
          </div>
        </div>
      )}
      {dialogue}
    </form>
  );
}
