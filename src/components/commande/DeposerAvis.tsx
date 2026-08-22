import * as React from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { deposerAvis } from "@/lib/donnees/avis";
import { cn } from "@/lib/utils";
import { Carte } from "@/components/ui/card";
import { ZoneTexte } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";

/**
 * Dépôt d'avis. Possible UNIQUEMENT sur une commande clôturée (spec B12) :
 * la politique RLS le vérifie, ce composant ne s'affiche que dans ce cas.
 * L'avis passe en modération avant publication.
 */
export function DeposerAvis({
  commandeId,
  fournisseurId,
  onDepose,
}: {
  commandeId: string;
  fournisseurId: string;
  onDepose: () => void;
}) {
  const [note, setNote] = React.useState(0);
  const [commentaire, setCommentaire] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);
  const [envoye, setEnvoye] = React.useState(false);

  const envoyer = async () => {
    if (note < 1) {
      toast.error("Choisissez une note.");
      return;
    }
    setEnCours(true);
    try {
      await deposerAvis({
        fournisseur_id: fournisseurId,
        commande_id: commandeId,
        note,
        commentaire: commentaire.trim() || null,
      });
      setEnvoye(true);
      onDepose();
    } catch (erreur) {
      toast.error("Avis refusé", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  if (envoye) {
    return (
      <Carte className="mt-4 p-4 print:hidden">
        <p className="text-[0.9375rem] font-semibold text-success-strong">Merci pour votre avis.</p>
        <p className="mt-1 text-legende text-muted-foreground">
          Il passe en modération avant d'apparaître sur la fiche du fournisseur.
        </p>
      </Carte>
    );
  }

  return (
    <Carte className="mt-4 p-4 print:hidden">
      <h2 className="text-produit">Votre avis sur ce fournisseur</h2>
      <p className="mt-0.5 text-legende text-muted-foreground">
        Vous seul pouvez en laisser un sur cette commande : c'est ce qui rend les avis d'Akora
        crédibles.
      </p>

      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Note sur cinq">
        {[1, 2, 3, 4, 5].map((valeur) => (
          <button
            key={valeur}
            type="button"
            role="radio"
            aria-checked={note === valeur}
            aria-label={valeur + " sur 5"}
            onClick={() => setNote(valeur)}
            className="inline-flex cible-44 items-center justify-center rounded-md hover:bg-muted"
          >
            <Star
              aria-hidden="true"
              className={cn("size-6", valeur <= note ? "fill-accent text-accent" : "text-border")}
            />
          </button>
        ))}
      </div>

      <div className="mt-3">
        <label htmlFor="commentaire-avis" className="text-legende font-semibold">
          Commentaire
        </label>
        <ZoneTexte
          id="commentaire-avis"
          className="mt-1.5"
          rows={3}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Délai tenu ? Marchandise conforme ? Livreur correct ?"
        />
      </div>

      <Bouton className="mt-3" disabled={enCours || note < 1} onClick={() => void envoyer()}>
        {enCours ? "Envoi" : "Publier mon avis"}
      </Bouton>
    </Carte>
  );
}
