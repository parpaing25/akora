import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import {
  confirmerLivraison,
  lireCommandeParNumero,
  listerLignes,
  listerPaiements,
} from "@/lib/donnees/commandes";
import { formaterAriary, formaterDateHeure, formaterTelephone } from "@/lib/format";
import { LIBELLE_COMMANDE, LIBELLE_PAIEMENT, LIBELLE_UNITE } from "@/lib/types-metier";
import { ENV } from "@/lib/env";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { Pastille } from "@/components/ui/badge";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

const TONS: Record<string, "succes" | "info" | "attention" | "danger" | "neutre"> = {
  cloturee: "succes",
  livree: "succes",
  payee: "succes",
  litige: "danger",
  annulee: "danger",
  refusee: "danger",
  en_attente_paiement: "attention",
};

/** Suivi et reçu d'une commande. Imprimable tel quel (`@media print`). */
export default function CommandeSuivi() {
  const { numero } = useParams<{ numero: string }>();
  const client = useQueryClient();

  const commande = useQuery({
    queryKey: ["commande", numero],
    queryFn: () => lireCommandeParNumero(numero as string),
    enabled: Boolean(numero),
    staleTime: 30_000,
  });

  const lignes = useQuery({
    queryKey: ["lignes-commande", commande.data?.id],
    queryFn: () => listerLignes(commande.data?.id as string),
    enabled: Boolean(commande.data?.id),
  });

  const paiements = useQuery({
    queryKey: ["paiements-commande", commande.data?.id],
    queryFn: () => listerPaiements(commande.data?.id as string),
    enabled: Boolean(commande.data?.id),
  });

  const c = commande.data;

  if (commande.isPending) {
    return (
      <div className="container max-w-3xl space-y-3 py-8" aria-busy="true">
        <Squelette className="h-8 w-1/2" />
        <Squelette className="h-64 w-full" />
      </div>
    );
  }

  if (!c) {
    return (
      <div className="container max-w-3xl py-10">
        <Seo titre="Commande introuvable" chemin={"/commande/" + numero} indexable={false} />
        <EtatVide
          titre="Commande introuvable"
          phrase="Le numéro est peut-être erroné, ou cette commande ne vous appartient pas."
          action={
            <Bouton asChild variante="secondaire">
              <Link to="/compte/commandes">Mes commandes</Link>
            </Bouton>
          }
        />
      </div>
    );
  }

  const lienPartage =
    "Commande " + c.numero + " sur Akora : " + new URL("/commande/" + c.numero, ENV.siteUrl).toString();

  const confirmer = async () => {
    try {
      await confirmerLivraison(c.id);
      await client.invalidateQueries({ queryKey: ["commande", numero] });
      toast.success("Réception confirmée", { description: "Le fournisseur peut désormais être payé." });
    } catch (erreur) {
      toast.error("Confirmation impossible", { description: (erreur as Error).message });
    }
  };

  return (
    <div className="container max-w-3xl py-6">
      <Seo titre={"Commande " + c.numero} chemin={"/commande/" + c.numero} indexable={false} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="nombres font-mono text-page">{c.numero}</h1>
          <p className="mt-1 text-legende text-muted-foreground">
            Passée le {formaterDateHeure(c.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Pastille ton={TONS[c.statut] ?? "neutre"}>{LIBELLE_COMMANDE[c.statut]}</Pastille>
          <Bouton variante="tertiaire" taille="compact" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Imprimer
          </Bouton>
          <Bouton asChild variante="tertiaire" taille="compact">
            <a
              href={"https://wa.me/?text=" + encodeURIComponent(lienPartage)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Partager
            </a>
          </Bouton>
        </div>
      </div>

      <Carte className="mt-4 p-4">
        <h2 className="text-produit">Détail</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-legende">
            <thead className="bg-muted text-muted-foreground [&_th]:px-2 [&_th]:py-2 [&_th]:text-left">
              <tr>
                <th scope="col">Désignation</th>
                <th scope="col">Qté</th>
                <th scope="col">P.U.</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody className="[&_td]:px-2 [&_td]:py-2 [&_tr]:border-t [&_tr]:border-border">
              {(lignes.data ?? []).map((l) => (
                <tr key={l.id}>
                  <td>{l.designation_snapshot}</td>
                  <td data-nombre="">
                    {l.quantite} {LIBELLE_UNITE[l.unite_snapshot]}
                  </td>
                  <td data-nombre="">{formaterAriary(Number(l.prix_unitaire_snapshot))}</td>
                  <td data-nombre="">{formaterAriary(Number(l.total_ligne))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-3 space-y-1 border-t border-border pt-3 text-legende">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Matériaux</dt>
            <dd className="nombres">{formaterAriary(Number(c.montant_produits))}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">
              Livraison
              {c.distance_km
                ? " (" + String(c.distance_km) + " km" + (c.nb_rotations > 1 ? " × " + c.nb_rotations : "") + ")"
                : ""}
            </dt>
            <dd className="nombres">{formaterAriary(Number(c.montant_livraison))}</dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-border pt-1.5 text-[1.0625rem]">
            <dt className="font-semibold">Total</dt>
            <dd className="nombres font-bold text-primary">{formaterAriary(Number(c.montant_total))}</dd>
          </div>
        </dl>
      </Carte>

      <Carte className="mt-4 p-4">
        <h2 className="text-produit">Livraison</h2>
        <dl className="mt-2 space-y-1 text-legende">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Contact</dt>
            <dd className="text-right">
              {c.nom_contact} · <span className="nombres">{formaterTelephone(c.telephone_contact)}</span>
            </dd>
          </div>
          {c.adresse_libre ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Adresse</dt>
              <dd className="text-right">{c.adresse_libre}</dd>
            </div>
          ) : null}
          {c.message ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Message</dt>
              <dd className="text-right">{c.message}</dd>
            </div>
          ) : null}
        </dl>
      </Carte>

      {(paiements.data ?? []).length > 0 ? (
        <Carte className="mt-4 p-4">
          <h2 className="text-produit">Paiements</h2>
          <ul className="mt-2 divide-y divide-border text-legende">
            {(paiements.data ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="nombres font-semibold">{formaterAriary(Number(p.montant))}</span>{" "}
                  <span className="text-muted-foreground">· {String(p.operateur).replace("_", " ")}</span>
                </span>
                <Pastille ton={p.statut === "libere" || p.statut === "sequestre" ? "succes" : "info"}>
                  {LIBELLE_PAIEMENT[p.statut]}
                </Pastille>
              </li>
            ))}
          </ul>
        </Carte>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        {c.statut === "en_attente_paiement" ||
        (c.mode_paiement !== "a_la_livraison" && c.statut === "acceptee") ? (
          <Bouton asChild>
            <Link to={"/paiement/" + c.numero}>Payer maintenant</Link>
          </Bouton>
        ) : null}
        {c.statut === "livree" ? (
          <Bouton onClick={() => void confirmer()}>
            <CheckCircle2 className="size-4" aria-hidden="true" />
            J'ai bien reçu ma commande
          </Bouton>
        ) : null}
        <Bouton asChild variante="secondaire">
          <Link to="/compte/commandes">Mes commandes</Link>
        </Bouton>
      </div>

      {c.statut === "livree" ? (
        <p className="mt-3 rounded-md bg-accent-soft px-3 py-2.5 text-legende text-accent-strong print:hidden">
          Sans confirmation de votre part, Akora libère automatiquement le paiement 72 heures après la
          livraison. Si quelque chose ne va pas, ouvrez un litige avant : l'argent reste bloqué.
        </p>
      ) : null}
    </div>
  );
}
