import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { listerDossiers, statuerDocument, type DossierAVerifier } from "@/lib/donnees/admin";
import { urlSigneeAdmin } from "@/lib/donnees/documents";
import { DOCUMENTS_OBLIGATOIRES, LIBELLE_DOCUMENT } from "@/lib/types-metier";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { Saisie } from "@/components/ui/input";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

/**
 * File de vérification KYC (AKORA-DESIGN §11).
 *
 * Le bouton d'ouverture est libellé « Ouvrir (lien 60 s) » : le lien est signé
 * pour une minute, généré à la demande, et chaque ouverture écrit une ligne
 * dans le journal d'audit. C'est écrit en pied de file, pas caché.
 */
export default function Verifications() {
  const client = useQueryClient();
  const [motifs, setMotifs] = React.useState<Record<string, string>>({});

  const dossiers = useQuery({ queryKey: ["dossiers-kyc"], queryFn: listerDossiers, staleTime: 30_000 });

  const ouvrir = async (chemin: string) => {
    try {
      const url = await urlSigneeAdmin(chemin);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (erreur) {
      toast.error("Ouverture impossible", { description: (erreur as Error).message });
    }
  };

  const statuer = async (id: string, statut: "valide" | "refuse") => {
    try {
      await statuerDocument(id, statut, motifs[id]);
      await client.invalidateQueries({ queryKey: ["dossiers-kyc"] });
      toast.success(statut === "valide" ? "Pièce validée" : "Pièce refusée");
    } catch (erreur) {
      toast.error("Action refusée", { description: (erreur as Error).message });
    }
  };

  if (dossiers.isPending) return <Squelette className="h-64 w-full" />;

  const enAttente = (dossiers.data ?? []).filter((d) =>
    d.documents.some((doc) => doc.statut === "en_attente"),
  );

  if (enAttente.length === 0) {
    return <EtatVide titre="Aucun dossier à traiter" phrase="Toutes les pièces déposées ont été examinées." />;
  }

  return (
    <div className="space-y-4">
      {enAttente.map((dossier) => (
        <DossierKyc
          key={dossier.fournisseur_id}
          dossier={dossier}
          motifs={motifs}
          onMotif={(id, valeur) => setMotifs({ ...motifs, [id]: valeur })}
          onOuvrir={ouvrir}
          onStatuer={statuer}
        />
      ))}
      <p className="text-[0.78rem] text-muted-foreground">
        Chaque ouverture de document écrit une ligne dans le journal d'audit.
      </p>
    </div>
  );
}

function DossierKyc({
  dossier,
  motifs,
  onMotif,
  onOuvrir,
  onStatuer,
}: {
  dossier: DossierAVerifier;
  motifs: Record<string, string>;
  onMotif: (id: string, valeur: string) => void;
  onOuvrir: (chemin: string) => void;
  onStatuer: (id: string, statut: "valide" | "refuse") => void;
}) {
  const valides = DOCUMENTS_OBLIGATOIRES.filter(
    (t) => dossier.documents.find((d) => d.type === t)?.statut === "valide",
  ).length;

  return (
    <Carte className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-produit">{dossier.raison_sociale}</h2>
        <span className="nombres text-legende text-muted-foreground">
          {valides} / {DOCUMENTS_OBLIGATOIRES.length} pièces validées · {dossier.niveau_verification}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-border">
        {dossier.documents.map((doc) => (
          <li key={doc.id} className="py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block font-semibold">{LIBELLE_DOCUMENT[doc.type]}</span>
                {doc.numero ? (
                  <span className="block font-mono text-[0.78rem] text-muted-foreground">{doc.numero}</span>
                ) : null}
              </span>
              <Pastille ton={doc.statut === "valide" ? "succes" : doc.statut === "refuse" ? "danger" : "info"}>
                {doc.statut === "valide" ? "Validée" : doc.statut === "refuse" ? "Refusée" : "En attente"}
              </Pastille>
            </div>

            {doc.statut === "en_attente" ? (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                {doc.chemin_bucket ? (
                  <Bouton
                    variante="secondaire"
                    taille="compact"
                    onClick={() => onOuvrir(doc.chemin_bucket as string)}
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    Ouvrir (lien 60 s)
                  </Bouton>
                ) : null}
                <div className="min-w-[12rem] flex-1">
                  <label htmlFor={"motif-" + doc.id} className="text-[0.78rem] text-muted-foreground">
                    Motif, si vous refusez
                  </label>
                  <Saisie
                    id={"motif-" + doc.id}
                    className="mt-1"
                    value={motifs[doc.id] ?? ""}
                    onChange={(e) => onMotif(doc.id, e.target.value)}
                  />
                </div>
                <Bouton taille="compact" onClick={() => onStatuer(doc.id, "valide")}>
                  Valider
                </Bouton>
                <Bouton
                  variante="fantome"
                  taille="compact"
                  className="text-destructive-strong"
                  disabled={(motifs[doc.id] ?? "").trim().length < 3}
                  onClick={() => onStatuer(doc.id, "refuse")}
                >
                  Refuser
                </Bouton>
              </div>
            ) : doc.motif_refus ? (
              <p className="mt-1 text-legende text-destructive-strong">Motif : {doc.motif_refus}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Carte>
  );
}
