import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { demanderAjoutMateriau } from "@/lib/donnees/materiaux";
import { listerFamilles } from "@/lib/donnees/categories";
import { LIBELLE_UNITE, type Unite } from "@/lib/types-metier";
import { Dialogue, DialogueContenu, DialogueDescription, DialogueTitre } from "@/components/ui/dialog";
import { Champ } from "@/components/ui/champ";
import { Saisie, ZoneTexte } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Liste, ListeContenu, ListeDeclencheur, ListeElement, ListeValeur } from "@/components/ui/select";

const UNITES: Unite[] = ["piece", "sac", "m3", "tonne", "m2", "ml", "botte", "chargement", "palette"];

/**
 * Demande d'ajout d'un matériau au référentiel (spec B4).
 * Elle ne crée RIEN : elle dépose une ligne que l'administrateur arbitre.
 * Le produit qui l'accompagne reste en attente, invisible du public.
 */
export function DialogueDemandeMateriau({
  ouvert,
  onOuvertChange,
  fournisseurId,
  onDeposee,
}: {
  ouvert: boolean;
  onOuvertChange: (ouvert: boolean) => void;
  fournisseurId: string;
  onDeposee: (demandeId: string, categorieId: string, unite: Unite, poids: number, volume: number, nom: string) => void;
}) {
  const familles = useQuery({ queryKey: ["familles"], queryFn: listerFamilles, staleTime: 30 * 60_000 });
  const [nom, setNom] = React.useState("");
  const [categorieId, setCategorieId] = React.useState("");
  const [unite, setUnite] = React.useState<Unite>("piece");
  const [poids, setPoids] = React.useState("");
  const [volume, setVolume] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);

  const envoyer = async () => {
    const p = Number.parseFloat(poids.replace(",", "."));
    const v = Number.parseFloat(volume.replace(",", "."));
    if (nom.trim().length < 2 || !categorieId || !(p > 0) || !(v > 0)) {
      toast.error("Demande incomplète", {
        description: "Nom, famille, poids et volume par unité sont nécessaires pour comparer les offres.",
      });
      return;
    }
    setEnCours(true);
    try {
      const id = await demanderAjoutMateriau({
        fournisseur_id: fournisseurId,
        nom_propose: nom.trim(),
        categorie_id: categorieId,
        unite,
        poids_kg_unite: p,
        volume_m3_unite: v,
        description: description.trim() || null,
      });
      toast.success("Demande envoyée", {
        description: "Votre produit reste en attente de référence. Vous serez prévenu de la décision.",
      });
      onDeposee(id, categorieId, unite, p, v, nom.trim());
      onOuvertChange(false);
    } catch (erreur) {
      toast.error("Envoi impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Dialogue open={ouvert} onOpenChange={onOuvertChange}>
      <DialogueContenu className="max-h-[88svh] overflow-y-auto">
        <DialogueTitre>Demander l'ajout d'un matériau</DialogueTitre>
        <DialogueDescription>
          Akora ne référence que le gros œuvre. Une demande hors périmètre — quincaillerie,
          plomberie, finitions — sera refusée avec un motif.
        </DialogueDescription>

        <div className="space-y-3">
          <Champ etiquette="Nom du matériau" obligatoire>
            {(a) => <Saisie {...a} value={nom} onChange={(e) => setNom(e.target.value)} />}
          </Champ>

          <Champ etiquette="Famille" obligatoire>
            {(a) => (
              <Liste value={categorieId} onValueChange={setCategorieId}>
                <ListeDeclencheur id={a.id} aria-invalid={a["aria-invalid"]}>
                  <ListeValeur placeholder="Choisir une famille" />
                </ListeDeclencheur>
                <ListeContenu>
                  {(familles.data ?? []).map((f) => (
                    <ListeElement key={f.id} value={f.id}>
                      {f.nom}
                    </ListeElement>
                  ))}
                </ListeContenu>
              </Liste>
            )}
          </Champ>

          <Champ etiquette="Unité de vente" obligatoire>
            {(a) => (
              <Liste value={unite} onValueChange={(v) => setUnite(v as Unite)}>
                <ListeDeclencheur id={a.id}>
                  <ListeValeur />
                </ListeDeclencheur>
                <ListeContenu>
                  {UNITES.map((u) => (
                    <ListeElement key={u} value={u}>
                      {LIBELLE_UNITE[u]}
                    </ListeElement>
                  ))}
                </ListeContenu>
              </Liste>
            )}
          </Champ>

          <div className="grid grid-cols-2 gap-2">
            <Champ etiquette="Poids par unité (kg)" obligatoire>
              {(a) => <Saisie {...a} value={poids} onChange={(e) => setPoids(e.target.value)} inputMode="decimal" />}
            </Champ>
            <Champ
              etiquette="Volume par unité (m³)"
              aide="Encombrement dans le camion, pas le volume de matière."
              obligatoire
            >
              {(a) => <Saisie {...a} value={volume} onChange={(e) => setVolume(e.target.value)} inputMode="decimal" />}
            </Champ>
          </div>

          <Champ etiquette="Précisions" aide="Dimensions, usage, appellation locale.">
            {(a) => <ZoneTexte {...a} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />}
          </Champ>

          <Bouton pleineLargeur disabled={enCours} onClick={() => void envoyer()}>
            {enCours ? "Envoi en cours" : "Envoyer la demande"}
          </Bouton>
        </div>
      </DialogueContenu>
    </Dialogue>
  );
}
