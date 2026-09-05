import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { confirmerEmailOAuth } from "@/lib/oauth";
import { retourInterne } from "@/lib/retour";
import { Seo } from "@/components/Seo";
import { LogoAkora } from "@/components/marque/LogoAkora";
import { Squelette } from "@/components/ui/skeleton";

/**
 * Retour de Google.
 *
 * Le client Supabase lit lui-même le jeton dans l'URL (`detectSessionInUrl`) ;
 * cette page ne fait qu'attendre que la session apparaisse, enregistrer que
 * l'adresse est déjà vérifiée par Google, puis conduire où l'on voulait aller.
 *
 * La destination voyage dans l'URL et non en mémoire : l'aller-retour passe
 * par un autre domaine, et rien de ce qui était en mémoire n'y survit.
 */
export default function RetourOAuth() {
  const [parametres] = useSearchParams();
  const naviguer = useNavigate();
  const { session, chargement } = useAuth();
  const traite = React.useRef(false);

  const vers = parametres.get("vers") ?? "/compte";
  const erreur = parametres.get("error_description") ?? parametres.get("error");

  React.useEffect(() => {
    if (erreur) {
      toast.error("Connexion Google interrompue", { description: erreur });
      naviguer("/connexion", { replace: true });
      return;
    }
    if (chargement || traite.current) return;

    if (session) {
      traite.current = true;
      void confirmerEmailOAuth()
        .catch(() => {
          // Ce n'est qu'un raccourci de confort : si l'enregistrement échoue,
          // la page de vérification prendra le relais avec un code.
        })
        .finally(() => {
          // Rechargement franc plutôt que navigation : le profil doit être
          // relu côté serveur, vérification comprise. `retourInterne` refuse
          // aussi « //… » : startsWith("/") seul laissait passer une URL
          // protocol-relative vers un autre domaine (open redirect).
          window.location.replace(retourInterne(vers) ?? "/compte");
        });
      return;
    }

    // Session absente une fois le chargement fini : le jeton n'est pas passé.
    const minuteur = window.setTimeout(() => {
      if (!traite.current) {
        toast.error("Connexion Google impossible", { description: "Réessayez, ou par mot de passe." });
        naviguer("/connexion", { replace: true });
      }
    }, 4000);
    return () => window.clearTimeout(minuteur);
  }, [session, chargement, erreur, naviguer, vers]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-muted/40 px-5">
      <Seo titre="Connexion en cours" chemin="/auth/retour" indexable={false} />
      <LogoAkora variante="logo" className="h-9 w-auto" />
      <p className="text-courant text-muted-foreground" aria-live="polite">
        Connexion en cours…
      </p>
      <div className="w-full max-w-xs space-y-2" aria-busy="true">
        <Squelette className="h-3 w-full" />
        <Squelette className="h-3 w-2/3" />
      </div>
    </div>
  );
}
