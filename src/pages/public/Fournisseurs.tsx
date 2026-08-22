import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Star } from "lucide-react";
import { Seo, filAriane } from "@/components/Seo";
import { listerFournisseurs, PAR_PAGE, type FournisseurPublic } from "@/lib/donnees/vitrine";
import { formaterNote } from "@/lib/format";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { Carte } from "@/components/ui/card";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { LigneCase } from "@/components/ui/checkbox";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";

/** Annuaire des fournisseurs. Lecture via la vue publique, sans aucune PII. */
export default function Fournisseurs() {
  const [recherche, setRecherche] = React.useState("");
  const [verifiesUniquement, setVerifies] = React.useState(false);
  const [page, setPage] = React.useState(0);

  React.useEffect(() => setPage(0), [recherche, verifiesUniquement]);

  const fournisseurs = useQuery({
    queryKey: ["fournisseurs", recherche, verifiesUniquement, page],
    queryFn: () => listerFournisseurs({ recherche, verifiesUniquement, page }),
    staleTime: 2 * 60_000,
  });

  return (
    <div className="container py-6">
      <Seo
        titre="Fournisseurs de matériaux"
        chemin="/fournisseurs"
        description="Dépôts, briqueteries, carrières et scieries vérifiés à Madagascar."
        donneesStructurees={filAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Fournisseurs", chemin: "/fournisseurs" },
        ])}
      />

      <h1 className="text-page">Fournisseurs</h1>
      <p className="mt-1 max-w-prose text-legende text-muted-foreground">
        Le badge bleu n'est pas décoratif : il veut dire que la carte fiscale, la carte
        statistique, le registre du commerce, la pièce du gérant et une photo du dépôt ont été
        examinés.{" "}
        <Link to="/verification" className="lien-souligne">
          Ce que ça veut dire exactement
        </Link>
        .
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="recherche-fournisseurs" className="text-legende font-semibold">
            Chercher un dépôt
          </label>
          <div className="relative mt-1.5">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Saisie
              id="recherche-fournisseurs"
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom du dépôt"
              className="pl-9"
            />
          </div>
        </div>
        <LigneCase
          id="verifies-uniquement"
          etiquette="Fournisseurs vérifiés uniquement"
          checked={verifiesUniquement}
          onCheckedChange={(c) => setVerifies(c === true)}
        />
      </div>

      <div aria-live="polite" className="mt-5">
        {fournisseurs.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Squelette key={i} className="h-36 w-full" />
            ))}
          </div>
        ) : fournisseurs.isError ? (
          <EtatErreur onReessayer={() => void fournisseurs.refetch()} />
        ) : fournisseurs.data.length === 0 ? (
          <EtatVide
            titre="Aucun fournisseur ne correspond"
            phrase={verifiesUniquement ? "Essayez sans le filtre « vérifiés uniquement »." : "Essayez un autre nom."}
            action={
              verifiesUniquement ? (
                <Bouton variante="secondaire" onClick={() => setVerifies(false)}>
                  Voir aussi les non vérifiés
                </Bouton>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fournisseurs.data.map((f) => (
                <li key={f.id as string}>
                  <CarteFournisseur fournisseur={f} />
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center justify-between gap-2">
              <Bouton variante="secondaire" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Précédent
              </Bouton>
              <span className="nombres text-legende text-muted-foreground">Page {page + 1}</span>
              <Bouton
                variante="secondaire"
                disabled={fournisseurs.data.length < PAR_PAGE}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </Bouton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CarteFournisseur({ fournisseur }: { fournisseur: FournisseurPublic }) {
  const note = fournisseur.note_moyenne == null ? null : Number(fournisseur.note_moyenne);
  return (
    <Carte className="flex h-full flex-col p-3">
      <div className="flex items-start gap-3">
        {fournisseur.logo_url ? (
          <img
            src={fournisseur.logo_url as string}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-md border border-border object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div aria-hidden="true" className="size-12 shrink-0 rounded-md bg-muted" />
        )}
        <div className="min-w-0">
          <h2 className="text-produit leading-snug">
            <Link to={`/fournisseurs/${fournisseur.slug}`} className="hover:underline">
              {fournisseur.raison_sociale as string}
            </Link>
          </h2>
          <div className="mt-1">
            <BadgeVerification
              niveau={fournisseur.niveau_verification as never}
              verifieLe={fournisseur.verifie_le as string | null}
            />
          </div>
        </div>
      </div>

      {fournisseur.description ? (
        <p className="mt-2 line-clamp-2 text-legende text-muted-foreground">
          {fournisseur.description as string}
        </p>
      ) : null}

      <div className="mt-auto flex items-center gap-3 pt-2 text-[0.78rem] text-muted-foreground">
        {note != null ? (
          <span className="nombres inline-flex items-center gap-1">
            <Star className="size-3.5 text-accent" aria-hidden="true" />
            {formaterNote(note)} ({String(fournisseur.nb_avis)})
          </span>
        ) : (
          <span>Pas encore d'avis</span>
        )}
        <span className="nombres">Livre jusqu'à {String(fournisseur.rayon_max_km)} km</span>
      </div>
    </Carte>
  );
}
