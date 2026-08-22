import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { chercherMateriaux, type MateriauRef } from "@/lib/donnees/materiaux";
import { listerFamilles } from "@/lib/donnees/categories";
import { LIBELLE_UNITE } from "@/lib/types-metier";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

/**
 * Choix dans la LISTE FERMÉE du référentiel (spec B4, AKORA-DESIGN §10).
 *
 * Le fournisseur ne peut pas créer un matériau : il en choisit un, ou il en
 * demande l'ajout. C'est ce qui rend deux offres du même parpaing comparables,
 * et c'est aussi ce qui tient le périmètre gros œuvre sans le moindre contrôle
 * de saisie — un matériau hors périmètre n'existe tout simplement pas dans la
 * liste.
 */
export function ChoixMateriau({
  choisi,
  onChoisir,
  onDemanderAjout,
}: {
  choisi: MateriauRef | null;
  onChoisir: (materiau: MateriauRef) => void;
  onDemanderAjout: () => void;
}) {
  const [terme, setTerme] = React.useState("");
  const [famille, setFamille] = React.useState<string | null>(null);

  const familles = useQuery({ queryKey: ["familles"], queryFn: listerFamilles, staleTime: 30 * 60_000 });
  const resultats = useQuery({
    queryKey: ["materiaux", terme, famille],
    queryFn: () => chercherMateriaux(terme, famille),
    staleTime: 5 * 60_000,
  });

  if (choisi) {
    return (
      <div className="rounded-md border border-primary bg-primary-soft p-3">
        <p className="text-[0.9375rem] font-semibold text-primary-strong">{choisi.nom}</p>
        <p className="nombres mt-1 text-legende text-primary-strong/90">
          {LIBELLE_UNITE[choisi.unite_defaut]} · {choisi.poids_kg_unite_defaut} kg ·{" "}
          {choisi.volume_m3_unite_defaut} m³ par unité
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-[0.78rem] text-primary-strong/80">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Le nom normalisé et la famille ne sont pas modifiables : c'est ce qui rend votre offre
          comparable à celle des autres dépôts. Le poids et le volume, eux, s'ajustent plus bas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Champ etiquette="Chercher le matériau dans le catalogue commun" aide="Tapez « parpaing », « ciment », « tôle »…">
        {(attributs) => (
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Saisie
              {...attributs}
              value={terme}
              onChange={(e) => setTerme(e.target.value)}
              className="pl-9"
              autoComplete="off"
            />
          </div>
        )}
      </Champ>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setFamille(null)}
          className={cn(
            "min-h-11 shrink-0 rounded-full border px-3 text-legende font-semibold",
            famille === null ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
          )}
        >
          Toutes
        </button>
        {(familles.data ?? []).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFamille(f.id)}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-3 text-legende font-semibold",
              famille === f.id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
            )}
          >
            {f.nom}
          </button>
        ))}
      </div>

      {resultats.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Squelette key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (resultats.data ?? []).length === 0 ? (
        <EtatVide
          titre="Aucun matériau ne correspond"
          phrase="Le catalogue d'Akora est volontairement fermé au gros œuvre. Si votre matériau en fait partie et qu'il manque, demandez son ajout."
          action={
            <Bouton variante="secondaire" onClick={onDemanderAjout}>
              Demander l'ajout d'un matériau
            </Bouton>
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {(resultats.data ?? []).map((materiau) => (
            <li key={materiau.id}>
              <button
                type="button"
                onClick={() => onChoisir(materiau)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
              >
                <span className="text-[0.9375rem]">{materiau.nom}</span>
                <span className="nombres shrink-0 text-[0.78rem] text-muted-foreground">
                  {LIBELLE_UNITE[materiau.unite_defaut]} · {materiau.poids_kg_unite_defaut} kg
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-md bg-muted p-3">
        <p className="text-legende text-muted-foreground">
          Votre matériau n'existe pas encore dans le catalogue commun ? Demandez son ajout : un
          administrateur le crée sous un nom normalisé, et votre produit se rattache tout seul.
        </p>
        <Bouton variante="secondaire" taille="compact" className="mt-2" onClick={onDemanderAjout}>
          Demander l'ajout d'un matériau
        </Bouton>
      </div>
    </div>
  );
}
