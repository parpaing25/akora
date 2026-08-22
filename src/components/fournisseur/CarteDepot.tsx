import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import type { DepotAnnuaire } from "@/lib/donnees/annuaire";
import { initiales } from "@/lib/donnees/annuaire";
import { formaterAriary } from "@/lib/format";
import { BadgeVerification } from "@/components/marque/BadgeVerification";

/**
 * Une carte de l'annuaire.
 *
 * La carte ENTIERE est le lien, pas seulement le nom : sur un telephone, viser
 * un nom de trois centimetres au milieu d'une carte de dix, c'est rater une
 * fois sur deux. Un seul <a> englobant, donc — et les elements interactifs
 * qu'il contiendrait seraient invalides, ce qui interdit un bouton « Suivre »
 * ici. Il vit sur la fiche du depot.
 *
 * Elle dit trois choses qu'on ne trouve nulle part ailleurs reunies : ce que
 * le depot vend, a partir de combien, et jusqu'ou il livre.
 */
export function CarteDepot({ depot }: { depot: DepotAnnuaire }) {
  const familles = depot.familles.slice(0, 2);
  const reste = depot.nb_produits;

  return (
    <Link
      to={`/fournisseurs/${depot.slug}`}
      className="carte carte-cliquable flex flex-col overflow-hidden p-0"
    >
      <div className="relative aspect-[16/9] w-full bg-muted">
        {depot.photo_depot ? (
          <img
            src={depot.photo_depot}
            alt=""
            loading="lazy"
            decoding="async"
            width={480}
            height={270}
            className="vignette size-full object-cover"
          />
        ) : null}
        <span className="absolute right-2 top-2">
          <BadgeVerification niveau={depot.niveau_verification} />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="nombres flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-courant font-bold text-primary-foreground"
          >
            {initiales(depot.raison_sociale)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-produit text-foreground">{depot.raison_sociale}</p>
            <p className="truncate text-legende text-muted-foreground">
              {[depot.metier, depot.localite_nom].filter(Boolean).join(" · ")}
              {depot.distance_km != null ? (
                <>
                  {" · "}
                  <span className="nombres">
                    {depot.distance_km.toFixed(1).replace(".", ",")} km
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <ul className="flex flex-wrap gap-1.5">
          {familles.map((famille) => (
            <li
              key={famille}
              className="rounded-full border border-border px-2 py-0.5 text-[0.72rem] text-muted-foreground"
            >
              {famille}
            </li>
          ))}
          {reste > 0 ? (
            <li className="nombres rounded-full border border-border px-2 py-0.5 text-[0.72rem] text-muted-foreground">
              {reste} produit{reste > 1 ? "s" : ""}
            </li>
          ) : null}
        </ul>

        {depot.produit_phare ? (
          <div className="flex items-end justify-between gap-3 rounded-md bg-muted px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[0.72rem] text-muted-foreground">
                {depot.produit_phare.nom} dès
              </p>
              <p className="nombres text-produit">
                {formaterAriary(depot.produit_phare.prix)}
                <span className="text-legende font-normal text-muted-foreground">
                  {" "}
                  / {depot.produit_phare.unite}
                </span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[0.72rem] text-muted-foreground">Livre jusqu'à</p>
              <p className="nombres text-produit">{depot.rayon_max_km} km</p>
            </div>
          </div>
        ) : (
          <p className="rounded-md bg-muted px-3 py-2.5 text-legende text-muted-foreground">
            Aucun produit publié pour l'instant.
          </p>
        )}

        <p className="pied -mx-4 -mb-4 mt-auto flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-legende">
          <span className="text-muted-foreground">
            {depot.nb_avis > 0 ? (
              <>
                <Star size={13} className="mr-1 inline text-accent" aria-hidden="true" />
                <span className="nombres">
                  {Number(depot.note_moyenne).toFixed(1).replace(".", ",")}
                </span>{" "}
                · <span className="nombres">{depot.nb_avis}</span> avis
              </>
            ) : (
              "Pas encore d'avis"
            )}
          </span>
          <span className="flex items-center gap-1 font-semibold text-primary">
            Voir le dépôt
            <ArrowRight size={14} className="fleche" aria-hidden="true" />
          </span>
        </p>
      </div>
    </Link>
  );
}
