import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Seo } from "@/components/Seo";
import {
  grouperParFournisseur,
  totalLignePanier,
  totalProduits,
  usePanier,
  type GroupeFournisseur,
} from "@/lib/panier";
import { listerFournisseursParIds } from "@/lib/donnees/vitrine";
import { commandesInvitees } from "@/lib/donnees/commandes";
import { formaterDateHeure } from "@/lib/format";
import { useLivraison } from "@/hooks/useLivraison";
import { formaterAriary } from "@/lib/format";
import { LIBELLE_UNITE } from "@/lib/types-metier";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { ImageProduit } from "@/components/produit/ImageProduit";
import { SimulateurLivraison } from "@/components/livraison/SimulateurLivraison";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { EtatVide } from "@/components/ui/etats";

/**
 * Panier multi-fournisseurs (spec B8).
 *
 * Il se lit déjà comme il se validera : un bloc par fournisseur, chacun avec
 * sa propre livraison. À la commande, chaque bloc devient une commande à part
 * entière — il n'y a pas de surprise au dernier écran.
 */
export default function Panier() {
  const lignes = usePanier((e) => e.lignes);
  const definirQuantite = usePanier((e) => e.definirQuantite);
  const retirer = usePanier((e) => e.retirer);
  const viderFournisseur = usePanier((e) => e.viderFournisseur);

  const groupes = React.useMemo(() => grouperParFournisseur(lignes), [lignes]);

  // Coordonnées des dépôts : le panier ne les mémorise pas, on les relit —
  // CEUX DU PANIER, pas une page d'annuaire qui pouvait ne pas les contenir.
  const fournisseurs = useQuery({
    queryKey: ["fournisseurs-panier", groupes.map((g) => g.fournisseurId).join(",")],
    queryFn: () => listerFournisseursParIds(groupes.map((g) => g.fournisseurId)),
    enabled: groupes.length > 0,
    staleTime: 5 * 60_000,
  });

  const parId = new Map((fournisseurs.data ?? []).map((f) => [f.id as string, f]));

  const entrees = groupes.map((groupe) => {
    const f = parId.get(groupe.fournisseurId);
    return {
      fournisseurId: groupe.fournisseurId,
      rayonMaxKm: Number(f?.rayon_max_km ?? 40),
      coefSinuosite: f?.coef_sinuosite == null ? null : Number(f.coef_sinuosite),
      depart: f?.lat == null || f.lng == null ? null : { lat: Number(f.lat), lng: Number(f.lng) },
      lignes: groupe.lignes.map((l) => ({
        quantite: l.quantite,
        poids_kg_unite: l.poidsKgUnite,
        volume_m3_unite: l.volumeM3Unite,
      })),
      montantProduits: groupe.montantProduits,
    };
  });

  const livraisons = useLivraison(entrees);

  const totalMateriaux = totalProduits(lignes);
  const totalLivraison = groupes.reduce((somme, groupe) => {
    const l = livraisons.get(groupe.fournisseurId);
    return somme + (l?.statut === "estimee" ? l.cout : 0);
  }, 0);
  const toutEstimable = groupes.every((g) => {
    const l = livraisons.get(g.fournisseurId);
    return l?.statut === "estimee" || l?.statut === "offerte";
  });

  if (lignes.length === 0) {
    return (
      <div className="container py-10">
        <Seo titre="Panier" chemin="/panier" indexable={false} />
        <h1 className="text-page">Panier</h1>
        <div className="mt-5">
          <EtatVide
            titre="Votre panier est vide"
            phrase="Comparez d'abord les fournisseurs au prix rendu chantier : c'est là que se joue la différence."
            action={
              <Bouton asChild>
                <Link to="/materiaux">Voir les matériaux</Link>
              </Bouton>
            }
          />
          <CommandesInvitees />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <Seo titre="Panier" chemin="/panier" indexable={false} />
      <h1 className="text-page">Panier</h1>
      <p className="mt-1 text-legende text-muted-foreground">
        <span className="nombres">{groupes.length}</span> fournisseur{groupes.length > 1 ? "s" : ""} ·{" "}
        <span className="nombres">{lignes.length}</span> ligne{lignes.length > 1 ? "s" : ""}. Chaque
        fournisseur donnera une commande séparée, avec sa propre livraison.
      </p>

      <div className="mt-4">
        <SelecteurPoint />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {groupes.map((groupe) => (
            <GroupePanier
              key={groupe.fournisseurId}
              groupe={groupe}
              livraison={livraisons.get(groupe.fournisseurId) ?? null}
              onQuantite={definirQuantite}
              onRetirer={retirer}
              onVider={viderFournisseur}
            />
          ))}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Carte className="p-4">
            <h2 className="text-produit">Total général</h2>
            <dl className="mt-3 space-y-1.5 text-legende" aria-live="polite">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Matériaux</dt>
                <dd className="nombres font-semibold">{formaterAriary(totalMateriaux)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Livraisons</dt>
                <dd className="nombres font-semibold">
                  {toutEstimable ? formaterAriary(totalLivraison) : "à confirmer"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-border pt-1.5 text-[1.0625rem]">
                <dt className="font-semibold">À payer</dt>
                <dd className="nombres font-bold text-primary">
                  {formaterAriary(totalMateriaux + totalLivraison)}
                </dd>
              </div>
            </dl>

            {!toutEstimable ? (
              <p className="mt-2 rounded-md bg-accent-soft px-2.5 py-1.5 text-[0.78rem] text-accent-strong">
                Une livraison au moins n'est pas chiffrable : le total ne la contient pas encore.
              </p>
            ) : null}

            <Bouton asChild className="mt-3" pleineLargeur>
              <Link to="/commander">Commander</Link>
            </Bouton>
            <Bouton asChild variante="fantome" className="mt-1" pleineLargeur>
              <Link to="/materiaux">Continuer mes achats</Link>
            </Bouton>
          </Carte>
        </aside>
      </div>
    </div>
  );
}

function GroupePanier({
  groupe,
  livraison,
  onQuantite,
  onRetirer,
  onVider,
}: {
  groupe: GroupeFournisseur;
  livraison: ReturnType<typeof useLivraison> extends Map<string, infer R> ? R | null : never;
  onQuantite: (produitId: string, quantite: number) => void;
  onRetirer: (produitId: string) => void;
  onVider: (fournisseurId: string) => void;
}) {
  const sousTotal =
    groupe.montantProduits + (livraison?.statut === "estimee" ? livraison.cout : 0);

  return (
    <Carte className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-produit">
          <BadgeVerification niveau={groupe.fournisseurNiveau} compact />
          <Link to={"/fournisseurs/" + groupe.fournisseurSlug} className="hover:underline">
            {groupe.fournisseurNom}
          </Link>
        </h2>
        <Bouton
          variante="fantome"
          taille="compact"
          className="text-destructive-strong"
          onClick={() => onVider(groupe.fournisseurId)}
        >
          Vider ce fournisseur
        </Bouton>
      </div>

      <ul className="mt-3 divide-y divide-border">
        {groupe.lignes.map((ligne) => (
          <li key={ligne.produitId} className="flex gap-3 py-3">
            <Link to={"/fournisseurs/" + ligne.fournisseurSlug + "/" + ligne.slug} className="shrink-0">
              <ImageProduit
                src={ligne.photo}
                alt=""
                className="size-16 rounded-xs border border-border bg-muted object-cover"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-semibold leading-snug">
                <Link
                  to={"/fournisseurs/" + ligne.fournisseurSlug + "/" + ligne.slug}
                  className="hover:underline"
                >
                  {ligne.nomAffiche}
                </Link>
              </p>
              <p className="nombres mt-0.5 text-[0.78rem] text-muted-foreground">
                {formaterAriary(ligne.prixUnitaire)} / {LIBELLE_UNITE[ligne.unite]}
              </p>

              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={"Diminuer la quantité de " + ligne.nomAffiche}
                    className="inline-flex size-9 items-center justify-center rounded-xs border border-border hover:bg-muted"
                    onClick={() => onQuantite(ligne.produitId, Math.max(ligne.quantiteMin, ligne.quantite - 1))}
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <label htmlFor={"qte-" + ligne.produitId} className="sr-only">
                    Quantité de {ligne.nomAffiche}
                  </label>
                  <input
                    id={"qte-" + ligne.produitId}
                    type="number"
                    inputMode="numeric"
                    min={ligne.quantiteMin}
                    value={ligne.quantite}
                    onChange={(e) => onQuantite(ligne.produitId, Number(e.target.value) || ligne.quantiteMin)}
                    className="nombres h-9 w-20 rounded-xs border border-input bg-card px-2 text-center"
                  />
                  <button
                    type="button"
                    aria-label={"Augmenter la quantité de " + ligne.nomAffiche}
                    className="inline-flex size-9 items-center justify-center rounded-xs border border-border hover:bg-muted"
                    onClick={() => onQuantite(ligne.produitId, ligne.quantite + 1)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <span className="nombres ml-auto font-semibold">{formaterAriary(totalLignePanier(ligne))}</span>
                <button
                  type="button"
                  aria-label={"Retirer " + ligne.nomAffiche + " du panier"}
                  className="inline-flex size-9 items-center justify-center rounded-xs text-destructive-strong hover:bg-muted"
                  onClick={() => onRetirer(ligne.produitId)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {livraison ? <SimulateurLivraison resultat={livraison} className="mt-3" /> : null}

      <p className="mt-3 flex items-baseline justify-between gap-2 border-t border-border pt-3">
        <span className="font-semibold">Sous-total chez ce fournisseur</span>
        <span className="nombres text-[1.0625rem] font-bold text-primary">{formaterAriary(sousTotal)}</span>
      </p>
    </Carte>
  );
}

/**
 * Les commandes passées SANS compte depuis ce navigateur (audit F-01) : le lien
 * porte le jeton de suivi, seule preuve de propriété. Rien n'est lu en base ici.
 */
function CommandesInvitees() {
  const liste = React.useMemo(() => commandesInvitees(), []);
  if (liste.length === 0) return null;
  return (
    <Carte className="mt-4 p-4">
      <h2 className="text-produit">Vos dernières commandes sur ce téléphone</h2>
      <ul className="mt-2 divide-y divide-border text-legende">
        {liste.map((c) => (
          <li key={c.numero} className="flex items-center justify-between gap-2 py-2">
            <span>
              <span className="nombres font-mono font-semibold">{c.numero}</span>
              <span className="text-muted-foreground"> · {formaterDateHeure(c.le)}</span>
            </span>
            <Link to={"/commande/" + c.numero + "?j=" + c.jeton} className="lien-souligne inline-block py-2.5">
              Suivre
            </Link>
          </li>
        ))}
      </ul>
    </Carte>
  );
}
