import * as React from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { activerPush, desactiverPush, pushDisponible } from "@/lib/push";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";

/**
 * Activer les notifications sur CE navigateur.
 *
 * Un abonnement push appartient a un navigateur, pas a un compte : le meme
 * utilisateur doit l'accorder sur son telephone et sur son ordinateur. D'ou
 * « sur cet appareil », et non « mes notifications ».
 *
 * La carte disparait si le navigateur ne sait pas faire, ou si la cle publique
 * VAPID n'est pas dans le bundle. On ne propose pas ce qui ne marchera pas —
 * et on ne demande la permission qu'une fois : un refus est definitif dans la
 * plupart des navigateurs, c'est le seul consentement qu'on ne rattrape pas.
 */
export function ReglagePush() {
  const [etat, setEtat] = React.useState<"inconnu" | "actif" | "inactif" | "refuse">("inconnu");
  const [enCours, setEnCours] = React.useState(false);

  React.useEffect(() => {
    if (!pushDisponible()) return;
    if (Notification.permission === "denied") {
      setEtat("refuse");
      return;
    }
    void navigator.serviceWorker.ready
      .then((enregistrement) => enregistrement.pushManager.getSubscription())
      .then((abonnement) => setEtat(abonnement ? "actif" : "inactif"))
      .catch(() => setEtat("inactif"));
  }, []);

  if (!pushDisponible() || etat === "inconnu") return null;

  const activer = async () => {
    setEnCours(true);
    try {
      if (await activerPush()) {
        setEtat("actif");
        toast.success("Notifications activées sur cet appareil");
      } else {
        setEtat(Notification.permission === "denied" ? "refuse" : "inactif");
        toast.error("Activation refusée", {
          description: "Autorisez les notifications dans les réglages du navigateur.",
        });
      }
    } catch (erreur) {
      toast.error("Activation impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  const desactiver = async () => {
    setEnCours(true);
    try {
      await desactiverPush();
      setEtat("inactif");
      toast.success("Notifications désactivées sur cet appareil");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Carte className="mt-4 p-4">
      <p className="flex items-center gap-2 text-produit">
        <BellRing size={17} aria-hidden="true" />
        Notifications sur cet appareil
      </p>
      <p className="mt-1 text-legende text-muted-foreground">
        Être prévenu quand un dépôt que vous suivez annonce du stock ou baisse un prix, et quand
        une commande avance. Un abonnement vaut pour ce navigateur seulement.
      </p>

      {etat === "refuse" ? (
        <p className="mt-3 rounded-md bg-muted p-3 text-legende text-muted-foreground">
          Votre navigateur a bloqué les notifications pour ce site. Il faut les réautoriser dans
          ses réglages — nous ne pouvons plus le demander depuis la page.
        </p>
      ) : etat === "actif" ? (
        <Bouton
          variante="secondaire"
          className="mt-3"
          disabled={enCours}
          onClick={() => void desactiver()}
        >
          {enCours ? "…" : "Désactiver"}
        </Bouton>
      ) : (
        <Bouton className="mt-3" disabled={enCours} onClick={() => void activer()}>
          {enCours ? "…" : "Activer les notifications"}
        </Bouton>
      )}
    </Carte>
  );
}
