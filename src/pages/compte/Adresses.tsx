import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePointLivraison } from "@/lib/point-livraison";
import type { Point } from "@/lib/livraison";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { CartePoint } from "@/components/carte/CartePoint";
import { ChoixLocalite } from "@/components/pro/ChoixLocalite";
import { EtatVide } from "@/components/ui/etats";
import { Squelette } from "@/components/ui/skeleton";

interface Adresse {
  id: string;
  libelle: string;
  adresse_libre: string | null;
  lat: number | null;
  lng: number | null;
  localite_id: string | null;
}

/** Adresses de chantier enregistrées, pour ne pas repointer la carte à chaque fois. */
export default function Adresses() {
  const { utilisateur } = useAuth();
  const client = useQueryClient();
  const definirPoint = usePointLivraison((e) => e.definir);
  const [libelle, setLibelle] = React.useState("");
  const [adresse, setAdresse] = React.useState("");
  const [localiteId, setLocaliteId] = React.useState<string | null>(null);
  const [point, setPoint] = React.useState<Point | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  const adresses = useQuery({
    queryKey: ["adresses", utilisateur?.id],
    enabled: Boolean(utilisateur?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adresses_chantier")
        .select("id, libelle, adresse_libre, lat, lng, localite_id")
        .eq("user_id", utilisateur?.id as string)
        .order("libelle");
      if (error) throw error;
      return (data ?? []) as unknown as Adresse[];
    },
  });

  const ajouter = async () => {
    if (libelle.trim().length < 2) {
      toast.error("Donnez un nom à ce chantier.");
      return;
    }
    setEnCours(true);
    const { error } = await supabase
      .from("adresses_chantier")
      .insert({
        user_id: utilisateur?.id as string,
        libelle: libelle.trim(),
        adresse_libre: adresse.trim() || null,
        localite_id: localiteId,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
      })
      .select("id");
    setEnCours(false);
    if (error) {
      toast.error("Enregistrement impossible", { description: error.message });
      return;
    }
    setLibelle("");
    setAdresse("");
    setPoint(null);
    await client.invalidateQueries({ queryKey: ["adresses", utilisateur?.id] });
    toast.success("Adresse enregistrée");
  };

  return (
    <>
      <Seo titre="Adresses de chantier" chemin="/compte/adresses" indexable={false} />
      <h2 className="text-section">Adresses de chantier</h2>
      <p className="mt-1 text-legende text-muted-foreground">
        Enregistrez vos chantiers une fois : vous les rappellerez d'un geste au moment de comparer.
      </p>

      {adresses.isPending ? (
        <Squelette className="mt-4 h-24 w-full" />
      ) : (adresses.data ?? []).length === 0 ? (
        <div className="mt-4">
          <EtatVide titre="Aucune adresse" phrase="Ajoutez votre premier chantier ci-dessous." />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {(adresses.data ?? []).map((a) => (
            <li key={a.id}>
              <Carte className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{a.libelle}</p>
                  <p className="text-[0.78rem] text-muted-foreground">
                    {a.adresse_libre ?? "—"}
                    {a.lat == null ? " · sans coordonnées" : ""}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {a.lat != null && a.lng != null ? (
                    <Bouton
                      variante="tertiaire"
                      taille="compact"
                      onClick={() => {
                        definirPoint({
                          lat: Number(a.lat),
                          lng: Number(a.lng),
                          libelle: a.libelle,
                          localiteId: a.localite_id,
                          origine: "adresse",
                        });
                        toast.success("Point de livraison mis à jour", { description: a.libelle });
                      }}
                    >
                      <MapPin className="size-4" aria-hidden="true" />
                      Livrer ici
                    </Bouton>
                  ) : null}
                  <button
                    type="button"
                    aria-label={"Supprimer " + a.libelle}
                    className="inline-flex cible-44 items-center justify-center rounded-md text-destructive-strong hover:bg-muted"
                    onClick={async () => {
                      await supabase.from("adresses_chantier").delete().eq("id", a.id).select("id");
                      await client.invalidateQueries({ queryKey: ["adresses", utilisateur?.id] });
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </Carte>
            </li>
          ))}
        </ul>
      )}

      <Carte className="mt-4 p-4">
        <h3 className="text-produit">Ajouter un chantier</h3>
        <div className="mt-3 space-y-3">
          <Champ etiquette="Nom du chantier" aide="« Maison Ambohipo », « Dépôt Ivato »…" obligatoire>
            {(a) => <Saisie {...a} value={libelle} onChange={(e) => setLibelle(e.target.value)} />}
          </Champ>
          <ChoixLocalite
            valeur={localiteId}
            onChange={(l) => {
              setLocaliteId(l?.id ?? null);
              if (l?.lat != null && l.lng != null) setPoint({ lat: l.lat, lng: l.lng });
            }}
          />
          <Champ etiquette="Précisions" aide="Rue, quartier, point de repère.">
            {(a) => <Saisie {...a} value={adresse} onChange={(e) => setAdresse(e.target.value)} />}
          </Champ>
          <div>
            <p className="text-legende font-semibold">Position exacte</p>
            <CartePoint className="mt-1.5 h-48" intitule="Position du chantier" point={point} onChange={setPoint} />
          </div>
          <Bouton disabled={enCours} onClick={() => void ajouter()}>
            {enCours ? "Enregistrement" : "Enregistrer ce chantier"}
          </Bouton>
        </div>
      </Carte>
    </>
  );
}
