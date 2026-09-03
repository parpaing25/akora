import * as React from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin, Megaphone, Phone, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import { listerMesProduits } from "@/lib/donnees/produits";
import { listerDocuments } from "@/lib/donnees/documents";
import { listerVehicules } from "@/lib/donnees/transport";
import { listerCommandesFournisseur } from "@/lib/donnees/commandes";
import { demandesPourMonDepot } from "@/lib/donnees/demandes";
import { LIBELLE_STATUT, STATUTS_A_TRAITER, STATUTS_VENDUS, regrouperClients } from "@/lib/clients";
import { DOCUMENTS_OBLIGATOIRES } from "@/lib/types-metier";
import { formaterAriary, formaterDate, formaterDistance, formaterNombre } from "@/lib/format";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { Squelette } from "@/components/ui/skeleton";
import { AvertissementMetier } from "@/components/ui/etats";
import { cn } from "@/lib/utils";

/**
 * Le cockpit d'un dépôt (03/09/2026).
 *
 * Ce qu'un dépôt veut savoir en ouvrant son téléphone, dans cet ordre :
 *   1. Y a-t-il une commande à traiter ? — et deux gestes sous le pouce :
 *      publier dans le fil, ajouter un produit.
 *   2. Combien j'ai vendu ce mois-ci, combien on m'a regardé, qui me suit.
 *   3. Qui cherche du matériau près de chez moi (les demandes, avec la
 *      distance), et qui m'a déjà commandé.
 *   4. Ce qui m'empêche encore de vendre — inchangé : position, véhicule,
 *      dossier, catalogue.
 *
 * ⚠ Chaque chiffre vient d'une lecture que la base autorise au dépôt : ses
 *   produits, ses commandes, ses vues, les demandes dans son rayon (RPC), son
 *   nombre d'abonnés (RPC). Rien n'est estimé.
 */
export default function TableauDeBord() {
  const fiche = useOutletContext<LigneFournisseur>();

  const produits = useQuery({
    queryKey: ["mes-produits", fiche.id],
    queryFn: () => listerMesProduits(fiche.id),
    staleTime: 60_000,
  });
  const documents = useQuery({
    queryKey: ["documents", fiche.id],
    queryFn: () => listerDocuments(fiche.id),
    staleTime: 60_000,
  });
  const vehicules = useQuery({
    queryKey: ["vehicules", fiche.id],
    queryFn: () => listerVehicules(fiche.id),
    staleTime: 60_000,
  });
  const commandes = useQuery({
    queryKey: ["commandes-pro", fiche.id],
    queryFn: () => listerCommandesFournisseur(fiche.id),
    staleTime: 60_000,
  });
  const demandes = useQuery({
    queryKey: ["demandes-pour-depot", fiche.id],
    queryFn: demandesPourMonDepot,
    staleTime: 60_000,
  });
  const abonnes = useQuery({
    queryKey: ["abonnes", fiche.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("compter_abonnes", { _fournisseur_id: fiche.id });
      if (error) throw error;
      return Number(data ?? 0);
    },
    staleTime: 5 * 60_000,
  });
  const idsProduits = React.useMemo(() => (produits.data ?? []).map((p) => p.id), [produits.data]);
  const vues = useQuery({
    queryKey: ["vues-7j", fiche.id, idsProduits.length],
    enabled: idsProduits.length > 0,
    queryFn: async () => {
      const depuis = new Date();
      depuis.setDate(depuis.getDate() - 7);
      const { data, error } = await supabase
        .from("vues_produit_jour")
        .select("vues")
        .in("produit_id", idsProduits)
        .gte("jour", depuis.toISOString().slice(0, 10));
      if (error) throw error;
      return (data ?? []).reduce((s, l) => s + Number(l.vues ?? 0), 0);
    },
    staleTime: 5 * 60_000,
  });

  /* Tant que produits ou documents chargent, les compteurs vaudraient 0 :
     un chiffre faux. Les tuiles montrent alors un squelette, pas un zéro. */
  const enChargement = produits.isPending || documents.isPending || commandes.isPending;
  const publies = (produits.data ?? []).filter((p) => p.statut === "actif").length;
  const enAttente = (produits.data ?? []).filter((p) => p.statut === "en_attente_materiau").length;
  const piecesValides = DOCUMENTS_OBLIGATOIRES.filter(
    (t) => (documents.data ?? []).find((d) => d.type === t)?.statut === "valide",
  ).length;

  const aTraiter = (commandes.data ?? []).filter((c) => STATUTS_A_TRAITER.has(c.statut));
  const il30j = new Date();
  il30j.setDate(il30j.getDate() - 30);
  const vendues30j = (commandes.data ?? []).filter(
    (c) => STATUTS_VENDUS.has(c.statut) && new Date(c.created_at) >= il30j,
  );
  const ca30j = vendues30j.reduce((s, c) => s + Number(c.montant_total ?? 0), 0);
  const clients = React.useMemo(() => regrouperClients(commandes.data ?? []), [commandes.data]);

  const manques: { titre: string; texte: string; lien: string; action: string }[] = [];
  if (fiche.lat == null) {
    manques.push({
      titre: "Votre dépôt n'est pas placé sur la carte",
      texte: "Sans position, aucun prix rendu chantier ne peut être calculé sur vos produits.",
      lien: "/pro/vitrine",
      action: "Placer mon dépôt",
    });
  }
  if ((vehicules.data ?? []).length === 0) {
    manques.push({
      titre: "Aucun véhicule déclaré",
      texte: "Vos produits s'affichent en « retrait sur place » tant qu'aucun véhicule n'est déclaré.",
      lien: "/pro/livraison",
      action: "Déclarer un véhicule",
    });
  }
  if (piecesValides < DOCUMENTS_OBLIGATOIRES.length) {
    manques.push({
      titre: `Dossier de vérification : ${piecesValides} pièce(s) sur ${DOCUMENTS_OBLIGATOIRES.length}`,
      texte: "Le badge « vérifié » débloque le paiement en ligne et le tri « vérifiés d'abord ».",
      lien: "/pro/verification",
      action: "Compléter mon dossier",
    });
  }
  if (publies === 0) {
    manques.push({
      titre: "Aucun produit publié",
      texte: "Choisissez un matériau dans le catalogue commun et fixez votre prix.",
      lien: "/pro/catalogue/nouveau",
      action: "Ajouter un produit",
    });
  }

  return (
    <div className="space-y-6">
      <Seo titre="Tableau de bord" chemin="/pro" indexable={false} />

      {/* ── Aujourd'hui : la commande à traiter, et les deux gestes ─────── */}
      <section aria-labelledby="titre-aujourdhui">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="titre-aujourdhui" className="text-section">
              Aujourd'hui
            </h2>
            <p className="mt-0.5 text-legende text-muted-foreground">{fiche.raison_sociale}</p>
          </div>
          <div className="flex gap-2">
            <Bouton asChild taille="compact" variante="secondaire">
              <Link to="/pro/publier">
                <Megaphone className="size-4" aria-hidden="true" />
                Publier
              </Link>
            </Bouton>
            <Bouton asChild taille="compact">
              <Link to="/pro/catalogue/nouveau">
                <Plus className="size-4" aria-hidden="true" />
                Produit
              </Link>
            </Bouton>
          </div>
        </div>

        <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tuile
            libelle="Commandes à traiter"
            valeur={enChargement ? null : formaterNombre(aTraiter.length)}
            detail={aTraiter.length > 0 ? (LIBELLE_STATUT[aTraiter[0]?.statut ?? ""] ?? "") : "rien en attente"}
            vers="/pro/commandes"
            fort={aTraiter.length > 0}
          />
          <Tuile
            libelle="Vendu, 30 jours"
            valeur={enChargement ? null : formaterAriary(ca30j)}
            detail={`${formaterNombre(vendues30j.length)} commande${vendues30j.length > 1 ? "s" : ""} · ${formaterNombre(fiche.nb_commandes_cloturees ?? 0)} clôturées en tout`}
            vers="/pro/portefeuille"
          />
          <Tuile
            libelle="Ils cherchent près de vous"
            valeur={demandes.isPending ? null : formaterNombre(demandes.data?.length ?? 0)}
            detail="demandes d'achat dans votre rayon"
            vers="/pro/clients"
            fort={(demandes.data?.length ?? 0) > 0}
          />
          <Tuile
            libelle="Vues et abonnés"
            valeur={vues.isPending && idsProduits.length > 0 ? null : formaterNombre(vues.data ?? 0)}
            detail={`vues sur 7 j · ${formaterNombre(abonnes.data ?? 0)} abonné${(abonnes.data ?? 0) > 1 ? "s" : ""}`}
            vers="/pro/statistiques"
          />
        </ul>
      </section>

      {/* ── Ce qui empêche de vendre ────────────────────────────────────── */}
      {manques.length > 0 ? (
        <section aria-labelledby="titre-manques" className="space-y-2">
          <h2 id="titre-manques" className="text-produit">
            Ce qui vous empêche encore de vendre
          </h2>
          {manques.map((manque) => (
            <AvertissementMetier
              key={manque.titre}
              titre={manque.titre}
              action={
                <Bouton asChild variante="secondaire" taille="compact">
                  <Link to={manque.lien}>
                    {manque.action}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Bouton>
              }
            >
              {manque.texte}
            </AvertissementMetier>
          ))}
        </section>
      ) : (
        <Carte className="p-4">
          <p className="text-[0.9375rem] font-semibold text-success-strong">Votre dépôt est prêt à vendre.</p>
          <p className="mt-1 text-legende text-muted-foreground">
            {formaterNombre(publies)} produit{publies > 1 ? "s" : ""} au prix rendu chantier
            {enAttente > 0 ? ` · ${formaterNombre(enAttente)} en attente de référence` : ""}.
          </p>
        </Carte>
      )}

      {/* ── Autour de vous ──────────────────────────────────────────────── */}
      {(demandes.data?.length ?? 0) > 0 ? (
        <section aria-labelledby="titre-autour">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="titre-autour" className="text-produit">
              Ils cherchent près de chez vous
            </h2>
            <Link to="/pro/clients" className="lien-souligne text-legende font-semibold">
              Tout voir
            </Link>
          </div>
          <ul className="mt-2 space-y-2">
            {(demandes.data ?? []).slice(0, 3).map((d) => (
              <li key={d.id}>
                <Link to="/pro/demandes" className="carte carte-cliquable filet-primaire flex items-center gap-3 p-3">
                  <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {d.lignes.map((l) => `${l.quantite} ${l.nom}`).join(" · ")}
                    </span>
                    <span className="nombres block truncate text-legende text-muted-foreground">
                      {d.libelle_lieu ?? d.localite_nom ?? "Lieu à préciser"} · publié le {formaterDate(d.created_at)}
                    </span>
                  </span>
                  {d.distance_km != null ? (
                    <span className="nombres shrink-0 text-legende font-semibold">{formaterDistance(d.distance_km)}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── Vos clients ─────────────────────────────────────────────────── */}
      {clients.length > 0 ? (
        <section aria-labelledby="titre-clients">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="titre-clients" className="text-produit">
              Vos derniers clients
            </h2>
            <Link to="/pro/clients" className="lien-souligne text-legende font-semibold">
              Tous les clients
            </Link>
          </div>
          <ul className="carte mt-2 divide-y divide-border">
            {clients.slice(0, 3).map((c) => (
              <li key={c.cle} className="flex items-center gap-3 px-3 py-2.5">
                <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.nom}</span>
                  <span className="nombres block truncate text-legende text-muted-foreground">
                    {c.nbCommandes} commande{c.nbCommandes > 1 ? "s" : ""} · {formaterAriary(c.total)} ·{" "}
                    {LIBELLE_STATUT[c.dernierStatut] ?? c.dernierStatut}
                  </span>
                </span>
                {c.telephone ? (
                  <a
                    href={`tel:${c.telephone.replace(/\s/g, "")}`}
                    aria-label={`Appeler ${c.nom}`}
                    className="cible-44 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted"
                  >
                    <Phone className="size-4" aria-hidden="true" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Tuile({
  libelle,
  valeur,
  detail,
  vers,
  fort = false,
}: {
  libelle: string;
  valeur: string | null;
  detail: string;
  vers: string;
  fort?: boolean;
}) {
  return (
    <li>
      <Link to={vers} className={cn("carte carte-cliquable block p-3", fort && "filet-primaire")}>
        {valeur === null ? (
          <Squelette className="h-7 w-16" />
        ) : (
          <span className={cn("nombres block text-[1.375rem] font-bold leading-tight tracking-tight", fort && "text-primary-strong")}>
            {valeur}
          </span>
        )}
        <span className="mt-0.5 block text-legende text-muted-foreground">{libelle}</span>
        <span className="nombres block truncate text-[0.75rem] text-muted-foreground">{detail}</span>
      </Link>
    </li>
  );
}
