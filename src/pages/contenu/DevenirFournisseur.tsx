import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageTexte } from "@/components/PageTexte";
import { Bouton } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { devenirFournisseur } from "@/lib/donnees/fiches-reservees";

export default function DevenirFournisseur() {
  const naviguer = useNavigate();
  const client = useQueryClient();
  const { session, roles } = useAuth();
  const [activationEnCours, setActivationEnCours] = React.useState(false);

  /*
   * Trois situations, trois appels à l'action :
   *   • déjà fournisseur → son espace, tout simplement ;
   *   • connecté en acheteur → un clic suffit : la RPC `devenir_fournisseur`
   *     ajoute le rôle côté base (le navigateur n'écrit JAMAIS dans
   *     user_roles, règle A3) — pas de second compte à créer ;
   *   • pas de compte → l'inscription, profil « fournisseur » pré-coché.
   * Tant que les rôles ne sont pas revenus, on montre le parcours par défaut
   * plutôt qu'un bouton qui changerait sous le clic.
   */
  const dejaFournisseur = roles.includes("fournisseur");
  const acheteurSeulement = Boolean(session) && !dejaFournisseur && roles.includes("acheteur");

  const activer = async () => {
    setActivationEnCours(true);
    try {
      await devenirFournisseur();
      toast.success("Espace fournisseur activé", {
        description: "Créez votre dépôt : nom, position sur la carte, puis votre catalogue.",
      });
      // /pro exige le rôle : on attend la relecture des rôles AVANT de
      // naviguer, sinon la garde de route renverrait à l'accueil.
      await client.invalidateQueries({ queryKey: ["roles"] });
      await client.invalidateQueries({ queryKey: ["profil"] });
      naviguer("/pro");
    } catch (erreur) {
      // Message de la base, déjà en français (connexion ou adresse à confirmer).
      toast.error("Activation impossible", { description: (erreur as Error).message });
      setActivationEnCours(false);
    }
  };

  return (
    <PageTexte
      titre="Devenir fournisseur"
      chemin="/devenir-fournisseur"
      chapeau="Vous tenez un dépôt, une briqueterie, une carrière, une scierie — ou un camion. Voici ce qu'Akora vous demande, et ce qu'il vous apporte."
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

      <h2>Vous êtes transporteur, sans dépôt ?</h2>
      <p>
        Votre place est ici aussi. Créez votre fiche comme un fournisseur, sautez le catalogue, et
        déclarez vos camions à l'étape 3 : benne, plateau, citerne, « 6 roues » ou « 10 roues »,
        capacité, tarif au voyage ou au kilomètre. Vous apparaissez dans{" "}
        <a href="/transporteurs">l'annuaire des transporteurs</a>, et les chantiers proches vous
        trouvent.
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
        {dejaFournisseur ? (
          <Bouton asChild taille="large">
            <Link to="/pro">Ouvrir mon espace fournisseur</Link>
          </Bouton>
        ) : acheteurSeulement ? (
          <Bouton taille="large" disabled={activationEnCours} onClick={() => void activer()}>
            {activationEnCours ? "Activation en cours…" : "Activer mon espace fournisseur"}
          </Bouton>
        ) : (
          <Bouton asChild taille="large">
            <Link to="/inscription?profil=fournisseur">Créer mon compte fournisseur</Link>
          </Bouton>
        )}
        <Bouton asChild variante="secondaire" taille="large">
          <Link to="/contact">Poser une question</Link>
        </Bouton>
      </div>
    </PageTexte>
  );
}
