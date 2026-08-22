import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import { listerCommandesFournisseur } from "@/lib/donnees/commandes";
import { formaterAriary, formaterDate } from "@/lib/format";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

/**
 * Statistiques. Volontairement sobres : quatre chiffres qui servent à décider,
 * pas un tableau de bord décoratif. Les vues produit sont AGRÉGÉES PAR JOUR en
 * base — jamais une ligne par consultation (spec C, `vues_produit_jour`).
 */
export default function Statistiques() {
  const fiche = useOutletContext<LigneFournisseur>();

  const commandes = useQuery({
    queryKey: ["commandes-pro", fiche.id],
    queryFn: () => listerCommandesFournisseur(fiche.id),
    staleTime: 5 * 60_000,
  });

  const vues = useQuery({
    queryKey: ["vues-produit", fiche.id],
    queryFn: async () => {
      const { data: produits } = await supabase
        .from("produits")
        .select("id, nom_affiche")
        .eq("fournisseur_id", fiche.id);
      const ids = (produits ?? []).map((p) => p.id as string);
      if (ids.length === 0) return [] as { nom: string; vues: number }[];
      const { data } = await supabase
        .from("vues_produit_jour")
        .select("produit_id, vues")
        .in("produit_id", ids);
      const total = new Map<string, number>();
      for (const ligne of data ?? []) {
        total.set(ligne.produit_id as string, (total.get(ligne.produit_id as string) ?? 0) + Number(ligne.vues));
      }
      return (produits ?? [])
        .map((p) => ({ nom: String(p.nom_affiche), vues: total.get(p.id as string) ?? 0 }))
        .sort((a, b) => b.vues - a.vues)
        .slice(0, 10);
    },
    staleTime: 10 * 60_000,
  });

  const liste = commandes.data ?? [];
  const cloturees = liste.filter((c) => c.statut === "cloturee");
  const chiffreAffaires = cloturees.reduce((s, c) => s + Number(c.montant_total), 0);
  const panierMoyen = cloturees.length ? Math.round(chiffreAffaires / cloturees.length) : 0;
  const tauxAcceptation = liste.length
    ? Math.round((liste.filter((c) => !["refusee", "annulee"].includes(c.statut)).length / liste.length) * 100)
    : 0;

  return (
    <>
      <Seo titre="Statistiques" chemin="/pro/statistiques" indexable={false} />
      <h2 className="text-section">Statistiques</h2>

      {commandes.isPending ? (
        <Squelette className="mt-4 h-24 w-full" />
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { libelle: "Commandes reçues", valeur: String(liste.length) },
            { libelle: "Clôturées", valeur: String(cloturees.length) },
            { libelle: "Chiffre d'affaires", valeur: formaterAriary(chiffreAffaires) },
            { libelle: "Panier moyen", valeur: formaterAriary(panierMoyen) },
          ].map((tuile) => (
            <Carte key={tuile.libelle} className="p-3">
              <p className="nombres text-[1.25rem] font-bold tracking-tight">{tuile.valeur}</p>
              <p className="mt-0.5 text-[0.78rem] text-muted-foreground">{tuile.libelle}</p>
            </Carte>
          ))}
        </div>
      )}

      <Carte className="mt-4 p-4">
        <h3 className="text-produit">Taux d'acceptation</h3>
        <p className="nombres mt-1 text-[1.75rem] font-bold text-primary">{tauxAcceptation} %</p>
        <p className="mt-1 text-legende text-muted-foreground">
          Part des commandes que vous n'avez ni refusées ni annulées. C'est l'un des critères du
          badge « Partenaire Akora », avec la note moyenne et l'absence de litige perdu.
        </p>
      </Carte>

      <h3 className="mt-5 text-produit">Produits les plus consultés</h3>
      {vues.isPending ? (
        <Squelette className="mt-2 h-32 w-full" />
      ) : (vues.data ?? []).length === 0 ? (
        <div className="mt-2">
          <EtatVide titre="Pas encore de consultations" phrase="Publiez un produit pour commencer à mesurer." />
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
          {(vues.data ?? []).map((v) => (
            <li key={v.nom} className="flex items-center justify-between gap-3 px-3 py-2 text-legende">
              <span className="truncate">{v.nom}</span>
              <span className="nombres shrink-0 font-semibold">{v.vues}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[0.78rem] text-muted-foreground">
        Dernière mise à jour de votre fiche : {formaterDate(fiche.updated_at)}.
      </p>
    </>
  );
}
