import * as React from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import {
  desactiverVehicule,
  desactiverZone,
  enregistrerVehicule,
  enregistrerZone,
  listerVehicules,
  listerZones,
} from "@/lib/donnees/transport";
import { calculerLivraison, type Vehicule, type Zone } from "@/lib/livraison";
import { formaterAriary, formaterDistance } from "@/lib/format";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { LigneCase } from "@/components/ui/checkbox";
import { Curseur } from "@/components/ui/slider";
import { Tableau, TableauCorps, TableauTete } from "@/components/ui/table";
import { EtatVide } from "@/components/ui/etats";

const VEHICULE_VIDE = {
  nom: "",
  capacite_m3: "",
  capacite_kg: "",
  prix_par_km: "",
  forfait_base: "",
  km_inclus: "0",
  prix_minimum: "",
  facturer_aller_retour: false,
};

const nombre = (v: string) => Number.parseFloat(v.replace(",", ".")) || 0;

/**
 * Barème de transport (étape 3 de la partie E).
 *
 * L'aperçu de droite rejoue `calculerLivraison` — le MÊME module que celui du
 * comparateur et du panier — sur une distance que le fournisseur fait varier.
 * Il voit donc exactement ce que l'acheteur verra, et pas une approximation
 * écrite pour la démonstration.
 */
export default function Livraison() {
  const fiche = useOutletContext<LigneFournisseur>();
  const client = useQueryClient();
  const [form, setForm] = React.useState(VEHICULE_VIDE);
  const [distanceApercu, setDistanceApercu] = React.useState(15);
  const [enCours, setEnCours] = React.useState(false);

  const vehicules = useQuery({
    queryKey: ["vehicules", fiche.id],
    queryFn: () => listerVehicules(fiche.id),
    staleTime: 60_000,
  });
  const zones = useQuery({
    queryKey: ["zones", fiche.id],
    queryFn: () => listerZones(fiche.id),
    staleTime: 60_000,
  });

  const rafraichir = () => {
    void client.invalidateQueries({ queryKey: ["vehicules", fiche.id] });
    void client.invalidateQueries({ queryKey: ["zones", fiche.id] });
  };

  const ajouterVehicule = async () => {
    if (form.nom.trim().length < 2 || !(nombre(form.capacite_m3) > 0) || !(nombre(form.capacite_kg) > 0)) {
      toast.error("Saisie incomplète", { description: "Un nom, un volume et une charge utile." });
      return;
    }
    setEnCours(true);
    try {
      await enregistrerVehicule({
        fournisseur_id: fiche.id,
        nom: form.nom.trim(),
        capacite_m3: nombre(form.capacite_m3),
        capacite_kg: nombre(form.capacite_kg),
        prix_par_km: Math.round(nombre(form.prix_par_km)),
        forfait_base: Math.round(nombre(form.forfait_base)),
        km_inclus: nombre(form.km_inclus),
        prix_minimum: Math.round(nombre(form.prix_minimum)),
        facturer_aller_retour: form.facturer_aller_retour,
      });
      setForm(VEHICULE_VIDE);
      rafraichir();
      toast.success("Véhicule enregistré");
    } catch (erreur) {
      toast.error("Enregistrement impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  /* Aperçu : un chargement type d'un mètre cube et d'une tonne, à la distance
     que le fournisseur choisit. On passe par le vrai calculateur, avec deux
     points fictifs placés à la bonne distance l'un de l'autre. */
  const apercu = React.useMemo(() => {
    const coef = fiche.coef_sinuosite ?? 1.3;
    const deltaLat = distanceApercu / coef / 111.195;
    return calculerLivraison({
      depart: { lat: -18.8, lng: 47.5 },
      arrivee: { lat: -18.8 + deltaLat, lng: 47.5 },
      rayonMaxKm: fiche.rayon_max_km,
      coefSinuosite: coef,
      vehicules: (vehicules.data ?? []) as Vehicule[],
      zones: (zones.data ?? []) as Zone[],
      lignes: [{ quantite: 1, poids_kg_unite: 1000, volume_m3_unite: 1 }],
      montantProduits: 500_000,
    });
  }, [distanceApercu, fiche.coef_sinuosite, fiche.rayon_max_km, vehicules.data, zones.data]);

  return (
    <>
      <Seo titre="Livraison" chemin="/pro/livraison" indexable={false} />
      <h2 className="text-section">Véhicules et tarifs</h2>
      <p className="mt-1 text-legende text-muted-foreground">
        Sans véhicule déclaré, vos produits s'affichent en « retrait sur place ». Avec, Akora
        calcule le prix rendu chantier depuis votre dépôt.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {(vehicules.data ?? []).length === 0 ? (
            <EtatVide
              titre="Aucun véhicule déclaré"
              phrase="Déclarez au moins une camionnette ou un camion pour que vos clients voient un prix livré."
            />
          ) : (
            <Tableau>
              <TableauTete>
                <tr>
                  <th scope="col">Véhicule</th>
                  <th scope="col">Capacité</th>
                  <th scope="col">Forfait</th>
                  <th scope="col">Par km</th>
                  <th scope="col">Inclus</th>
                  <th scope="col">Minimum</th>
                  <th scope="col">
                    <span className="sr-only">Retirer</span>
                  </th>
                </tr>
              </TableauTete>
              <TableauCorps>
                {(vehicules.data ?? []).map((v) => (
                  <tr key={v.id}>
                    <td className="font-semibold">{v.nom}</td>
                    <td data-nombre="">
                      {v.capacite_m3} m³ · {v.capacite_kg} kg
                    </td>
                    <td data-nombre="">{formaterAriary(v.forfait_base)}</td>
                    <td data-nombre="">
                      {formaterAriary(v.prix_par_km)}
                      {v.facturer_aller_retour ? " (A/R)" : ""}
                    </td>
                    <td data-nombre="">{v.km_inclus} km</td>
                    <td data-nombre="">{formaterAriary(v.prix_minimum)}</td>
                    <td>
                      <div className="flex justify-end">
                        <Bouton
                          variante="fantome"
                          taille="compact"
                          className="text-destructive-strong"
                          onClick={async () => {
                            await desactiverVehicule(v.id);
                            rafraichir();
                          }}
                        >
                          Retirer
                        </Bouton>
                      </div>
                    </td>
                  </tr>
                ))}
              </TableauCorps>
            </Tableau>
          )}

          <Carte className="p-4">
            <h3 className="text-produit">Ajouter un véhicule</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Champ etiquette="Nom" aide="« Camionnette 3 m³ », « Camion 10 roues »…" obligatoire>
                {(a) => <Saisie {...a} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />}
              </Champ>
              <Champ etiquette="Volume utile (m³)" obligatoire>
                {(a) => <Saisie {...a} className="nombres" inputMode="decimal" value={form.capacite_m3} onChange={(e) => setForm({ ...form, capacite_m3: e.target.value })} />}
              </Champ>
              <Champ etiquette="Charge utile (kg)" obligatoire>
                {(a) => <Saisie {...a} className="nombres" inputMode="numeric" value={form.capacite_kg} onChange={(e) => setForm({ ...form, capacite_kg: e.target.value })} />}
              </Champ>
              <Champ etiquette="Forfait de base (Ar)" aide="Ce que coûte la sortie, avant le kilométrage.">
                {(a) => <Saisie {...a} className="nombres" inputMode="numeric" value={form.forfait_base} onChange={(e) => setForm({ ...form, forfait_base: e.target.value })} />}
              </Champ>
              <Champ etiquette="Prix par kilomètre (Ar)">
                {(a) => <Saisie {...a} className="nombres" inputMode="numeric" value={form.prix_par_km} onChange={(e) => setForm({ ...form, prix_par_km: e.target.value })} />}
              </Champ>
              <Champ etiquette="Kilomètres inclus" aide="Non facturés, au départ du dépôt.">
                {(a) => <Saisie {...a} className="nombres" inputMode="decimal" value={form.km_inclus} onChange={(e) => setForm({ ...form, km_inclus: e.target.value })} />}
              </Champ>
              <Champ etiquette="Prix plancher (Ar)" aide="Jamais moins que ça, même à 2 km.">
                {(a) => <Saisie {...a} className="nombres" inputMode="numeric" value={form.prix_minimum} onChange={(e) => setForm({ ...form, prix_minimum: e.target.value })} />}
              </Champ>
              <div className="sm:col-span-2">
                <LigneCase
                  id="aller-retour"
                  etiquette="Facturer l'aller-retour"
                  aide="À cocher si vous comptez le trajet de retour à vide."
                  checked={form.facturer_aller_retour}
                  onCheckedChange={(c) => setForm({ ...form, facturer_aller_retour: c === true })}
                />
              </div>
            </div>
            <Bouton className="mt-3" disabled={enCours} onClick={() => void ajouterVehicule()}>
              Ajouter ce véhicule
            </Bouton>
          </Carte>

          <ZonesLivraison
            fournisseurId={fiche.id}
            zones={zones.data ?? []}
            onChange={rafraichir}
          />
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Carte className="p-4">
            <h3 className="text-produit">Aperçu du tarif</h3>
            <p className="mt-0.5 text-[0.78rem] text-muted-foreground">
              Pour un chargement d'un mètre cube et d'une tonne. C'est le même calcul que celui
              affiché à l'acheteur.
            </p>

            <div className="mt-3">
              <label htmlFor="distance-apercu" className="text-legende font-semibold">
                Distance : <span className="nombres">{formaterDistance(distanceApercu)}</span>
              </label>
              <Curseur
                id="distance-apercu"
                className="mt-1"
                min={1}
                max={Math.max(10, Math.round(fiche.rayon_max_km))}
                step={1}
                value={[distanceApercu]}
                onValueChange={(valeurs) => setDistanceApercu(valeurs[0] ?? 1)}
              />
            </div>

            <div className="mt-3 rounded-md bg-muted p-3 text-legende" aria-live="polite">
              {apercu.statut === "retrait_sur_place" ? (
                <p>Retrait sur place uniquement : aucun véhicule déclaré.</p>
              ) : apercu.statut === "hors_zone" ? (
                <p>Hors de votre rayon maximum ({formaterDistance(fiche.rayon_max_km)}).</p>
              ) : apercu.statut === "offerte" ? (
                <p className="font-semibold text-success-strong">Livraison offerte : le franco est atteint.</p>
              ) : apercu.statut === "estimee" ? (
                <>
                  <p className="nombres text-[1.125rem] font-bold text-primary">{formaterAriary(apercu.cout)}</p>
                  <p className="mt-1">
                    {apercu.detail.vehicule.nom}
                    {apercu.detail.rotations > 1 ? " · " + apercu.detail.rotations + " rotations" : ""}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-[0.72rem] text-muted-foreground">
                    {apercu.detail.formule}
                  </pre>
                </>
              ) : (
                <p>Renseignez la position de votre dépôt pour voir un tarif.</p>
              )}
            </div>
          </Carte>
        </aside>
      </div>
    </>
  );
}

const ZONE_VIDE = { nom: "", rayon_km: "", seuil_franco: "", rayon_franco_km: "", majoration_pct: "0" };

/**
 * Zones : franco de port et majoration. La zone retenue pour un calcul est la
 * PLUS PETITE dont le rayon couvre la distance — c'est la règle appliquée par
 * `choisirZone`, et elle est rappelée ici pour éviter les surprises.
 */
function ZonesLivraison({
  fournisseurId,
  zones,
  onChange,
}: {
  fournisseurId: string;
  zones: readonly Zone[];
  onChange: () => void;
}) {
  const [form, setForm] = React.useState(ZONE_VIDE);
  const [enCours, setEnCours] = React.useState(false);

  const ajouter = async () => {
    if (form.nom.trim().length < 2 || !(nombre(form.rayon_km) > 0)) {
      toast.error("Saisie incomplète", { description: "Un nom et un rayon en kilomètres." });
      return;
    }
    const seuil = form.seuil_franco.trim() ? Math.round(nombre(form.seuil_franco)) : null;
    const rayonFranco = form.rayon_franco_km.trim() ? nombre(form.rayon_franco_km) : null;
    if ((seuil === null) !== (rayonFranco === null)) {
      toast.error("Franco incomplet", {
        description: "Un franco de port a besoin des deux : un montant ET un rayon.",
      });
      return;
    }
    setEnCours(true);
    try {
      await enregistrerZone({
        fournisseur_id: fournisseurId,
        nom: form.nom.trim(),
        rayon_km: nombre(form.rayon_km),
        seuil_franco: seuil,
        rayon_franco_km: rayonFranco,
        majoration_pct: nombre(form.majoration_pct),
      });
      setForm(ZONE_VIDE);
      onChange();
      toast.success("Zone enregistrée");
    } catch (erreur) {
      toast.error("Enregistrement impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Carte className="p-4">
      <h3 className="text-produit">Zones, franco de port et majorations</h3>
      <p className="mt-0.5 text-legende text-muted-foreground">
        Pour une distance donnée, Akora retient la plus petite zone qui la couvre.
      </p>

      {zones.length > 0 ? (
        <Tableau conteneurClassName="mt-3">
          <TableauTete>
            <tr>
              <th scope="col">Zone</th>
              <th scope="col">Rayon</th>
              <th scope="col">Franco</th>
              <th scope="col">Majoration</th>
              <th scope="col">
                <span className="sr-only">Retirer</span>
              </th>
            </tr>
          </TableauTete>
          <TableauCorps>
            {zones.map((z) => (
              <tr key={z.id}>
                <td className="font-semibold">{z.nom}</td>
                <td data-nombre="">{formaterDistance(z.rayon_km)}</td>
                <td data-nombre="">
                  {z.seuil_franco == null
                    ? "—"
                    : formaterAriary(z.seuil_franco) + " sous " + formaterDistance(z.rayon_franco_km ?? 0)}
                </td>
                <td data-nombre="">{z.majoration_pct} %</td>
                <td>
                  <div className="flex justify-end">
                    <Bouton
                      variante="fantome"
                      taille="compact"
                      className="text-destructive-strong"
                      onClick={async () => {
                        await desactiverZone(z.id);
                        onChange();
                      }}
                    >
                      Retirer
                    </Bouton>
                  </div>
                </td>
              </tr>
            ))}
          </TableauCorps>
        </Tableau>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Champ etiquette="Nom de la zone" aide="« Ville », « Périphérie », « Province »…" obligatoire>
          {(a) => <Saisie {...a} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />}
        </Champ>
        <Champ etiquette="Rayon (km)" obligatoire>
          {(a) => <Saisie {...a} className="nombres" inputMode="decimal" value={form.rayon_km} onChange={(e) => setForm({ ...form, rayon_km: e.target.value })} />}
        </Champ>
        <Champ etiquette="Franco à partir de (Ar)" aide="Laissez vide si vous n'offrez pas la livraison.">
          {(a) => <Saisie {...a} className="nombres" inputMode="numeric" value={form.seuil_franco} onChange={(e) => setForm({ ...form, seuil_franco: e.target.value })} />}
        </Champ>
        <Champ etiquette="Franco jusqu'à (km)" aide="Les deux conditions doivent être réunies.">
          {(a) => <Saisie {...a} className="nombres" inputMode="decimal" value={form.rayon_franco_km} onChange={(e) => setForm({ ...form, rayon_franco_km: e.target.value })} />}
        </Champ>
        <Champ etiquette="Majoration (%)" aide="Route difficile, bac, piste. Négatif pour une remise.">
          {(a) => <Saisie {...a} className="nombres" inputMode="decimal" value={form.majoration_pct} onChange={(e) => setForm({ ...form, majoration_pct: e.target.value })} />}
        </Champ>
      </div>
      <Bouton className="mt-3" variante="tertiaire" disabled={enCours} onClick={() => void ajouter()}>
        Ajouter cette zone
      </Bouton>
    </Carte>
  );
}
