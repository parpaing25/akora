import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, ShoppingCart } from "lucide-react";
import { calepinerDalle, hourdisParM2, type FormatHourdis } from "@/lib/calepinage";
import { listerOffres, offresDe, type OffreMateriau } from "@/lib/donnees/offres-metre";
import { listerPaliers } from "@/lib/donnees/produits";
import { usePointLivraison } from "@/lib/point-livraison";
import { usePanier } from "@/lib/panier";
import { formaterAriary } from "@/lib/format";
import { useLivraison } from "@/hooks/useLivraison";
import { DialogueFournisseurs } from "./DialogueFournisseurs";
import { DevisImprimable, referenceDevis, type LigneDevis } from "./DevisImprimable";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { Bouton } from "@/components/ui/button";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";

/**
 * Calculateur de dalle en hourdis.
 *
 * Il demande la PORTEE et la LARGEUR, pas une surface. Ce n'est pas une
 * coquetterie : une dalle se pose en files entieres, et deux dalles de 22 m2
 * n'ont pas le meme metre selon leurs proportions. Multiplier une surface par
 * un ratio donne un nombre qui ne correspond a aucune dalle constructible —
 * c'est le defaut que ce calculateur corrige (cf. `src/lib/calepinage.ts`).
 *
 * Le cout affiche est le cout RENDU CHANTIER : materiaux plus livraison,
 * groupee par depot. C'est la seule facon de comparer honnetement deux
 * fournisseurs, et c'est la promesse d'Akora.
 */

/** Les six formats du referentiel, avec leurs dimensions de pose. */
const FORMATS: (FormatHourdis & { nom: string; portee: string; matiere: string })[] = [
  { slug: "hourdis-12", nom: "12", entraxeCm: 60, pasCm: 20, hauteurCm: 12, portee: "portée ≤ 3,50 m", matiere: "béton" },
  { slug: "hourdis-16", nom: "16", entraxeCm: 60, pasCm: 20, hauteurCm: 16, portee: "portée ≤ 4,50 m", matiere: "béton" },
  { slug: "hourdis-20", nom: "20", entraxeCm: 60, pasCm: 20, hauteurCm: 20, portee: "portée ≤ 5,50 m", matiere: "béton" },
  { slug: "hourdis-tc-12", nom: "12×33×33", entraxeCm: 33, pasCm: 33, hauteurCm: 12, portee: "portée ≤ 3,50 m", matiere: "terre cuite" },
  { slug: "hourdis-tc-15", nom: "15×33×33", entraxeCm: 33, pasCm: 33, hauteurCm: 15, portee: "portée ≤ 4,00 m", matiere: "terre cuite" },
  { slug: "hourdis-tc-20", nom: "20×33×33", entraxeCm: 33, pasCm: 33, hauteurCm: 20, portee: "portée ≤ 5,00 m", matiere: "terre cuite" },
];

const RESERVES = [
  "Étaiement, coffrage de rive et armatures de chaînage.",
  "La portée admissible des poutrelles : à vérifier avec le fournisseur.",
  "Main-d'œuvre et location de matériel.",
];

const nombre = (valeur: number, decimales = 0) =>
  valeur.toFixed(decimales).replace(/\.0+$/, "").replace(".", ",");

export function DalleHourdis() {
  const { point } = usePointLivraison();
  const ajouterAuPanier = usePanier((e) => e.ajouter);

  const [portee, setPortee] = React.useState(4);
  const [largeur, setLargeur] = React.useState(5.5);
  const [format, setFormat] = React.useState(FORMATS[1] as (typeof FORMATS)[number]);
  const [marge, setMarge] = React.useState(5);
  const [dialogue, setDialogue] = React.useState(false);
  const [choix, setChoix] = React.useState<Record<string, string | null>>({});
  const [ajout, setAjout] = React.useState(false);
  const reference = React.useMemo(() => referenceDevis(new Date()), []);

  const calepinage = React.useMemo(
    () => calepinerDalle({ porteeM: portee, largeurM: largeur, format }),
    [portee, largeur, format],
  );

  // Marge de securite : chutes, casse, pertes. Elle s'applique aux quantites
  // du calepinage, pas a la surface — sinon elle disparaitrait dans les
  // arrondis de file.
  const k = 1 + marge / 100;
  const surface = calepinage.surfaceM2;
  const epaisseurTable = format.hauteurCm <= 12 ? 0.04 : format.hauteurCm <= 16 ? 0.045 : 0.05;

  const lignes = React.useMemo(
    () => [
      {
        cle: "poutrelle",
        libelle: "Poutrelle béton précontraint",
        formule: `${calepinage.nbPoutrelles} poutrelles de ${nombre(portee, 2)} m`,
        quantite: Math.ceil(calepinage.mlPoutrelles * k),
        brute: calepinage.mlPoutrelles,
        unite: "ml",
        materiauSlug: "poutrelle-beton",
      },
      {
        cle: "hourdis",
        libelle: `Hourdis ${format.nom}`,
        formule: `${calepinage.nbFiles} files × ${calepinage.hourdisParFile} pièces`,
        quantite: Math.ceil(calepinage.nbHourdis * k),
        brute: calepinage.nbHourdis,
        unite: "pièce",
        materiauSlug: format.slug,
      },
      {
        cle: "beton",
        libelle: "Béton dosé à 350 (table de compression)",
        formule: `table de ${Math.round(epaisseurTable * 100)} cm × ${nombre(surface, 1)} m²`,
        quantite: Math.ceil(surface * epaisseurTable * k * 100) / 100,
        brute: surface * epaisseurTable,
        unite: "m³",
        materiauSlug: "beton-350",
      },
      {
        cle: "treillis",
        libelle: "Treillis soudé ST25",
        formule: "surface + 5 % de recouvrement",
        quantite: Math.ceil(surface * 1.05 * k * 10) / 10,
        brute: surface * 1.05,
        unite: "m²",
        materiauSlug: "treillis-soude-6-150",
      },
    ],
    [calepinage, format, portee, k, surface, epaisseurTable],
  );

  const slugs = React.useMemo(() => lignes.map((l) => l.materiauSlug), [lignes]);

  const offres = useQuery({
    queryKey: ["offres-metre", slugs, point?.lat, point?.lng],
    queryFn: () => listerOffres(slugs, point ? { lat: point.lat, lng: point.lng } : null),
    staleTime: 5 * 60_000,
  });

  const toutes = React.useMemo(() => offres.data ?? [], [offres.data]);

  /** L'offre retenue pour une ligne : celle choisie, sinon la moins chère. */
  const retenue = React.useCallback(
    (cle: string, slug: string | null): OffreMateriau | null => {
      const liste = offresDe(toutes, slug);
      return liste.find((o) => o.produit_id === choix[cle]) ?? liste[0] ?? null;
    },
    [toutes, choix],
  );

  const chiffrees = React.useMemo(
    () =>
      lignes.map((ligne) => {
        const offre = retenue(ligne.cle, ligne.materiauSlug);
        return { ...ligne, offre, total: offre ? offre.prix_unitaire * ligne.quantite : 0 };
      }),
    [lignes, retenue],
  );

  const totalMateriaux = chiffrees.reduce((s, l) => s + l.total, 0);

  // Un poste de livraison par depot distinct : c'est ce qui explique qu'un
  // metre eclate sur quatre fournisseurs coute plus cher a livrer qu'un metre
  // groupe sur deux.
  const parDepot = React.useMemo(() => {
    const groupes = new Map<string, { offre: OffreMateriau; poids: number; volume: number; montant: number }>();
    for (const ligne of chiffrees) {
      if (!ligne.offre) continue;
      const g = groupes.get(ligne.offre.fournisseur_id) ?? {
        offre: ligne.offre,
        poids: 0,
        volume: 0,
        montant: 0,
      };
      g.poids += Number(ligne.offre.poids_kg_unite) * ligne.quantite;
      g.volume += Number(ligne.offre.volume_m3_unite) * ligne.quantite;
      g.montant += ligne.total;
      groupes.set(ligne.offre.fournisseur_id, g);
    }
    return [...groupes.values()];
  }, [chiffrees]);

  const livraisons = useLivraison(
    parDepot.map((g) => ({
      fournisseurId: g.offre.fournisseur_id,
      rayonMaxKm: Number(g.offre.rayon_max_km),
      coefSinuosite: g.offre.coef_sinuosite,
      depart:
        g.offre.fournisseur_lat != null && g.offre.fournisseur_lng != null
          ? { lat: Number(g.offre.fournisseur_lat), lng: Number(g.offre.fournisseur_lng) }
          : null,
      lignes: [{ quantite: 1, poids_kg_unite: g.poids, volume_m3_unite: g.volume }],
      montantProduits: g.montant,
    })),
  );

  let totalLivraison: number | null = 0;
  let rotations = 0;
  for (const g of parDepot) {
    const r = livraisons.get(g.offre.fournisseur_id);
    if (r?.statut === "estimee") {
      totalLivraison = (totalLivraison ?? 0) + r.cout;
      rotations += r.detail.rotations;
    } else if (r?.statut === "offerte") {
      rotations += r.detail.rotations;
    } else if (r) {
      // Hors zone ou retrait sur place : on ne fabrique pas un chiffre.
      totalLivraison = null;
    }
  }

  const poidsKg = parDepot.reduce((s, g) => s + g.poids, 0);
  const totalRendu = totalMateriaux + (totalLivraison ?? 0);
  const coutMarge = chiffrees.reduce(
    (s, l) => s + (l.offre ? l.offre.prix_unitaire * (l.quantite - l.brute) : 0),
    0,
  );

  const remplirPanier = async () => {
    setAjout(true);
    try {
      for (const ligne of chiffrees) {
        if (!ligne.offre) continue;
        const paliers = await listerPaliers(ligne.offre.produit_id).catch(() => []);
        ajouterAuPanier(
          {
            produitId: ligne.offre.produit_id,
            slug: ligne.offre.produit_slug,
            nomAffiche: ligne.offre.produit_nom,
            photo: null,
            unite: ligne.offre.unite as never,
            prixUnitaire: ligne.offre.prix_unitaire,
            paliers,
            quantiteMin: ligne.offre.quantite_min,
            poidsKgUnite: Number(ligne.offre.poids_kg_unite),
            volumeM3Unite: Number(ligne.offre.volume_m3_unite),
            stock: ligne.offre.stock_statut,
            fournisseurId: ligne.offre.fournisseur_id,
            fournisseurSlug: ligne.offre.fournisseur_slug,
            fournisseurNom: ligne.offre.fournisseur_nom,
            fournisseurNiveau: ligne.offre.fournisseur_niveau,
          },
          Math.max(ligne.quantite, ligne.offre.quantite_min),
        );
      }
      setDialogue(false);
      toast.success("Panier rempli", { description: "Vérifiez les quantités avant de commander." });
    } catch (erreur) {
      toast.error("Ajout impossible", { description: (erreur as Error).message });
    } finally {
      setAjout(false);
    }
  };

  return (
    <>
      {/* ── Le coût AVANT la liste : un métré sans prix ne sert à rien ── */}
      <section className="print:hidden rounded-lg bg-foreground p-4 text-background sm:p-5">
        <p className="nombres text-[0.66rem] uppercase tracking-wider text-background/60">
          Coût total rendu chantier
        </p>
        <p className="nombres mt-0.5 text-[2.125rem] font-bold leading-none">
          {formaterAriary(totalRendu)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-legende">
          <span className="rounded-md bg-background/10 px-2.5 py-1">
            Matériaux <span className="nombres">{formaterAriary(totalMateriaux)}</span>
          </span>
          <span className="rounded-md bg-background/10 px-2.5 py-1">
            Livraison{" "}
            <span className="nombres">
              {totalLivraison != null ? formaterAriary(totalLivraison) : "à convenir"}
            </span>
          </span>
          <span className="rounded-md bg-primary px-2.5 py-1 font-semibold text-primary-foreground">
            <span className="nombres">{parDepot.length}</span> fournisseur
            {parDepot.length > 1 ? "s" : ""}
          </span>
        </div>

        <dl className="mt-4 grid gap-4 border-t border-background/15 pt-4 sm:grid-cols-3">
          <div>
            <dt className="nombres text-[0.66rem] uppercase tracking-wider text-background/60">
              Coût au m² de dalle
            </dt>
            <dd className="nombres text-[1.375rem] font-bold">
              {surface > 0 ? formaterAriary(totalRendu / surface) : "—"}
              <span className="text-legende font-normal text-background/70"> / m²</span>
            </dd>
            <dd className="text-legende text-background/60">
              sur <span className="nombres">{nombre(surface, 1)}</span> m² de dalle
            </dd>
          </div>
          <div>
            <dt className="nombres text-[0.66rem] uppercase tracking-wider text-background/60">
              Poids à transporter
            </dt>
            <dd className="nombres text-[1.375rem] font-bold">
              {poidsKg >= 1000 ? `${nombre(poidsKg / 1000, 1)} t` : `${Math.round(poidsKg)} kg`}
            </dd>
            <dd className="text-legende text-background/60">
              <span className="nombres">{rotations}</span> rotation{rotations > 1 ? "s" : ""} de camion
            </dd>
          </div>
          <div>
            <dt className="nombres text-[0.66rem] uppercase tracking-wider text-background/60">
              Marge de sécurité
            </dt>
            <dd className="nombres text-[1.375rem] font-bold">{marge} %</dd>
            <dd className="text-legende text-background/60">
              soit <span className="nombres">{formaterAriary(coutMarge)}</span> de réserve
            </dd>
          </div>
        </dl>
      </section>

      <div className="print:hidden mt-4 grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* ── Votre ouvrage ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="carte p-4">
            <h2 className="text-produit">Votre ouvrage</h2>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Champ etiquette="Portée (sens des poutrelles)" aide="en mètres">
                {(a) => (
                  <Saisie
                    {...a}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="1"
                    max="8"
                    value={portee}
                    onChange={(e) => setPortee(Math.max(0, Number(e.target.value)))}
                  />
                )}
              </Champ>
              <Champ etiquette="Largeur" aide="en mètres">
                {(a) => (
                  <Saisie
                    {...a}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="1"
                    max="30"
                    value={largeur}
                    onChange={(e) => setLargeur(Math.max(0, Number(e.target.value)))}
                  />
                )}
              </Champ>
            </div>
            <p className="mt-1.5 text-legende text-muted-foreground">
              <span className="nombres">{nombre(surface, 1)}</span> m² de dalle. Les poutrelles
              courent dans le sens de la portée, d'un seul tenant.
            </p>

            <p className="mt-4 text-legende font-semibold">Hourdis</p>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.slug}
                  type="button"
                  aria-pressed={format.slug === f.slug}
                  onClick={() => setFormat(f)}
                  className={
                    "rounded-md border p-2 text-left " +
                    (format.slug === f.slug ? "border-primary bg-primary-soft" : "border-border bg-card")
                  }
                >
                  <span className="nombres block text-courant font-bold">{f.nom}</span>
                  <span className="block text-[0.66rem] text-muted-foreground">{f.matiere}</span>
                  <span className="block text-[0.66rem] text-muted-foreground">{f.portee}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-legende text-muted-foreground">
              <span className="nombres">{nombre(hourdisParM2(format), 2)}</span> hourdis au m² en
              théorie — le calepinage ci-contre donne le compte réel.
            </p>

            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="marge" className="text-legende font-semibold">
                  Marge de sécurité
                </label>
                <span className="nombres text-courant font-bold text-primary">{marge} %</span>
              </div>
              <input
                id="marge"
                type="range"
                min={0}
                max={15}
                step={1}
                value={marge}
                onChange={(e) => setMarge(Number(e.target.value))}
                className="mt-1.5 w-full accent-primary"
              />
              <p className="text-legende text-muted-foreground">
                Chutes, casse, pertes. 5 % est un minimum raisonnable.
              </p>
            </div>
          </div>

          <div className="carte p-4">
            <SelecteurPoint />
          </div>

          <div className="carte p-4">
            <h2 className="text-produit">Ce que le calcul ne couvre pas</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-legende text-muted-foreground">
              {RESERVES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Votre liste de courses ────────────────────────────────────── */}
        <div className="carte overflow-hidden p-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border p-4">
            <h2 className="text-produit">Votre liste de courses</h2>
            <p className="text-legende text-muted-foreground">
              <span className="nombres">{lignes.length}</span> lignes · marge de{" "}
              <span className="nombres">{marge} %</span> incluse
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse">
              <caption className="sr-only">Matériaux nécessaires, quantités et fournisseurs</caption>
              <thead>
                <tr className="text-legende text-muted-foreground">
                  <th scope="col" className="px-4 py-2 text-left font-semibold">Matériau</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Quantité</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Prix unitaire</th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold">Fournisseur retenu</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Total ligne</th>
                </tr>
              </thead>
              <tbody>
                {chiffrees.map((ligne) => (
                  <tr key={ligne.cle} className="ligne-survol border-t border-border">
                    <th scope="row" className="px-4 py-3 text-left align-top">
                      <span className="block text-courant font-semibold">{ligne.libelle}</span>
                      <span className="nombres block text-[0.72rem] text-muted-foreground">
                        {ligne.formule}
                      </span>
                    </th>
                    <td className="px-4 py-3 text-right align-top">
                      <span className="nombres block text-produit">{nombre(ligne.quantite, 2)}</span>
                      <span className="block text-[0.72rem] text-muted-foreground">{ligne.unite}</span>
                    </td>
                    <td className="nombres px-4 py-3 text-right align-top text-courant">
                      {ligne.offre ? formaterAriary(ligne.offre.prix_unitaire) : "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {ligne.offre ? (
                        <>
                          <span className="block text-legende font-semibold">
                            {ligne.offre.fournisseur_nom}
                          </span>
                          <span className="nombres block text-[0.72rem] text-muted-foreground">
                            {ligne.offre.distance_km != null
                              ? `${nombre(ligne.offre.distance_km, 1)} km`
                              : "distance inconnue"}
                          </span>
                        </>
                      ) : (
                        <span className="text-legende text-muted-foreground">
                          Aucune offre — à commander ailleurs
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <span className="nombres block text-courant font-semibold">
                        {ligne.offre ? formaterAriary(ligne.total) : "—"}
                      </span>
                      {totalRendu > 0 && ligne.total > 0 ? (
                        <span className="nombres block text-[0.72rem] text-muted-foreground">
                          {Math.round((ligne.total / totalRendu) * 100)} % du budget
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted">
                  <th scope="row" colSpan={4} className="px-4 py-2.5 text-left text-courant">
                    Sous-total matériaux
                  </th>
                  <td className="nombres px-4 py-2.5 text-right text-courant font-semibold">
                    {formaterAriary(totalMateriaux)}
                  </td>
                </tr>
                <tr className="border-t border-border bg-muted">
                  <th scope="row" colSpan={4} className="px-4 py-2.5 text-left text-courant">
                    Livraison rendue chantier
                    <span className="nombres block text-[0.72rem] font-normal text-muted-foreground">
                      {parDepot.length} fournisseur{parDepot.length > 1 ? "s" : ""} · {rotations}{" "}
                      rotation{rotations > 1 ? "s" : ""}
                    </span>
                  </th>
                  <td className="nombres px-4 py-2.5 text-right text-courant font-semibold">
                    {totalLivraison != null ? formaterAriary(totalLivraison) : "à convenir"}
                  </td>
                </tr>
                <tr className="border-t-2 border-foreground">
                  <th scope="row" colSpan={4} className="px-4 py-3 text-left text-produit">
                    Total rendu chantier
                  </th>
                  <td className="nombres px-4 py-3 text-right text-section text-primary">
                    {formaterAriary(totalRendu)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border p-4">
            <Bouton onClick={() => setDialogue(true)} disabled={totalMateriaux <= 0}>
              <ShoppingCart size={16} aria-hidden="true" />
              Remplir mon panier · {formaterAriary(totalRendu)}
            </Bouton>
            <Bouton variante="secondaire" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" />
              Exporter le devis en PDF
            </Bouton>
          </div>

          <p className="border-t border-border bg-muted p-4 text-legende text-muted-foreground">
            Akora retient, pour chaque ligne, le fournisseur le moins cher livré chez vous — pas le
            moins cher au dépôt. Estimation : le prix final est confirmé par chaque fournisseur.
          </p>
        </div>
      </div>

      <DialogueFournisseurs
        ouvert={dialogue}
        onFermer={() => setDialogue(false)}
        lignes={lignes}
        offres={toutes}
        choix={choix}
        onChoisir={(cle, produitId) => setChoix((c) => ({ ...c, [cle]: produitId }))}
        onConfirmer={() => void remplirPanier()}
        enCours={ajout}
      />

      <DevisImprimable
        ouvrage={`Dalle en hourdis ${format.nom}`}
        details={[
          { intitule: "Portée", valeur: `${nombre(portee, 2)} m` },
          { intitule: "Largeur", valeur: `${nombre(largeur, 2)} m` },
          { intitule: "Surface", valeur: `${nombre(surface, 1)} m²` },
          {
            intitule: "Calepinage",
            valeur: `${calepinage.nbFiles} files · ${calepinage.nbPoutrelles} poutrelles`,
          },
          { intitule: "Marge de sécurité", valeur: `${marge} %` },
        ]}
        lignes={chiffrees as unknown as LigneDevis[]}
        totalMateriaux={totalMateriaux}
        totalLivraison={totalLivraison}
        totalRendu={totalRendu}
        surfaceM2={surface}
        lieu={point?.libelle ?? null}
        reserves={RESERVES}
        reference={reference}
        etabliLe={new Date()}
      />
    </>
  );
}
