import { Link, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import { listerMesProduits } from "@/lib/donnees/produits";
import { listerDocuments } from "@/lib/donnees/documents";
import { listerVehicules } from "@/lib/donnees/transport";
import { DOCUMENTS_OBLIGATOIRES } from "@/lib/types-metier";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Bouton } from "@/components/ui/button";
import { Squelette } from "@/components/ui/skeleton";
import { AvertissementMetier } from "@/components/ui/etats";

/**
 * Tableau de bord : ce qui manque pour vendre, dans l'ordre où ça bloque.
 * Position, véhicule, catalogue, vérification — chacun avec son raccourci.
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

  /* Tant que produits ou documents chargent, les compteurs vaudraient 0 :
     un chiffre faux. Les tuiles montrent alors un squelette, pas un zéro. */
  const enChargement = produits.isPending || documents.isPending;

  const publies = (produits.data ?? []).filter((p) => p.statut === "actif").length;
  const enAttente = (produits.data ?? []).filter((p) => p.statut === "en_attente_materiau").length;
  const piecesValides = DOCUMENTS_OBLIGATOIRES.filter(
    (t) => (documents.data ?? []).find((d) => d.type === t)?.statut === "valide",
  ).length;

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
    <>
      <Seo titre="Tableau de bord" chemin="/pro" indexable={false} />
      <h2 className="text-section">Tableau de bord</h2>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { libelle: "Produits publiés", valeur: publies },
          { libelle: "En attente de référence", valeur: enAttente },
          { libelle: "Pièces validées", valeur: `${piecesValides} / ${DOCUMENTS_OBLIGATOIRES.length}` },
          { libelle: "Commandes clôturées", valeur: fiche.nb_commandes_cloturees },
        ].map((tuile) => (
          <Carte key={tuile.libelle} className="p-3">
            {enChargement ? (
              <Squelette className="h-7 w-14" />
            ) : (
              <p className="nombres text-[1.375rem] font-bold tracking-tight">{tuile.valeur}</p>
            )}
            <p className="mt-0.5 text-[0.78rem] text-muted-foreground">{tuile.libelle}</p>
          </Carte>
        ))}
      </div>

      {manques.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h3 className="text-produit">Ce qui vous empêche encore de vendre</h3>
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
        </div>
      ) : (
        <Carte className="mt-4 p-4">
          <p className="text-[0.9375rem] font-semibold text-success-strong">
            Votre dépôt est prêt à vendre.
          </p>
          <p className="mt-1 text-legende text-muted-foreground">
            Vos produits apparaissent dans le comparateur au prix rendu chantier.
          </p>
        </Carte>
      )}
    </>
  );
}
