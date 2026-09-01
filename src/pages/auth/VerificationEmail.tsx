import * as React from "react";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { MailCheck, ShieldCheck } from "lucide-react";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { envoyerCode, verifierCode } from "@/lib/donnees/otp";
import { retourInterne } from "@/lib/retour";
import { SaisieCode, LONGUEUR_CODE } from "@/components/ui/saisie-code";
import { LogoAkora } from "@/components/marque/LogoAkora";

/**
 * Confirmation de l'adresse.
 *
 * Le signal lu ici est `profiles.email_verifie` — surtout pas
 * `email_confirmed_at`, que la confirmation automatique de Supabase remplit
 * dès l'inscription et qui ne prouve donc rien. C'est exactement le défaut
 * constaté le 22/08/2026 : cette page affichait « Adresse confirmée » à des
 * comptes qui n'avaient jamais saisi le moindre code.
 *
 * Le code part TOUT SEUL à l'arrivée : demander à quelqu'un de cliquer sur
 * « envoyez-moi un code » alors qu'il vient de s'inscrire, c'est une étape de
 * plus pour rien.
 */
export default function VerificationEmail() {
  const emplacement = useLocation();
  const { session, profil, utilisateur, chargementProfil } = useAuth();
  const [code, setCode] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);
  const [envoye, setEnvoye] = React.useState(false);
  const [secondes, setSecondes] = React.useState(60);
  const demandeFaite = React.useRef(false);

  const email = (emplacement.state as { email?: string } | null)?.email ?? utilisateur?.email ?? "";
  // Où reconduire une fois l'adresse confirmée (inscription arrivée avec
  // `?retour=…`, ex. une fiche réservée). Chemin interne seulement.
  const retour = retourInterne((emplacement.state as { retour?: string } | null)?.retour);
  const verifie = profil?.email_verifie === true;

  const demander = React.useCallback(
    async (silencieux: boolean) => {
      if (!utilisateur || !email) return;
      try {
        await envoyerCode(utilisateur.id, email);
        setEnvoye(true);
        setSecondes(60);
        if (!silencieux) toast.success("Nouveau code envoyé");
      } catch (erreur) {
        // Un plafond atteint n'est pas une panne : le code précédent est
        // souvent encore valable, on laisse donc l'écran de saisie ouvert.
        setEnvoye(true);
        if (!silencieux) toast.error("Envoi impossible", { description: (erreur as Error).message });
      }
    },
    [utilisateur, email],
  );

  React.useEffect(() => {
    // Tant que le profil n'est pas revenu, `verifie` vaut faux par défaut de
    // réponse, pas par constat : envoyer un code ici en brûlerait un à chaque
    // passage d'un compte déjà confirmé.
    if (chargementProfil || verifie || !utilisateur || !email || demandeFaite.current) return;
    demandeFaite.current = true;
    void demander(true);
  }, [chargementProfil, verifie, utilisateur, email, demander]);

  React.useEffect(() => {
    if (!envoye) return;
    const minuteur = window.setInterval(() => setSecondes((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(minuteur);
  }, [envoye]);

  const soumettre = async (valeur: string) => {
    if (valeur.length !== LONGUEUR_CODE || enCours) return;
    setEnCours(true);
    try {
      if (await verifierCode(email, valeur)) {
        toast.success("Adresse confirmée");
        // Rechargement franc : la session et le profil doivent repartir du
        // serveur, pas d'un cache qui dit encore « non vérifié ».
        window.location.replace(retour ?? "/compte");
      } else {
        toast.error("Code incorrect ou expiré", {
          description: "Il vous reste des essais, vérifiez le mail.",
        });
        setCode("");
      }
    } catch (erreur) {
      toast.error("Vérification impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-muted/40 px-5 py-8">
      <Seo titre="Confirmer votre adresse" chemin="/verification-email" indexable={false} />

      <Link to="/" className="mb-7 flex justify-center" aria-label="Akora — accueil">
        <LogoAkora variante="logo" className="h-9 w-auto" />
      </Link>

      <div className="carte mx-auto w-full max-w-md p-5 text-center">
        {verifie ? (
          <>
            <MailCheck size={36} className="mx-auto mb-3 text-success-strong" aria-hidden="true" />
            <h1 className="text-section">Adresse confirmée</h1>
            <p className="mt-1 text-legende text-muted-foreground">
              Votre compte est actif. Vous pouvez commander et payer en ligne.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Link
                to="/materiaux"
                className="cible-44 flex items-center justify-center rounded-md bg-primary px-4 text-[1rem] font-bold text-primary-foreground"
              >
                Voir les matériaux
              </Link>
              <Link
                to="/compte"
                className="cible-44 flex items-center justify-center rounded-md border border-input bg-card px-4 text-courant font-semibold"
              >
                Mon compte
              </Link>
            </div>
          </>
        ) : session ? (
          <>
            <LogoAkora className="mx-auto mb-3 size-9" />
            <h1 className="text-section">Vérifiez votre e-mail</h1>
            <p className="mt-1 text-legende text-muted-foreground">
              Nous avons envoyé un code à six chiffres à{" "}
              <strong className="text-foreground">{email}</strong>. Il expire dans quinze minutes.
            </p>

            <div className="mt-5">
              <SaisieCode
                valeur={code}
                onChange={setCode}
                onComplet={(v) => void soumettre(v)}
                desactive={enCours}
                idPrefixe="code-verif"
              />
            </div>

            <button
              type="button"
              disabled={enCours || code.length < LONGUEUR_CODE}
              onClick={() => void soumettre(code)}
              className="cible-44 mt-4 w-full rounded-md bg-primary px-4 text-[1rem] font-bold text-primary-foreground disabled:opacity-60"
            >
              {enCours ? "Vérification" : "Confirmer mon adresse"}
            </button>

            <p className="mt-3 text-legende text-muted-foreground" aria-live="polite">
              {secondes > 0 ? (
                <>
                  Pas reçu ? Vous pourrez en redemander un dans{" "}
                  <span className="nombres">{secondes}</span> s.
                </>
              ) : (
                <button type="button" onClick={() => void demander(false)} className="lien-souligne">
                  Renvoyer le code
                </button>
              )}
            </p>

            <p className="mt-4 rounded-md bg-muted p-3 text-left text-legende leading-relaxed text-muted-foreground">
              Vous pouvez déjà chercher des matériaux et remplir votre panier. La vérification est
              nécessaire pour <strong className="text-foreground">payer en ligne</strong> et voir
              les numéros des fournisseurs — le séquestre suppose de savoir à qui rendre l'argent en
              cas de litige.
            </p>

            <button
              type="button"
              onClick={() => {
                void supabase.auth.signOut().then(() => window.location.replace("/"));
              }}
              className="mt-3 text-legende text-muted-foreground underline underline-offset-2"
            >
              Mauvaise adresse ? Se déconnecter et recommencer
            </button>

            <p className="mt-4 flex items-center justify-center gap-2 border-t border-border pt-4 text-[0.72rem] text-muted-foreground">
              <ShieldCheck size={14} className="shrink-0" aria-hidden="true" />
              Regardez dans les courriers indésirables. Personne d'Akora ne vous demandera ce code.
            </p>
          </>
        ) : (
          <>
            <LogoAkora className="mx-auto mb-3 size-9" />
            <h1 className="text-section">Confirmez votre adresse</h1>
            <p className="mt-1 text-legende text-muted-foreground">
              Connectez-vous d'abord : le code part vers l'adresse du compte.
            </p>
            <Link
              to="/connexion"
              className="cible-44 mt-5 flex items-center justify-center rounded-md bg-primary px-4 text-[1rem] font-bold text-primary-foreground"
            >
              Se connecter
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
