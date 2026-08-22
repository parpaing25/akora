import { Link } from "react-router-dom";
import { PageTexte } from "@/components/PageTexte";

export default function Conditions() {
  return (
    <PageTexte
      titre="Conditions d'utilisation"
      chemin="/conditions-utilisation"
      chapeau="Ce que vous pouvez attendre d'Akora, et ce qu'Akora attend de vous."
      majLe="22/08/2026"
    >
      <h2>1. Ce qu'est Akora</h2>
      <p>
        Akora est une place de marché de matériaux de gros œuvre. Il met en relation des acheteurs
        et des fournisseurs indépendants. <strong>Le contrat de vente est conclu entre l'acheteur
        et le fournisseur</strong>, pas avec Akora.
      </p>

      <h2>2. Les prix affichés</h2>
      <p>
        Les prix des matériaux sont saisis par les fournisseurs. Le coût de livraison est une{" "}
        <strong>estimation</strong> calculée à partir de la distance à vol d'oiseau entre le dépôt
        et le chantier, multipliée par un coefficient de sinuosité, puis appliquée au barème du
        véhicule retenu. La formule complète est affichée à chaque estimation.
      </p>
      <p>
        Le prix définitif est confirmé par le fournisseur. Au-delà de son rayon de livraison, Akora
        n'affiche aucun prix : la livraison se négocie directement avec lui.
      </p>

      <h2>3. Le séquestre</h2>
      <p>Quand un acheteur règle en ligne :</p>
      <ul>
        <li>La somme est encaissée par Akora et <strong>retenue</strong>. Elle n'est pas versée au fournisseur.</li>
        <li>Elle est libérée à la <strong>confirmation de réception</strong> par l'acheteur.</li>
        <li>
          À défaut de confirmation, elle est libérée <strong>automatiquement 72 heures</strong> après
          le passage de la commande en « livrée », sans contestation.
        </li>
        <li>
          Si un <strong>litige</strong> est ouvert avant la libération, l'argent reste bloqué
          jusqu'à l'arbitrage.
        </li>
      </ul>

      <h2>4. La commission</h2>
      <p>
        Akora retient <strong>3 % du montant des matériaux</strong> au moment de la libération.
        Aucune commission n'est prise sur la livraison : c'est un coût réel du fournisseur, pas une
        marge. Le taux peut varier par famille de produits ; il est toujours celui en vigueur au
        moment de la commande.
      </p>

      <h2>5. Les litiges</h2>
      <p>
        L'acheteur peut ouvrir un litige avant la libération du séquestre, en indiquant un motif et
        en joignant des photos. Akora arbitre : libération au fournisseur, remboursement total ou
        remboursement partiel. La décision est motivée et communiquée aux deux parties.
      </p>
      <p>
        L'arbitrage d'Akora ne prive personne de son droit de saisir la justice malgache.
      </p>

      <h2>6. Obligations du fournisseur</h2>
      <ul>
        <li>Tenir ses prix, ses stocks et ses délais à jour.</li>
        <li>Livrer conformément à ce qui a été commandé.</li>
        <li>Fournir des pièces authentiques lors de la vérification.</li>
        <li>Ne pas contourner Akora pour éviter la commission sur une commande passée par la plateforme.</li>
      </ul>
      <p>
        Un manquement peut entraîner la suspension du compte, la révocation du badge, et la
        retenue des sommes en séquestre le temps de régler les commandes en cours.
      </p>

      <h2>7. Obligations de l'acheteur</h2>
      <ul>
        <li>Donner un numéro de téléphone et une adresse exacts : la livraison en dépend.</li>
        <li>Être joignable le jour de la livraison.</li>
        <li>Confirmer la réception, ou ouvrir un litige, dans un délai raisonnable.</li>
        <li>Ne pas déposer d'avis mensonger ou injurieux.</li>
      </ul>

      <h2>8. Périmètre</h2>
      <p>
        Akora ne référence que le gros œuvre. La quincaillerie, l'outillage, la plomberie,
        l'électricité, la peinture, le carrelage, le sanitaire et la menuiserie alu ou PVC en sont
        exclus.
      </p>

      <h2>9. Compte et données</h2>
      <p>
        Vous pouvez à tout moment exporter vos données ou supprimer votre compte depuis{" "}
        <Link to="/compte/securite">votre espace</Link>. Voir la{" "}
        <Link to="/politique-confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>10. Droit applicable</h2>
      <p>Ces conditions sont régies par le droit malgache.</p>
    </PageTexte>
  );
}
