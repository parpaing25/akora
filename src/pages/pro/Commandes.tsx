import * as React from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import { changerStatutCommande, listerCommandesFournisseur, listerLignes } from "@/lib/donnees/commandes";
import { suitesFournisseur } from "@/lib/machines-etats";
import { LIBELLE_COMMANDE, LIBELLE_UNITE, type StatutCommande } from "@/lib/types-metier";
import { formaterAriary, formaterDate, formaterTelephone } from "@/lib/format";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { Onglets, OngletContenu, OngletDeclencheur, OngletsListe } from "@/components/ui/tabs";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

const FILES: { cle: string; libelle: string; statuts: StatutCommande[] }[] = [
  { cle: "a-traiter", libelle: "À traiter", statuts: ["envoyee", "vue", "devis_envoye", "acceptee"] },
  {
    cle: "en-cours",
    libelle: "En cours",
    statuts: ["en_attente_paiement", "payee", "en_preparation", "en_livraison"],
  },
  { cle: "terminees", libelle: "Terminées", statuts: ["livree", "cloturee"] },
  { cle: "problemes", libelle: "Problèmes", statuts: ["litige", "annulee", "refusee"] },
];

/** Commandes reçues. Les suites proposées viennent de la machine à états. */
export default function CommandesPro() {
  const fiche = useOutletContext<LigneFournisseur>();
  const client = useQueryClient();
  const [ouverte, setOuverte] = React.useState<string | null>(null);

  const commandes = useQuery({
    queryKey: ["commandes-pro", fiche.id],
    queryFn: () => listerCommandesFournisseur(fiche.id),
    staleTime: 30_000,
  });

  const lignes = useQuery({
    queryKey: ["lignes-pro", ouverte],
    queryFn: () => listerLignes(ouverte as string),
    enabled: Boolean(ouverte),
  });

  const avancer = async (id: string, statut: StatutCommande) => {
    try {
      await changerStatutCommande(id, statut);
      await client.invalidateQueries({ queryKey: ["commandes-pro", fiche.id] });
      toast.success("Commande mise à jour", { description: LIBELLE_COMMANDE[statut] });
    } catch (erreur) {
      toast.error("Changement refusé", { description: (erreur as Error).message });
    }
  };

  const toutes = commandes.data ?? [];

  return (
    <>
      <Seo titre="Commandes reçues" chemin="/pro/commandes" indexable={false} />
      <h2 className="text-section">Commandes reçues</h2>

      {commandes.isPending ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Squelette key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <Onglets defaultValue="a-traiter" className="mt-4">
          <OngletsListe>
            {FILES.map((file) => (
              <OngletDeclencheur
                key={file.cle}
                value={file.cle}
                compteur={toutes.filter((c) => file.statuts.includes(c.statut)).length}
              >
                {file.libelle}
              </OngletDeclencheur>
            ))}
          </OngletsListe>

          {FILES.map((file) => (
            <OngletContenu key={file.cle} value={file.cle}>
              <FileCommandes
                commandes={toutes.filter((c) => file.statuts.includes(c.statut))}
                libelle={file.libelle}
                ouverte={ouverte}
                lignes={lignes.data ?? []}
                onBasculer={(id) => setOuverte(ouverte === id ? null : id)}
                onAvancer={avancer}
              />
            </OngletContenu>
          ))}
        </Onglets>
      )}
    </>
  );
}

function FileCommandes({
  commandes,
  libelle,
  ouverte,
  lignes,
  onBasculer,
  onAvancer,
}: {
  commandes: Awaited<ReturnType<typeof listerCommandesFournisseur>>;
  libelle: string;
  ouverte: string | null;
  lignes: Awaited<ReturnType<typeof listerLignes>>;
  onBasculer: (id: string) => void;
  onAvancer: (id: string, statut: StatutCommande) => void;
}) {
  if (commandes.length === 0) {
    return <EtatVide titre="Rien ici" phrase={"Aucune commande dans « " + libelle.toLowerCase() + " »."} />;
  }

  return (
    <ul className="space-y-3">
      {commandes.map((commande) => (
        <li key={commande.id}>
          <Carte className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="nombres font-mono font-semibold">{commande.numero}</p>
                <p className="text-legende text-muted-foreground">
                  {commande.nom_contact} ·{" "}
                  <a href={"tel:" + commande.telephone_contact} className="nombres lien-souligne">
                    {formaterTelephone(commande.telephone_contact)}
                  </a>
                </p>
                <p className="text-[0.78rem] text-muted-foreground">
                  {formaterDate(commande.created_at)}
                  {commande.distance_km ? " · " + String(commande.distance_km) + " km" : ""}
                  {commande.adresse_libre ? " · " + commande.adresse_libre : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="nombres text-[1.0625rem] font-bold text-primary">
                  {formaterAriary(Number(commande.montant_total))}
                </p>
                <Pastille ton="info">{LIBELLE_COMMANDE[commande.statut]}</Pastille>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {suitesFournisseur(commande.statut).map((suite) => (
                <Bouton
                  key={suite}
                  variante={suite === "refusee" || suite === "annulee" ? "fantome" : "tertiaire"}
                  taille="compact"
                  className={suite === "refusee" || suite === "annulee" ? "text-destructive-strong" : ""}
                  onClick={() => onAvancer(commande.id, suite)}
                >
                  {LIBELLE_COMMANDE[suite]}
                </Bouton>
              ))}
              <Bouton variante="fantome" taille="compact" onClick={() => onBasculer(commande.id)}>
                {ouverte === commande.id ? "Masquer le détail" : "Voir le détail"}
              </Bouton>
            </div>

            {ouverte === commande.id ? (
              <ul className="mt-3 divide-y divide-border border-t border-border pt-2 text-legende">
                {lignes.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2 py-1.5">
                    <span>{l.designation_snapshot}</span>
                    <span className="nombres shrink-0">
                      {l.quantite} {LIBELLE_UNITE[l.unite_snapshot]} · {formaterAriary(Number(l.total_ligne))}
                    </span>
                  </li>
                ))}
                {commande.message ? (
                  <li className="py-1.5 text-muted-foreground">« {commande.message} »</li>
                ) : null}
              </ul>
            ) : null}
          </Carte>
        </li>
      ))}
    </ul>
  );
}
