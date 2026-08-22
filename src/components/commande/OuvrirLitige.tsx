import * as React from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { envoyerPhotos } from "@/lib/photos";
import {
  Dialogue,
  DialogueContenu,
  DialogueDeclencheur,
  DialogueDescription,
  DialogueTitre,
} from "@/components/ui/dialog";
import { Champ } from "@/components/ui/champ";
import { Saisie, ZoneTexte } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";

/**
 * Ouverture d'un litige (spec B10).
 *
 * Tant qu'un litige est ouvert, l'argent RESTE bloqué : la libération
 * automatique à 72 heures est suspendue. C'est écrit dans le dialogue, parce
 * que c'est la seule information qui compte à ce moment-là.
 */
export function OuvrirLitige({ commandeId, onOuvert }: { commandeId: string; onOuvert: () => void }) {
  const [ouvert, setOuvert] = React.useState(false);
  const [motif, setMotif] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [enCours, setEnCours] = React.useState(false);
  const champFichier = React.useRef<HTMLInputElement>(null);

  const ajouterPhotos = async (fichiers: File[]) => {
    try {
      const urls = await envoyerPhotos(fichiers.slice(0, 8 - photos.length), "produits");
      setPhotos([...photos, ...urls]);
    } catch (erreur) {
      toast.error("Envoi impossible", { description: (erreur as Error).message });
    }
  };

  const envoyer = async () => {
    if (motif.trim().length < 5) {
      toast.error("Décrivez le problème en quelques mots.");
      return;
    }
    setEnCours(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await supabase
        .from("litiges")
        .insert({
          commande_id: commandeId,
          ouvert_par: session.session?.user.id as string,
          motif: motif.trim(),
          description: description.trim() || null,
          photos,
        })
        .select("id");
      if (error) throw error;
      setOuvert(false);
      onOuvert();
      toast.success("Litige ouvert", {
        description: "L'argent reste bloqué chez Akora le temps de l'arbitrage.",
      });
    } catch (erreur) {
      toast.error("Ouverture impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DialogueDeclencheur asChild>
        <Bouton variante="fantome" className="text-destructive-strong">
          Signaler un problème
        </Bouton>
      </DialogueDeclencheur>
      <DialogueContenu className="max-h-[88svh] overflow-y-auto">
        <DialogueTitre>Signaler un problème</DialogueTitre>
        <DialogueDescription>
          Tant que ce litige est ouvert, l'argent reste bloqué chez Akora : la libération
          automatique à 72 heures est suspendue. Un administrateur tranche, et sa décision est
          motivée.
        </DialogueDescription>

        <div className="space-y-3">
          <Champ etiquette="Que s'est-il passé ?" aide="En une phrase." obligatoire>
            {(a) => <Saisie {...a} value={motif} onChange={(e) => setMotif(e.target.value)} />}
          </Champ>
          <Champ etiquette="Détails" aide="Quantités, état de la marchandise, ce qui a été livré.">
            {(a) => (
              <ZoneTexte {...a} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            )}
          </Champ>

          <div>
            <p className="text-legende font-semibold">Photos</p>
            <p className="text-[0.78rem] text-muted-foreground">
              Elles pèsent lourd dans l'arbitrage. Prenez le tas, la marchandise abîmée, le camion.
            </p>
            <label htmlFor="photos-litige" className="sr-only">
              Ajouter des photos au litige
            </label>
            <input
              id="photos-litige"
              ref={champFichier}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                const fichiers = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (fichiers.length > 0) void ajouterPhotos(fichiers);
              }}
            />
            <Bouton
              variante="secondaire"
              taille="compact"
              className="mt-2"
              disabled={photos.length >= 8}
              onClick={() => champFichier.current?.click()}
            >
              Ajouter des photos ({photos.length}/8)
            </Bouton>
          </div>

          <Bouton pleineLargeur disabled={enCours} onClick={() => void envoyer()}>
            {enCours ? "Envoi" : "Ouvrir le litige"}
          </Bouton>
        </div>
      </DialogueContenu>
    </Dialogue>
  );
}
