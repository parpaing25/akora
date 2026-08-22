import { Link } from "react-router-dom";
import { PageTexte } from "@/components/PageTexte";
import { Bouton } from "@/components/ui/button";

export default function DevenirFournisseur() {
  return (
    <PageTexte
      titre="Devenir fournisseur"
      chemin="/devenir-fournisseur"
      chapeau="Vous tenez un dépôt, une briqueterie, une carrière ou une scierie. Voici ce qu'Akora vous demande, et ce qu'il vous apporte."
    >
      <h2>Ce que ça change pour vous</h2>
      <p>
        Un acheteur qui compare au prix rendu chantier ne choisit pas toujours le moins cher au
        dépôt. S'il habite à côté de chez vous, votre transport court vous fait gagner des
        commandes que vous perdiez sur le seul prix affiché.
      </p>
      <p>
        Akora prend <strong>3 % du montant des matériaux</strong>, et <strong>rien sur la
        livraison</strong> — c'est un coût réel pour vous, pas une marge. Il n'y a ni abonnement ni
        frais d'inscription.
      </p>

      <h2>En trois étapes</h2>
      <h3>1. Créez votre dépôt</h3>
      <p>
        Nom, téléphone, et surtout <strong>la position exacte de votre dépôt sur la carte</strong>.
        Sans elle, aucune livraison n'est chiffrable, donc aucun prix rendu chantier ne s'affiche
        sur vos produits.
      </p>

      <h3>2. Montez votre catalogue</h3>
      <p>
        Vous choisissez chaque matériau dans un <strong>catalogue commun</strong>. Vous ne pouvez
        pas en créer un vous-même — et c'est volontaire : c'est ce qui met votre parpaing 15 en face
        de celui du dépôt d'à côté, à armes égales. Si un matériau manque, vous en demandez l'ajout
        et un administrateur le crée.
      </p>
      <p>
        Vous fixez votre prix, votre quantité minimale, vos paliers dégressifs, et vous ajustez le
        poids et le volume pour <em>vos</em> produits.
      </p>

      <h3>3. Déclarez vos véhicules</h3>
      <p>
        Capacité, forfait de sortie, prix au kilomètre, kilomètres inclus, prix plancher. Akora
        choisit tout seul le plus petit véhicule qui passe, compte les rotations s'il en faut
        plusieurs, et affiche la formule à l'acheteur. Vous voyez le tarif se calculer en direct
        pendant que vous le réglez.
      </p>

      <h2>La vérification</h2>
      <p>
        Elle est gratuite et débloque le paiement en ligne ainsi que le tri « vérifiés d'abord ».
        Six pièces : carte fiscale, carte statistique, registre du commerce, pièce d'identité du
        gérant, photo de l'enseigne et du dépôt, numéro mobile money de versement.
      </p>
      <p>
        Vos scans partent dans un stockage privé. Seuls les administrateurs y accèdent, par lien
        temporaire, et chaque consultation est journalisée.{" "}
        <Link to="/verification">Ce que le badge veut dire exactement</Link>.
      </p>

      <h2>Comment vous êtes payé</h2>
      <p>
        Quand un acheteur règle en ligne, la somme est <strong>retenue par Akora</strong>. Elle
        vous est versée après sa confirmation de livraison, ou automatiquement 72 heures après la
        livraison s'il ne dit rien. En cas de litige, l'argent reste bloqué jusqu'à l'arbitrage.
      </p>
      <p>
        Votre portefeuille affiche le disponible et le séquestre, ligne par ligne. Vous demandez un
        versement sur votre numéro mobile money quand vous voulez.
      </p>

      <div className="not-prose mt-6 flex flex-wrap gap-2">
        <Bouton asChild taille="large">
          <Link to="/inscription">Créer mon compte fournisseur</Link>
        </Bouton>
        <Bouton asChild variante="secondaire" taille="large">
          <Link to="/contact">Poser une question</Link>
        </Bouton>
      </div>
    </PageTexte>
  );
}
