import { Link } from "react-router-dom";
import { PageTexte } from "@/components/PageTexte";
import { CONTACT_PUBLIC, faq } from "@/lib/seo/jsonld";

/**
 * FAQ — construite le 06/09/2026 (audit C-04, GEO).
 *
 * Chaque réponse reprend un fait déjà écrit ailleurs sur le site (conditions,
 * vérification, devenir fournisseur, paiement, confidentialité) : une FAQ qui
 * invente une règle crée un litige. Le JSON-LD FAQPage est généré depuis la
 * même liste : une seule source. Délai de vérification des paiements : 24 h
 * ouvrées (décision par défaut de l'audit, à confirmer par Andry).
 */
const QUESTIONS: { id: string; question: string; reponse: string; lien?: { vers: string; texte: string } }[] = [
  {
    id: "akora",
    question: "Qu'est-ce qu'Akora ?",
    reponse:
      "Akora est une place de marché de matériaux de construction à Madagascar. Il compare les dépôts, briqueteries, carrières et scieries au prix rendu chantier : le prix du matériau plus la livraison calculée depuis votre adresse. Akora ne vend rien lui-même : ce sont des fournisseurs indépendants qui vendent, livrent et encaissent.",
    lien: { vers: "/a-propos", texte: "Qui fait Akora" },
  },
  {
    id: "prix-rendu",
    question: "Que veut dire « prix rendu chantier » ?",
    reponse:
      "C'est le prix du matériau au dépôt, plus le coût de transport jusqu'à votre chantier, estimé à partir du barème déclaré par chaque fournisseur (véhicules, kilomètres inclus, zones, franco). Le total est ramené à l'unité livrée pour comparer deux dépôts qui n'ont ni le même prix ni la même distance. La livraison affichée est une estimation ; le fournisseur la confirme avant de partir.",
    lien: { vers: "/materiaux", texte: "Comparer un matériau" },
  },
  {
    id: "commander",
    question: "Comment passer une commande ?",
    reponse:
      "Choisissez un matériau, comparez les fournisseurs, ajoutez au panier, puis « Commander » : votre nom, votre numéro de téléphone et l'adresse de livraison suffisent. Vous pouvez commander sans créer de compte si vous payez à la livraison. Le fournisseur reçoit la commande et vous appelle pour fixer le créneau. Gardez le numéro de commande (AK-…) et le lien de suivi qui s'affichent : ils permettent de revoir la commande.",
    lien: { vers: "/panier", texte: "Mon panier" },
  },
  {
    id: "payer",
    question: "Comment payer ? Faut-il une carte bancaire ?",
    reponse:
      "Aucune carte bancaire. Deux façons de payer : à la livraison, en espèces au fournisseur ; ou en ligne par mobile money (MVola, Orange Money, Airtel Money) quand le fournisseur est vérifié et l'accepte. Pour le mobile money, vous envoyez le montant au numéro indiqué, puis vous recopiez la référence de transaction reçue par SMS : un administrateur Akora la vérifie sous 24 heures ouvrées. Le paiement en ligne demande un compte.",
    lien: { vers: "/guides/payer-mobile-money", texte: "Payer par mobile money, pas à pas" },
  },
  {
    id: "sequestre",
    question: "Où va mon argent quand je paie en ligne ?",
    reponse:
      "Il est mis sous séquestre par Akora : le fournisseur ne le reçoit qu'après votre confirmation de réception. Si vous ouvrez un litige avant, l'argent reste bloqué le temps de l'arbitrage. Akora retient alors 3 % du montant des matériaux (rien sur la livraison) : c'est sa seule rémunération, payée par le fournisseur, jamais par vous en supplément.",
    lien: { vers: "/conditions-utilisation", texte: "Les conditions d'utilisation" },
  },
  {
    id: "litige",
    question: "La livraison ne correspond pas à la commande : que faire ?",
    reponse:
      "Si vous avez payé en ligne, ouvrez un litige depuis la page de la commande avant de confirmer la réception, avec un motif et des photos. Akora arbitre : libération au fournisseur, remboursement total ou partiel, décision motivée envoyée aux deux parties. Si vous avez payé à la livraison, refusez la marchandise non conforme au déchargement et signalez le fournisseur depuis sa fiche.",
    lien: { vers: "/guides/reception-livraison", texte: "Bien réceptionner une livraison" },
  },
  {
    id: "verifie",
    question: "Que veut dire le badge « vérifié » ?",
    reponse:
      "Le fournisseur a fourni six pièces (cartes fiscale et statistique, registre du commerce, pièce d'identité du gérant, photo du dépôt…) qu'un administrateur a examinées. Le badge dit ce qui a été vérifié et quand, jamais le contenu des documents. Il existe quatre niveaux ; « vérifié » débloque le paiement en ligne, « partenaire » s'obtient après dix commandes clôturées avec une note d'au moins 4,2 sur 5.",
    lien: { vers: "/verification", texte: "Les quatre niveaux, en détail" },
  },
  {
    id: "livraison",
    question: "Qui livre, et jusqu'où ?",
    reponse:
      "Le fournisseur, avec ses propres véhicules, ou un transporteur déclaré sur Akora. Chaque dépôt fixe son rayon de livraison. Hors zone, Akora ne calcule pas de prix : il vous donne le numéro du fournisseur pour vous entendre directement. Certains dépôts proposent aussi le retrait sur place.",
    lien: { vers: "/transporteurs", texte: "Les transporteurs" },
  },
  {
    id: "quantite",
    question: "Comment savoir combien de parpaings, de sable ou de ciment il me faut ?",
    reponse:
      "Les calculateurs d'Akora estiment les quantités pour un mur en parpaings, une dalle à hourdis, un volume de béton, une chape ou un enduit, une toiture, à partir de vos dimensions. Ce sont des estimations de métré, pas un devis d'ingénieur : gardez une marge de casse et faites valider les structures porteuses par un professionnel.",
    lien: { vers: "/calculateurs", texte: "Les calculateurs" },
  },
  {
    id: "fournisseur",
    question: "Je suis un dépôt ou une briqueterie : comment vendre sur Akora ?",
    reponse:
      "C'est gratuit. Trois étapes en ligne : créer le compte, décrire le dépôt (adresse, horaires, véhicules, zones de livraison), publier vos produits avec prix et photos. La vérification est gratuite aussi et débloque le paiement en ligne et le tri « vérifiés d'abord ». Akora prend 3 % du montant des matériaux vendus par la plateforme, rien sur la livraison, rien à l'inscription.",
    lien: { vers: "/devenir-fournisseur", texte: "Devenir fournisseur" },
  },
  {
    id: "fiche-existante",
    question: "Mon dépôt apparaît déjà sur Akora sans que je l'aie créé. Pourquoi ?",
    reponse:
      "Akora référence des dépôts à partir de leurs annonces publiques (par exemple sur Facebook), avec les prix qu'ils ont eux-mêmes publiés, pour que les acheteurs les trouvent. Vous pouvez revendiquer la fiche, la corriger ou demander son retrait en nous écrivant depuis la page contact avec le nom du dépôt et un numéro où vous joindre.",
    lien: { vers: "/contact", texte: "Nous écrire" },
  },
  {
    id: "donnees",
    question: "Quelles données gardez-vous sur moi, et comment supprimer mon compte ?",
    reponse:
      "Votre panier et votre point de livraison restent dans votre navigateur. Sur nos serveurs : votre nom, numéro, e-mail, vos commandes et paiements (jamais de données bancaires). Le compte se supprime depuis Mon compte › Sécurité ; les commandes terminées sont conservées sans votre nom pour la comptabilité. Les pièces de vérification des fournisseurs sont dans un stockage privé, effacées un an après la fermeture du compte.",
    lien: { vers: "/politique-confidentialite", texte: "La politique de confidentialité" },
  },
  {
    id: "contact",
    question: "Comment joindre Akora ?",
    reponse: `Par WhatsApp ou téléphone au ${CONTACT_PUBLIC.telephoneAffiche}, du lundi au samedi de 8 h à 17 h, ou par e-mail à ${CONTACT_PUBLIC.courriel}. Pour une commande en cours, le plus rapide reste le fournisseur, joignable depuis la page de la commande.`,
    lien: { vers: "/contact", texte: "Page contact" },
  },
];

const DONNEES_FAQ = faq(QUESTIONS.map((q) => ({ question: q.question, reponse: q.reponse })));

export default function FAQ() {
  return (
    <PageTexte
      titre="Questions fréquentes"
      chemin="/faq"
      description="Commander, payer par mobile money, séquestre, litiges, livraison, badge vérifié, vendre sur Akora : les réponses courtes aux questions que l'on nous pose."
      chapeau="Les réponses courtes. Chaque réponse renvoie à la page qui détaille."
      majLe="06/09/2026"
      donneesStructurees={DONNEES_FAQ}
    >
      <nav aria-label="Questions" className="not-prose mb-6 rounded-md bg-muted p-3">
        <ol className="grid gap-1 text-legende sm:grid-cols-2">
          {QUESTIONS.map((q) => (
            <li key={q.id}>
              <a href={`#${q.id}`} className="lien-souligne inline-block py-1">
                {q.question}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {QUESTIONS.map((q) => (
        <section key={q.id} id={q.id} aria-labelledby={`${q.id}-titre`} className="scroll-mt-20">
          <h2 id={`${q.id}-titre`}>{q.question}</h2>
          <p>{q.reponse}</p>
          {q.lien ? (
            <p>
              <Link to={q.lien.vers} className="lien-souligne">
                {q.lien.texte}
              </Link>
            </p>
          ) : null}
        </section>
      ))}

      <h2>Une question sans réponse ici ?</h2>
      <p>
        <Link to="/contact">Écrivez-nous</Link> : la réponse rejoint cette page si elle peut servir à
        d'autres.
      </p>
    </PageTexte>
  );
}
