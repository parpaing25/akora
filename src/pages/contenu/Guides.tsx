import { Link, useParams } from "react-router-dom";
import { PageTexte } from "@/components/PageTexte";
import { filAriane } from "@/components/Seo";
import NonTrouve from "@/pages/NonTrouve";

/**
 * Guides éditoriaux (spec D7). Un seul chunk pour les quatre : ce sont des
 * textes, ils ne pèsent rien, et les découper multiplierait les allers-retours
 * réseau pour rien.
 */
const GUIDES: Record<string, { titre: string; chapeau: string; corps: React.ReactNode }> = {
  "choisir-son-sable": {
    titre: "Bien choisir son sable",
    chapeau: "Trois sables, trois usages. Se tromper coûte plus cher que la différence de prix.",
    corps: (
      <>
        <h2>Sable fin</h2>
        <p>
          Grains serrés, très peu d'argile. C'est le sable des <strong>enduits</strong> et des
          finitions. Il donne une surface lisse et accroche bien. En revanche, il ne tient pas dans
          un béton : trop fin, il demande beaucoup d'eau et fissure au séchage.
        </p>

        <h2>Sable de rivière</h2>
        <p>
          Le polyvalent. Grains ronds, lavés par le courant, peu d'impuretés. C'est le sable du{" "}
          <strong>mortier de pose</strong> et du <strong>béton courant</strong>. Si vous ne devez en
          commander qu'un, c'est celui-là.
        </p>

        <h2>Sable de carrière</h2>
        <p>
          Concassé, grains anguleux, souvent chargé en fines. Il <strong>accroche mieux</strong>{" "}
          dans un béton de structure, mais il faut vérifier sa propreté : trop d'argile et le béton
          perd en résistance.
        </p>

        <h2>Le test du bocal, en cinq minutes</h2>
        <ol>
          <li>Remplissez un bocal transparent au tiers de sable.</li>
          <li>Complétez d'eau claire, fermez, secouez vingt secondes.</li>
          <li>Laissez reposer une heure.</li>
        </ol>
        <p>
          Une couche d'argile se dépose au-dessus du sable. Si elle dépasse{" "}
          <strong>un dixième de la hauteur de sable</strong>, le sable est trop chargé pour un
          béton de structure. Pour un remblai, ça n'a pas d'importance.
        </p>

        <h2>Combien commander</h2>
        <p>
          Un mètre cube de sable pèse environ 1 500 à 1 600 kg. Une petite camionnette en transporte
          rarement plus de deux ; un camion de 8 m³ en prend six à huit selon la charge utile. C'est
          pour ça qu'Akora choisit tout seul le véhicule et compte les rotations : trois voyages ne
          coûtent pas le prix d'un.
        </p>
        <p>
          <Link to="/materiaux/granulats">Comparer les sables au prix rendu chantier</Link>.
        </p>
      </>
    ),
  },

  "combien-de-parpaings": {
    titre: "Combien de parpaings pour mon mur ?",
    chapeau: "Le calcul tient en une ligne. Ce qu'on oublie, c'est le mortier et les 5 % de casse.",
    corps: (
      <>
        <h2>Le calcul de base</h2>
        <p>
          Un parpaing standard mesure 40 × 20 cm de face, soit 0,08 m². Il en faut donc{" "}
          <strong>12,5 par mètre carré</strong> de mur, joints compris.
        </p>
        <p>
          Surface du mur = longueur × hauteur, <strong>moins</strong> la surface des portes et des
          fenêtres. Un mur de 10 m sur 3 m avec 6 m² d'ouvertures fait 24 m², soit 300 parpaings.
        </p>

        <h2>Ce qu'on oublie</h2>
        <ul>
          <li>
            <strong>La casse.</strong> Comptez 5 % de plus. Sur 300 blocs, c'est 15 : moins cher que
            de refaire venir un camion pour dix parpaings.
          </li>
          <li>
            <strong>Le mortier.</strong> Environ 0,02 m³ par mètre carré de mur. Pour 24 m², cela
            fait 0,48 m³, soit à peu près 4 sacs de ciment et 0,6 m³ de sable.
          </li>
          <li>
            <strong>L'épaisseur.</strong> Un bloc de 15 pèse 17 kg, un bloc de 20 en pèse 22. Sur
            300 blocs, la différence fait 1,5 tonne — et parfois une rotation de camion en plus.
          </li>
        </ul>

        <h2>Creux ou plein ?</h2>
        <p>
          Le <strong>creux</strong> suffit pour un mur de remplissage entre poteaux : plus léger,
          moins cher, plus facile à poser. Le <strong>plein</strong> se justifie pour un mur porteur,
          un soubassement ou une clôture exposée.
        </p>

        <h2>Laissez faire le calculateur</h2>
        <p>
          Le <Link to="/calculateurs/mur-parpaings">calculateur de mur</Link> fait les trois calculs,
          applique la marge que vous choisissez, et remplit votre panier avec les meilleures offres{" "}
          <strong>rendues chantier</strong> — pas les moins chères au dépôt.
        </p>
      </>
    ),
  },

  "reception-livraison": {
    titre: "Réceptionner une livraison de matériaux",
    chapeau: "Dix minutes de vérification au déchargement évitent des semaines de discussion.",
    corps: (
      <>
        <h2>Avant que le camion reparte</h2>
        <p>
          Une fois le camion vide et parti, vous n'avez plus de preuve. Tout se joue pendant le
          déchargement.
        </p>
        <ol>
          <li>
            <strong>Comptez.</strong> Les parpaings et les tôles se comptent à l'unité, pendant le
            déchargement, pas après. Pour les granulats, vérifiez que la benne est pleine au niveau
            annoncé.
          </li>
          <li>
            <strong>Regardez.</strong> Parpaings ébréchés, tôles pliées, fers rouillés en surface :
            écartez-les tout de suite et faites-les noter.
          </li>
          <li>
            <strong>Photographiez.</strong> Le tas déchargé, le compteur du camion, la marchandise
            abîmée. Trois photos suffisent, et elles servent si un litige s'ouvre.
          </li>
          <li>
            <strong>Vérifiez la nature.</strong> Un sable de carrière livré à la place d'un sable de
            rivière ne se voit qu'au déchargement.
          </li>
        </ol>

        <h2>Ce qui se contrôle, matériau par matériau</h2>
        <ul>
          <li>
            <strong>Ciment</strong> — sacs intacts, non durcis. Un sac qui sonne creux ou qui a des
            grumeaux a pris l'humidité : refusez-le.
          </li>
          <li>
            <strong>Fers à béton</strong> — le diamètre, à la clé ou au pied à coulisse. Une rouille
            de surface est normale ; une rouille qui s'écaille ne l'est pas.
          </li>
          <li>
            <strong>Tôles</strong> — l'épaisseur annoncée, et l'absence de pli sur les bords.
          </li>
          <li>
            <strong>Bois</strong> — sec, sans trace d'insecte, sans grosse déformation.
          </li>
          <li>
            <strong>Béton prêt à l'emploi</strong> — l'heure de départ de la centrale. Au-delà de
            deux heures, il commence à prendre.
          </li>
        </ul>

        <h2>Si quelque chose ne va pas</h2>
        <p>
          <strong>Ne confirmez pas la réception</strong> dans Akora. Ouvrez un litige depuis la page
          de la commande, joignez vos photos et décrivez le problème. Tant que le litige est ouvert,
          l'argent reste bloqué chez Akora — il n'est pas versé au fournisseur.
        </p>
        <p>
          Attention au délai : sans confirmation ni litige de votre part, le paiement est libéré{" "}
          <strong>automatiquement 72 heures</strong> après le passage de la commande en « livrée ».
        </p>

        <h2>Si tout va bien</h2>
        <p>
          Confirmez la réception depuis la page de la commande. Le fournisseur est payé, et vous
          pouvez laisser un avis — c'est le seul moment où c'est possible, et c'est ce qui rend les
          avis d'Akora crédibles.
        </p>
      </>
    ),
  },

  "payer-mobile-money": {
    titre: "Payer par MVola, Orange Money ou Airtel Money",
    chapeau: "Comment ça marche, et pourquoi votre argent n'arrive pas tout de suite chez le fournisseur.",
    corps: (
      <>
        <h2>Pourquoi passer par Akora plutôt que payer en direct</h2>
        <p>
          Parce que votre argent est <strong>retenu jusqu'à la livraison</strong>. Si le camion
          n'arrive jamais, si les parpaings sont cassés, si ce n'est pas le bon sable : la somme est
          encore chez Akora, pas chez le fournisseur. C'est tout l'intérêt.
        </p>

        <h2>Quel opérateur pour quel numéro</h2>
        <ul>
          <li><strong>032</strong> → Orange Money</li>
          <li><strong>033</strong> → Airtel Money</li>
          <li><strong>034 et 038</strong> → MVola (Telma)</li>
        </ul>
        <p>
          Akora présélectionne l'opérateur d'après votre numéro. Si vous payez depuis un autre
          compte, changez-le : c'est un simple avertissement, jamais un blocage.
        </p>

        <h2>Le déroulé, pas à pas</h2>
        <ol>
          <li>Vous choisissez l'opérateur et le numéro qui paie.</li>
          <li>
            Akora affiche le <strong>numéro marchand</strong> et le <strong>montant exact</strong>.
            Payez depuis votre téléphone comme d'habitude.
          </li>
          <li>
            Vous recevez un SMS de confirmation avec une <strong>référence de transaction</strong>.
            Recopiez-la dans Akora.
          </li>
          <li>
            Un administrateur vérifie la référence. Le paiement passe alors « sous séquestre » :
            confirmé, mais pas versé.
          </li>
          <li>
            À votre confirmation de réception — ou 72 heures après la livraison sans contestation —
            la somme part chez le fournisseur, moins la commission d'Akora.
          </li>
        </ol>
        <p>
          Le jour où les API marchandes seront branchées, les étapes 3 et 4 disparaîtront : la
          confirmation sera automatique. Le séquestre, lui, ne change pas.
        </p>

        <h2>Payer une partie seulement</h2>
        <p>
          Certains fournisseurs acceptent un <strong>acompte</strong> — 30 % par défaut — le solde
          étant réglé au livreur. L'acompte est mis sous séquestre comme un paiement complet.
        </p>

        <h2>Ce qu'Akora ne fait jamais</h2>
        <ul>
          <li>Demander votre code secret mobile money. Personne ne doit vous le demander.</li>
          <li>Collecter un numéro de carte bancaire. Le paiement est mobile money, uniquement.</li>
          <li>Verser au fournisseur avant que vous ayez reçu, sauf par le délai de 72 heures.</li>
        </ul>
        <p>
          Le détail des règles figure dans les{" "}
          <Link to="/conditions-utilisation">conditions d'utilisation</Link>.
        </p>
      </>
    ),
  },
};

export default function Guides() {
  const { slug } = useParams<{ slug: string }>();
  const guide = slug ? GUIDES[slug] : undefined;
  if (!guide) return <NonTrouve />;

  return (
    <PageTexte
      titre={guide.titre}
      chemin={"/guides/" + slug}
      chapeau={guide.chapeau}
      donneesStructurees={filAriane([
        { nom: "Accueil", chemin: "/" },
        { nom: "Guides", chemin: "/guides/" + slug },
        { nom: guide.titre, chemin: "/guides/" + slug },
      ])}
    >
      {guide.corps}
    </PageTexte>
  );
}
