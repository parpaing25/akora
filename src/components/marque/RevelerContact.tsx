import * as React from "react";
import { Link } from "react-router-dom";
import { Phone, MessageCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { revelerContact } from "@/lib/donnees/vitrine";
import { formaterTelephone } from "@/lib/format";
import { Bouton } from "@/components/ui/button";

/**
 * Affiche le téléphone d'un fournisseur — mais seulement sur demande, et
 * seulement à un compte connecté.
 *
 * Ce n'est pas une friction gratuite : sans elle, le fichier fournisseurs
 * entier s'aspire en une requête. Chaque révélation écrit une ligne dans
 * `audit_log`, et un plafond horaire s'applique côté serveur.
 */
export function RevelerContact({ fournisseurId }: { fournisseurId: string }) {
  const { session } = useAuth();
  const [contact, setContact] = React.useState<{ telephone: string | null; whatsapp: string | null } | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  if (!session) {
    return (
      <div className="rounded-md bg-muted p-3">
        <p className="text-legende text-muted-foreground">
          Le numéro du fournisseur est réservé aux comptes connectés.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Bouton asChild taille="compact">
            <Link to="/connexion">Se connecter</Link>
          </Bouton>
          <Bouton asChild variante="secondaire" taille="compact">
            <Link to="/inscription">Créer un compte</Link>
          </Bouton>
        </div>
      </div>
    );
  }

  if (contact) {
    return (
      <div className="flex flex-wrap gap-2">
        {contact.telephone ? (
          <Bouton asChild taille="compact">
            <a href={`tel:${contact.telephone}`}>
              <Phone className="size-4" aria-hidden="true" />
              <span className="nombres">{formaterTelephone(contact.telephone)}</span>
            </a>
          </Bouton>
        ) : null}
        {contact.whatsapp ? (
          <Bouton asChild variante="secondaire" taille="compact">
            <a
              href={`https://wa.me/${contact.whatsapp.replace("+", "")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp
            </a>
          </Bouton>
        ) : null}
        {!contact.telephone && !contact.whatsapp ? (
          <p className="text-legende text-muted-foreground">Ce fournisseur n'a pas renseigné de numéro.</p>
        ) : null}
      </div>
    );
  }

  return (
    <Bouton
      variante="secondaire"
      taille="compact"
      disabled={enCours}
      onClick={async () => {
        setEnCours(true);
        try {
          setContact(await revelerContact(fournisseurId));
        } catch (erreur) {
          toast.error("Numéro indisponible", { description: (erreur as Error).message });
        } finally {
          setEnCours(false);
        }
      }}
    >
      <Eye className="size-4" aria-hidden="true" />
      {enCours ? "Affichage" : "Afficher le numéro"}
    </Bouton>
  );
}
