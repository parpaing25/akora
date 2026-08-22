import { Link } from "react-router-dom";
import { PageTexte } from "@/components/PageTexte";

export default function APropos() {
  return (
    <PageTexte
      titre="À propos d'Akora"
      chemin="/a-propos"
      chapeau="Akora compare les fournisseurs de matériaux de gros œuvre au prix rendu chantier, à Madagascar."
    >
      <h2>Le problème</h2>
      <p>
        À Antananarivo comme en province, le prix affiché au dépôt ne dit presque rien du prix
        réel. Un mètre cube de sable à 90 000 Ar livré à 8 km revient moins cher qu'un mètre cube à
        75 000 Ar livré à 40 km. Tout le monde le sait, personne ne peut le calculer avant d'avoir
        appelé cinq dépôts.
      </p>

      <h2>Ce qu'Akora fait</h2>
      <p>
        Il calcule. Vous dites où livrer, vous choisissez un matériau, et vous voyez le prix rendu
        chantier de chaque fournisseur : matériau, transport, total, et le prix ramené à l'unité
        livrée. La formule est affichée, pas cachée.
      </p>

      <h2>Ce qu'Akora ne fait pas</h2>
      <ul>
        <li>
          Il ne vend rien lui-même. Les fournisseurs sont des dépôts, des briqueteries, des
          carrières et des scieries indépendants.
        </li>
        <li>
          Il ne référence que le <strong>gros œuvre</strong> : agglomérés, briques, granulats,
          liants, bois, couverture, acier de construction, béton prêt à l'emploi. Ni quincaillerie,
          ni plomberie, ni électricité, ni finitions.
        </li>
        <li>
          Il n'invente jamais un prix. Hors zone de livraison, il le dit et vous donne le numéro du
          fournisseur.
        </li>
      </ul>

      <h2>La famille Fonenako</h2>
      <p>
        Akora est fait par l'équipe de <strong>Fonenako</strong>, la plateforme immobilière
        malgache. Même exigence, même refus des données inventées, même attention au réseau lent :
        la majorité de nos visiteurs sont sur un téléphone Android en 3G.
      </p>

      <h2>Nous écrire</h2>
      <p>
        <Link to="/contact">La page contact</Link> pour une question, un signalement ou une
        candidature de fournisseur.
      </p>
    </PageTexte>
  );
}
