import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import type { OffreMateriau } from "@/lib/donnees/offres-metre";
import { offresDe } from "@/lib/donnees/offres-metre";
import { formaterAriary } from "@/lib/format";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { Dialogue, DialogueContenu, DialogueDescription, DialogueTitre } from "@/components/ui/dialog";
import { Bouton } from "@/components/ui/button";

/**
 * Choisir le depot, ligne par ligne, avant de remplir le panier.
 *
 * Akora presente la moins chere en tete et la retient par defaut. Mais c'est
 * l'acheteur qui tranche : le moins cher n'est pas toujours celui qu'on veut —
 * on connait le voisin, il livre le samedi, on lui doit un service. Remplir le
 * panier sans montrer les autres offres, ce serait choisir a sa place.
 *
 * Une ligne sans aucune offre reste visible : la taire donnerait un panier
 * silencieusement incomplet.
 */
export interface LigneAChoisir {
  cle: string;
  libelle: string;
  quantite: number;
  unite: string;
  materiauSlug: string | null;
}

export function DialogueFournisseurs({
  ouvert,
  onFermer,
  lignes,
  offres,
  choix,
  onChoisir,
  onConfirmer,
  enCours = false,
}: {
  ouvert: boolean;
  onFermer: () => void;
  lignes: readonly LigneAChoisir[];
  offres: readonly OffreMateriau[];
  /** produit_id retenu, par cle de ligne. */
  choix: Record<string, string | null>;
  onChoisir: (cle: string, produitId: string) => void;
  onConfirmer: () => void;
  enCours?: boolean;
}) {
  const [deplie, setDeplie] = React.useState<string | null>(null);

  const total = lignes.reduce((somme, ligne) => {
    const liste = offresDe(offres, ligne.materiauSlug);
    const retenue = liste.find((o) => o.produit_id === choix[ligne.cle]) ?? liste[0];
    return somme + (retenue ? retenue.prix_unitaire * ligne.quantite : 0);
  }, 0);

  const manquantes = lignes.filter((l) => offresDe(offres, l.materiauSlug).length === 0);

  return (
    <Dialogue open={ouvert} onOpenChange={(o) => (o ? undefined : onFermer())}>
      <DialogueContenu className="max-w-2xl">
        <DialogueTitre>Choisissez vos fournisseurs</DialogueTitre>
        <DialogueDescription>
          Akora place le moins cher en tête et le retient par défaut. Vous pouvez en choisir un
          autre : le prix n'est pas la seule raison de préférer un dépôt.
        </DialogueDescription>

        <div className="max-h-[52vh] space-y-3 overflow-y-auto">
          {lignes.map((ligne) => {
            const liste = offresDe(offres, ligne.materiauSlug);
            const retenue = liste.find((o) => o.produit_id === choix[ligne.cle]) ?? liste[0] ?? null;
            const ouvertes = deplie === ligne.cle;

            return (
              <div key={ligne.cle} className="rounded-md border border-border">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-3 py-2">
                  <p className="text-courant font-semibold">{ligne.libelle}</p>
                  <p className="nombres text-legende text-muted-foreground">
                    {ligne.quantite} {ligne.unite}
                  </p>
                </div>

                {liste.length === 0 ? (
                  <p className="px-3 py-2.5 text-legende text-muted-foreground">
                    Aucun dépôt ne propose cette référence pour l'instant. Cette ligne ne sera pas
                    ajoutée au panier.
                  </p>
                ) : ouvertes ? (
                  <ul>
                    {liste.map((offre, index) => {
                      const actif = retenue?.produit_id === offre.produit_id;
                      return (
                        <li key={offre.produit_id}>
                          <button
                            type="button"
                            onClick={() => {
                              onChoisir(ligne.cle, offre.produit_id);
                              setDeplie(null);
                            }}
                            className={
                              "flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-0 " +
                              (actif ? "bg-primary-soft" : "hover:bg-muted")
                            }
                          >
                            <span className="flex size-5 shrink-0 items-center justify-center">
                              {actif ? <Check size={16} className="text-primary" aria-hidden="true" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-courant font-semibold">
                                  {offre.fournisseur_nom}
                                </span>
                                <BadgeVerification niveau={offre.fournisseur_niveau} compact />
                                {index === 0 ? (
                                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.66rem] font-semibold text-success-strong">
                                    Le moins cher
                                  </span>
                                ) : null}
                              </span>
                              <span className="block text-legende text-muted-foreground">
                                {offre.distance_km != null ? (
                                  <span className="nombres">
                                    {offre.distance_km.toFixed(1).replace(".", ",")} km
                                  </span>
                                ) : (
                                  "distance inconnue"
                                )}
                                {offre.stock_statut === "en_stock"
                                  ? " · en stock"
                                  : offre.stock_statut === "sur_commande"
                                    ? " · sur commande"
                                    : " · rupture"}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="nombres block text-courant font-semibold">
                                {formaterAriary(offre.prix_unitaire)}
                              </span>
                              <span className="block text-[0.72rem] text-muted-foreground">
                                / {offre.unite}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : retenue ? (
                  <button
                    type="button"
                    onClick={() => setDeplie(ligne.cle)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-courant font-semibold">
                          {retenue.fournisseur_nom}
                        </span>
                        <BadgeVerification niveau={retenue.fournisseur_niveau} compact />
                      </span>
                      <span className="block text-legende text-muted-foreground">
                        {liste.length > 1
                          ? `${liste.length} dépôts proposent cette référence — changer`
                          : "seul dépôt à proposer cette référence"}
                      </span>
                    </span>
                    <span className="nombres shrink-0 text-courant font-semibold">
                      {formaterAriary(retenue.prix_unitaire * ligne.quantite)}
                    </span>
                    {liste.length > 1 ? (
                      <ChevronDown size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : null}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3">
          <p className="text-courant text-muted-foreground">Total matériaux, hors livraison</p>
          <p className="nombres text-section">{formaterAriary(total)}</p>
        </div>

        {manquantes.length > 0 ? (
          <p className="rounded-md bg-muted p-3 text-legende text-muted-foreground">
            <span className="nombres">{manquantes.length}</span> ligne
            {manquantes.length > 1 ? "s" : ""} sans dépôt ne sera
            {manquantes.length > 1 ? "nt" : ""} pas ajoutée
            {manquantes.length > 1 ? "s" : ""} : {manquantes.map((l) => l.libelle).join(", ")}.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Bouton onClick={onConfirmer} disabled={enCours || total <= 0} pleineLargeur>
            {enCours ? "Ajout en cours" : "Remplir mon panier"}
          </Bouton>
          <Bouton variante="secondaire" onClick={onFermer} pleineLargeur>
            Annuler
          </Bouton>
        </div>
      </DialogueContenu>
    </Dialogue>
  );
}
