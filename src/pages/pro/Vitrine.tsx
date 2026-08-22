import * as React from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import { majMaFiche } from "@/lib/donnees/fournisseurs";
import { useInvaliderMaFiche } from "@/hooks/useMaFiche";
import { envoyerPhotos } from "@/lib/photos";
import { NOM_OPERATEUR, normaliserTelephone, telephoneValide } from "@/lib/format";
import { LIBELLE_MODE_PAIEMENT, type ModePaiement, type OperateurPaiement } from "@/lib/types-metier";
import type { Point } from "@/lib/livraison";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie, ZoneTexte } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { LigneCase } from "@/components/ui/checkbox";
import { AvertissementMetier } from "@/components/ui/etats";
import { CartePoint } from "@/components/carte/CartePoint";
import { ChoixLocalite } from "@/components/pro/ChoixLocalite";
import { Liste, ListeContenu, ListeDeclencheur, ListeElement, ListeValeur } from "@/components/ui/select";

const MODES: ModePaiement[] = ["a_la_livraison", "en_ligne_acompte", "en_ligne_integral"];
const OPERATEURS: OperateurPaiement[] = ["mvola", "orange_money", "airtel_money"];

/**
 * Vitrine publique et réglages commerciaux.
 *
 * Le paiement en ligne n'est proposé aux acheteurs que si le fournisseur est
 * vérifié (spec B9). On l'annonce ici plutôt que de laisser le fournisseur
 * cocher une case sans effet.
 */
export default function Vitrine() {
  const fiche = useOutletContext<LigneFournisseur>();
  const invalider = useInvaliderMaFiche();
  const [enCours, setEnCours] = React.useState(false);

  const [description, setDescription] = React.useState(fiche.description ?? "");
  const [telephone, setTelephone] = React.useState(fiche.telephone ?? "");
  const [whatsapp, setWhatsapp] = React.useState(fiche.whatsapp ?? "");
  const [email, setEmail] = React.useState(fiche.email ?? "");
  const [adresse, setAdresse] = React.useState(fiche.adresse ?? "");
  const [localiteId, setLocaliteId] = React.useState<string | null>(fiche.localite_id);
  const [point, setPoint] = React.useState<Point | null>(
    fiche.lat != null && fiche.lng != null ? { lat: fiche.lat, lng: fiche.lng } : null,
  );
  const [rayon, setRayon] = React.useState(String(fiche.rayon_max_km));
  const [sinuosite, setSinuosite] = React.useState(fiche.coef_sinuosite == null ? "" : String(fiche.coef_sinuosite));
  const [tva, setTva] = React.useState(fiche.assujetti_tva);
  const [modes, setModes] = React.useState<ModePaiement[]>(fiche.modes_paiement_acceptes ?? ["a_la_livraison"]);
  const [acompte, setAcompte] = React.useState(String(fiche.taux_acompte));
  const [operateur, setOperateur] = React.useState<OperateurPaiement | "">(fiche.operateur_versement ?? "");
  const [msisdn, setMsisdn] = React.useState(fiche.msisdn_versement ?? "");
  const [logo, setLogo] = React.useState(fiche.logo_url);
  const champLogo = React.useRef<HTMLInputElement>(null);

  const peutEncaisserEnLigne = fiche.niveau_verification === "verifie" || fiche.niveau_verification === "partenaire";

  const basculerMode = (mode: ModePaiement, actif: boolean) => {
    setModes((precedents) => {
      const suivants = actif ? [...new Set([...precedents, mode])] : precedents.filter((m) => m !== mode);
      return suivants.length ? suivants : ["a_la_livraison"];
    });
  };

  const enregistrer = async () => {
    if (telephone && !telephoneValide(telephone)) {
      toast.error("Téléphone invalide", { description: "Format attendu : 034 12 345 67." });
      return;
    }
    if (msisdn && !telephoneValide(msisdn)) {
      toast.error("Numéro de versement invalide", { description: "Format attendu : 034 12 345 67." });
      return;
    }
    const rayonNombre = Number.parseFloat(rayon.replace(",", "."));
    if (!(rayonNombre > 0)) {
      toast.error("Rayon maximum invalide");
      return;
    }
    setEnCours(true);
    try {
      await majMaFiche(fiche.id, {
        description: description.trim() || null,
        telephone: telephone ? normaliserTelephone(telephone) : null,
        whatsapp: whatsapp ? normaliserTelephone(whatsapp) : null,
        email: email.trim() || null,
        adresse: adresse.trim() || null,
        localite_id: localiteId,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
        rayon_max_km: rayonNombre,
        coef_sinuosite: sinuosite.trim() ? Number.parseFloat(sinuosite.replace(",", ".")) : null,
        assujetti_tva: tva,
        modes_paiement_acceptes: modes,
        taux_acompte: Math.min(100, Math.max(10, Number.parseInt(acompte, 10) || 30)),
        operateur_versement: operateur || null,
        msisdn_versement: msisdn ? normaliserTelephone(msisdn) : null,
        logo_url: logo,
      });
      await invalider();
      toast.success("Vitrine mise à jour");
    } catch (erreur) {
      toast.error("Enregistrement impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <>
      <Seo titre="Ma vitrine" chemin="/pro/vitrine" indexable={false} />
      <h2 className="text-section">Ma vitrine</h2>
      <p className="mt-1 text-legende text-muted-foreground">
        Ce que voient les acheteurs. Votre téléphone n'apparaît qu'aux comptes connectés, et
        chaque consultation est journalisée.
      </p>

      <div className="mt-4 space-y-4">
        <Carte className="p-4">
          <h3 className="text-produit">Présentation</h3>
          <div className="mt-3 space-y-3">
            <Champ etiquette="Description" aide="Ce que vous vendez, depuis quand, ce qui vous distingue.">
              {(a) => <ZoneTexte {...a} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />}
            </Champ>

            <div>
              <p className="text-legende font-semibold">Logo</p>
              <div className="mt-1.5 flex items-center gap-3">
                {logo ? (
                  <img src={logo} alt="" width={64} height={64} className="size-16 rounded-md border border-border object-cover" />
                ) : (
                  <div aria-hidden="true" className="size-16 rounded-md border border-dashed border-border bg-muted" />
                )}
                <label htmlFor="logo-fournisseur" className="sr-only">
                  Choisir un logo
                </label>
                <input
                  id="logo-fournisseur"
                  ref={champLogo}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={async (e) => {
                    const fichier = e.target.files?.[0];
                    e.target.value = "";
                    if (!fichier) return;
                    try {
                      const [url] = await envoyerPhotos([fichier], "fournisseurs");
                      setLogo(url ?? null);
                    } catch (erreur) {
                      toast.error("Envoi impossible", { description: (erreur as Error).message });
                    }
                  }}
                />
                <Bouton variante="secondaire" taille="compact" onClick={() => champLogo.current?.click()}>
                  {logo ? "Remplacer le logo" : "Ajouter un logo"}
                </Bouton>
              </div>
            </div>
          </div>
        </Carte>

        <Carte className="p-4">
          <h3 className="text-produit">Contact et emplacement</h3>
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ etiquette="Téléphone">
                {(a) => <Saisie {...a} type="tel" inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />}
              </Champ>
              <Champ etiquette="WhatsApp">
                {(a) => <Saisie {...a} type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />}
              </Champ>
            </div>
            <Champ etiquette="Adresse e-mail">
              {(a) => <Saisie {...a} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Champ>
            <ChoixLocalite
              valeur={localiteId}
              onChange={(l) => {
                setLocaliteId(l?.id ?? null);
                if (l?.lat != null && l.lng != null && !point) setPoint({ lat: l.lat, lng: l.lng });
              }}
            />
            <Champ etiquette="Adresse du dépôt">
              {(a) => <Saisie {...a} value={adresse} onChange={(e) => setAdresse(e.target.value)} />}
            </Champ>

            <div className="space-y-1.5">
              <p className="text-legende font-semibold">Position sur la carte</p>
              <p className="text-[0.78rem] text-muted-foreground">
                C'est ce point qui sert au calcul de distance. Sans lui, aucun prix rendu chantier
                ne s'affiche sur vos produits.
              </p>
              <CartePoint point={point} onChange={setPoint} intitule="Position du dépôt" className="h-56" />
              {point ? (
                <p className="nombres text-[0.78rem] text-muted-foreground">
                  {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                </p>
              ) : (
                <p className="text-[0.78rem] text-accent-strong">Position non renseignée.</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Champ etiquette="Rayon de livraison maximum (km)" aide="Au-delà, Akora affiche « à négocier » plutôt qu'un prix inventé.">
                {(a) => <Saisie {...a} className="nombres" inputMode="decimal" value={rayon} onChange={(e) => setRayon(e.target.value)} />}
              </Champ>
              <Champ
                etiquette="Coefficient de sinuosité"
                aide="Vide = 1,30, la valeur d'Akora. Montez-le si vos routes tournent beaucoup."
              >
                {(a) => <Saisie {...a} className="nombres" inputMode="decimal" value={sinuosite} onChange={(e) => setSinuosite(e.target.value)} placeholder="1,30" />}
              </Champ>
            </div>
          </div>
        </Carte>

        <Carte className="p-4">
          <h3 className="text-produit">Paiement et facturation</h3>

          {!peutEncaisserEnLigne ? (
            <div className="mt-3">
              <AvertissementMetier titre="Paiement en ligne indisponible pour l'instant">
                Il faut le badge « Fournisseur vérifié » pour encaisser en ligne. Complétez votre
                dossier de vérification : c'est la même exigence pour tout le monde, et c'est ce
                qui fait que le badge veut dire quelque chose.
              </AvertissementMetier>
            </div>
          ) : null}

          <div className="mt-3 space-y-3">
            <fieldset>
              <legend className="text-legende font-semibold">Modes de paiement acceptés</legend>
              <div className="mt-1">
                {MODES.map((mode) => (
                  <LigneCase
                    key={mode}
                    id={"mode-" + mode}
                    etiquette={LIBELLE_MODE_PAIEMENT[mode]}
                    checked={modes.includes(mode)}
                    disabled={mode !== "a_la_livraison" && !peutEncaisserEnLigne}
                    onCheckedChange={(c) => basculerMode(mode, c === true)}
                  />
                ))}
              </div>
            </fieldset>

            {modes.includes("en_ligne_acompte") ? (
              <Champ etiquette="Acompte demandé (%)" aide="Entre 10 et 100. Le solde est réglé à la livraison.">
                {(a) => <Saisie {...a} className="nombres" inputMode="numeric" value={acompte} onChange={(e) => setAcompte(e.target.value)} />}
              </Champ>
            ) : null}

            <LigneCase
              id="assujetti-tva"
              etiquette="Je suis assujetti à la TVA"
              aide="Vos prix seront alors affichés « HT », avec la TVA calculée à part."
              checked={tva}
              onCheckedChange={(c) => setTva(c === true)}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Champ etiquette="Opérateur de versement" aide="Là où Akora vous verse vos ventes.">
                {(a) => (
                  <Liste value={operateur} onValueChange={(v) => setOperateur(v as OperateurPaiement)}>
                    <ListeDeclencheur id={a.id}>
                      <ListeValeur placeholder="Choisir un opérateur" />
                    </ListeDeclencheur>
                    <ListeContenu>
                      {OPERATEURS.map((o) => (
                        <ListeElement key={o} value={o}>
                          {NOM_OPERATEUR[o]}
                        </ListeElement>
                      ))}
                    </ListeContenu>
                  </Liste>
                )}
              </Champ>
              <Champ etiquette="Numéro de versement">
                {(a) => <Saisie {...a} type="tel" inputMode="tel" value={msisdn} onChange={(e) => setMsisdn(e.target.value)} />}
              </Champ>
            </div>
          </div>
        </Carte>

        <Bouton disabled={enCours} onClick={() => void enregistrer()}>
          {enCours ? "Enregistrement" : "Enregistrer ma vitrine"}
        </Bouton>
      </div>
    </>
  );
}
