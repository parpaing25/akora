import { Link, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import { listerCommandesFournisseur } from "@/lib/donnees/commandes";
import { lireObservatoire } from "@/lib/donnees/prix-marche";
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
      /* PostgREST passe le filtre `.in()` dans l'URL : au-delà d'environ 150
         identifiants, elle sature. On borne donc aux 150 premiers produits —
         largement assez pour un top 10. */
      const idsBornes = ids.slice(0, 150);
      /* Et on borne la somme aux 30 derniers jours (colonne `jour`) : sans
         cela, le total grossit sans fin et ne dit plus rien du présent. */
      const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("vues_produit_jour")
        .select("produit_id, vues")
        .in("produit_id", idsBornes)
        .gte("jour", depuis);
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

  /*
   * Vos prix face au marché : chaque produit actif comparé à la MÉDIANE de
   * l'observatoire (offres actives du site + relevés anonymisés de la
   * veille). C'est le signal qui explique pourquoi un produit part — ou pas.
   * Un chiffre appuyé sur moins de trois dépôts est marqué « indicatif ».
   */
  const marche = useQuery({
    queryKey: ["prix-vs-marche", fiche.id],
    queryFn: async () => {
      const [{ data: produits }, observatoire] = await Promise.all([
        supabase
          .from("produits")
          .select("id, nom_affiche, prix_unitaire, prix_promo, materiau_ref_id")
          .eq("fournisseur_id", fiche.id)
          .eq("statut", "actif")
          .not("materiau_ref_id", "is", null),
        lireObservatoire(null, null),
      ]);
      const parRef = new Map(observatoire.map((l) => [l.materiau_ref_id, l]));
      return (produits ?? [])
        .map((p) => {
          const ligne = parRef.get(p.materiau_ref_id as string);
          if (!ligne || !ligne.prix_median) return null;
          const prix = Number(p.prix_promo ?? p.prix_unitaire);
          const ecart = Math.round(((prix - Number(ligne.prix_median)) / Number(ligne.prix_median)) * 100);
          return {
            nom: String(p.nom_affiche),
            prix,
            mediane: Number(ligne.prix_median),
            ecart,
            nbDepots: ligne.nb_depots,
            fiable: ligne.fiable,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null)
        .sort((a, b) => b.ecart - a.ecart);
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
        {commandes.isPending ? (
          <Squelette className="mt-1 h-8 w-20" />
        ) : (
          <p className="nombres mt-1 text-[1.75rem] font-bold text-primary">{tauxAcceptation} %</p>
        )}
        <p className="mt-1 text-legende text-muted-foreground">
          Part des commandes que vous n'avez ni refusées ni annulées. C'est l'un des critères du
          badge « Partenaire Akora », avec la note moyenne et l'absence de litige perdu.
        </p>
      </Carte>

      <h3 className="mt-5 text-produit">Vos prix face au marché</h3>
      <p className="mt-0.5 text-[0.78rem] text-muted-foreground">
        Écart à la médiane relevée par{" "}
        <Link to="/prix" className="lien-souligne">
          l'observatoire Akora
        </Link>{" "}
        (offres actives + veille anonymisée, tout Madagascar).
      </p>
      {marche.isPending ? (
        <Squelette className="mt-2 h-28 w-full" />
      ) : (marche.data ?? []).length === 0 ? (
        <div className="mt-2">
          <EtatVide
            titre="Pas encore de point de comparaison"
            phrase="Dès que l'observatoire relève votre matériau ailleurs, l'écart s'affiche ici."
          />
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
          {(marche.data ?? []).map((l) => (
            <li key={l.nom} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-legende">
              <span className="min-w-0 flex-1 truncate">{l.nom}</span>
              <span className="nombres text-muted-foreground">
                vous : {formaterAriary(l.prix)} · marché : {formaterAriary(l.mediane)}
              </span>
              <span
                className={
                  "nombres shrink-0 rounded-full px-2 py-0.5 text-[0.78rem] font-bold " +
                  (l.ecart > 5
                    ? "bg-destructive/10 text-destructive-strong"
                    : l.ecart < -5
                      ? "bg-success/10 text-success"
                      : "bg-muted text-foreground")
                }
              >
                {l.ecart > 0 ? "+" : ""}
                {l.ecart} %
              </span>
              {!l.fiable ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.72rem] text-muted-foreground">
                  indicatif · {l.nbDepots} dépôt{l.nbDepots > 1 ? "s" : ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-5 text-produit">Produits les plus consultés</h3>
      <p className="mt-0.5 text-[0.78rem] text-muted-foreground">Sur les 30 derniers jours.</p>
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
