import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { accepterDemande, listerDemandesMateriau, refuserDemande } from "@/lib/donnees/admin";
import { listerFamilles } from "@/lib/donnees/categories";
import { LIBELLE_UNITE } from "@/lib/types-metier";
import { formaterDate, slugifier } from "@/lib/format";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

/**
 * File des demandes de matériau (spec B4).
 *
 * L'admin est le SEUL à pouvoir créer une référence. Il peut normaliser le nom
 * proposé — « parpaing 15 » devient « Parpaing creux 15 (40x20x15) » — parce
 * que c'est ce nom-là qui rendra les offres comparables. Un refus doit être
 * motivé : « hors périmètre gros œuvre », le plus souvent.
 */
export default function MateriauxDemandes() {
  const client = useQueryClient();
  const [saisies, setSaisies] = React.useState<Record<string, { nom: string; motif: string }>>({});

  const demandes = useQuery({
    queryKey: ["demandes-materiau"],
    queryFn: listerDemandesMateriau,
    staleTime: 30_000,
  });
  const familles = useQuery({ queryKey: ["familles"], queryFn: listerFamilles, staleTime: 30 * 60_000 });

  const enAttente = (demandes.data ?? []).filter((d) => d.statut === "en_attente");

  const accepter = async (id: string, nomPropose: string, categorieId: string, unite: string, poids: number, volume: number) => {
    const nom = (saisies[id]?.nom ?? nomPropose).trim();
    if (nom.length < 3) {
      toast.error("Le nom normalisé est trop court.");
      return;
    }
    try {
      await accepterDemande({
        demandeId: id,
        nom,
        slug: slugifier(nom),
        categorieId,
        unite: unite as never,
        poids,
        volume,
      });
      await client.invalidateQueries({ queryKey: ["demandes-materiau"] });
      toast.success("Matériau créé", { description: nom });
    } catch (erreur) {
      toast.error("Création refusée", { description: (erreur as Error).message });
    }
  };

  if (demandes.isPending) return <Squelette className="h-64 w-full" />;
  if (enAttente.length === 0) {
    return (
      <EtatVide
        titre="Aucune demande en attente"
        phrase="Les fournisseurs choisissent dans le catalogue commun ; ce qui manque atterrit ici."
      />
    );
  }

  return (
    <div className="space-y-4">
      {enAttente.map((demande) => {
        const famille = (familles.data ?? []).find((f) => f.id === demande.categorie_id);
        const saisie = saisies[demande.id] ?? { nom: demande.nom_propose, motif: "" };
        return (
          <Carte key={demande.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-produit">{demande.nom_propose}</h2>
                <p className="nombres text-legende text-muted-foreground">
                  {famille?.nom ?? "famille inconnue"} · {LIBELLE_UNITE[demande.unite]} ·{" "}
                  {demande.poids_kg_unite} kg · {demande.volume_m3_unite} m³
                </p>
                <p className="text-[0.78rem] text-muted-foreground">
                  Demandé le {formaterDate(demande.created_at)}
                </p>
              </div>
              <Pastille ton={demande.nb_demandeurs > 1 ? "attention" : "neutre"}>
                {demande.nb_demandeurs} demandeur{demande.nb_demandeurs > 1 ? "s" : ""}
              </Pastille>
            </div>

            {demande.description ? (
              <p className="mt-2 text-legende text-muted-foreground">{demande.description}</p>
            ) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Champ
                etiquette="Nom normalisé"
                aide="C'est ce nom qui rendra les offres comparables entre dépôts."
              >
                {(a) => (
                  <Saisie
                    {...a}
                    value={saisie.nom}
                    onChange={(e) => setSaisies({ ...saisies, [demande.id]: { ...saisie, nom: e.target.value } })}
                  />
                )}
              </Champ>
              <Champ etiquette="Motif, si vous refusez" aide="« Hors périmètre gros œuvre », par exemple.">
                {(a) => (
                  <Saisie
                    {...a}
                    value={saisie.motif}
                    onChange={(e) => setSaisies({ ...saisies, [demande.id]: { ...saisie, motif: e.target.value } })}
                  />
                )}
              </Champ>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Bouton
                onClick={() =>
                  void accepter(
                    demande.id,
                    demande.nom_propose,
                    demande.categorie_id,
                    demande.unite,
                    Number(demande.poids_kg_unite),
                    Number(demande.volume_m3_unite),
                  )
                }
              >
                Créer la référence
              </Bouton>
              <Bouton
                variante="fantome"
                className="text-destructive-strong"
                disabled={saisie.motif.trim().length < 5}
                onClick={async () => {
                  try {
                    await refuserDemande(demande.id, saisie.motif.trim());
                    await client.invalidateQueries({ queryKey: ["demandes-materiau"] });
                    toast.success("Demande refusée");
                  } catch (erreur) {
                    toast.error("Refus impossible", { description: (erreur as Error).message });
                  }
                }}
              >
                Refuser
              </Bouton>
            </div>
          </Carte>
        );
      })}
    </div>
  );
}
