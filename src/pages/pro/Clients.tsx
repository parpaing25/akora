import * as React from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, MessageCircle, Phone, Search } from "lucide-react";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import { listerCommandesFournisseur } from "@/lib/donnees/commandes";
import { demandesPourMonDepot } from "@/lib/donnees/demandes";
import { LIBELLE_STATUT, lienWhatsApp, regrouperClients } from "@/lib/clients";
import { formaterAriary, formaterDate, formaterDistance } from "@/lib/format";
import { Seo } from "@/components/Seo";
import { Saisie } from "@/components/ui/input";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";
import { cn } from "@/lib/utils";

/**
 * Les clients d'un dépôt — et ceux qui pourraient le devenir.
 *
 * Deux listes, une question chacune :
 *   · « Qui cherche du matériau près de chez vous ? » — les demandes d'achat
 *     ouvertes dans le rayon du dépôt (RPC `demandes_pour_mon_depot`, avec
 *     la distance), à répondre en un geste ;
 *   · « Qui vous a déjà commandé ? » — regroupé depuis les commandes, avec
 *     ce que chacun a payé, sa dernière commande, et un bouton pour l'appeler
 *     ou lui écrire sur WhatsApp — le canal de vente de tout Madagascar.
 *
 * ⚠ Rien ici ne lit `profiles` : on ne montre que ce que le dépôt possède
 *   déjà (les contacts de ses commandes) et ce que l'acheteur a publié (sa
 *   demande). Un client ne se « trouve » pas, il se rappelle.
 */
export default function Clients() {
  const fiche = useOutletContext<LigneFournisseur>();
  const [saisie, setSaisie] = React.useState("");

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

  const clients = React.useMemo(() => regrouperClients(commandes.data ?? []), [commandes.data]);
  const q = saisie.trim().toLowerCase();
  const visibles = q
    ? clients.filter((c) => [c.nom, c.telephone ?? "", c.email ?? ""].some((v) => v.toLowerCase().includes(q)))
    : clients;

  return (
    <div className="space-y-6">
      <Seo titre="Mes clients" chemin="/pro/clients" indexable={false} />

      {/* ── Autour de vous ──────────────────────────────────────────────── */}
      <section aria-labelledby="titre-autour">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titre-autour" className="text-section">
            Ils cherchent près de chez vous
          </h2>
          <Link to="/pro/demandes" className="lien-souligne text-legende font-semibold">
            Toutes les demandes
          </Link>
        </div>
        {demandes.isPending ? (
          <Squelette className="mt-3 h-24 rounded-lg" />
        ) : demandes.isError ? (
          <EtatErreur onReessayer={() => void demandes.refetch()} />
        ) : demandes.data.length === 0 ? (
          <p className="mt-3 text-legende text-muted-foreground">
            Aucune demande d'achat ouverte dans votre rayon pour l'instant. Elles apparaissent ici dès qu'un
            acheteur publie ce qu'il cherche.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {demandes.data.slice(0, 6).map((d, index) => (
              <li key={d.id} className="entree" style={{ animationDelay: `${60 * index}ms` }}>
                <Link to="/pro/demandes" className="carte carte-cliquable filet-primaire block p-3.5">
                  <p className="flex items-center gap-1.5 text-legende text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{d.libelle_lieu ?? d.localite_nom ?? "Lieu à préciser"}</span>
                    {d.distance_km != null ? (
                      <span className="nombres ml-auto shrink-0 font-semibold text-foreground">
                        {formaterDistance(d.distance_km)}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-courant font-semibold">
                    {d.lignes.map((l) => `${l.quantite} ${l.nom}`).join(" · ")}
                  </p>
                  <p className="nombres mt-1 text-legende text-muted-foreground">
                    {d.date_souhaitee ? `Souhaité le ${formaterDate(d.date_souhaitee)} · ` : ""}
                    publié le {formaterDate(d.created_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Vos clients ─────────────────────────────────────────────────── */}
      <section aria-labelledby="titre-clients">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="titre-clients" className="text-section">
              Vos clients
            </h2>
            <p className="mt-0.5 text-legende text-muted-foreground">
              {commandes.data
                ? `${clients.length} client${clients.length > 1 ? "s" : ""} · ${clients.filter((c) => c.enCours).length} avec une commande en cours`
                : " "}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <label htmlFor="recherche-clients" className="sr-only">
              Chercher un client
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Saisie
              id="recherche-clients"
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Nom ou téléphone"
              className="pl-9"
            />
          </div>
        </div>

        {commandes.isPending ? (
          <div className="mt-3 space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Squelette key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : commandes.isError ? (
          <EtatErreur onReessayer={() => void commandes.refetch()} />
        ) : visibles.length === 0 ? (
          <div className="mt-3">
            <EtatVide
              titre={q ? "Aucun client ne correspond" : "Pas encore de client"}
              phrase={
                q
                  ? `Rien pour « ${saisie.trim()} ».`
                  : "Vos clients apparaîtront ici à la première commande. En attendant, répondez aux demandes autour de vous."
              }
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {visibles.map((c) => {
              const wa = lienWhatsApp(c.telephone);
              return (
                <li key={c.cle} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate font-semibold">{c.nom}</p>
                    <p className="nombres truncate text-legende text-muted-foreground">
                      {c.nbCommandes} commande{c.nbCommandes > 1 ? "s" : ""} · {formaterAriary(c.total)} payés · dernière le{" "}
                      {formaterDate(c.derniereLe)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[0.75rem] font-semibold",
                      c.enCours ? "bg-primary-soft text-primary-strong" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {LIBELLE_STATUT[c.dernierStatut] ?? c.dernierStatut}
                  </span>
                  <div className="flex gap-1.5">
                    {c.telephone ? (
                      <a
                        href={`tel:${c.telephone.replace(/\s/g, "")}`}
                        aria-label={`Appeler ${c.nom}`}
                        className="cible-44 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted"
                      >
                        <Phone className="size-4" aria-hidden="true" />
                      </a>
                    ) : null}
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Écrire à ${c.nom} sur WhatsApp`}
                        className="cible-44 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted"
                      >
                        <MessageCircle className="size-4" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
