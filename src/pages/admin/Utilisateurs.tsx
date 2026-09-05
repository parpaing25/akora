import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ShieldCheck } from "lucide-react";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import { Saisie } from "@/components/ui/input";
import { Squelette } from "@/components/ui/skeleton";
import { EtatErreur, EtatVide } from "@/components/ui/etats";
import {
  Confirmation,
  ConfirmationAnnuler,
  ConfirmationContenu,
  ConfirmationDeclencheur,
  ConfirmationTexte,
  ConfirmationTitre,
  ConfirmationValider,
} from "@/components/ui/alert-dialog";
import { formaterDate, formaterDateHeure } from "@/lib/format";
import {
  definirRoleAdmin,
  listerUtilisateursAdmin,
  type CompteAdmin,
  type RoleGouverne,
} from "@/lib/donnees/pilotage";
import { cn } from "@/lib/utils";

/**
 * Les comptes — l'onglet « Utilisateurs » de la console Fonenako.
 *
 * Un admin LIT : identité, courriel, rôles, dépôt, dernière connexion. Seul
 * le super_admin GOUVERNE les rôles, et la base le vérifie à chaque geste
 * (`definir_role_admin`) — les boutons n'apparaissent que pour lui, mais
 * c'est la fonction qui refuse, pas l'écran.
 *
 * ⚠ Sous `sm`, une carte par compte ; le tableau au-dessus. Un tableau de
 *   huit colonnes ne se lit pas sur un téléphone (règle mobile n° 8).
 */
export default function Utilisateurs() {
  const { aRole, utilisateur } = useAuth();
  const client = useQueryClient();
  const [saisie, setSaisie] = React.useState("");
  const [q, setQ] = React.useState("");
  const superAdmin = aRole("super_admin");

  React.useEffect(() => {
    const t = window.setTimeout(() => setQ(saisie), 250);
    return () => window.clearTimeout(t);
  }, [saisie]);

  const comptes = useQuery({
    queryKey: ["admin", "utilisateurs", q],
    queryFn: () => listerUtilisateursAdmin(q, 200),
    staleTime: 30_000,
  });

  const basculer = async (compte: CompteAdmin, role: RoleGouverne, actif: boolean) => {
    try {
      const roles = await definirRoleAdmin(compte.id, role, actif);
      await client.invalidateQueries({ queryKey: ["admin", "utilisateurs"] });
      toast.success(actif ? `Rôle ${role} donné` : `Rôle ${role} retiré`, {
        description: `${compte.email ?? compte.id} : ${roles.join(", ") || "aucun rôle"}`,
      });
    } catch (erreur) {
      toast.error("Geste refusé", { description: (erreur as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <Seo titre="Utilisateurs" chemin="/admin/utilisateurs" indexable={false} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-section">Utilisateurs</h2>
          <p className="mt-0.5 text-legende text-muted-foreground">
            {comptes.data ? `${comptes.data.length} compte${comptes.data.length > 1 ? "s" : ""}` : " "}
            {superAdmin ? " · vous gouvernez les rôles" : " · lecture seule"}
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <label htmlFor="recherche-comptes" className="sr-only">
            Chercher un compte
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Saisie
            id="recherche-comptes"
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom, courriel, téléphone, dépôt"
            className="pl-9"
          />
        </div>
      </div>

      {comptes.isPending ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Squelette key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : comptes.isError ? (
        <EtatErreur onReessayer={() => void comptes.refetch()} />
      ) : comptes.data.length === 0 ? (
        <EtatVide titre="Aucun compte" phrase={q ? `Rien ne correspond à « ${q} ».` : "Personne n'est encore inscrit."} />
      ) : (
        <>
          {/* Téléphone : une carte par compte */}
          <ul className="space-y-2 sm:hidden">
            {comptes.data.map((c) => (
              <li key={c.id} className="carte p-3.5">
                <Identite compte={c} />
                <Roles compte={c} />
                <p className="nombres mt-1.5 text-legende text-muted-foreground">
                  Inscrit le {formaterDate(c.cree_le)}
                  {c.derniere_connexion ? ` · vu le ${formaterDate(c.derniere_connexion)}` : " · jamais connecté"}
                </p>
                {superAdmin ? <Gouverner compte={c} moi={utilisateur?.id ?? null} onBasculer={basculer} /> : null}
              </li>
            ))}
          </ul>

          {/* Ordinateur : le tableau */}
          <div className="carte hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-legende">
              <caption className="sr-only">Comptes inscrits, leurs rôles et leur dépôt</caption>
              <thead>
                <tr className="border-b border-border text-left text-[0.8125rem] uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Compte</th>
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Rôles</th>
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Dépôt</th>
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Inscrit</th>
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Dernière connexion</th>
                  {superAdmin ? <th scope="col" className="px-3.5 py-2.5 font-semibold">Gouverner</th> : null}
                </tr>
              </thead>
              <tbody>
                {comptes.data.map((c) => (
                  <tr key={c.id} className="ligne-survol border-b border-border/60 align-top">
                    <td className="px-3.5 py-2.5">
                      <Identite compte={c} />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Roles compte={c} />
                    </td>
                    <td className="px-3.5 py-2.5">
                      {c.fournisseur ? (
                        <>
                          <span className="font-semibold">{c.fournisseur}</span>
                          <span className="block text-muted-foreground">{c.fournisseur_statut}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="nombres px-3.5 py-2.5 text-muted-foreground">{formaterDate(c.cree_le)}</td>
                    <td className="nombres px-3.5 py-2.5 text-muted-foreground">
                      {c.derniere_connexion ? formaterDateHeure(c.derniere_connexion) : "jamais"}
                    </td>
                    {superAdmin ? (
                      <td className="px-3.5 py-2.5">
                        <Gouverner compte={c} moi={utilisateur?.id ?? null} onBasculer={basculer} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Identite({ compte }: { compte: CompteAdmin }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold">{compte.nom_complet || compte.email || "Compte sans nom"}</p>
      <p className="truncate text-legende text-muted-foreground">
        {compte.email}
        {compte.telephone ? ` · ${compte.telephone}` : ""}
        {compte.ville ? ` · ${compte.ville}` : ""}
        {compte.email_verifie === false ? " · courriel non vérifié" : ""}
      </p>
    </div>
  );
}

const TON_ROLE: Record<string, string> = {
  super_admin: "border-primary/40 bg-primary-soft text-primary-strong",
  admin: "border-foreground/30 bg-muted text-foreground",
  fournisseur: "border-secondary/40 bg-secondary-soft text-secondary-strong",
  acheteur: "border-border bg-card text-muted-foreground",
};

function Roles({ compte }: { compte: CompteAdmin }) {
  if (compte.roles.length === 0) return <span className="text-muted-foreground">aucun rôle</span>;
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5 sm:mt-0" aria-label="Rôles">
      {compte.roles.map((r) => (
        <li
          key={r}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.75rem] font-semibold",
            TON_ROLE[r] ?? TON_ROLE.acheteur,
          )}
        >
          {r === "super_admin" ? <ShieldCheck className="size-3" aria-hidden="true" /> : null}
          {r.replace("_", " ")}
        </li>
      ))}
    </ul>
  );
}

/** Les deux bascules du super_admin, chacune derrière une confirmation. */
function Gouverner({
  compte,
  moi,
  onBasculer,
}: {
  compte: CompteAdmin;
  moi: string | null;
  onBasculer: (compte: CompteAdmin, role: RoleGouverne, actif: boolean) => Promise<void>;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-2 sm:mt-0">
      {(["admin", "super_admin"] as RoleGouverne[]).map((role) => {
        const actif = compte.roles.includes(role);
        const cestMoi = moi === compte.id && role === "super_admin" && actif;
        return (
          <Confirmation key={role}>
            <ConfirmationDeclencheur asChild>
              <button
                type="button"
                disabled={cestMoi}
                aria-pressed={actif}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border px-3 text-[0.8125rem] font-semibold disabled:opacity-50",
                  actif ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {actif ? "Retirer " : "Donner "}
                {role.replace("_", " ")}
              </button>
            </ConfirmationDeclencheur>
            <ConfirmationContenu>
              <ConfirmationTitre>
                {actif ? "Retirer" : "Donner"} le rôle {role.replace("_", " ")} ?
              </ConfirmationTitre>
              <ConfirmationTexte>
                {compte.email ?? compte.id}
                {role === "super_admin" && !actif
                  ? " pourra gouverner les rôles de tous les comptes, y compris le vôtre."
                  : role === "admin" && actif
                    ? " perdra aussi super_admin s'il l'avait : un super-administrateur est d'abord un administrateur."
                    : " — le geste est journalisé."}
              </ConfirmationTexte>
              <div className="mt-4 flex justify-end gap-2">
                <ConfirmationAnnuler>Annuler</ConfirmationAnnuler>
                <ConfirmationValider onClick={() => void onBasculer(compte, role, !actif)}>
                  {actif ? "Retirer" : "Donner"}
                </ConfirmationValider>
              </div>
            </ConfirmationContenu>
          </Confirmation>
        );
      })}
    </div>
  );
}
