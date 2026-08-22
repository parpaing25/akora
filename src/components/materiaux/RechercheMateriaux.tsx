import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import {
  cheminResultat,
  rechercherReferentiel,
  type NatureResultat,
  type ResultatRecherche,
} from "@/lib/donnees/referentiel";
import { formaterAriary } from "@/lib/format";
import { Squelette } from "@/components/ui/skeleton";

/**
 * Recherche avec aide a l'ecriture dans le referentiel.
 *
 * « hou » propose d'abord le TYPE Hourdis — les six formats d'un coup — puis
 * les formats un par un. L'ordre vient de la base ; ici on ne fait que
 * l'afficher.
 *
 * Insensible aux accents et a la casse, tolerante a la faute de frappe, et
 * elle comprend le malgache : on demande des « biriky » sur un chantier, pas
 * des « parpaings creux ».
 */
const DELAI_FRAPPE_MS = 160;
const MINIMUM = 2;

const ETIQUETTE: Record<NatureResultat, string> = {
  type: "Type",
  format: "Format",
  famille: "Famille",
};

/** Meme normalisation que la base, pour surligner au bon endroit. */
function normaliser(valeur: string): string {
  return valeur
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[×x*]/g, "x")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function decouper(titre: string, requete: string): [string, string, string] {
  const cible = normaliser(titre);
  const terme = normaliser(requete).split(" ")[0] ?? "";
  if (!terme) return [titre, "", ""];
  const index = cible.indexOf(terme);
  if (index < 0) return [titre, "", ""];
  return [titre.slice(0, index), titre.slice(index, index + terme.length), titre.slice(index + terme.length)];
}

function detail(r: ResultatRecherche): { chemin: string; droite: string } {
  if (r.kind === "type") {
    return {
      chemin: `${r.famille_nom} · ${r.nb_formats} format${(r.nb_formats ?? 0) > 1 ? "s" : ""}`,
      droite: r.prix_des != null ? `dès ${formaterAriary(r.prix_des)}` : "",
    };
  }
  if (r.kind === "format") {
    return {
      chemin: `${r.famille_nom} › ${r.type_nom}`,
      droite:
        !r.nb_offres || r.nb_offres === 0
          ? "aucune offre"
          : `${r.nb_offres} offre${r.nb_offres > 1 ? "s" : ""} · dès ${formaterAriary(r.prix_des ?? 0)}`,
    };
  }
  return { chemin: `${r.nb_formats} types`, droite: "" };
}

export function RechercheMateriaux({
  portee,
  placeholder = "Ciment, parpaing 15, tôle…",
  etiquette = "Chercher un matériau",
}: {
  /** Slug de famille ou de type : limite la recherche à cette branche. */
  portee?: string;
  placeholder?: string;
  etiquette?: string;
}) {
  const naviguer = useNavigate();
  const [saisie, setSaisie] = React.useState("");
  const [terme, setTerme] = React.useState("");
  const [ouvert, setOuvert] = React.useState(false);
  const [actif, setActif] = React.useState(0);
  const boite = React.useRef<HTMLDivElement>(null);
  const champ = React.useRef<HTMLInputElement>(null);
  const identifiant = React.useId();

  // 160 ms : assez court pour paraître instantané, assez long pour ne pas
  // lancer une requête à chaque frappe sur une 3G.
  React.useEffect(() => {
    const minuteur = window.setTimeout(() => setTerme(saisie.trim()), DELAI_FRAPPE_MS);
    return () => window.clearTimeout(minuteur);
  }, [saisie]);

  React.useEffect(() => {
    const dehors = (evenement: MouseEvent) => {
      if (boite.current && !boite.current.contains(evenement.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, []);

  const recherche = useQuery({
    queryKey: ["referentiel", terme, portee],
    enabled: normaliser(terme).length >= MINIMUM,
    staleTime: 60_000,
    queryFn: () => rechercherReferentiel(terme, portee, 8),
  });

  const resultats = React.useMemo(() => recherche.data ?? [], [recherche.data]);
  React.useEffect(() => setActif(0), [resultats.length]);

  const montrer = ouvert && normaliser(terme).length >= MINIMUM;

  const aller = (r?: ResultatRecherche) => {
    const cible = r ?? resultats[actif];
    if (!cible) return;
    setOuvert(false);
    setSaisie("");
    naviguer(cheminResultat(cible));
  };

  const clavier = (evenement: React.KeyboardEvent) => {
    if (!montrer || resultats.length === 0) return;
    if (evenement.key === "ArrowDown") {
      evenement.preventDefault();
      setActif((i) => (i + 1) % resultats.length);
    } else if (evenement.key === "ArrowUp") {
      evenement.preventDefault();
      setActif((i) => (i - 1 + resultats.length) % resultats.length);
    } else if (evenement.key === "Enter") {
      evenement.preventDefault();
      aller();
    } else if (evenement.key === "Escape") {
      setOuvert(false);
      champ.current?.blur();
    }
  };

  return (
    <div ref={boite} className="relative">
      <label htmlFor={identifiant} className="mb-1.5 block text-legende font-semibold">
        {etiquette}
      </label>

      <div
        className={
          "flex min-h-12 items-center rounded-md border bg-card transition-colors " +
          (montrer ? "border-primary" : "border-input")
        }
      >
        <Search size={17} className="ml-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={champ}
          id={identifiant}
          type="text"
          role="combobox"
          aria-expanded={montrer}
          aria-controls={identifiant + "-liste"}
          aria-autocomplete="list"
          aria-activedescendant={montrer && resultats[actif] ? `${identifiant}-${resultats[actif].id}` : undefined}
          autoComplete="off"
          value={saisie}
          placeholder={placeholder}
          onChange={(e) => {
            setSaisie(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={clavier}
          className="min-h-11 min-w-0 flex-1 bg-transparent px-3.5 text-courant outline-none"
        />
        {saisie ? (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => {
              setSaisie("");
              champ.current?.focus();
            }}
            className="mr-1 flex size-11 items-center justify-center text-muted-foreground"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="sr-only">
        {montrer ? `${resultats.length} résultat${resultats.length > 1 ? "s" : ""}` : ""}
      </p>

      {montrer ? (
        <div
          id={identifiant + "-liste"}
          role="listbox"
          aria-label="Suggestions de matériaux"
          className="carte absolute z-40 mt-2 w-full overflow-hidden p-0"
        >
          {recherche.isFetching && resultats.length === 0 ? (
            <div className="space-y-2 p-3.5">
              <Squelette className="h-4 w-4/5" />
              <Squelette className="h-4 w-3/5" />
              <Squelette className="h-4 w-2/5" />
            </div>
          ) : null}

          {resultats.map((r, index) => {
            const [avant, dedans, apres] = decouper(r.nom, terme);
            const { chemin, droite } = detail(r);
            return (
              <button
                key={r.id}
                id={`${identifiant}-${r.id}`}
                role="option"
                aria-selected={index === actif}
                type="button"
                onMouseEnter={() => setActif(index)}
                onClick={() => aller(r)}
                className={
                  "flex w-full items-center gap-3 border-b border-border px-3.5 py-2.5 text-left last:border-0 " +
                  (index === actif ? "bg-primary-soft" : "bg-card")
                }
              >
                <span
                  className={
                    "nombres shrink-0 rounded-xs px-1.5 py-0.5 text-[0.66rem] uppercase tracking-wider " +
                    (r.kind === "type"
                      ? "bg-primary text-primary-foreground"
                      : r.kind === "famille"
                        ? "bg-secondary-soft text-secondary-strong"
                        : "bg-muted text-muted-foreground")
                  }
                >
                  {ETIQUETTE[r.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-courant font-semibold">
                    {avant}
                    {dedans ? <mark className="rounded-xs bg-accent-soft text-inherit">{dedans}</mark> : null}
                    {apres}
                  </span>
                  <span className="block truncate text-legende text-muted-foreground">{chemin}</span>
                </span>
                <span className="nombres shrink-0 text-legende text-muted-foreground">{droite}</span>
              </button>
            );
          })}

          {!recherche.isFetching && resultats.length === 0 ? (
            <div className="p-4">
              <p className="text-courant font-semibold">Aucun matériau ne correspond</p>
              <p className="mt-1 text-legende leading-relaxed text-muted-foreground">
                Le référentiel est fermé : seuls les administrateurs y ajoutent une référence.
                C'est ce qui garde les offres comparables — un fournisseur peut demander un ajout
                depuis son espace.
              </p>
            </div>
          ) : null}

          {resultats.length > 0 ? (
            <p className="bg-muted px-3.5 py-2.5 text-legende text-muted-foreground">
              Entrée ouvre le premier résultat · ↑ ↓ pour naviguer
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
