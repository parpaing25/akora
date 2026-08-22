import * as React from "react";
import { toast } from "sonner";
import { connexionGoogle, googleDisponible } from "@/lib/oauth";

/**
 * « Continuer avec Google ».
 *
 * Ne s'affiche QUE si le fournisseur est actif côté Supabase : tant que les
 * identifiants Google ne sont pas renseignés, ce bouton n'existe pas plutôt
 * que de mener à une page d'erreur.
 *
 * Le logo est le « G » officiel, en SVG et en quatre couleurs : les règles de
 * marque de Google interdisent de le redessiner ou de le recolorer. C'est la
 * seule marque étrangère du produit, et la seule couleur qui ne vienne pas des
 * tokens — pour cette raison précise.
 */
export function BoutonGoogle({
  retour = "/compte",
  intitule = "Continuer avec Google",
}: {
  retour?: string;
  intitule?: string;
}) {
  const [disponible, setDisponible] = React.useState(false);
  const [enCours, setEnCours] = React.useState(false);

  React.useEffect(() => {
    let vivant = true;
    void googleDisponible().then((ok) => {
      if (vivant) setDisponible(ok);
    });
    return () => {
      vivant = false;
    };
  }, []);

  if (!disponible) return null;

  const partir = async () => {
    setEnCours(true);
    try {
      await connexionGoogle(retour);
    } catch (erreur) {
      setEnCours(false);
      toast.error("Connexion Google impossible", { description: (erreur as Error).message });
    }
  };

  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => void partir()}
      className="cible-44 flex w-full items-center justify-center gap-2.5 rounded-md border border-input bg-card px-4 text-courant font-semibold transition-colors hover:bg-muted disabled:opacity-60"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
        />
      </svg>
      {enCours ? "Redirection…" : intitule}
    </button>
  );
}

/** Séparateur « ou », affiché seulement quand Google l'est aussi. */
export function SeparateurOu() {
  const [disponible, setDisponible] = React.useState(false);
  React.useEffect(() => {
    let vivant = true;
    void googleDisponible().then((ok) => {
      if (vivant) setDisponible(ok);
    });
    return () => {
      vivant = false;
    };
  }, []);
  if (!disponible) return null;

  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <span className="text-legende text-muted-foreground">ou</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
