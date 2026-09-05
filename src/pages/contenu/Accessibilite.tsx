import { Link } from "react-router-dom";
import { PageTexte } from "@/components/PageTexte";

/**
 * Déclaration d'accessibilité — publiée le 06/09/2026 (audit A-06).
 *
 * Madagascar n'impose pas de déclaration ; on la publie parce que l'audience
 * (téléphone d'entrée de gamme, 3G, parfois TalkBack) mérite de savoir ce qui
 * marche et ce qui ne marche pas. Le texte dit ce qui a été MESURÉ, avec la
 * date et l'outil, jamais « conforme » sans mesure. À mettre à jour à chaque
 * correction de la liste ci-dessous.
 */
export default function Accessibilite() {
  return (
    <PageTexte
      titre="Accessibilité"
      chemin="/accessibilite"
      description="État d'accessibilité d'akora.fonenako.mg : référentiel WCAG 2.2 AA, ce qui a été mesuré, les défauts connus et comment les signaler."
      chapeau="Ce qui a été mesuré, ce qui reste à corriger, et comment nous le dire."
      majLe="06/09/2026"
    >
      <h2>Engagement</h2>
      <p>
        Akora vise la conformité au niveau <strong>AA</strong> des règles WCAG 2.2, sur téléphone
        d'entrée de gamme comme sur ordinateur, au clavier comme au lecteur d'écran. Cette page est
        une déclaration d'état, pas une promesse : elle dit ce qui a été vérifié et ce qui ne l'a pas
        été.
      </p>

      <h2>État au 6 septembre 2026</h2>
      <p>
        Audit du 5 septembre 2026 : 36 pages contrôlées en navigateur réel (axe-core 4, Lighthouse 12,
        largeurs 390 px et 1 280 px), plus le banc automatique du dépôt. Résultat :{" "}
        <strong>partiellement conforme</strong>, corrections du 6 septembre déployées.
      </p>
      <p>Ce qui fonctionne :</p>
      <ul>
        <li>Un lien « Aller au contenu » en tête de chaque page ; un titre principal par page.</li>
        <li>Repères de page (en-tête, navigation, contenu, pied de page), langue déclarée.</li>
        <li>Focus visible sur tous les éléments interactifs ; animations coupées si votre appareil le demande.</li>
        <li>Toutes les images informatives ont un texte de remplacement ; les images décoratives sont ignorées.</li>
        <li>Formulaires avec étiquettes visibles et messages d'erreur en texte.</li>
        <li>Boutons de 44 px minimum ; zoom jamais bloqué.</li>
      </ul>

      <h2>Corrigé le 6 septembre 2026</h2>
      <ul>
        <li>
          <strong>Contraste des boutons compacts</strong> (« Créer un compte », « Se connecter » dans
          l'en-tête, « Choisir le lieu ») : texte foncé sur latérite, 2,6:1 au lieu de 4,5:1.
        </li>
        <li>
          <strong>Curseur de quantité</strong> (comparateur, calculateurs) : il n'avait pas de nom lu
          par le lecteur d'écran.
        </li>
        <li>
          <strong>Tableau de comparaison</strong> : sur petit écran, un libellé masqué le faisait
          déborder de la page.
        </li>
      </ul>

      <h2>Défauts connus</h2>
      <ul>
        <li>
          <strong>Petites cibles</strong> : les puces de produits sur la fiche d'un fournisseur restent
          sous 24 px — correction prévue avant fin septembre 2026.
        </li>
        <li>
          <strong>Non testé</strong> : parcours complet au lecteur d'écran (TalkBack, NVDA) et clavier
          seul sur la commande et le paiement. Test prévu avant l'ouverture publique.
        </li>
        <li>
          Les noms de dépôts en malgache ne sont pas marqués comme changement de langue : la synthèse
          vocale les prononce à la française.
        </li>
      </ul>

      <h2>Contenus tiers</h2>
      <p>
        Les cartes proviennent d'OpenStreetMap et se pilotent à la souris ou au doigt ; les mêmes
        informations (adresse, distance, coût de livraison) sont toujours écrites en texte à côté de la
        carte.
      </p>

      <h2>Nous signaler un obstacle</h2>
      <p>
        Une page que vous n'arrivez pas à lire, un bouton que vous n'atteignez pas, un formulaire qui
        vous bloque : <Link to="/contact">écrivez-nous</Link> en indiquant la page et votre appareil.
        Nous répondons sous cinq jours ouvrés et corrigeons dans la version suivante quand c'est en
        notre pouvoir.
      </p>
    </PageTexte>
  );
}
