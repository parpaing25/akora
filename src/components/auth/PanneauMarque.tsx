import { Link } from "react-router-dom";
import { LogoAkora } from "@/components/marque/LogoAkora";
import { IllustrationCamion } from "@/components/motion/IllustrationCamion";

/**
 * Le panneau latérite des pages d'authentification.
 *
 * Écrit ici une fois : inscription et connexion partagent la même promesse, et
 * deux copies auraient divergé au premier changement de formulation. Il dit ce
 * qu'un compte apporte — les numéros des fournisseurs vérifiés, le paiement
 * mobile money, le séquestre — parce qu'un formulaire sans raison d'être se
 * fait abandonner.
 *
 * Sur mobile, il devient un en-tête compact : la place vaut trop cher pour un
 * argumentaire au-dessus des champs.
 */

export const ETAPES: [string, string][] = [
  ["Comparez au prix rendu", "Matériau + livraison calculée depuis votre adresse de chantier."],
  ["Commandez chez un fournisseur vérifié", "NIF, STAT, RCS et dépôt contrôlés par Akora."],
  [
    "Payez, l'argent reste en séquestre",
    "Libéré au fournisseur seulement après votre confirmation de livraison.",
  ],
];

export function PanneauMarque({
  titre,
  intro,
  avecEtapes = true,
}: {
  titre: string;
  intro: string;
  avecEtapes?: boolean;
}) {
  return (
    <aside className="flex flex-col justify-between bg-primary px-10 py-9 text-primary-foreground">
      <div>
        <Link to="/" className="mb-11 flex items-center gap-3" aria-label="Akora — accueil">
          <LogoAkora sombre alt="" className="size-[34px]" />
          <span className="text-[1.375rem] font-bold tracking-tight">AKORA</span>
        </Link>
        <h2 className="mb-3.5 max-w-[340px] text-[2.125rem] font-bold leading-[1.12] tracking-tight">
          {titre}
        </h2>
        <p className="max-w-[330px] text-[0.96875rem] leading-relaxed text-primary-foreground">
          {intro}
        </p>
      </div>

      {avecEtapes ? (
        <ol className="my-10 space-y-4">
          {/* ⭐ Le camion roule pendant qu'on lit les trois promesses : le
              geste du produit, sur la page où l'on décide de le rejoindre.
              Sans chiffre — un prix d'exemple serait un mensonge (A2.8). */}
          <li aria-hidden="true" className="mb-2">
            <IllustrationCamion categorie="camion" anime couleur="rgba(255,255,255,0.92)" className="h-16 w-auto" />
          </li>
          {ETAPES.map(([titreEtape, aide], index) => (
            <li key={titreEtape} className="flex gap-3.5">
              <span className="nombres flex size-6 shrink-0 items-center justify-center rounded-full bg-black/15 text-[0.78rem] font-bold">
                {index + 1}
              </span>
              <span>
                <span className="block text-[0.9375rem] font-semibold">{titreEtape}</span>
                <span className="block text-legende leading-snug text-primary-foreground">
                  {aide}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div aria-hidden="true" />
      )}

      <p className="border-t border-white/25 pt-4 text-legende text-primary-foreground">
        Aucune carte bancaire. Mobile money uniquement.
      </p>
    </aside>
  );
}

/** Version mobile : bandeau latérite au-dessus du formulaire. */
export function BandeauMarque({
  surtitre,
  titre,
  intro,
  action,
}: {
  surtitre?: string;
  titre: string;
  intro: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="bg-primary px-5 pb-7 pt-6 text-primary-foreground">
      <div className="mb-7 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Akora — accueil">
          <LogoAkora sombre alt="" className="size-7" />
          <span className="text-[1.125rem] font-bold tracking-tight">AKORA</span>
        </Link>
        {action}
      </div>
      {surtitre ? (
        <p className="nombres mb-1.5 text-[0.75rem] tracking-[0.1em] text-primary-foreground">
          {surtitre}
        </p>
      ) : null}
      <h1 className="mb-2 text-[1.5625rem] font-bold leading-tight tracking-tight">{titre}</h1>
      <p className="text-courant leading-relaxed text-primary-foreground">{intro}</p>
    </header>
  );
}
