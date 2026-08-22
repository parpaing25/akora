import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Rappel discret tant que l'adresse n'est pas confirmée.
 *
 * On ne bloque pas la navigation pour autant : quelqu'un peut vouloir
 * comparer des prix avant de confirmer quoi que ce soit. Le verrou est au bon
 * endroit — le paiement en ligne, refusé côté serveur.
 */
export function BandeauVerification() {
  const { session, profil } = useAuth();
  if (!session || !profil || profil.email_verifie) return null;

  return (
    <div className="border-b border-accent/40 bg-accent-soft">
      <p className="container flex flex-wrap items-center justify-between gap-2 py-1.5 text-legende text-accent-strong">
        <span>Votre adresse e-mail n'est pas encore confirmée : le paiement en ligne reste fermé.</span>
        <Link to="/verification-email" className="shrink-0 font-semibold underline underline-offset-2">
          Recevoir mon code
        </Link>
      </p>
    </div>
  );
}
