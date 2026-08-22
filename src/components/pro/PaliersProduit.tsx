import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ajouterPalier, listerPaliers, supprimerPalier } from "@/lib/donnees/produits";
import { formaterAriary } from "@/lib/format";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Tableau, TableauCorps, TableauTete } from "@/components/ui/table";

/**
 * Paliers dégressifs. La base refuse un palier supérieur ou égal au prix de
 * base : ce n'est pas une remise. Le message d'erreur vient de là, pas d'ici.
 */
export function PaliersProduit({ produitId, prixDeBase }: { produitId: string; prixDeBase: number }) {
  const client = useQueryClient();
  const [quantite, setQuantite] = React.useState("");
  const [prix, setPrix] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);

  const paliers = useQuery({
    queryKey: ["paliers", produitId],
    queryFn: () => listerPaliers(produitId),
    staleTime: 60_000,
  });

  const rafraichir = () => client.invalidateQueries({ queryKey: ["paliers", produitId] });

  const ajouter = async () => {
    const q = Number.parseInt(quantite, 10);
    const p = Number.parseInt(prix, 10);
    if (!Number.isFinite(q) || q < 2 || !Number.isFinite(p) || p <= 0) {
      toast.error("Saisie incomplète", { description: "Une quantité à partir de 2, et un prix en Ariary." });
      return;
    }
    setEnCours(true);
    try {
      await ajouterPalier(produitId, { quantite_min: q, prix_unitaire: p });
      setQuantite("");
      setPrix("");
      await rafraichir();
    } catch (erreur) {
      toast.error("Palier refusé", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-legende font-semibold">Paliers dégressifs</p>
      <p className="text-[0.78rem] text-muted-foreground">
        « À partir de N unités, le prix unitaire tombe à P. » Le comparateur les applique en
        direct quand l'acheteur bouge le curseur de quantité.
      </p>

      {(paliers.data ?? []).length > 0 ? (
        <Tableau>
          <TableauTete>
            <tr>
              <th scope="col">À partir de</th>
              <th scope="col">Prix unitaire</th>
              <th scope="col">
                <span className="sr-only">Retirer</span>
              </th>
            </tr>
          </TableauTete>
          <TableauCorps>
            {(paliers.data ?? []).map((palier) => (
              <tr key={palier.id}>
                <td data-nombre="">{palier.quantite_min}</td>
                <td data-nombre="">{formaterAriary(palier.prix_unitaire)}</td>
                <td>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      aria-label={`Retirer le palier à partir de ${palier.quantite_min}`}
                      className="inline-flex cible-44 items-center justify-center rounded-md text-destructive-strong hover:bg-muted"
                      onClick={async () => {
                        await supprimerPalier(palier.id);
                        await rafraichir();
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </TableauCorps>
        </Tableau>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <Champ etiquette="À partir de (quantité)" className="min-w-[9rem] flex-1">
          {(a) => (
            <Saisie {...a} value={quantite} onChange={(e) => setQuantite(e.target.value)} inputMode="numeric" />
          )}
        </Champ>
        <Champ
          etiquette="Prix unitaire (Ar)"
          aide={`Doit rester sous ${formaterAriary(prixDeBase)}`}
          className="min-w-[9rem] flex-1"
        >
          {(a) => <Saisie {...a} value={prix} onChange={(e) => setPrix(e.target.value)} inputMode="numeric" />}
        </Champ>
        <Bouton variante="tertiaire" disabled={enCours} onClick={() => void ajouter()}>
          Ajouter le palier
        </Bouton>
      </div>
    </div>
  );
}
