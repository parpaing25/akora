import { cn } from "@/lib/utils";
import { formaterDate } from "@/lib/format";
import type { NiveauVerification } from "@/lib/types-metier";
import { Infobulle, InfobulleContenu, InfobulleDeclencheur } from "@/components/ui/tooltip";

/**
 * LE badge de vérification. Écrit une seule fois, réutilisé partout : carte
 * produit, vitrine, comparateur, page commande, espace pro (AKORA-DESIGN §5).
 * Ne jamais le redessiner localement — c'est un interdit de design (§14).
 *
 * L'infobulle dit CE QUI a été vérifié et QUAND. Jamais un document, jamais un
 * lien vers un scan : les pièces d'identité ne sortent pas du bucket privé (B5).
 */

type Apparence = { libelle: string; pill: string; puce: string };

const APPARENCE: Record<NiveauVerification, Apparence> = {
  partenaire: {
    libelle: "Partenaire Akora",
    pill: "bg-accent-soft text-accent-strong",
    puce: "bg-accent",
  },
  verifie: {
    libelle: "Fournisseur vérifié",
    pill: "bg-secondary-soft text-secondary-strong",
    puce: "bg-secondary",
  },
  en_cours: {
    libelle: "Vérification en cours",
    pill: "bg-muted text-muted-foreground",
    puce: "bg-muted-foreground",
  },
  non_verifie: {
    libelle: "Non vérifié",
    pill: "border border-dashed border-border text-muted-foreground",
    puce: "bg-border",
  },
};

export interface ProprietesBadgeVerification {
  niveau: NiveauVerification;
  /** Date de validation du dossier, pour l'infobulle. */
  verifieLe?: string | null;
  /** Pièces effectivement validées, affichées dans l'infobulle. */
  piecesValidees?: readonly string[];
  /** Sur une carte produit, le badge se réduit à sa puce colorée (§5). */
  compact?: boolean;
  className?: string;
}

function texteInfobulle(
  niveau: NiveauVerification,
  verifieLe?: string | null,
  piecesValidees?: readonly string[],
): string | null {
  if (niveau !== "verifie" && niveau !== "partenaire") return null;
  const pieces = piecesValidees?.length ? piecesValidees.join(", ") : "NIF, STAT, RCS";
  const quand = verifieLe ? ` le ${formaterDate(verifieLe)}` : "";
  const entete = niveau === "partenaire" ? "Partenaire Akora." : "";
  return `${entete} Identité légale vérifiée${quand} : ${pieces}.`.trim();
}

export function BadgeVerification({
  niveau,
  verifieLe,
  piecesValidees,
  compact = false,
  className,
}: ProprietesBadgeVerification) {
  const apparence = APPARENCE[niveau];
  const infobulle = texteInfobulle(niveau, verifieLe, piecesValidees);

  if (compact) {
    // Sur une carte produit : la puce seule, à côté du nom du fournisseur.
    return (
      <span
        className={cn("inline-block size-2 shrink-0 rounded-full align-middle", apparence.puce, className)}
        role="img"
        aria-label={apparence.libelle}
        title={apparence.libelle}
      />
    );
  }

  const pill = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.78rem] font-semibold leading-5",
        apparence.pill,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", apparence.puce)} />
      {apparence.libelle}
    </span>
  );

  if (!infobulle) return pill;

  return (
    <Infobulle>
      <InfobulleDeclencheur asChild>
        <button type="button" className="cursor-help rounded-full" aria-label={`${apparence.libelle}. ${infobulle}`}>
          {pill}
        </button>
      </InfobulleDeclencheur>
      <InfobulleContenu>{infobulle}</InfobulleContenu>
    </Infobulle>
  );
}
