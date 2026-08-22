import * as React from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import {
  deposerPiece,
  enregistrerNumero,
  listerDocuments,
  type DocumentFournisseur,
} from "@/lib/donnees/documents";
import { DOCUMENTS_OBLIGATOIRES, LIBELLE_DOCUMENT, type TypeDocument } from "@/lib/types-metier";
import { formaterDate } from "@/lib/format";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { Progression } from "@/components/ui/progress";
import { Pastille } from "@/components/ui/badge";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur } from "@/components/ui/etats";

const AVEC_NUMERO: TypeDocument[] = ["nif", "stat", "rcs"];
const FACULTATIFS: TypeDocument[] = ["photo_camion"];
const TOUS: TypeDocument[] = [...DOCUMENTS_OBLIGATOIRES, ...FACULTATIFS];

function PastilleStatut({ document }: { document: DocumentFournisseur | undefined }) {
  const statut = document?.statut;
  if (statut === "valide") {
    return (
      <Pastille ton="succes">
        Validée{document?.valide_le ? " le " + formaterDate(document.valide_le) : ""}
      </Pastille>
    );
  }
  if (statut === "refuse") return <Pastille ton="danger">Refusée</Pastille>;
  if (statut === "en_attente") return <Pastille ton="info">En cours d'examen</Pastille>;
  return <Pastille ton="contour">Manquante</Pastille>;
}

function LignePiece({
  type,
  document,
  fournisseurId,
  userId,
  onFait,
}: {
  type: TypeDocument;
  document: DocumentFournisseur | undefined;
  fournisseurId: string;
  userId: string;
  onFait: () => void;
}) {
  const [enCours, setEnCours] = React.useState(false);
  const [numero, setNumero] = React.useState(document?.numero ?? "");
  const champFichier = React.useRef<HTMLInputElement>(null);

  const envoyer = async (fichier: File) => {
    setEnCours(true);
    try {
      await deposerPiece(fournisseurId, userId, type, fichier, numero || null);
      toast.success("Pièce envoyée", { description: "Un administrateur va l'examiner." });
      onFait();
    } catch (erreur) {
      toast.error("Envoi impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  const enregistrer = async () => {
    setEnCours(true);
    try {
      await enregistrerNumero(fournisseurId, type, numero.trim());
      toast.success("Numéro enregistré");
      onFait();
    } catch (erreur) {
      toast.error("Enregistrement impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <li className="border-b border-border py-3 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-semibold">
            {LIBELLE_DOCUMENT[type]}
            {FACULTATIFS.includes(type) ? (
              <span className="ml-1.5 text-[0.78rem] font-normal text-muted-foreground">(facultatif)</span>
            ) : null}
          </p>
          {document?.statut === "refuse" && document.motif_refus ? (
            <p className="mt-0.5 text-legende text-destructive-strong">Motif : {document.motif_refus}</p>
          ) : null}
          {document?.chemin_bucket && document.statut !== "refuse" ? (
            <p className="mt-0.5 text-[0.78rem] text-muted-foreground">Document déposé.</p>
          ) : null}
        </div>
        <PastilleStatut document={document} />
      </div>

      {AVEC_NUMERO.includes(type) ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Champ etiquette="Numéro" className="min-w-[12rem] flex-1">
            {(a) => (
              <Saisie {...a} value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="numeric" />
            )}
          </Champ>
          <Bouton variante="tertiaire" disabled={enCours || numero.trim().length === 0} onClick={() => void enregistrer()}>
            Enregistrer le numéro
          </Bouton>
        </div>
      ) : null}

      <div className="mt-2">
        <label htmlFor={"fichier-" + type} className="sr-only">
          Choisir le scan pour {LIBELLE_DOCUMENT[type]}
        </label>
        <input
          id={"fichier-" + type}
          ref={champFichier}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={(e) => {
            const fichier = e.target.files?.[0];
            if (fichier) void envoyer(fichier);
            e.target.value = "";
          }}
        />
        <Bouton
          variante={document?.chemin_bucket ? "tertiaire" : "secondaire"}
          taille="compact"
          disabled={enCours}
          onClick={() => champFichier.current?.click()}
        >
          {enCours ? "Envoi en cours" : document?.chemin_bucket ? "Remplacer le scan" : "Envoyer le scan"}
        </Bouton>
      </div>
    </li>
  );
}

/**
 * Dossier de vérification (AKORA-DESIGN §10).
 * Barre de progression, puis une ligne par pièce avec sa pastille de statut,
 * le motif de refus en clair, et une seule action par ligne.
 */
export default function Verification() {
  const fiche = useOutletContext<LigneFournisseur>();
  const { utilisateur } = useAuth();
  const client = useQueryClient();

  const documents = useQuery({
    queryKey: ["documents", fiche.id],
    queryFn: () => listerDocuments(fiche.id),
    staleTime: 60_000,
  });

  const parType = new Map((documents.data ?? []).map((d) => [d.type, d]));
  const valides = DOCUMENTS_OBLIGATOIRES.filter((t) => parType.get(t)?.statut === "valide").length;
  const total = DOCUMENTS_OBLIGATOIRES.length;

  const rafraichir = () => {
    void client.invalidateQueries({ queryKey: ["documents", fiche.id] });
    void client.invalidateQueries({ queryKey: ["ma-fiche"] });
  };

  return (
    <>
      <Seo titre="Dossier de vérification" chemin="/pro/verification" indexable={false} />
      <h2 className="text-section">Dossier de vérification</h2>
      <p className="mt-1 text-legende text-muted-foreground">
        Le badge bleu débloque le paiement en ligne et le tri « vérifiés d'abord ». Il ne s'obtient
        que sur pièces.
      </p>

      <Carte className="mt-4 p-4">
        <p className="nombres text-[0.9375rem] font-semibold" aria-live="polite">
          {valides} pièce{valides > 1 ? "s" : ""} sur {total} validée{valides > 1 ? "s" : ""}
        </p>
        <Progression className="mt-2" value={(valides / total) * 100} />

        {documents.isPending ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Squelette key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : documents.isError ? (
          <div className="mt-4">
            <EtatErreur onReessayer={() => void documents.refetch()} />
          </div>
        ) : (
          <ul className="mt-3">
            {TOUS.map((type) => (
              <LignePiece
                key={type}
                type={type}
                document={parType.get(type)}
                fournisseurId={fiche.id}
                userId={utilisateur?.id ?? ""}
                onFait={rafraichir}
              />
            ))}
          </ul>
        )}
      </Carte>

      <p className="mt-3 rounded-md border-l-4 border-l-secondary bg-secondary-soft px-3 py-2.5 text-legende text-secondary-strong">
        Vos scans partent dans un stockage privé. Seuls les administrateurs y accèdent, par lien
        temporaire, et chaque consultation est journalisée.
      </p>
    </>
  );
}
