import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MapPin, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePointLivraison } from "@/lib/point-livraison";
import { supabase } from "@/integrations/supabase/client";
import {
  creerDemande,
  fermerDemande,
  maDemande,
  repondreProposition,
  totalProposition,
  type LigneDemande,
  type MaDemande,
  type Proposition,
} from "@/lib/donnees/demandes";
import { listerFormats, rechercherReferentiel, type FormatVitrine } from "@/lib/donnees/referentiel";
import { formaterAriary, formaterDate } from "@/lib/format";
import { LIBELLE_UNITE } from "@/lib/types-metier";
import { Seo } from "@/components/Seo";
import { Bouton } from "@/components/ui/button";
import { Carte } from "@/components/ui/card";
import { Saisie } from "@/components/ui/input";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";
import { BadgeVerification } from "@/components/marque/BadgeVerification";
import { RevelerContact } from "@/components/marque/RevelerContact";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { AnneauProgression } from "@/components/motion/AnneauProgression";

/**
 * Je cherche… — la demande d'achat, refaite le 02/09/2026.
 *
 * Avant : un texte libre, illisible par une machine, sans réponse possible.
 * Maintenant : des LIGNES du catalogue fermé (matériau + quantité), un lieu,
 * une date — une seule demande ouverte par personne. Les dépôts qui vendent
 * ces matériaux dans leur rayon sont prévenus et proposent un prix depuis
 * leur espace ; les propositions arrivent ICI, sur la même page, à côté des
 * suggestions tirées de la base (`offres_pour_materiaux`).
 */
interface LigneSaisie {
  cle: string;
  format: FormatVitrine;
  quantite: number;
}

export default function DemandeNouvelle() {
  const { session, profil, chargementProfil } = useAuth();
  const client = useQueryClient();

  const demande = useQuery({
    queryKey: ["ma-demande"],
    queryFn: maDemande,
    enabled: Boolean(session),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  if (!session) {
    return (
      <div className="container max-w-lg py-10">
        <Seo titre="Je cherche un matériau" chemin="/demandes/nouvelle" indexable={false} />
        <h1 className="text-page">Je cherche…</h1>
        <Carte className="mt-5 p-4">
          <p className="text-courant">
            Choisissez vos matériaux et vos quantités : les dépôts qui les vendent près de votre
            chantier vous répondent avec leur prix. Il faut un compte, c'est ce qui leur permet de
            vous répondre.
          </p>
          <Bouton asChild className="mt-4" pleineLargeur>
            <Link to="/connexion" state={{ retour: "/demandes/nouvelle" }}>Se connecter</Link>
          </Bouton>
        </Carte>
      </div>
    );
  }

  if (!chargementProfil && profil && profil.email_verifie !== true) {
    return (
      <div className="container max-w-lg py-10">
        <Seo titre="Je cherche un matériau" chemin="/demandes/nouvelle" indexable={false} />
        <h1 className="text-page">Confirmez votre adresse d'abord</h1>
        <Carte className="mt-5 p-4">
          <p className="text-courant">
            Une demande engage des dépôts à préparer un prix. On ne l'ouvre qu'à des comptes dont
            l'adresse est confirmée.
          </p>
          <Bouton asChild className="mt-4" pleineLargeur>
            <Link to="/verification-email">Confirmer mon adresse</Link>
          </Bouton>
        </Carte>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <Seo titre="Je cherche un matériau" chemin="/demandes/nouvelle" indexable={false} />
      {demande.isPending ? (
        <div className="max-w-lg space-y-3">
          <Squelette className="h-8 w-48" />
          <Squelette className="h-40 w-full" />
        </div>
      ) : demande.data ? (
        <VueDemande
          demande={demande.data}
          onChange={() => void client.invalidateQueries({ queryKey: ["ma-demande"] })}
        />
      ) : (
        <Formulaire onCree={() => void client.invalidateQueries({ queryKey: ["ma-demande"] })} />
      )}
    </div>
  );
}

/* ── Le formulaire ─────────────────────────────────────────────────────── */

export function Formulaire({ onCree }: { onCree: () => void }) {
  const { point } = usePointLivraison();
  const [recherche, setRecherche] = React.useState("");
  const [typeOuvert, setTypeOuvert] = React.useState<string | null>(null);
  const [lignes, setLignes] = React.useState<LigneSaisie[]>([]);
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);

  const resultats = useQuery({
    queryKey: ["referentiel-demande", recherche],
    queryFn: () => rechercherReferentiel(recherche, null, 8),
    enabled: recherche.trim().length >= 2,
    staleTime: 5 * 60_000,
  });
  const formatsDuType = useQuery({
    queryKey: ["formats", typeOuvert],
    queryFn: () => listerFormats(typeOuvert as string),
    enabled: Boolean(typeOuvert),
    staleTime: 30 * 60_000,
  });

  const ajouter = (format: FormatVitrine) => {
    if (lignes.some((l) => l.format.id === format.id)) {
      toast.info("Déjà dans votre demande");
      return;
    }
    if (lignes.length >= 10) {
      toast.error("Dix matériaux au maximum par demande.");
      return;
    }
    setLignes((l) => [...l, { cle: format.id, format, quantite: 1 }]);
    setRecherche("");
    setTypeOuvert(null);
  };

  const gestes = [lignes.length > 0, lignes.every((l) => l.quantite > 0) && lignes.length > 0, Boolean(point)];
  const pret = gestes.every(Boolean) && !enCours;

  const soumettre = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    if (!pret || !point) return;
    setEnCours(true);
    try {
      await creerDemande({
        lignes: lignes.map((l) => ({ materiau_ref_id: l.format.id, quantite: l.quantite })),
        localiteId: point.localiteId ?? null,
        lat: point.lat,
        lng: point.lng,
        libelleLieu: point.libelle,
        dateSouhaitee: date || null,
        note: note.trim() || null,
      });
      toast.success("Votre demande est partie", {
        description: "Les dépôts proches qui vendent ces matériaux sont prévenus.",
      });
      onCree();
    } catch (erreur) {
      toast.error("Demande impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={soumettre} className="max-w-2xl space-y-5" noValidate>
        <div className="flex items-center gap-4">
          <AnneauProgression fait={gestes.filter(Boolean).length} total={3} />
          <div>
            <h1 className="text-page">Je cherche…</h1>
            <p className="mt-1 text-legende text-muted-foreground">
              Vos matériaux, vos quantités, votre chantier. Les dépôts proches vous répondent avec
              leur prix.
            </p>
          </div>
        </div>

        {/* 1 · Les matériaux */}
        <Carte className="p-4">
          <p className="text-produit">1 · Quels matériaux ?</p>
          <div className="relative mt-2">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Saisie
              type="search"
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value);
                setTypeOuvert(null);
              }}
              placeholder="Hourdis, sable, fer 10, tôle…"
              aria-label="Chercher un matériau du catalogue"
              className="pl-9"
            />
          </div>

          {recherche.trim().length >= 2 ? (
            <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">
              {resultats.isPending ? (
                <Squelette className="h-9 w-40" />
              ) : (resultats.data ?? []).length === 0 ? (
                <p className="text-legende text-muted-foreground">Rien au catalogue sous ce nom.</p>
              ) : (
                (resultats.data ?? [])
                  .filter((r) => r.kind !== "famille")
                  .map((r) => (
                    <button
                      key={r.kind + r.id}
                      type="button"
                      onClick={() => {
                        if (r.kind === "type" && r.type_slug) setTypeOuvert(r.type_slug);
                        else if (r.kind === "format" && r.format_slug) {
                          if (r.type_slug) setTypeOuvert(r.type_slug);
                          void listerFormats(r.type_slug as string).then((formats) => {
                            const f = formats.find((x) => x.slug === r.format_slug);
                            if (f) ajouter(f);
                          });
                        }
                      }}
                      className="chip inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-3 text-legende font-semibold text-primary-strong"
                    >
                      {r.nom}
                      <span className="font-normal text-muted-foreground">
                        {r.kind === "type" && r.nb_formats ? `${r.nb_formats} formats` : r.famille_nom}
                      </span>
                    </button>
                  ))
              )}
            </div>
          ) : null}

          {typeOuvert ? (
            <div className="mt-3 rounded-md bg-muted p-3">
              <p className="text-legende font-semibold">Quel format ?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {formatsDuType.isPending ? (
                  <Squelette className="h-9 w-32" />
                ) : (
                  (formatsDuType.data ?? []).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => ajouter(f)}
                      className="puce inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-legende font-semibold"
                    >
                      <Plus className="size-3.5 text-primary" aria-hidden="true" />
                      {f.libelle_court ?? f.nom}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {lignes.length > 0 ? (
            <ul className="mt-3 divide-y divide-border rounded-md border border-border">
              {lignes.map((l, index) => (
                <li key={l.cle} className="assemble flex flex-wrap items-center gap-3 p-3" style={{ animationDelay: `${40 * index}ms` }}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-courant font-semibold">{l.format.nom}</span>
                    <span className="block text-legende text-muted-foreground">{l.format.famille_nom}</span>
                  </span>
                  <label className="flex items-center gap-2">
                    <span className="sr-only">Quantité de {l.format.nom}</span>
                    <input
                      id={`quantite-${l.cle}`}
                      aria-label={`Quantité de ${l.format.nom}`}
                      type="number"
                      inputMode="decimal"
                      min="0.5"
                      step="any"
                      value={l.quantite}
                      onChange={(e) =>
                        setLignes((tous) =>
                          tous.map((x) => (x.cle === l.cle ? { ...x, quantite: Math.max(0, Number(e.target.value)) } : x)),
                        )
                      }
                      className="nombres h-11 w-24 rounded-md border border-input bg-card px-3 text-center text-[1.0625rem] font-semibold"
                    />
                    <span className="text-legende text-muted-foreground">{LIBELLE_UNITE[l.format.unite as never] ?? l.format.unite}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setLignes((tous) => tous.filter((x) => x.cle !== l.cle))}
                    className="cible-44 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive-strong"
                    aria-label={`Retirer ${l.format.nom}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-legende text-muted-foreground">
              Cherchez un matériau et ajoutez-le : vous pouvez en mettre plusieurs.
            </p>
          )}
        </Carte>

        {/* 2 · Où livrer */}
        <Carte className="p-4">
          <p className="text-produit">2 · Où livrer ?</p>
          <div className="mt-2">
            <SelecteurPoint />
          </div>
        </Carte>

        {/* 3 · Quand, et un mot */}
        <Carte className="p-4">
          <p className="text-produit">3 · Pour quand ? <span className="text-legende font-normal text-muted-foreground">(facultatif)</span></p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-legende font-semibold">Date souhaitée</span>
              <input
                id="demande-date"
                aria-label="Date de livraison souhaitée"
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className="nombres h-11 rounded-md border border-input bg-card px-3 text-courant"
              />
            </label>
            <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
              <span className="text-legende font-semibold">Un mot pour les dépôts</span>
              <input
                id="demande-note"
                aria-label="Un mot pour les dépôts"
                type="text"
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Accès camion 10 roues possible, livraison le matin…"
                className="h-11 rounded-md border border-input bg-card px-3 text-courant"
              />
            </label>
          </div>
          <p className="mt-2 text-[0.78rem] text-muted-foreground">
            Ne mettez pas votre numéro : les dépôts vous répondent ici, et vous révélez le vôtre à
            celui que vous choisissez.
          </p>
        </Carte>

        <Bouton type="submit" taille="large" pleineLargeur disabled={!pret}>
          {enCours ? "Envoi en cours" : lignes.length === 0 ? "Ajoutez un matériau" : !point ? "Dites où livrer" : "Envoyer ma demande"}
        </Bouton>
      </form>

      <aside className="space-y-3">
        <Carte className="p-4">
          <p className="text-produit">Comment ça marche</p>
          <ol className="mt-2 space-y-2 text-legende text-muted-foreground">
            <li>Les dépôts qui vendent vos matériaux près du chantier sont prévenus.</li>
            <li>Ils vous proposent un prix par matériau, la livraison et un délai.</li>
            <li>Vous comparez ici même, vous acceptez, vous appelez.</li>
          </ol>
        </Carte>
        {lignes.length > 0 && point ? (
          <Suggestions slugs={lignes.map((l) => l.format.slug)} lat={point.lat} lng={point.lng} titre="Déjà en vente près de vous" />
        ) : null}
      </aside>
    </div>
  );
}

/* ── Ma demande : lignes, propositions, suggestions ─────────────────────── */

export function VueDemande({ demande, onChange }: { demande: MaDemande; onChange: () => void }) {
  const [occupe, setOccupe] = React.useState(false);
  const lieu = demande.libelle_lieu ?? demande.localite_nom ?? "votre chantier";

  const clore = async () => {
    setOccupe(true);
    try {
      await fermerDemande(demande.id);
      toast.success("Demande clôturée");
      onChange();
    } catch (erreur) {
      toast.error("Impossible de clôturer", { description: (erreur as Error).message });
    } finally {
      setOccupe(false);
    }
  };

  const repondre = async (proposition: Proposition, decision: "acceptee" | "refusee") => {
    setOccupe(true);
    try {
      await repondreProposition(proposition.id, decision);
      toast.success(decision === "acceptee" ? "Proposition acceptée — appelez le dépôt" : "Proposition refusée");
      onChange();
    } catch (erreur) {
      toast.error("Réponse impossible", { description: (erreur as Error).message });
    } finally {
      setOccupe(false);
    }
  };

  const propositions = demande.propositions.filter((p) => p.statut !== "retiree");
  const acceptee = propositions.find((p) => p.statut === "acceptee") ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="max-w-2xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-page">Ma demande</h1>
            <p className="mt-1 text-legende text-muted-foreground">
              Envoyée le <span className="nombres">{formaterDate(demande.created_at)}</span>
              {demande.statut === "ouverte" ? (
                <> · ouverte jusqu'au <span className="nombres">{formaterDate(demande.expire_le)}</span></>
              ) : (
                <> · <span className="font-semibold text-success-strong">pourvue</span></>
              )}
            </p>
          </div>
          <Bouton variante="tertiaire" taille="compact" onClick={clore} disabled={occupe}>
            {demande.statut === "pourvue" ? "Nouvelle demande" : "Clôturer"}
          </Bouton>
        </div>

        <Carte className="p-4">
          <ul className="divide-y divide-border">
            {demande.lignes.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="text-courant font-semibold">{l.nom}</span>
                <span className="nombres text-courant">
                  {Number(l.quantite)} {LIBELLE_UNITE[l.unite] ?? l.unite}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-legende text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 text-primary" aria-hidden="true" />
              {lieu}
            </span>
            {demande.date_souhaitee ? (
              <span className="nombres">pour le {formaterDate(demande.date_souhaitee)}</span>
            ) : null}
            {demande.note ? <span>« {demande.note} »</span> : null}
          </p>
        </Carte>

        <section aria-live="polite">
          <h2 className="text-section">
            Propositions{" "}
            <span className="nombres font-normal text-muted-foreground">({propositions.length})</span>
          </h2>
          {propositions.length === 0 ? (
            <div className="mt-2">
              <EtatVide
                titre="Les dépôts sont prévenus"
                phrase="Ceux qui vendent vos matériaux près du chantier ont reçu votre demande. Leurs propositions apparaîtront ici — revenez, ou attendez la notification."
              />
            </div>
          ) : (
            <ul className="mt-2 space-y-3">
              {propositions.map((p, index) => (
                <li key={p.id} className="entree" style={{ animationDelay: `${60 * index}ms` }}>
                  <CarteProposition
                    proposition={p}
                    lignes={demande.lignes}
                    estAcceptee={acceptee?.id === p.id}
                    decisionPossible={demande.statut === "ouverte" && !occupe}
                    onRepondre={(decision) => void repondre(p, decision)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-3">
        {demande.lat != null && demande.lng != null ? (
          <Suggestions
            slugs={demande.lignes.map((l) => l.materiau_slug)}
            lat={demande.lat}
            lng={demande.lng}
            titre="Selon notre base"
          />
        ) : null}
      </aside>
    </div>
  );
}

function CarteProposition({
  proposition: p,
  lignes,
  estAcceptee,
  decisionPossible,
  onRepondre,
}: {
  proposition: Proposition;
  lignes: LigneDemande[];
  estAcceptee: boolean;
  decisionPossible: boolean;
  onRepondre: (decision: "acceptee" | "refusee") => void;
}) {
  const total = totalProposition(p, lignes);
  return (
    <Carte className={"p-4 " + (estAcceptee ? "border-success/50 bg-success-soft/40" : p.statut === "refusee" ? "opacity-60" : "")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-produit">
          <Link to={`/fournisseurs/${p.fournisseur.slug}`} className="hover:underline">
            {p.fournisseur.raison_sociale}
          </Link>
          <BadgeVerification niveau={p.fournisseur.niveau_verification as never} compact />
        </p>
        <p className="text-legende text-muted-foreground">
          {p.fournisseur.localite_nom ?? ""}
          {p.delai_jours != null ? <> · sous <span className="nombres">{p.delai_jours}</span> j</> : null}
        </p>
      </div>

      <ul className="mt-2 divide-y divide-border/60 text-legende">
        {lignes.map((l) => {
          const prix = p.lignes.find((x) => x.ligne_id === l.id);
          return (
            <li key={l.id} className="flex items-center justify-between gap-3 py-1.5">
              <span>{l.nom}</span>
              <span className="nombres font-semibold">
                {!prix || !prix.disponible ? (
                  <span className="font-normal text-muted-foreground">non disponible</span>
                ) : prix.prix_unitaire == null ? (
                  <span className="font-normal text-muted-foreground">à convenir</span>
                ) : (
                  <>{formaterAriary(Number(prix.prix_unitaire))} <span className="font-normal text-muted-foreground">/ {LIBELLE_UNITE[l.unite] ?? l.unite}</span></>
                )}
              </span>
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-3 py-1.5">
          <span>Livraison</span>
          <span className="nombres font-semibold">{p.livraison == null ? <span className="font-normal text-muted-foreground">à convenir</span> : p.livraison === 0 ? "offerte" : formaterAriary(Number(p.livraison))}</span>
        </li>
      </ul>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-2">
        <div className="nombres">
          <p className="text-[0.66rem] uppercase tracking-[0.08em] text-muted-foreground">Rendu chantier</p>
          <p className="text-[1.375rem] font-extrabold leading-none text-primary">
            {total == null ? <span className="text-[1rem] font-semibold text-muted-foreground">à convenir</span> : formaterAriary(total)}
          </p>
        </div>
        {estAcceptee ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-[0.78rem] font-semibold text-success-strong">
              <Check className="size-3.5" aria-hidden="true" /> Acceptée
            </span>
            <RevelerContact fournisseurId={p.fournisseur.id} />
          </div>
        ) : p.statut === "refusee" ? (
          <span className="text-legende text-muted-foreground">Refusée</span>
        ) : decisionPossible ? (
          <div className="flex gap-2">
            <Bouton taille="compact" onClick={() => onRepondre("acceptee")}>
              <Check className="size-4" aria-hidden="true" /> Accepter
            </Bouton>
            <Bouton variante="fantome" taille="compact" onClick={() => onRepondre("refusee")}>
              <X className="size-4" aria-hidden="true" /> Refuser
            </Bouton>
          </div>
        ) : null}
      </div>
      {p.message ? <p className="mt-2 text-legende text-muted-foreground">« {p.message} »</p> : null}
    </Carte>
  );
}

/* ── Suggestions : ce que la base connaît déjà pour ces matériaux ──────── */

interface OffreSuggeree {
  materiau_slug: string;
  materiau_nom: string;
  produit_slug: string;
  produit_nom: string;
  unite: string;
  prix_unitaire: number;
  fournisseur_slug: string;
  fournisseur_nom: string;
  fournisseur_niveau: string;
  distance_km: number | null;
}

function Suggestions({ slugs, lat, lng, titre }: { slugs: string[]; lat: number; lng: number; titre: string }) {
  const offres = useQuery({
    queryKey: ["suggestions-demande", slugs.join(","), lat, lng],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("offres_pour_materiaux", { _slugs: slugs, _lat: lat, _lng: lng });
      if (error) throw error;
      return (data ?? []) as unknown as OffreSuggeree[];
    },
    enabled: slugs.length > 0,
    staleTime: 5 * 60_000,
  });

  const parMateriau = React.useMemo(() => {
    const groupes = new Map<string, { slug: string; nom: string; offres: OffreSuggeree[] }>();
    for (const o of offres.data ?? []) {
      const groupe = groupes.get(o.materiau_slug) ?? { slug: o.materiau_slug, nom: o.materiau_nom, offres: [] };
      if (groupe.offres.length < 3) groupe.offres.push(o);
      groupes.set(o.materiau_slug, groupe);
    }
    return [...groupes.values()];
  }, [offres.data]);

  return (
    <Carte className="p-4">
      <p className="text-produit">{titre}</p>
      {offres.isPending ? (
        <div className="mt-2 space-y-2">
          <Squelette className="h-10 w-full" />
          <Squelette className="h-10 w-full" />
        </div>
      ) : parMateriau.length === 0 ? (
        <p className="mt-1 text-legende text-muted-foreground">
          Aucun dépôt ne publie encore ces matériaux — votre demande est justement ce qui les fera venir.
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {parMateriau.map((groupe) => (
            <li key={groupe.slug}>
              <p className="text-legende font-semibold">{groupe.nom}</p>
              <ul className="mt-1 space-y-1">
                {groupe.offres.map((o) => (
                  <li key={o.produit_slug + o.fournisseur_slug}>
                    <Link
                      to={`/fournisseurs/${o.fournisseur_slug}/${o.produit_slug}`}
                      className="ligne-survol flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-legende"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <BadgeVerification niveau={o.fournisseur_niveau as never} compact />
                        <span className="truncate">{o.fournisseur_nom}</span>
                      </span>
                      <span className="nombres shrink-0 text-right">
                        <span className="font-semibold">{formaterAriary(Number(o.prix_unitaire))}</span>
                        {o.distance_km != null ? (
                          <span className="block text-[0.72rem] text-muted-foreground">à {Number(o.distance_km).toFixed(1).replace(".", ",")} km</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}
