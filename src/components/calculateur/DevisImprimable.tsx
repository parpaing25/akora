import { formaterAriary } from "@/lib/format";
import type { OffreMateriau } from "@/lib/donnees/offres-metre";
import { LogoAkora } from "@/components/marque/LogoAkora";

/**
 * Le devis, mis en page pour l'impression et donc pour le PDF.
 *
 * Aucune bibliotheque : « Imprimer » puis « Enregistrer au format PDF » est
 * offert par tous les navigateurs, y compris Chrome sur Android. Embarquer un
 * generateur de PDF couterait 200 Ko a tout le monde pour un bouton que peu
 * cliquent — sur une 3G malgache, c'est indefendable.
 *
 * Ce bloc n'existe QU'A L'IMPRESSION : `hidden print:block`. Il ne pese donc
 * rien a l'ecran, et l'ecran ne pese rien sur la feuille.
 *
 * Le document dit ce qu'il est : une ESTIMATION d'Akora aux prix affiches par
 * les fournisseurs a la date d'edition, pas un devis engageant le depot. La
 * confusion couterait cher a quelqu'un.
 */
export interface LigneDevis {
  libelle: string;
  formule: string;
  quantite: number;
  unite: string;
  offre: OffreMateriau | null;
  total: number;
}

export interface ProprietesDevis {
  ouvrage: string;
  details: { intitule: string; valeur: string }[];
  lignes: readonly LigneDevis[];
  totalMateriaux: number;
  totalLivraison: number | null;
  totalRendu: number;
  surfaceM2: number;
  lieu: string | null;
  reserves: readonly string[];
  reference: string;
  etabliLe: Date;
}

/** Une reference lisible : AK-2308-4F2A. Locale, jamais un numero de facture. */
export function referenceDevis(date: Date): string {
  const jour = String(date.getDate()).padStart(2, "0");
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const suffixe = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AK-${jour}${mois}-${suffixe}`;
}

export function DevisImprimable(p: ProprietesDevis) {
  const depots = [...new Set(p.lignes.map((l) => l.offre?.fournisseur_nom).filter(Boolean))];

  return (
    <div className="hidden print:block" aria-hidden="true">
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <div>
          <div className="flex items-center gap-2">
            <LogoAkora className="size-6" />
            <span className="text-[1.25rem] font-bold tracking-tight">AKORA</span>
          </div>
          <p className="mt-1 text-[0.66rem] leading-snug">
            Marketplace de matériaux de gros œuvre
            <br />
            akora.fonenako.mg · Antananarivo, Madagascar
          </p>
        </div>
        <div className="text-right">
          <p className="text-[1.0625rem] font-bold">Estimation chiffrée</p>
          <p className="nombres text-[0.66rem]">N° {p.reference}</p>
          <p className="nombres text-[0.66rem]">Établie le {p.etabliLe.toLocaleDateString("fr-FR")}</p>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[0.66rem] uppercase tracking-wider">Ouvrage calculé</p>
          <p className="mt-0.5 text-[0.9375rem] font-bold">{p.ouvrage}</p>
          <dl className="mt-1 text-[0.72rem]">
            {p.details.map((d) => (
              <div key={d.intitule} className="flex justify-between gap-3">
                <dt>{d.intitule}</dt>
                <dd className="nombres font-semibold">{d.valeur}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <p className="text-[0.66rem] uppercase tracking-wider">Livraison</p>
          <p className="mt-0.5 text-[0.9375rem] font-bold">
            {p.lieu ?? "Point de livraison non défini"}
          </p>
          <p className="mt-1 text-[0.72rem]">
            {depots.length} fournisseur{depots.length > 1 ? "s" : ""} : {depots.join(", ") || "—"}
          </p>
        </div>
      </div>

      <table className="mt-4 w-full border-collapse text-[0.72rem]">
        <thead>
          <tr className="bg-black text-white">
            <th scope="col" className="px-2 py-1.5 text-left">Désignation</th>
            <th scope="col" className="px-2 py-1.5 text-right">Qté</th>
            <th scope="col" className="px-2 py-1.5 text-left">Unité</th>
            <th scope="col" className="px-2 py-1.5 text-right">P.U.</th>
            <th scope="col" className="px-2 py-1.5 text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          {p.lignes.map((ligne) => (
            <tr key={ligne.libelle} className="border-b border-black/20">
              <td className="px-2 py-1.5">
                <span className="block font-semibold">{ligne.libelle}</span>
                <span className="block text-[0.62rem]">
                  {ligne.offre
                    ? `${ligne.offre.fournisseur_nom}${
                        ligne.offre.distance_km != null
                          ? ` · ${ligne.offre.distance_km.toFixed(1).replace(".", ",")} km`
                          : ""
                      }`
                    : "Aucune offre — à commander hors Akora"}
                </span>
              </td>
              <td className="nombres px-2 py-1.5 text-right font-semibold">{ligne.quantite}</td>
              <td className="px-2 py-1.5">{ligne.unite}</td>
              <td className="nombres px-2 py-1.5 text-right">
                {ligne.offre ? formaterAriary(ligne.offre.prix_unitaire) : "—"}
              </td>
              <td className="nombres px-2 py-1.5 text-right font-semibold">
                {ligne.offre ? formaterAriary(ligne.total) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <dl className="w-[18rem] text-[0.72rem]">
          <div className="flex justify-between gap-3 py-1">
            <dt>Sous-total matériaux</dt>
            <dd className="nombres">{formaterAriary(p.totalMateriaux)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-black/20 py-1">
            <dt>Livraison rendue chantier</dt>
            <dd className="nombres">
              {p.totalLivraison != null ? formaterAriary(p.totalLivraison) : "à convenir"}
            </dd>
          </div>
          <div className="mt-1 flex justify-between gap-3 bg-black px-2 py-1.5 text-white">
            <dt className="font-bold">Total estimé</dt>
            <dd className="nombres font-bold">{formaterAriary(p.totalRendu)}</dd>
          </div>
          {p.surfaceM2 > 0 ? (
            <p className="nombres mt-1 text-right text-[0.62rem]">
              soit {formaterAriary(p.totalRendu / p.surfaceM2)} par m² d'ouvrage
            </p>
          ) : null}
        </dl>
      </div>

      <div className="mt-4 border-l-4 border-black pl-3 text-[0.66rem]">
        <p className="font-bold">Ce que cette estimation ne comprend pas</p>
        <p className="mt-0.5">{p.reserves.join(" · ")}</p>
      </div>

      <p className="mt-4 text-[0.62rem] leading-relaxed">
        Estimation établie par le calculateur de métré d'Akora. Les quantités incluent la marge de
        sécurité indiquée. Les prix sont ceux affichés par les fournisseurs à la date
        d'établissement et restent soumis à leur confirmation : ce document n'engage pas les dépôts.
        Prix en ariary. Paiement par mobile money uniquement — MVola, Orange Money, Airtel Money.
        Aucune carte bancaire n'est acceptée.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-8 text-[0.66rem]">
        <div>
          <p>Bon pour accord — le client</p>
          <div className="mt-6 border-t border-black pt-1">Nom, date et signature</div>
        </div>
        <div>
          <p>Cachet du fournisseur</p>
          <div className="mt-6 border-t border-black pt-1">Réservé au fournisseur</div>
        </div>
      </div>
    </div>
  );
}
