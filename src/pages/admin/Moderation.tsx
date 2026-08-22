import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formaterDateHeure } from "@/lib/format";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

/**
 * Modération : avis en attente et signalements.
 *
 * Publier un avis, c'est engager la crédibilité du site — et un avis n'existe
 * déjà que sur une commande clôturée. Le travail ici consiste surtout à
 * écarter les insultes et les règlements de comptes, pas à filtrer les
 * mauvaises notes.
 */
export default function Moderation() {
  const client = useQueryClient();

  const avis = useQuery({
    queryKey: ["avis-moderation"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avis")
        .select("id, fournisseur_id, note, commentaire, statut, created_at")
        .eq("statut", "en_attente")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const signalements = useQuery({
    queryKey: ["signalements"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signalements")
        .select("id, entite, entite_id, motif, description, created_at")
        .eq("traite", false)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const moderer = async (id: string, statut: "publie" | "masque") => {
    const { error } = await supabase.rpc("moderer_avis", { _avis_id: id, _statut: statut });
    if (error) {
      toast.error("Modération refusée", { description: error.message });
      return;
    }
    await client.invalidateQueries({ queryKey: ["avis-moderation"] });
    toast.success(statut === "publie" ? "Avis publié" : "Avis masqué");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-produit">Avis en attente</h2>
        {avis.isPending ? (
          <Squelette className="mt-2 h-32 w-full" />
        ) : (avis.data ?? []).length === 0 ? (
          <div className="mt-2">
            <EtatVide titre="Aucun avis à modérer" phrase="Tous les avis déposés ont été traités." />
          </div>
        ) : (
          <ul className="mt-2 space-y-3">
            {(avis.data ?? []).map((a) => (
              <li key={a.id as string}>
                <Carte className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          aria-hidden="true"
                          className={
                            i < Number(a.note) ? "size-4 fill-accent text-accent" : "size-4 text-border"
                          }
                        />
                      ))}
                      <span className="sr-only">{String(a.note)} sur 5</span>
                    </p>
                    <span className="nombres text-[0.78rem] text-muted-foreground">
                      {formaterDateHeure(a.created_at as string)}
                    </span>
                  </div>
                  {a.commentaire ? (
                    <p className="mt-2 text-[0.9375rem]">« {String(a.commentaire)} »</p>
                  ) : (
                    <p className="mt-2 text-legende text-muted-foreground">Note sans commentaire.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Bouton taille="compact" onClick={() => void moderer(a.id as string, "publie")}>
                      Publier
                    </Bouton>
                    <Bouton
                      variante="fantome"
                      taille="compact"
                      className="text-destructive-strong"
                      onClick={() => void moderer(a.id as string, "masque")}
                    >
                      Masquer
                    </Bouton>
                  </div>
                </Carte>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-produit">Signalements</h2>
        {signalements.isPending ? (
          <Squelette className="mt-2 h-24 w-full" />
        ) : (signalements.data ?? []).length === 0 ? (
          <div className="mt-2">
            <EtatVide titre="Aucun signalement" phrase="Rien n'a été signalé par les utilisateurs." />
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {(signalements.data ?? []).map((s) => (
              <li key={s.id as string}>
                <Carte className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{String(s.motif)}</p>
                    <p className="font-mono text-[0.78rem] text-muted-foreground">
                      {String(s.entite)} · {String(s.entite_id)}
                    </p>
                    {s.description ? (
                      <p className="mt-1 text-legende">{String(s.description)}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Pastille ton="attention">à traiter</Pastille>
                    <Bouton
                      variante="tertiaire"
                      taille="compact"
                      onClick={async () => {
                        await supabase
                          .from("signalements")
                          .update({ traite: true, traite_le: new Date().toISOString() })
                          .eq("id", s.id as string)
                          .select("id");
                        await client.invalidateQueries({ queryKey: ["signalements"] });
                      }}
                    >
                      Marquer traité
                    </Bouton>
                  </div>
                </Carte>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
