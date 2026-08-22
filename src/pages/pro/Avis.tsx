import * as React from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import { listerAvisFournisseur, repondreAvis } from "@/lib/donnees/avis";
import { formaterDate, formaterNote } from "@/lib/format";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { ZoneTexte } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

/** Avis reçus, avec droit de réponse. La publication reste à la modération. */
export default function AvisPro() {
  const fiche = useOutletContext<LigneFournisseur>();
  const client = useQueryClient();
  const [brouillons, setBrouillons] = React.useState<Record<string, string>>({});

  const avis = useQuery({
    queryKey: ["avis-pro", fiche.id],
    queryFn: () => listerAvisFournisseur(fiche.id),
    staleTime: 60_000,
  });

  const repondre = async (id: string) => {
    try {
      await repondreAvis(id, (brouillons[id] ?? "").trim());
      await client.invalidateQueries({ queryKey: ["avis-pro", fiche.id] });
      toast.success("Réponse enregistrée");
    } catch (erreur) {
      toast.error("Réponse refusée", { description: (erreur as Error).message });
    }
  };

  return (
    <>
      <Seo titre="Avis reçus" chemin="/pro/avis" indexable={false} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-section">Avis reçus</h2>
        {fiche.note_moyenne != null ? (
          <p className="nombres inline-flex items-center gap-1 text-legende">
            <Star className="size-4 text-accent" aria-hidden="true" />
            {formaterNote(Number(fiche.note_moyenne))} sur {fiche.nb_avis} avis
          </p>
        ) : null}
      </div>

      {avis.isPending ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Squelette key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (avis.data ?? []).length === 0 ? (
        <div className="mt-4">
          <EtatVide
            titre="Aucun avis pour l'instant"
            phrase="Un avis n'est possible qu'après une commande clôturée : c'est ce qui les rend crédibles."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {(avis.data ?? []).map((a) => (
            <li key={a.id}>
              <Carte className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        aria-hidden="true"
                        className={i < a.note ? "size-4 fill-accent text-accent" : "size-4 text-border"}
                      />
                    ))}
                    <span className="sr-only">{a.note} sur 5</span>
                  </p>
                  <span className="flex items-center gap-2">
                    <Pastille ton={a.statut === "publie" ? "succes" : a.statut === "masque" ? "danger" : "info"}>
                      {a.statut === "publie" ? "Publié" : a.statut === "masque" ? "Masqué" : "En modération"}
                    </Pastille>
                    <span className="nombres text-[0.78rem] text-muted-foreground">
                      {formaterDate(a.created_at)}
                    </span>
                  </span>
                </div>

                {a.commentaire ? <p className="mt-2 text-[0.9375rem]">« {a.commentaire} »</p> : null}

                {a.reponse_fournisseur ? (
                  <p className="mt-2 rounded-md bg-muted p-2.5 text-legende">
                    <span className="font-semibold">Votre réponse : </span>
                    {a.reponse_fournisseur}
                  </p>
                ) : (
                  <div className="mt-3">
                    <label htmlFor={"reponse-" + a.id} className="text-legende font-semibold">
                      Répondre publiquement
                    </label>
                    <ZoneTexte
                      id={"reponse-" + a.id}
                      className="mt-1.5"
                      rows={2}
                      value={brouillons[a.id] ?? ""}
                      onChange={(e) => setBrouillons({ ...brouillons, [a.id]: e.target.value })}
                    />
                    <Bouton
                      variante="tertiaire"
                      taille="compact"
                      className="mt-2"
                      disabled={(brouillons[a.id] ?? "").trim().length < 2}
                      onClick={() => void repondre(a.id)}
                    >
                      Publier ma réponse
                    </Bouton>
                  </div>
                )}
              </Carte>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
