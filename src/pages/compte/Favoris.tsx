import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listerProduits } from "@/lib/donnees/vitrine";
import { versCarte } from "@/lib/adaptateurs";
import { Seo } from "@/components/Seo";
import { CarteProduit } from "@/components/produit/CarteProduit";
import { Bouton } from "@/components/ui/button";
import { GrilleSquelettes } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

export default function Favoris() {
  const { utilisateur } = useAuth();
  const client = useQueryClient();

  const favoris = useQuery({
    queryKey: ["favoris", utilisateur?.id],
    enabled: Boolean(utilisateur?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favoris")
        .select("id, produit_id, fournisseur_id")
        .eq("user_id", utilisateur?.id as string);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        produit_id: string | null;
        fournisseur_id: string | null;
      }[];
    },
  });

  const produitIds = (favoris.data ?? []).map((f) => f.produit_id).filter(Boolean) as string[];

  const produits = useQuery({
    queryKey: ["favoris-produits", produitIds.join(",")],
    enabled: produitIds.length > 0,
    queryFn: async () => {
      const tous = await listerProduits({ page: 0 });
      return tous.filter((p) => produitIds.includes(p.id as string));
    },
  });

  const retirer = async (produitId: string) => {
    await supabase
      .from("favoris")
      .delete()
      .eq("user_id", utilisateur?.id as string)
      .eq("produit_id", produitId)
      .select("id");
    await client.invalidateQueries({ queryKey: ["favoris", utilisateur?.id] });
  };

  return (
    <>
      <Seo titre="Favoris" chemin="/compte/favoris" indexable={false} />
      <h2 className="text-section">Favoris</h2>

      {favoris.isPending ? (
        <div className="mt-4">
          <GrilleSquelettes nombre={4} />
        </div>
      ) : produitIds.length === 0 ? (
        <div className="mt-4">
          <EtatVide
            titre="Aucun favori"
            phrase="Mettez de côté les offres que vous voulez recomparer plus tard."
            action={
              <Bouton asChild>
                <Link to="/materiaux">Parcourir les matériaux</Link>
              </Bouton>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {(produits.data ?? []).map((produit) => (
            <div key={produit.id as string} className="relative">
              <CarteProduit produit={versCarte(produit)} />
              <button
                type="button"
                aria-label="Retirer des favoris"
                className="absolute right-1 top-1 inline-flex size-9 items-center justify-center rounded-xs bg-card/90 text-destructive-strong shadow"
                onClick={() => void retirer(produit.id as string)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
