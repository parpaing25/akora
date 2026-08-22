import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formaterDistance } from "@/lib/format";
import { LIBELLE_STOCK, type ProduitCarte } from "@/lib/types-metier";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { ImageProduit } from "./ImageProduit";
import { Prix } from "./Prix";
import { Pastille } from "@/components/ui/badge";

/**
 * LA carte produit (AKORA-DESIGN §5). Écrite une fois, réutilisée partout.
 * Ordre imposé : vignette 4:3 → nom → fournisseur + puce de badge →
 * prix gros / unité petit → ligne basse (stock, distance, bouton « + » 44 px).
 *
 * La distance n'apparaît QUE si un point de livraison est fixé : sans
 * coordonnées, on n'estime rien (B6 étape 1).
 */
export function CarteProduit({
  produit,
  onAjouter,
  className,
}: {
  produit: ProduitCarte;
  onAjouter?: (produit: ProduitCarte) => void;
  className?: string;
}) {
  const lien = `/fournisseurs/${produit.fournisseurSlug}/${produit.slug}`;
  const prix = produit.prixPromo ?? produit.prixUnitaire;
  const tonStock =
    produit.stock === "en_stock" ? "succes" : produit.stock === "rupture" ? "danger" : "neutre";

  return (
    <article className={cn("carte carte-vivante flex flex-col overflow-hidden", className)}>
      <Link to={lien} className="block" tabIndex={-1} aria-hidden="true">
        <ImageProduit
          src={produit.photo}
          alt=""
          variante="vignette"
          className="vignette aspect-[4/3] w-full bg-muted object-cover"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="text-produit leading-snug">
          <Link to={lien} className="hover:underline">
            {produit.nomAffiche}
          </Link>
        </h3>

        <p className="flex items-center gap-1.5 text-legende text-muted-foreground">
          <BadgeVerification niveau={produit.fournisseurNiveau} compact />
          <Link to={`/fournisseurs/${produit.fournisseurSlug}`} className="truncate hover:underline">
            {produit.fournisseurNom}
          </Link>
        </p>

        <Prix montant={prix} unite={produit.unite} />

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-col gap-1">
            <Pastille ton={tonStock}>{LIBELLE_STOCK[produit.stock]}</Pastille>
            {produit.distanceKm != null ? (
              <span className="nombres text-[0.78rem] text-muted-foreground">
                à {formaterDistance(produit.distanceKm)}
              </span>
            ) : null}
          </div>

          {onAjouter ? (
            <button
              type="button"
              onClick={() => onAjouter(produit)}
              className="inline-flex cible-44 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow hover:bg-primary/90"
              aria-label={`Ajouter ${produit.nomAffiche} au panier`}
            >
              <Plus className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
