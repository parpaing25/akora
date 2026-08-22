import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Seo, filAriane } from "@/components/Seo";
import { chargerRatios, margeParDefaut } from "@/lib/donnees/ratios";
import {
  beton350,
  chapeEnduit,
  dalleHourdis,
  murParpaings,
  toitureToles,
  type ResultatMetre,
} from "@/lib/calculateurs";
import { listerProduits, listerPaliersGroupes } from "@/lib/donnees/vitrine";
import { chercherMateriaux } from "@/lib/donnees/materiaux";
import { construireLigne, trierLignes } from "@/lib/comparateur";
import { departFournisseur, versLignePanier } from "@/lib/adaptateurs";
import { calculerLivraison } from "@/lib/livraison";
import { listerVehicules, listerZones } from "@/lib/donnees/transport";
import { coordonnees, usePointLivraison } from "@/lib/point-livraison";
import { usePanier } from "@/lib/panier";
import { LIBELLE_UNITE } from "@/lib/types-metier";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Curseur } from "@/components/ui/slider";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { Squelette } from "@/components/ui/skeleton";
import { DalleHourdis } from "@/components/calculateur/DalleHourdis";
import NonTrouve from "@/pages/NonTrouve";

const TITRES: Record<string, string> = {
  "mur-parpaings": "Mur en parpaings",
  "dalle-hourdis": "Dalle en hourdis",
  beton: "Béton dosé à 350",
  "chape-enduit": "Chape et enduit",
  toiture: "Toiture en tôles",
};

export default function CalculateurDetail() {
  const { type } = useParams<{ type: string }>();
  const ajouter = usePanier((e) => e.ajouter);
  const { point } = usePointLivraison();
  const [champs, setChamps] = React.useState<Record<string, string>>({});
  const [marge, setMarge] = React.useState<number | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  const ratios = useQuery({ queryKey: ["ratios"], queryFn: chargerRatios, staleTime: 30 * 60_000 });

  const nombre = (cle: string, defaut = 0) => {
    const brut = champs[cle];
    const valeur = brut == null ? NaN : Number.parseFloat(brut.replace(",", "."));
    return Number.isFinite(valeur) ? valeur : defaut;
  };

  const margeEffective = marge ?? (ratios.data ? margeParDefaut(ratios.data) : 5);

  const resultat: ResultatMetre | null = React.useMemo(() => {
    if (!ratios.data) return null;
    const r = ratios.data;
    switch (type) {
      case "mur-parpaings":
        return murParpaings(
          {
            longueurM: nombre("longueur"),
            hauteurM: nombre("hauteur"),
            ouverturesM2: nombre("ouvertures"),
            epaisseurCm: (nombre("epaisseur", 15) as 10 | 15 | 20) ?? 15,
          },
          r,
          margeEffective,
        );
      case "dalle-hourdis":
        return dalleHourdis(
          { surfaceM2: nombre("surface"), hauteurHourdisCm: (nombre("hourdis", 16) as 12 | 16 | 20) ?? 16 },
          r,
          margeEffective,
        );
      case "beton":
        return beton350({ volumeM3: nombre("volume") }, r, margeEffective);
      case "chape-enduit":
        return chapeEnduit(
          {
            surfaceM2: nombre("surface"),
            epaisseurCm: nombre("epaisseur", 5),
            type: champs.nature === "enduit" ? "enduit" : "chape",
          },
          r,
          margeEffective,
        );
      case "toiture":
        return toitureToles(
          {
            surfaceM2: nombre("surface"),
            longueurToleM: (nombre("longueur_tole", 2) as 2 | 3) ?? 2,
            faitageM: nombre("faitage"),
            longueurBatimentM: nombre("longueur_batiment"),
          },
          r,
          margeEffective,
        );
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, champs, margeEffective, ratios.data]);

  if (type && !TITRES[type]) return <NonTrouve />;

  /**
   * « Remplir mon panier » : pour chaque ligne du métré, on choisit la
   * meilleure offre AU PRIX RENDU CHANTIER — pas au prix au dépôt. C'est la
   * promesse du site, elle vaut aussi ici.
   */
  const remplirPanier = async () => {
    if (!resultat) return;
    setEnCours(true);
    let ajoutees = 0;
    let introuvables = 0;
    try {
      for (const ligne of resultat.lignes) {
        if (!ligne.materiauSlug || ligne.quantite <= 0) continue;
        const materiau = await chercherMateriaux(ligne.libelle, null, 1).then(async () => {
          const tous = await chercherMateriaux("", null, 500);
          return tous.find((m) => m.slug === ligne.materiauSlug) ?? null;
        });
        if (!materiau) {
          introuvables++;
          continue;
        }
        const offres = await listerProduits({ materiauRefId: materiau.id });
        if (offres.length === 0) {
          introuvables++;
          continue;
        }
        const paliers = await listerPaliersGroupes(offres.map((o) => o.id as string));
        const arrivee = coordonnees(point);
        const construites = [];
        for (const offre of offres) {
          const fournisseurId = offre.fournisseur_id as string;
          const [vehicules, zones] = await Promise.all([
            listerVehicules(fournisseurId),
            listerZones(fournisseurId),
          ]);
          const livraison = calculerLivraison({
            depart: departFournisseur(offre),
            arrivee,
            rayonMaxKm: Number(offre.fournisseur_rayon_max_km ?? 40),
            coefSinuosite:
              offre.fournisseur_coef_sinuosite == null ? null : Number(offre.fournisseur_coef_sinuosite),
            vehicules,
            zones,
            lignes: [
              {
                quantite: ligne.quantite,
                poids_kg_unite: Number(offre.poids_kg_unite),
                volume_m3_unite: Number(offre.volume_m3_unite),
              },
            ],
            montantProduits: Math.round(Number(offre.prix_promo ?? offre.prix_unitaire) * ligne.quantite),
          });
          construites.push(
            construireLigne(offre, paliers.get(offre.id as string) ?? [], ligne.quantite, livraison),
          );
        }
        const meilleure = trierLignes(construites, "rendu")[0];
        if (!meilleure) {
          introuvables++;
          continue;
        }
        ajouter(
          versLignePanier(meilleure.produit, paliers.get(meilleure.produit.id as string) ?? []),
          Math.ceil(ligne.quantite),
        );
        ajoutees++;
      }
      if (ajoutees > 0) {
        toast.success(ajoutees + " ligne(s) ajoutée(s) au panier", {
          description: introuvables > 0 ? introuvables + " matériau(x) sans offre disponible." : undefined,
        });
      } else {
        toast.error("Aucune offre disponible", {
          description: "Aucun fournisseur ne vend encore ces matériaux sur Akora.",
        });
      }
    } catch (erreur) {
      toast.error("Remplissage impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  const champ = (cle: string, etiquette: string, aide?: string, defaut?: string) => (
    <Champ key={cle} etiquette={etiquette} aide={aide}>
      {(a) => (
        <Saisie
          {...a}
          className="nombres"
          inputMode="decimal"
          value={champs[cle] ?? defaut ?? ""}
          onChange={(e) => setChamps({ ...champs, [cle]: e.target.value })}
        />
      )}
    </Champ>
  );

  // La dalle en hourdis a son propre ecran : elle ne se calcule pas par
  // ratio mais par calepinage, et elle chiffre en direct sur les offres
  // reelles. Les autres calculateurs gardent la forme generique.
  if (type === "dalle-hourdis") {
    return (
      <div className="container py-6">
        <Seo
          titre={TITRES[type] ?? "Calculateur"}
          chemin={"/calculateurs/" + type}
          description="Calculez une dalle en hourdis par calepinage : files entières, poutrelles, béton de table, treillis — au prix rendu chantier."
          donneesStructurees={filAriane([
            { nom: "Accueil", chemin: "/" },
            { nom: "Calculateurs", chemin: "/calculateurs" },
            { nom: TITRES[type] ?? "", chemin: "/calculateurs/" + type },
          ])}
        />
        <nav
          aria-label="Fil d'Ariane"
          className="print:hidden mb-2 flex flex-wrap items-center gap-2 text-legende text-muted-foreground"
        >
          <Link to="/calculateurs" className="lien-souligne">
            Calculateurs
          </Link>
          <span aria-hidden="true">›</span>
          <span className="font-semibold text-foreground">{TITRES[type]}</span>
        </nav>
        <h1 className="print:hidden text-page">{TITRES[type]}</h1>
        <p className="print:hidden mb-4 mt-1 text-legende text-muted-foreground">
          Poutrelles, hourdis, treillis et béton de table — comptés par files entières, comme on
          les pose.
        </p>
        <DalleHourdis />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-6">
      <Seo
        titre={TITRES[type ?? ""] ?? "Calculateur"}
        chemin={"/calculateurs/" + type}
        description={"Calculez les quantités nécessaires : " + (TITRES[type ?? ""] ?? "")}
        donneesStructurees={filAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Calculateurs", chemin: "/calculateurs" },
          { nom: TITRES[type ?? ""] ?? "", chemin: "/calculateurs/" + type },
        ])}
      />

      <h1 className="text-page">{TITRES[type ?? ""]}</h1>

      <Carte className="mt-4 p-4">
        <h2 className="text-produit">Votre ouvrage</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {type === "mur-parpaings" ? (
            <>
              {champ("longueur", "Longueur du mur (m)")}
              {champ("hauteur", "Hauteur du mur (m)")}
              {champ("ouvertures", "Portes et fenêtres (m²)", "Surface totale à déduire.")}
              {champ("epaisseur", "Épaisseur du bloc (cm)", "10, 15 ou 20.", "15")}
            </>
          ) : null}
          {type === "dalle-hourdis" ? (
            <>
              {champ("surface", "Surface de la dalle (m²)")}
              {champ("hourdis", "Hauteur du hourdis (cm)", "12, 16 ou 20.", "16")}
            </>
          ) : null}
          {type === "beton" ? champ("volume", "Volume de béton (m³)") : null}
          {type === "chape-enduit" ? (
            <>
              {champ("surface", "Surface (m²)")}
              {champ("epaisseur", "Épaisseur (cm)", "5 cm pour une chape, 1,5 cm pour un enduit.", "5")}
              <Champ etiquette="Nature" aide="Chape au sol, ou enduit sur mur.">
                {(a) => (
                  <select
                    id={a.id}
                    value={champs.nature ?? "chape"}
                    onChange={(e) => setChamps({ ...champs, nature: e.target.value })}
                    className="flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-[0.9375rem]"
                  >
                    <option value="chape">Chape</option>
                    <option value="enduit">Enduit</option>
                  </select>
                )}
              </Champ>
            </>
          ) : null}
          {type === "toiture" ? (
            <>
              {champ("surface", "Surface de couverture (m²)", "Pente comprise, pas la surface au sol.")}
              {champ(
                "longueur_batiment",
                "Longueur du bâtiment (m)",
                "Perpendiculaire à la pente. Sans elle, le compte des tôles reste approché : une tôle se pose entière.",
              )}
              {champ("longueur_tole", "Longueur des tôles (m)", "2 ou 3.", "2")}
              {champ("faitage", "Longueur du faîtage (m)", "Laissez vide s'il n'y en a pas.")}
            </>
          ) : null}
        </div>

        <div className="mt-4">
          <label htmlFor="marge" className="text-legende font-semibold">
            Marge de sécurité : <span className="nombres">{margeEffective}</span> %
          </label>
          <p className="text-[0.78rem] text-muted-foreground">
            Pour les chutes, la casse et les pertes. Cinq pour cent est un minimum raisonnable.
          </p>
          <Curseur
            id="marge"
            className="mt-1"
            min={0}
            max={20}
            step={1}
            value={[margeEffective]}
            onValueChange={(v) => setMarge(v[0] ?? 5)}
          />
        </div>
      </Carte>

      {ratios.isPending ? (
        <Squelette className="mt-4 h-48 w-full" />
      ) : resultat && resultat.lignes.some((l) => l.quantite > 0) ? (
        <Carte className="mt-4 p-4">
          <h2 className="text-produit">Votre liste de courses</h2>
          <ul className="mt-3 divide-y divide-border">
            {resultat.lignes.map((ligne) => (
              <li key={ligne.cle} className="flex items-baseline justify-between gap-3 py-2">
                <span>{ligne.libelle}</span>
                <span className="nombres shrink-0 text-[1.0625rem] font-bold text-primary">
                  {ligne.quantite} <span className="text-legende font-normal text-muted-foreground">
                    {LIBELLE_UNITE[ligne.unite]}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3 rounded-md bg-muted p-3">
            <p className="text-legende font-semibold">Estimation, hors chutes et pertes</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[0.78rem] text-muted-foreground">
              {resultat.reserves.map((reserve) => (
                <li key={reserve}>{reserve}</li>
              ))}
              <li>Marge de sécurité appliquée : {resultat.margePct} %.</li>
            </ul>
          </div>

          <div className="mt-3">
            <SelecteurPoint />
          </div>

          <Bouton className="mt-3" pleineLargeur taille="large" disabled={enCours} onClick={() => void remplirPanier()}>
            {enCours ? "Recherche des meilleures offres" : "Remplir mon panier au meilleur prix rendu"}
          </Bouton>
          <p className="mt-1.5 text-[0.78rem] text-muted-foreground">
            Akora choisit, pour chaque ligne, le fournisseur le moins cher <strong>livré chez
            vous</strong> — pas le moins cher au dépôt.
          </p>
        </Carte>
      ) : (
        <p className="mt-4 rounded-md bg-muted px-3 py-2.5 text-legende text-muted-foreground">
          Renseignez les dimensions ci-dessus pour voir la liste.
        </p>
      )}

      <p className="mt-4 text-legende">
        <Link to="/calculateurs" className="lien-souligne">
          Revenir aux calculateurs
        </Link>
      </p>
    </div>
  );
}
