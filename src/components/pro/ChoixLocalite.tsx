import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { chercherLocalites, type Localite } from "@/lib/donnees/localites";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Recherche de commune dans la table `localites` (règle A2.3 : pas de
 * géocodeur externe). Une localité sans coordonnées est proposée quand même,
 * mais annoncée comme telle : elle ne permettra pas de calculer une distance.
 */
export function ChoixLocalite({
  valeur,
  onChange,
  etiquette = "Commune",
  aide = "Tapez les premières lettres. La liste vient de la base Akora.",
}: {
  valeur: string | null;
  onChange: (localite: Localite | null) => void;
  etiquette?: string;
  aide?: string;
}) {
  const [terme, setTerme] = React.useState("");
  const [choisie, setChoisie] = React.useState<Localite | null>(null);
  const [ouvert, setOuvert] = React.useState(false);

  const resultats = useQuery({
    queryKey: ["localites", terme],
    queryFn: () => chercherLocalites(terme),
    enabled: ouvert && terme.trim().length >= 2,
    staleTime: 10 * 60_000,
  });

  React.useEffect(() => {
    if (!valeur) setChoisie(null);
  }, [valeur]);

  return (
    <div className="relative">
      <Champ etiquette={etiquette} aide={choisie ? undefined : aide}>
        {(attributs) => (
          <Saisie
            {...attributs}
            value={choisie ? choisie.nom : terme}
            onChange={(e) => {
              setChoisie(null);
              onChange(null);
              setTerme(e.target.value);
              setOuvert(true);
            }}
            onFocus={() => setOuvert(true)}
            placeholder="Antananarivo, Toamasina…"
            autoComplete="off"
            role="combobox"
            aria-expanded={ouvert}
          />
        )}
      </Champ>

      {choisie && choisie.lat == null ? (
        <p className="mt-1 text-[0.78rem] text-accent-strong">
          Cette commune n'a pas encore de coordonnées : la distance ne sera pas calculable depuis
          elle. Pointez votre position sur la carte ci-dessous.
        </p>
      ) : null}

      {ouvert && terme.trim().length >= 2 && !choisie ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow"
        >
          {resultats.isPending ? (
            <li className="px-3 py-2 text-legende text-muted-foreground">Recherche…</li>
          ) : (resultats.data ?? []).length === 0 ? (
            <li className="px-3 py-2 text-legende text-muted-foreground">Aucune commune trouvée.</li>
          ) : (
            (resultats.data ?? []).map((localite) => (
              <li key={localite.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setChoisie(localite);
                    onChange(localite);
                    setOuvert(false);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-[0.9375rem] hover:bg-muted",
                  )}
                >
                  <span>{localite.nom}</span>
                  <span className="text-[0.78rem] text-muted-foreground">
                    {localite.lat == null ? "sans coordonnées" : localite.type}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
