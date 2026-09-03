import { Link, useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import { listerMesProduits, majProduit, publierProduit, type LigneProduit } from "@/lib/donnees/produits";
import { LIBELLE_STOCK, LIBELLE_UNITE } from "@/lib/types-metier";
import { formaterAriary, formaterDate } from "@/lib/format";
import { Seo } from "@/components/Seo";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { Tableau, TableauCorps, TableauTete } from "@/components/ui/table";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";

function PastilleProduit({ produit }: { produit: LigneProduit }) {
  if (produit.statut === "actif") return <Pastille ton="succes">Publié</Pastille>;
  if (produit.statut === "en_attente_materiau") return <Pastille ton="neutre">En attente de référence</Pastille>;
  if (produit.statut === "inactif") return <Pastille ton="contour">Retiré</Pastille>;
  return <Pastille ton="info">Brouillon</Pastille>;
}

export default function Catalogue() {
  const fiche = useOutletContext<LigneFournisseur>();
  const client = useQueryClient();

  const produits = useQuery({
    queryKey: ["mes-produits", fiche.id],
    queryFn: () => listerMesProduits(fiche.id),
    staleTime: 60_000,
  });

  const rafraichir = () => client.invalidateQueries({ queryKey: ["mes-produits", fiche.id] });

  const basculer = async (produit: LigneProduit) => {
    try {
      if (produit.statut === "actif") {
        await majProduit(produit.id, { statut: "inactif" });
        toast.success("Produit retiré de la vitrine");
      } else {
        await publierProduit(produit);
        toast.success("Produit publié");
      }
      await rafraichir();
    } catch (erreur) {
      toast.error("Action impossible", { description: (erreur as Error).message });
    }
  };

  return (
    <>
      <Seo titre="Mon catalogue" chemin="/pro/catalogue" indexable={false} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-section">Mon catalogue</h2>
        <Bouton asChild taille="compact">
          <Link to="/pro/catalogue/nouveau">
            <Plus className="size-4" aria-hidden="true" />
            Ajouter un produit
          </Link>
        </Bouton>
      </div>

      {produits.isPending ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Squelette key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : produits.isError ? (
        <div className="mt-4">
          <EtatErreur onReessayer={() => void produits.refetch()} />
        </div>
      ) : produits.data.length === 0 ? (
        <div className="mt-4">
          <EtatVide
            titre="Votre catalogue est vide"
            phrase="Choisissez un matériau dans le catalogue commun, fixez votre prix, et vous apparaissez dans le comparateur."
            action={
              <Bouton asChild>
                <Link to="/pro/catalogue/nouveau">Ajouter un premier produit</Link>
              </Bouton>
            }
          />
        </div>
      ) : (
        <>
          {/* ── Téléphone : une carte par produit (03/09/2026) ──────────────
              Le tableau à six colonnes ne se lit pas à 390 px (règle mobile
              n° 8). La carte dit la même chose dans l'ordre d'importance :
              le nom, le prix en gros, le statut, puis les deux gestes. */}
          <ul className="mt-4 space-y-2 sm:hidden">
            {produits.data.map((produit) => (
              <li key={produit.id} className="carte p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <Link to={"/pro/catalogue/" + produit.id} className="min-w-0 font-semibold hover:underline">
                    <span className="line-clamp-2">{produit.nom_affiche}</span>
                  </Link>
                  <PastilleProduit produit={produit} />
                </div>
                <p className="nombres mt-1.5">
                  <span className="text-[1.125rem] font-bold">{formaterAriary(produit.prix_promo ?? produit.prix_unitaire)}</span>
                  <span className="text-legende text-muted-foreground"> / {LIBELLE_UNITE[produit.unite]}</span>
                </p>
                <p className="nombres text-legende text-muted-foreground">
                  {LIBELLE_STOCK[produit.stock_statut]} · prix mis à jour le {formaterDate(produit.prix_maj_le)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Bouton asChild variante="tertiaire" className="flex-1">
                    <Link to={"/pro/catalogue/" + produit.id}>Modifier</Link>
                  </Bouton>
                  {produit.statut !== "en_attente_materiau" ? (
                    <Bouton
                      variante={produit.statut === "actif" ? "secondaire" : "principal"}
                      className="flex-1"
                      onClick={() => void basculer(produit)}
                    >
                      {produit.statut === "actif" ? "Retirer" : "Publier"}
                    </Bouton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

        <Tableau conteneurClassName="mt-4 hidden sm:block">
          <TableauTete>
            <tr>
              <th scope="col">Produit</th>
              <th scope="col">Prix</th>
              <th scope="col">Stock</th>
              <th scope="col">Statut</th>
              <th scope="col">Prix mis à jour</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </TableauTete>
          <TableauCorps>
            {produits.data.map((produit) => (
              <tr key={produit.id}>
                <td>
                  <Link to={"/pro/catalogue/" + produit.id} className="font-semibold hover:underline">
                    {produit.nom_affiche}
                  </Link>
                </td>
                <td data-nombre="">
                  {formaterAriary(produit.prix_promo ?? produit.prix_unitaire)}
                  <span className="text-muted-foreground"> / {LIBELLE_UNITE[produit.unite]}</span>
                </td>
                <td>{LIBELLE_STOCK[produit.stock_statut]}</td>
                <td>
                  <PastilleProduit produit={produit} />
                </td>
                <td data-nombre="">{formaterDate(produit.prix_maj_le)}</td>
                <td>
                  <div className="flex justify-end gap-1.5">
                    <Bouton asChild variante="tertiaire" taille="compact">
                      <Link to={"/pro/catalogue/" + produit.id}>Modifier</Link>
                    </Bouton>
                    {produit.statut !== "en_attente_materiau" ? (
                      <Bouton
                        variante={produit.statut === "actif" ? "secondaire" : "principal"}
                        taille="compact"
                        onClick={() => void basculer(produit)}
                      >
                        {produit.statut === "actif" ? "Retirer" : "Publier"}
                      </Bouton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </TableauCorps>
        </Tableau>
        </>
      )}
    </>
  );
}
