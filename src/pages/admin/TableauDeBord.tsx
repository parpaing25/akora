import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Boxes,
  FileWarning,
  Flag,
  Landmark,
  MessageSquareWarning,
  Users,
  Wallet,
} from "lucide-react";
import { Seo } from "@/components/Seo";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur } from "@/components/ui/etats";
import { formaterAriary, formaterDateHeure, formaterNombre } from "@/lib/format";
import { activiteAdmin, chiffresDuJour, seriesAdmin, type PointSerie } from "@/lib/donnees/pilotage";
import { cn } from "@/lib/utils";

/**
 * Le tableau de bord — première page de l'administration.
 *
 * Transposé de la console superadmin de Fonenako : d'abord CE QU'IL Y A À
 * FAIRE (les files, avec leur nombre et leur porte), puis ce que la plateforme
 * pèse, puis trente jours en barres, puis qui a fait quoi. Un chiffre = une
 * fonction en base, jamais une addition faite ici.
 *
 * ⚠ Aucune bibliothèque de graphiques : quatre-cent kilo-octets de recharts
 *   pour trois séries de barres, sur une console qu'on ouvre depuis un
 *   téléphone. Des barres en CSS, une table cachée pour les lecteurs d'écran.
 */
export default function TableauDeBord() {
  const chiffres = useQuery({ queryKey: ["admin", "chiffres"], queryFn: chiffresDuJour, staleTime: 60_000 });
  const series = useQuery({ queryKey: ["admin", "series", 30], queryFn: () => seriesAdmin(30), staleTime: 5 * 60_000 });
  const activite = useQuery({ queryKey: ["admin", "activite"], queryFn: () => activiteAdmin(12), staleTime: 60_000 });

  if (chiffres.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Squelette key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Squelette className="h-40 rounded-lg" />
      </div>
    );
  }
  if (chiffres.isError) return <EtatErreur onReessayer={() => void chiffres.refetch()} />;

  const c = chiffres.data;
  const f = c.fournisseurs ?? {};
  const files: { libelle: string; n: number; vers: string; Icone: typeof Users }[] = [
    { libelle: "Dossiers à vérifier", n: c.kyc_en_attente, vers: "/admin/verifications", Icone: BadgeCheck },
    { libelle: "Paiements à vérifier", n: c.paiements_a_verifier, vers: "/admin/paiements", Icone: Wallet },
    { libelle: "Litiges ouverts", n: c.litiges_ouverts, vers: "/admin/litiges", Icone: AlertTriangle },
    { libelle: "Versements à traiter", n: c.retraits_a_traiter, vers: "/admin/versements", Icone: Banknote },
    { libelle: "Matériaux demandés", n: c.materiaux_demandes, vers: "/admin/materiaux", Icone: FileWarning },
    { libelle: "Publications signalées", n: c.publications_signalees, vers: "/admin/moderation", Icone: Flag },
  ];
  const aFaire = files.reduce((s, x) => s + x.n, 0);

  return (
    <div className="space-y-6">
      <Seo titre="Tableau de bord" chemin="/admin" indexable={false} />

      {/* ── À traiter ───────────────────────────────────────────────────── */}
      <section aria-labelledby="titre-files">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titre-files" className="text-section">
            À traiter
          </h2>
          <p className="nombres text-legende text-muted-foreground">
            {aFaire === 0 ? "Rien en attente" : `${aFaire} en attente`}
          </p>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {files.map(({ libelle, n, vers, Icone }) => (
            <li key={vers}>
              <Link
                to={vers}
                className={cn(
                  "carte carte-cliquable flex min-h-24 flex-col justify-between p-3.5",
                  n > 0 && "filet-primaire",
                )}
              >
                <span className="flex items-center justify-between gap-2 text-legende text-muted-foreground">
                  {libelle}
                  <Icone className="size-4 shrink-0" aria-hidden="true" />
                </span>
                <span className={cn("nombres text-[1.75rem] font-bold leading-none", n > 0 ? "text-primary-strong" : "text-foreground")}>
                  {formaterNombre(n)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── La plateforme ───────────────────────────────────────────────── */}
      <section aria-labelledby="titre-plateforme">
        <h2 id="titre-plateforme" className="text-section">
          La plateforme
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Chiffre Icone={Users} libelle="Comptes" valeur={formaterNombre(c.utilisateurs)} detail={`+${formaterNombre(c.utilisateurs_7j)} sur 7 j · ${formaterNombre(c.actifs_7j)} actifs`} vers="/admin/utilisateurs" />
          <Chiffre Icone={Landmark} libelle="Dépôts actifs" valeur={formaterNombre(f.actif ?? 0)} detail={`${formaterNombre(f.en_attente ?? 0)} en attente · ${formaterNombre(f.brouillon ?? 0)} brouillons · ${formaterNombre(c.fournisseurs_verifies)} vérifiés`} vers="/fournisseurs" />
          <Chiffre Icone={Boxes} libelle="Produits en ligne" valeur={formaterNombre(c.produits_actifs)} detail={`sur ${formaterNombre(c.produits_total)} au catalogue`} />
          <Chiffre Icone={Wallet} libelle="Commandes, 7 jours" valeur={formaterNombre(c.commandes_7j)} detail={`${formaterAriary(c.volume_7j)} · commissions ${formaterAriary(c.commissions_7j)}`} />
          <Chiffre Icone={MessageSquareWarning} libelle="Fil" valeur={formaterNombre(c.publications)} detail={`${formaterNombre(c.demandes_ouvertes)} demande${c.demandes_ouvertes > 1 ? "s" : ""} d'achat ouverte${c.demandes_ouvertes > 1 ? "s" : ""}`} vers="/" />
          <Chiffre Icone={Landmark} libelle="Observatoire" valeur={formaterNombre(c.releves_prix)} detail="relevés de prix" vers="/prix" />
          <Chiffre Icone={Boxes} libelle="Vues de produits, 7 j" valeur={formaterNombre(c.vues_7j)} detail={`${formaterNombre(c.avis_en_attente)} avis à modérer`} />
          <Chiffre Icone={Users} libelle="Commandes, par statut" valeur={formaterNombre(Object.values(c.commandes ?? {}).reduce((s, n) => s + n, 0))} detail={resumerStatuts(c.commandes)} />
        </dl>
      </section>

      {/* ── Trente jours ────────────────────────────────────────────────── */}
      <section aria-labelledby="titre-30j">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titre-30j" className="text-section">
            Trente jours
          </h2>
          <Link to="/admin/statistiques" className="lien-souligne text-legende font-semibold">
            Le détail
          </Link>
        </div>
        {series.isPending ? (
          <Squelette className="mt-3 h-32 rounded-lg" />
        ) : series.isError ? (
          <EtatErreur onReessayer={() => void series.refetch()} />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Barres points={series.data} cle="inscriptions" libelle="Inscriptions" />
            <Barres points={series.data} cle="commandes" libelle="Commandes" />
            <Barres points={series.data} cle="vues" libelle="Vues de produits" />
          </div>
        )}
      </section>

      {/* ── Activité ────────────────────────────────────────────────────── */}
      <section aria-labelledby="titre-activite">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titre-activite" className="text-section">
            Activité récente
          </h2>
          <Link to="/admin/audit" className="lien-souligne text-legende font-semibold">
            Tout le journal
          </Link>
        </div>
        {activite.isPending ? (
          <Squelette className="mt-3 h-32 rounded-lg" />
        ) : activite.isError ? (
          <EtatErreur onReessayer={() => void activite.refetch()} />
        ) : activite.data.length === 0 ? (
          <p className="mt-3 text-legende text-muted-foreground">Aucune action enregistrée pour l'instant.</p>
        ) : (
          <ol className="carte mt-3 divide-y divide-border">
            {activite.data.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
                <span className="min-w-0">
                  <span className="font-semibold">{a.acteur}</span>{" "}
                  <span className="text-muted-foreground">
                    {a.action} · {a.entite}
                    {a.entite_id ? ` ${a.entite_id.slice(0, 8)}` : ""}
                  </span>
                </span>
                <time dateTime={a.quand} className="nombres shrink-0 text-legende text-muted-foreground">
                  {formaterDateHeure(a.quand)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="nombres text-legende text-muted-foreground">
        Chiffres calculés le {formaterDateHeure(c.calcule_le)}.
      </p>
    </div>
  );
}

function resumerStatuts(statuts: Record<string, number> | null | undefined): string {
  const entrees = Object.entries(statuts ?? {}).sort((a, b) => b[1] - a[1]);
  if (entrees.length === 0) return "aucune commande";
  return entrees
    .slice(0, 3)
    .map(([s, n]) => `${formaterNombre(n)} ${s.replace(/_/g, " ")}`)
    .join(" · ");
}

function Chiffre({
  Icone,
  libelle,
  valeur,
  detail,
  vers,
}: {
  Icone: typeof Users;
  libelle: string;
  valeur: string;
  detail: string;
  vers?: string;
}) {
  const contenu = (
    <>
      <dt className="flex items-center justify-between gap-2 text-legende text-muted-foreground">
        {libelle}
        <Icone className="size-4 shrink-0" aria-hidden="true" />
      </dt>
      <dd className="mt-1">
        <span className="nombres block text-[1.5rem] font-bold leading-tight">{valeur}</span>
        <span className="nombres block text-legende text-muted-foreground">{detail}</span>
      </dd>
    </>
  );
  return vers ? (
    <Link to={vers} className="carte carte-cliquable block p-3.5">
      {contenu}
    </Link>
  ) : (
    <div className="carte p-3.5">{contenu}</div>
  );
}

/**
 * Trente barres, la plus haute prend toute la hauteur. Une table cachée porte
 * les mêmes chiffres pour qui ne voit pas les barres.
 */
export function Barres({
  points,
  cle,
  libelle,
  format = formaterNombre,
}: {
  points: PointSerie[];
  cle: "inscriptions" | "commandes" | "vues" | "volume";
  libelle: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...points.map((p) => p[cle]));
  const total = points.reduce((s, p) => s + p[cle], 0);
  return (
    <figure className="carte p-3.5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-legende text-muted-foreground">{libelle}</span>
        <span className="nombres font-semibold">{format(total)}</span>
      </figcaption>
      <ul className="mt-2 flex h-16 items-end gap-px" aria-hidden="true">
        {points.map((p) => (
          <li
            key={p.jour}
            title={`${p.jour} : ${format(p[cle])}`}
            className={cn("flex-1 rounded-t-[2px]", p[cle] > 0 ? "bg-primary" : "bg-muted")}
            style={{ height: `${Math.max(4, Math.round((p[cle] / max) * 100))}%` }}
          />
        ))}
      </ul>
      <table className="sr-only">
        <caption>{libelle}, par jour</caption>
        <thead>
          <tr>
            <th scope="col">Jour</th>
            <th scope="col">{libelle}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.jour}>
              <td>{p.jour}</td>
              <td>{format(p[cle])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
