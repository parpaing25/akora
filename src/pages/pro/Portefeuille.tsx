import * as React from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import {
  demanderRetrait,
  listerEcritures,
  listerRetraits,
  lirePortefeuille,
} from "@/lib/donnees/portefeuille";
import { soldeDepuisLedger, verifierChaine } from "@/lib/ledger";
import { formaterAriary, formaterDateHeure, NOM_OPERATEUR, normaliserTelephone, telephoneValide } from "@/lib/format";
import type { OperateurPaiement } from "@/lib/types-metier";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { Tableau, TableauCorps, TableauTete } from "@/components/ui/table";
import { Squelette } from "@/components/ui/skeleton";
import { AvertissementMetier, EtatVide } from "@/components/ui/etats";

const LIBELLE_RETRAIT: Record<string, string> = {
  demande: "Demandé",
  en_cours: "En cours",
  paye: "Versé",
  refuse: "Refusé",
};

/**
 * Portefeuille du fournisseur.
 *
 * Le solde affiché est celui de la table, mais on le CONFRONTE au ledger sous
 * les yeux du fournisseur. Si les deux divergent, il le voit avant nous — et
 * c'est exactement l'effet recherché : un solde qui ne se reconstitue pas est
 * un bug, pas une approximation.
 */
export default function Portefeuille() {
  const fiche = useOutletContext<LigneFournisseur>();
  const client = useQueryClient();
  const [montant, setMontant] = React.useState("");
  const [operateur, setOperateur] = React.useState<OperateurPaiement>(
    (fiche.operateur_versement as OperateurPaiement) ?? "mvola",
  );
  const [msisdn, setMsisdn] = React.useState(fiche.msisdn_versement ?? "");
  const [enCours, setEnCours] = React.useState(false);

  const portefeuille = useQuery({
    queryKey: ["portefeuille", fiche.id],
    queryFn: () => lirePortefeuille(fiche.id),
    staleTime: 30_000,
  });
  const ecritures = useQuery({
    queryKey: ["ledger", fiche.id],
    queryFn: () => listerEcritures(fiche.id),
    staleTime: 30_000,
  });
  const retraits = useQuery({
    queryKey: ["retraits", fiche.id],
    queryFn: () => listerRetraits(fiche.id),
    staleTime: 30_000,
  });

  const disponible = Number(portefeuille.data?.solde_disponible ?? 0);
  const sequestre = Number(portefeuille.data?.solde_sequestre ?? 0);
  const soldeLedger = soldeDepuisLedger(ecritures.data ?? []);
  const ecart = disponible - soldeLedger;
  const anomalies = verifierChaine(ecritures.data ?? []);

  const envoyer = async () => {
    const valeur = Number.parseInt(montant, 10);
    if (!(valeur > 0)) {
      toast.error("Montant invalide");
      return;
    }
    if (!telephoneValide(msisdn)) {
      toast.error("Numéro de versement invalide");
      return;
    }
    setEnCours(true);
    try {
      await demanderRetrait({
        fournisseur_id: fiche.id,
        montant: valeur,
        operateur,
        msisdn: normaliserTelephone(msisdn) as string,
      });
      setMontant("");
      await client.invalidateQueries({ queryKey: ["retraits", fiche.id] });
      toast.success("Demande envoyée", { description: "Un administrateur va l'exécuter." });
    } catch (erreur) {
      toast.error("Demande refusée", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <>
      <Seo titre="Portefeuille" chemin="/pro/portefeuille" indexable={false} />
      <h2 className="text-section">Portefeuille</h2>

      {portefeuille.isPending ? (
        <Squelette className="mt-4 h-24 w-full" />
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Carte className="p-4">
            <p className="text-legende text-muted-foreground">Disponible</p>
            <p className="nombres mt-1 text-[1.75rem] font-bold tracking-tight text-primary">
              {formaterAriary(disponible)}
            </p>
            <p className="mt-1 text-[0.78rem] text-muted-foreground">Retirable dès maintenant.</p>
          </Carte>
          <Carte className="p-4">
            <p className="text-legende text-muted-foreground">Sous séquestre</p>
            <p className="nombres mt-1 text-[1.75rem] font-bold tracking-tight">{formaterAriary(sequestre)}</p>
            <p className="mt-1 text-[0.78rem] text-muted-foreground">
              Payé par l'acheteur, versé après confirmation de livraison.
            </p>
          </Carte>
        </div>
      )}

      {ecart !== 0 || anomalies.length > 0 ? (
        <div className="mt-3">
          <AvertissementMetier titre="Le solde ne se reconstitue pas depuis les écritures">
            Solde affiché <span className="nombres">{formaterAriary(disponible)}</span>, somme des
            écritures <span className="nombres">{formaterAriary(soldeLedger)}</span>
            {anomalies.length > 0 ? ", " + anomalies.length + " rupture(s) de chaîne" : ""}. Signalez-le :
            c'est un défaut, pas un arrondi.
          </AvertissementMetier>
        </div>
      ) : null}

      <Carte className="mt-4 p-4">
        <h3 className="text-produit">Demander un versement</h3>
        <p className="mt-0.5 text-legende text-muted-foreground">
          Akora verse sur votre numéro mobile money. Le minimum et le solde disponible sont vérifiés
          à l'envoi.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Champ etiquette="Montant (Ar)">
            {(a) => (
              <Saisie
                {...a}
                className="nombres"
                inputMode="numeric"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
              />
            )}
          </Champ>
          <Champ etiquette="Opérateur">
            {(a) => (
              <select
                id={a.id}
                value={operateur}
                onChange={(e) => setOperateur(e.target.value as OperateurPaiement)}
                className="flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-[0.9375rem]"
              >
                {(["mvola", "orange_money", "airtel_money"] as OperateurPaiement[]).map((o) => (
                  <option key={o} value={o}>
                    {NOM_OPERATEUR[o]}
                  </option>
                ))}
              </select>
            )}
          </Champ>
          <Champ etiquette="Numéro">
            {(a) => (
              <Saisie {...a} type="tel" inputMode="tel" value={msisdn} onChange={(e) => setMsisdn(e.target.value)} />
            )}
          </Champ>
        </div>
        <Bouton className="mt-3" disabled={enCours} onClick={() => void envoyer()}>
          {enCours ? "Envoi" : "Demander le versement"}
        </Bouton>
      </Carte>

      {(retraits.data ?? []).length > 0 ? (
        <>
          <h3 className="mt-5 text-produit">Mes versements</h3>
          <Tableau conteneurClassName="mt-2">
            <TableauTete>
              <tr>
                <th scope="col">Demandé le</th>
                <th scope="col">Montant</th>
                <th scope="col">Vers</th>
                <th scope="col">Statut</th>
                <th scope="col">Référence</th>
              </tr>
            </TableauTete>
            <TableauCorps>
              {(retraits.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td data-nombre="">{formaterDateHeure(r.demande_le)}</td>
                  <td data-nombre="">{formaterAriary(Number(r.montant))}</td>
                  <td className="nombres">{r.msisdn}</td>
                  <td>
                    <Pastille ton={r.statut === "paye" ? "succes" : r.statut === "refuse" ? "danger" : "info"}>
                      {LIBELLE_RETRAIT[r.statut] ?? r.statut}
                    </Pastille>
                    {r.motif_refus ? (
                      <span className="block text-[0.72rem] text-destructive-strong">{r.motif_refus}</span>
                    ) : null}
                  </td>
                  <td className="font-mono text-[0.8rem]">{r.reference ?? "—"}</td>
                </tr>
              ))}
            </TableauCorps>
          </Tableau>
        </>
      ) : null}

      <h3 className="mt-5 text-produit">Mouvements</h3>
      {(ecritures.data ?? []).length === 0 ? (
        <div className="mt-2">
          <EtatVide
            titre="Aucun mouvement"
            phrase="Votre premier encaissement apparaîtra ici, ligne par ligne."
          />
        </div>
      ) : (
        <Tableau conteneurClassName="mt-2">
          <TableauTete>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Libellé</th>
              <th scope="col">Montant</th>
              <th scope="col">Solde après</th>
            </tr>
          </TableauTete>
          <TableauCorps>
            {(ecritures.data ?? []).map((e) => (
              <tr key={e.id}>
                <td data-nombre="">{formaterDateHeure(e.created_at)}</td>
                <td>{e.libelle}</td>
                <td data-nombre="" className={Number(e.montant) < 0 ? "text-destructive-strong" : "text-success-strong"}>
                  {Number(e.montant) > 0 ? "+" : ""}
                  {formaterAriary(Number(e.montant))}
                </td>
                <td data-nombre="">{formaterAriary(Number(e.solde_apres))}</td>
              </tr>
            ))}
          </TableauCorps>
        </Tableau>
      )}
      <p className="mt-2 text-[0.78rem] text-muted-foreground">
        Ces lignes sont immuables. Une correction s'écrit en ajoutant un ajustement, jamais en
        réécrivant le passé — c'est ce qui rend votre solde vérifiable.
      </p>
    </>
  );
}
