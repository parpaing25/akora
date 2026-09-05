import { Link } from "react-router-dom";
import { getThumbUrl } from "@/components/produit/ImageProduit";
import { Heart, Truck } from "lucide-react";
import type { Publication } from "@/lib/donnees/fil";
import { BoutonSuivre } from "@/components/fil/BoutonSuivre";
import { RevelerContact } from "@/components/marque/RevelerContact";
import { useLivraisonUnique } from "@/hooks/useLivraison";
import { usePointLivraison } from "@/lib/point-livraison";
import { formaterAriary } from "@/lib/format";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { LogoAkora } from "@/components/marque/LogoAkora";
import { Visionneuse, useVisionneuse } from "@/components/ui/visionneuse";
import { RouteLivraison } from "@/components/motion/RouteLivraison";

/**
 * Une publication du fil.
 *
 * Le prix rendu chantier est calculé ICI, pour la quantité de référence du
 * produit, et non au dépôt : c'est la promesse d'Akora, et la seule manière de
 * comparer deux dépôts honnêtement. Le calcul est pur (`src/lib/livraison`) et
 * ne fait aucun appel réseau — seuls les barèmes du dépôt sont chargés, et
 * react-query les partage entre toutes les cartes du même fournisseur.
 */

/** Depuis quand, en clair. L'heure ronde suffit sur un chantier. */
function depuis(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 1440) return `il y a ${Math.round(minutes / 60)} h`;
  const jours = Math.round(minutes / 1440);
  if (jours <= 7) return `il y a ${jours} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? "")
    .join("");
}

export function CartePublication({ publication }: { publication: Publication }) {
  if (publication.type === "prix_marche") return <PostPrixMarche publication={publication} />;
  if (publication.type === "demande") return <PostDemande publication={publication} />;
  return <PostFournisseur publication={publication} />;
}

/* ── Publication d'un dépôt ─────────────────────────────────────────────── */

function PostFournisseur({ publication }: { publication: Publication }) {
  const { point } = usePointLivraison();
  const produit = publication.produits[0];
  const visionneuse = useVisionneuse(publication.photos);

  // Quantité de référence : celle que le dépôt exige au minimum. Afficher un
  // prix rendu pour une quantité que personne ne peut commander serait un
  // chiffre décoratif.
  const quantite = produit ? Math.max(produit.quantite_min, 1) : 0;

  const livraison = useLivraisonUnique(
    produit && publication.fournisseur_id
      ? {
          fournisseurId: publication.fournisseur_id,
          rayonMaxKm: publication.fournisseur_rayon_max_km ?? 0,
          coefSinuosite: publication.fournisseur_coef_sinuosite,
          depart:
            publication.fournisseur_lat != null && publication.fournisseur_lng != null
              ? { lat: publication.fournisseur_lat, lng: publication.fournisseur_lng }
              : null,
          lignes: [
            {
              quantite,
              poids_kg_unite: produit.poids_kg_unite,
              volume_m3_unite: produit.volume_m3_unite,
            },
          ],
          montantProduits: (produit.prix_promo ?? produit.prix_unitaire) * quantite,
        }
      : null,
  );

  const prixUnitaire = produit ? (produit.prix_promo ?? produit.prix_unitaire) : 0;
  const montantProduits = prixUnitaire * quantite;
  const coutLivraison =
    livraison?.statut === "estimee" ? livraison.cout : livraison?.statut === "offerte" ? 0 : null;
  const rendu = coutLivraison === null ? null : montantProduits + coutLivraison;

  return (
    <article className="carte carte-vivante overflow-hidden p-0">
      <header className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-[0.9375rem] font-bold text-primary-foreground"
        >
          {initiales(publication.fournisseur_nom ?? "?")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* ⚠ Le nom du dépôt est LA cible de la carte : 22 px de haut, il
                se ratait au pouce. 44 px, sans changer la ligne. */}
            <Link
              to={`/fournisseurs/${publication.fournisseur_slug}`}
              className="inline-flex min-h-11 items-center text-produit text-foreground"
            >
              {publication.fournisseur_nom}
            </Link>
            <BadgeVerification niveau={publication.fournisseur_niveau ?? "non_verifie"} compact />
          </div>
          <p className="mt-0.5 text-legende text-muted-foreground">
            {publication.localite_nom ?? "Madagascar"}
            {livraison?.statut === "estimee" || livraison?.statut === "offerte"
              ? ` · ${livraison.detail.distanceRouteKm.toFixed(1).replace(".", ",")} km`
              : ""}{" "}
            · {depuis(publication.publie_le)}
          </p>
        </div>
        {publication.fournisseur_id ? (
          <BoutonSuivre
            fournisseurId={publication.fournisseur_id}
            suiviInitial={publication.suivi}
          />
        ) : null}
      </header>

      <p className="whitespace-pre-line px-4 pb-3 text-courant">{publication.texte}</p>

      {publication.photos.length > 0 ? (
        <div className={publication.photos.length > 1 ? "grid grid-cols-2 gap-0.5" : ""}>
          {publication.photos.slice(0, 2).map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => visionneuse.ouvrir(index)}
              aria-label={`Agrandir la photo ${index + 1}`}
              className="block cursor-zoom-in"
            >
              <img
                src={getThumbUrl(url) ?? url}
                srcSet={getThumbUrl(url) !== url ? `${getThumbUrl(url)} 480w, ${url} 1200w` : undefined}
                sizes={publication.photos.length > 1 ? "(min-width: 1024px) 300px, 50vw" : "(min-width: 1024px) 600px, 100vw"}
                onError={(e) => {
                  if (e.currentTarget.src !== url) e.currentTarget.src = url;
                }}
                alt=""
                loading="lazy"
                decoding="async"
                width={publication.photos.length > 1 ? 400 : 800}
                height={publication.photos.length > 1 ? 300 : 450}
                className={
                  "vignette " +
                  (publication.photos.length > 1
                    ? "aspect-[4/3] w-full bg-muted object-cover"
                    : "aspect-[16/9] w-full bg-muted object-cover")
                }
              />
            </button>
          ))}
        </div>
      ) : null}

      {produit ? (
        <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-produit">{produit.nom_affiche}</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <span className="nombres text-[1.375rem] font-bold">{formaterAriary(prixUnitaire)}</span>
              <span className="text-legende text-muted-foreground">/ {produit.unite} au dépôt</span>
              {produit.prix_promo ? (
                <span className="nombres text-legende text-muted-foreground line-through">
                  {formaterAriary(produit.prix_unitaire)}
                </span>
              ) : null}
            </p>
          </div>
          {/* V2 : le camion roule du dépôt au chantier, puis le prix rendu
              apparaît. Sans point de livraison, pas de trajet — on n'invente
              rien, on le dit. */}
          {rendu !== null ? (
            <RouteLivraison
              variante="ligne"
              depart={publication.localite_nom ?? "dépôt"}
              arrivee={point?.libelle ?? "mon chantier"}
              distanceKm={
                livraison?.statut === "estimee" || livraison?.statut === "offerte"
                  ? livraison.detail.distanceRouteKm
                  : null
              }
              montant={rendu}
              legende={`${quantite} ${produit.unite}, livrés${livraison?.statut === "offerte" ? " · livraison offerte" : ""}`}
            />
          ) : (
            <p className="text-legende text-muted-foreground">
              {livraison?.statut === "retrait_sur_place"
                ? "Ce dépôt n'a pas encore déclaré de camion : retrait sur place, ou livraison à convenir avec lui."
                : !point
                  ? "Indiquez où livrer pour voir le prix rendu à votre chantier."
                  : livraison?.statut === "hors_zone"
                    ? "Hors zone de livraison — à négocier avec le dépôt."
                    : "Prix rendu en cours de calcul."}
            </p>
          )}
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center gap-2 px-4 pb-3.5 pt-2.5">
        {produit ? (
          <Link
            to={`/fournisseurs/${publication.fournisseur_slug}/${produit.slug}`}
            className="cible-44 flex items-center rounded-md bg-primary px-4 text-courant font-bold text-primary-foreground"
          >
            Voir le produit
          </Link>
        ) : null}
        <Link
          to={`/fournisseurs/${publication.fournisseur_slug}/livraison`}
          className="cible-44 flex items-center gap-2 rounded-md border border-border px-3.5 text-courant font-semibold"
        >
          <Truck size={16} aria-hidden="true" /> Simuler la livraison
        </Link>
        {/* « Appeler » revele le numero ici meme : renvoyer vers une autre page
            pour un bouton qui annonce un appel, c'est mentir sur l'etiquette. */}
        {publication.fournisseur_id ? (
          <RevelerContact fournisseurId={publication.fournisseur_id} />
        ) : null}
      </footer>

      <Visionneuse
        photos={publication.photos}
        index={visionneuse.index}
        ouvert={visionneuse.ouvert}
        onFermer={visionneuse.fermer}
        onIndex={visionneuse.changer}
        legende={publication.fournisseur_nom ?? undefined}
      />
    </article>
  );
}

/* ── Publication d'Akora : les prix du marché ───────────────────────────── */

function PostPrixMarche({ publication }: { publication: Publication }) {
  return (
    <article className="rounded-lg bg-foreground p-4 text-background">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <LogoAkora sombre className="size-5" />
        <span className="text-courant font-semibold">Akora · prix du marché</span>
        <span className="text-legende text-background/60">{depuis(publication.publie_le)}</span>
      </div>
      <p className="mb-3.5 text-produit">{publication.texte}</p>
      {publication.produits.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto lg:grid lg:grid-cols-3 lg:overflow-visible">
          {publication.produits.map((mediane) => (
            <div key={mediane.id} className="shrink-0 rounded-md bg-background/10 px-3.5 py-3">
              <p className="text-legende text-background/75">{mediane.nom_affiche}</p>
              <p className="nombres mt-0.5 text-[1.25rem] font-bold">
                {formaterAriary(mediane.prix_unitaire)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3.5 text-legende text-background/60">
        Publié seulement à partir de trois offres actives.
      </p>
    </article>
  );
}

/* ── Demande d'un acheteur ──────────────────────────────────────────────── */

function PostDemande({ publication }: { publication: Publication }) {
  return (
    <article className="rounded-lg border border-dashed border-border bg-card p-4">
      <header className="mb-2.5 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-legende font-bold"
        >
          <Heart size={16} />
        </span>
        <div className="flex-1">
          <p className="text-produit">Demande · {publication.localite_nom ?? "Madagascar"}</p>
          <p className="text-legende text-muted-foreground">{depuis(publication.publie_le)}</p>
        </div>
        <span className="nombres shrink-0 rounded-full bg-muted px-2.5 py-1 text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Devis ouvert
        </span>
      </header>
      <p className="mb-3 whitespace-pre-line text-courant">{publication.texte}</p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/pro/demandes"
          className="cible-44 inline-flex items-center rounded-md bg-primary px-4 text-courant font-bold text-primary-foreground"
        >
          Proposer mon prix
        </Link>
        <Link
          to="/demandes/nouvelle"
          className="cible-44 inline-flex items-center rounded-md border border-foreground px-4 text-courant font-semibold"
        >
          Je cherche aussi…
        </Link>
      </div>
    </article>
  );
}
