import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { demandesPourMonDepot, proposer, type DemandePourDepot } from "@/lib/donnees/demandes";
import { formaterAriary, formaterDate } from "@/lib/format";
import { LIBELLE_UNITE } from "@/lib/types-metier";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";

/**
 * Les demandes des acheteurs qui portent sur ce que JE vends — et mon prix.
 *
 * Une demande n'apparaît ici que si au moins une de ses lignes correspond à
 * un produit actif de mon catalogue : je ne suis pas dérangé pour du sable
 * si je vends des tôles. Mon prix catalogue est proposé par défaut ; je
 * l'ajuste ligne par ligne, je dis ce que je n'ai pas, j'ajoute la livraison
 * et un délai. L'acheteur reçoit tout sur la page de sa demande.
 */
export default function Demandes() {
  const client = useQueryClient();
  const demandes = useQuery({
    queryKey: ["demandes-pro"],
    queryFn: demandesPourMonDepot,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  return (
    <>
      <Seo titre="Demandes des acheteurs" chemin="/pro/demandes" indexable={false} />
      <h2 className="text-section">Demandes des acheteurs</h2>
      <p className="mt-1 text-legende text-muted-foreground">
        Celles qui portent sur vos matériaux, les plus proches d'abord. Proposez votre prix : il
        arrive directement chez l'acheteur.
      </p>

      <div className="mt-4" aria-live="polite">
        {demandes.isPending ? (
          <div className="space-y-3">
            <Squelette className="h-40 w-full" />
            <Squelette className="h-40 w-full" />
          </div>
        ) : demandes.isError ? (
          <EtatErreur onReessayer={() => void demandes.refetch()} />
        ) : demandes.data.length === 0 ? (
          <EtatVide
            titre="Aucune demande pour vos matériaux en ce moment"
            phrase="Dès qu'un acheteur cherche ce que vous vendez près de chez vous, la demande apparaît ici et vous êtes prévenu."
          />
        ) : (
          <ul className="space-y-4">
            {demandes.data.map((d, index) => (
              <li key={d.id} className="entree" style={{ animationDelay: `${60 * index}ms` }}>
                <CarteDemande demande={d} onPropose={() => void client.invalidateQueries({ queryKey: ["demandes-pro"] })} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function CarteDemande({
  demande: d,
  onPropose,
  ouvertAuDepart = false,
}: {
  demande: DemandePourDepot;
  onPropose: () => void;
  /** Pour l'aperçu et l'audit : le formulaire de proposition déjà déplié. */
  ouvertAuDepart?: boolean;
}) {
  const [ouvert, setOuvert] = React.useState(ouvertAuDepart);
  const [prix, setPrix] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(d.lignes.map((l) => [l.id, l.mon_prix != null ? String(l.mon_prix) : ""])),
  );
  const [indispo, setIndispo] = React.useState<Record<string, boolean>>({});
  const [livraison, setLivraison] = React.useState("");
  const [delai, setDelai] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);

  const total = d.lignes.reduce((somme, l) => {
    if (indispo[l.id]) return somme;
    const p = Number(prix[l.id]);
    return somme + (p > 0 ? p * Number(l.quantite) : 0);
  }, 0) + (Number(livraison) > 0 ? Number(livraison) : 0);

  const envoyer = async () => {
    const lignes = d.lignes.map((l) => ({
      ligne_id: l.id,
      prix_unitaire: indispo[l.id] ? null : Number(prix[l.id]) > 0 ? Math.round(Number(prix[l.id])) : null,
      disponible: !indispo[l.id],
    }));
    if (!lignes.some((l) => l.disponible && l.prix_unitaire != null)) {
      toast.error("Indiquez au moins un prix.");
      return;
    }
    setEnCours(true);
    try {
      await proposer({
        demandeId: d.id,
        lignes,
        livraison: livraison === "" ? null : Math.max(0, Math.round(Number(livraison))),
        delaiJours: delai === "" ? null : Math.max(0, Math.round(Number(delai))),
        message: message.trim() || null,
      });
      toast.success("Proposition envoyée", { description: "L'acheteur est prévenu." });
      setOuvert(false);
      onPropose();
    } catch (erreur) {
      toast.error("Envoi impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  const lieu = d.libelle_lieu ?? d.localite_nom ?? "lieu non précisé";

  return (
    <Carte className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-produit">
            <MapPin className="size-4 text-primary" aria-hidden="true" />
            {lieu}
            {d.distance_km != null ? (
              <span className="nombres text-legende font-normal text-muted-foreground">· {Number(d.distance_km).toFixed(1).replace(".", ",")} km</span>
            ) : null}
          </p>
          <p className="nombres mt-0.5 text-legende text-muted-foreground">
            reçue le {formaterDate(d.created_at)}
            {d.date_souhaitee ? <> · souhaitée pour le {formaterDate(d.date_souhaitee)}</> : null}
          </p>
        </div>
        {d.deja_propose ? (
          <span className={"rounded-full px-2.5 py-0.5 text-[0.78rem] font-semibold " + (d.statut_proposition === "acceptee" ? "bg-success-soft text-success-strong" : d.statut_proposition === "refusee" ? "bg-muted text-muted-foreground" : "bg-secondary-soft text-secondary-strong")}>
            {d.statut_proposition === "acceptee" ? "Acceptée" : d.statut_proposition === "refusee" ? "Refusée" : "Proposé"}
          </span>
        ) : (
          <span className="nombres rounded-full bg-primary-soft px-2.5 py-0.5 text-[0.78rem] font-semibold text-primary-strong">
            {d.nb_correspondances} de vos produits
          </span>
        )}
      </div>

      <ul className="mt-3 divide-y divide-border/60 text-legende">
        {d.lignes.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span className={l.mon_produit_id ? "font-semibold" : "text-muted-foreground"}>
              {l.nom}
              {l.precision ? <span className="font-normal text-muted-foreground"> · {l.precision}</span> : null}
            </span>
            <span className="nombres">{Number(l.quantite)} {LIBELLE_UNITE[l.unite] ?? l.unite}</span>
          </li>
        ))}
      </ul>
      {d.note ? <p className="mt-2 text-legende text-muted-foreground">« {d.note} »</p> : null}

      {!ouvert ? (
        <Bouton className="mt-3" onClick={() => setOuvert(true)} pleineLargeur variante={d.deja_propose ? "secondaire" : "principal"}>
          <Send className="size-4" aria-hidden="true" />
          {d.deja_propose ? "Modifier ma proposition" : "Proposer mon prix"}
        </Bouton>
      ) : (
        <div className="panneau mt-3 rounded-md bg-muted p-3">
          <p className="text-legende font-semibold">Votre prix, par matériau</p>
          <ul className="mt-2 space-y-2">
            {d.lignes.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-legende">{l.nom}</span>
                <label className="flex items-center gap-1.5">
                  <span className="sr-only">Prix unitaire pour {l.nom}</span>
                  <input
                    id={`prix-${l.id}`}
                    aria-label={`Prix unitaire pour ${l.nom}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={prix[l.id] ?? ""}
                    disabled={Boolean(indispo[l.id])}
                    onChange={(e) => setPrix((p) => ({ ...p, [l.id]: e.target.value }))}
                    placeholder="Ar"
                    className="nombres h-11 w-28 rounded-md border border-input bg-card px-3 text-right text-courant font-semibold disabled:opacity-50"
                  />
                  <span className="text-legende text-muted-foreground">/ {LIBELLE_UNITE[l.unite] ?? l.unite}</span>
                </label>
                <label className="flex items-center gap-1.5 text-legende text-muted-foreground">
                  <input
                    id={`indispo-${l.id}`}
                    aria-label={`Je n'ai pas ${l.nom}`}
                    type="checkbox"
                    checked={Boolean(indispo[l.id])}
                    onChange={(e) => setIndispo((x) => ({ ...x, [l.id]: e.target.checked }))}
                    className="size-4 accent-[hsl(var(--primary))]"
                  />
                  je n'ai pas
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-legende font-semibold">Livraison jusqu'au chantier</span>
              <input id={`livraison-${d.id}`} aria-label="Livraison jusqu'au chantier, en ariary" type="number" inputMode="numeric" min="0" value={livraison} onChange={(e) => setLivraison(e.target.value)} placeholder="à convenir" className="nombres h-11 w-44 rounded-md border border-input bg-card px-3 text-courant" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-legende font-semibold">Délai</span>
              <span className="flex items-center gap-1.5">
                <input id={`delai-${d.id}`} aria-label="Délai de livraison, en jours" type="number" inputMode="numeric" min="0" max="90" value={delai} onChange={(e) => setDelai(e.target.value)} className="nombres h-11 w-20 rounded-md border border-input bg-card px-3 text-courant" />
                <span className="text-legende text-muted-foreground">jours</span>
              </span>
            </label>
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
              <span className="text-legende font-semibold">Un mot</span>
              <input id={`mot-${d.id}`} aria-label="Un mot pour l'acheteur" type="text" maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Stock disponible dès demain" className="h-11 rounded-md border border-input bg-card px-3 text-courant" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="nombres text-legende text-muted-foreground">
              Rendu chantier : <span className="text-[1.125rem] font-bold text-primary">{formaterAriary(total)}</span>
            </p>
            <div className="flex gap-2">
              <Bouton variante="fantome" taille="compact" onClick={() => setOuvert(false)} disabled={enCours}>Annuler</Bouton>
              <Bouton taille="compact" onClick={envoyer} disabled={enCours}>
                {enCours ? "Envoi…" : "Envoyer à l'acheteur"}
              </Bouton>
            </div>
          </div>
        </div>
      )}
    </Carte>
  );
}
