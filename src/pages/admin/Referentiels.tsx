import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chercherLocalites, type Localite } from "@/lib/donnees/localites";
import type { Point } from "@/lib/livraison";
import { slugifier } from "@/lib/format";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { CartePoint } from "@/components/carte/CartePoint";
import { Squelette } from "@/components/ui/skeleton";

/**
 * Référentiels : poser les coordonnées manquantes des localités.
 *
 * Le seed ne contient AUCUNE coordonnée inventée (règle A2.8). Les communes de
 * l'agglomération d'Antananarivo attendent donc ici qu'on les pointe sur la
 * carte, une fois pour toutes. C'est plus lent qu'une estimation ; c'est aussi
 * la seule façon de ne pas facturer une livraison sur une position fausse.
 */
export default function Referentiels() {
  const client = useQueryClient();
  const [terme, setTerme] = React.useState("");
  const [choisie, setChoisie] = React.useState<Localite | null>(null);
  const [point, setPoint] = React.useState<Point | null>(null);
  const [nouvelle, setNouvelle] = React.useState("");

  const localites = useQuery({
    queryKey: ["localites-admin", terme],
    queryFn: () => chercherLocalites(terme, 60),
    staleTime: 60_000,
  });

  const sansCoordonnees = (localites.data ?? []).filter((l) => l.lat == null);

  const enregistrer = async () => {
    if (!choisie || !point) return;
    const { error } = await supabase
      .from("localites")
      .update({ lat: point.lat, lng: point.lng })
      .eq("id", choisie.id)
      .select("id");
    if (error) {
      toast.error("Enregistrement impossible", { description: error.message });
      return;
    }
    await client.invalidateQueries({ queryKey: ["localites-admin"] });
    setChoisie(null);
    setPoint(null);
    toast.success("Coordonnées enregistrées", { description: choisie.nom });
  };

  const creer = async () => {
    const nom = nouvelle.trim();
    if (nom.length < 2 || !point) {
      toast.error("Nom et position sont nécessaires.");
      return;
    }
    const { error } = await supabase
      .from("localites")
      .insert({ nom, slug: slugifier(nom), type: "commune", lat: point.lat, lng: point.lng })
      .select("id");
    if (error) {
      toast.error("Création impossible", { description: error.message });
      return;
    }
    setNouvelle("");
    setPoint(null);
    await client.invalidateQueries({ queryKey: ["localites-admin"] });
    toast.success("Localité créée", { description: nom });
  };

  return (
    <div className="space-y-4">
      <Carte className="p-4">
        <h2 className="text-produit">Localités sans coordonnées</h2>
        <p className="mt-0.5 text-legende text-muted-foreground">
          Tant qu'une commune n'a pas de point, le site affiche « distance non calculable » plutôt
          que d'inventer une position.
        </p>

        <div className="mt-3">
          <Champ etiquette="Chercher une localité">
            {(a) => <Saisie {...a} value={terme} onChange={(e) => setTerme(e.target.value)} />}
          </Champ>
        </div>

        {localites.isPending ? (
          <Squelette className="mt-3 h-32 w-full" />
        ) : (
          <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {(localites.data ?? []).map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => {
                    setChoisie(l);
                    setPoint(l.lat != null && l.lng != null ? { lat: l.lat, lng: l.lng } : null);
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left hover:bg-muted"
                >
                  <span>{l.nom}</span>
                  {l.lat == null ? (
                    <Pastille ton="attention">sans coordonnées</Pastille>
                  ) : (
                    <span className="nombres text-[0.75rem] text-muted-foreground">
                      {l.lat.toFixed(3)}, {l.lng?.toFixed(3)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[0.78rem] text-muted-foreground">
          <span className="nombres">{sansCoordonnees.length}</span> sans coordonnées dans cette liste.
        </p>
      </Carte>

      <Carte className="p-4">
        <h2 className="text-produit">
          {choisie ? "Positionner « " + choisie.nom + " »" : "Ajouter une localité"}
        </h2>
        {!choisie ? (
          <div className="mt-3">
            <Champ etiquette="Nom de la commune ou du quartier">
              {(a) => <Saisie {...a} value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} />}
            </Champ>
          </div>
        ) : null}

        <CartePoint
          className="mt-3 h-64"
          intitule="Poser la localité sur la carte"
          point={point}
          onChange={setPoint}
        />
        {point ? (
          <p className="nombres mt-1 text-[0.78rem] text-muted-foreground">
            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {choisie ? (
            <>
              <Bouton disabled={!point} onClick={() => void enregistrer()}>
                Enregistrer la position
              </Bouton>
              <Bouton
                variante="fantome"
                onClick={() => {
                  setChoisie(null);
                  setPoint(null);
                }}
              >
                Annuler
              </Bouton>
            </>
          ) : (
            <Bouton disabled={!point || nouvelle.trim().length < 2} onClick={() => void creer()}>
              Créer la localité
            </Bouton>
          )}
        </div>
      </Carte>
    </div>
  );
}
