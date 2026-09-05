import { Link } from "react-router-dom";
import { PageTexte } from "@/components/PageTexte";

export default function Confidentialite() {
  return (
    <PageTexte
      titre="Politique de confidentialité"
      chemin="/politique-confidentialite"
      chapeau="Ce qu'Akora collecte, pourquoi, combien de temps, et comment le récupérer ou l'effacer."
      majLe="22/08/2026"
    >
      <h2>Ce que nous collectons</h2>
      <h3>Tout le monde</h3>
      <ul>
        <li>
          Le <strong>point de livraison</strong> que vous choisissez. Il reste dans votre navigateur
          et n'est envoyé nulle part tant que vous ne commandez pas.
        </li>
        <li>
          Votre <strong>panier</strong>. Lui aussi reste dans votre navigateur : un panier abandonné
          ne crée aucune ligne chez nous.
        </li>
        <li>Un compteur de consultations par produit et par jour, agrégé — jamais une ligne par visite.</li>
      </ul>

      <h3>Acheteurs</h3>
      <ul>
        <li>Nom, téléphone, e-mail, ville, et le type de client (particulier ou entreprise).</li>
        <li>Vos commandes, leurs lignes, leurs montants, l'adresse de livraison.</li>
        <li>Vos paiements : opérateur, montant, statut, référence. <strong>Jamais de données bancaires.</strong></li>
        <li>Vos adresses de chantier, vos favoris, vos avis.</li>
      </ul>

      <h3>Fournisseurs</h3>
      <ul>
        <li>Les informations de l'entreprise : raison sociale, NIF, STAT, RCS, adresse, position du dépôt.</li>
        <li>
          Les <strong>pièces de vérification</strong> : scans des cartes fiscale et statistique, du
          registre du commerce, de la pièce d'identité du gérant, photo du dépôt.
        </li>
      </ul>

      <h2>Le sort des pièces de vérification</h2>
      <p>
        C'est le point le plus sensible, alors il est traité à part. Les scans sont rangés dans un{" "}
        <strong>stockage privé</strong>, distinct des photos de produits. Ils ne sont accessibles
        qu'aux administrateurs d'Akora, par un lien temporaire valable{" "}
        <strong>soixante secondes</strong>, généré à la demande. Chaque consultation écrit une ligne
        dans un journal : qui, quand, quel document.
      </p>
      <p>
        Ils ne sont jamais publiés, jamais transmis à un tiers, jamais visibles par un autre
        fournisseur ni par un acheteur. Le badge affiché publiquement dit ce qui a été vérifié et à
        quelle date — pas le contenu des pièces.
      </p>
      <p>
        Ils sont effacés <strong>un an après</strong> la fermeture du compte fournisseur, ou
        immédiatement sur demande si aucune commande n'est en cours.
      </p>

      <h2>Ce que voient les autres</h2>
      <p>
        Votre <strong>téléphone n'est jamais dans les pages publiques</strong>. Un fournisseur ne
        voit vos coordonnées qu'à partir du moment où vous lui passez commande. Réciproquement, le
        numéro d'un fournisseur n'est révélé qu'à un utilisateur connecté, sur demande explicite, et
        chaque révélation est journalisée pour empêcher l'aspiration de l'annuaire.
      </p>

      <h2>Combien de temps</h2>
      <ul>
        <li><strong>Compte et profil</strong> : tant que le compte existe.</li>
        <li><strong>Commandes et paiements</strong> : dix ans, obligation comptable.</li>
        <li><strong>Journal d'audit</strong> : trois ans.</li>
        <li><strong>Pièces de vérification</strong> : un an après la fermeture du compte.</li>
        <li><strong>Panier et point de livraison</strong> : jusqu'à ce que vous videz votre navigateur.</li>
      </ul>

      <h2>Vos droits</h2>
      <p>
        Depuis <Link to="/compte/securite">votre espace sécurité</Link>, vous pouvez à tout moment :
      </p>
      <ul>
        <li><strong>Exporter</strong> l'ensemble de vos données, au format JSON.</li>
        <li><strong>Supprimer</strong> votre compte.</li>
      </ul>
      <p>
        La suppression est immédiate et efface votre identifiant de connexion, le profil, les
        adresses, les favoris, les avis et les notifications. Les commandes terminées sont conservées
        cinq ans sans votre nom ni votre numéro (obligation comptable) ; un dépôt, un litige ou une
        commande en cours doit être clos avant. À la création d'une commande, l'adresse IP est
        journalisée avec elle pendant un an, pour la lutte contre la fraude.
      </p>
      <p>
        Autorité de contrôle : la Commission malagasy de l'informatique et des libertés (CMIL), loi
        n° 2014-038. Vous pouvez la saisir si vous estimez que vos droits ne sont pas respectés.
      </p>

      <h2>Sous-traitants</h2>
      <ul>
        <li><strong>Supabase</strong> — base de données et authentification, serveurs dans l'Union européenne.</li>
        <li><strong>o2switch</strong> — hébergement du site et des photos de produits, France.</li>
        <li><strong>OpenStreetMap</strong> — fonds de carte. Aucun compte, aucun identifiant transmis.</li>
        <li>
          <strong>MVola, Orange Money, Airtel Money</strong> — encaissement, le jour où le paiement
          par API sera branché.
        </li>
      </ul>
      <p>
        Akora n'utilise <strong>ni Google Analytics, ni pixel publicitaire, ni traceur tiers</strong>.
      </p>

      <h2>Nous écrire</h2>
      <p>
        Pour toute question sur vos données : contact@akora.fonenako.mg, ou la{" "}
        <Link to="/contact">page contact</Link>.
      </p>
    </PageTexte>
  );
}
