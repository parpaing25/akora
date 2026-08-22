import { Link } from "react-router-dom";
import { PageTexte } from "@/components/PageTexte";
import { BadgeVerification } from "@/components/marque/BadgeVerification";

/** « Que veut dire vérifié ? » — argument commercial autant que transparence. */
export default function Verification() {
  return (
    <PageTexte
      titre="Que veut dire « vérifié » ?"
      chemin="/verification"
      chapeau="Un badge qui ne veut rien dire ne protège personne. Voici exactement ce qu'Akora contrôle, et ce qu'il ne contrôle pas."
      donneesStructurees={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Que vérifie Akora avant d'accorder le badge bleu ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "La carte fiscale (NIF), la carte statistique (STAT), le registre du commerce (RCS), la pièce d'identité du gérant, une photo de l'enseigne et du dépôt, et un numéro mobile money de versement.",
            },
          },
          {
            "@type": "Question",
            name: "Le badge garantit-il la qualité des matériaux ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Non. Il garantit que l'entreprise existe légalement, qu'elle a un dépôt physique et qu'elle est joignable. La qualité se juge sur les avis, qui ne sont possibles qu'après une commande clôturée.",
            },
          },
        ],
      }}
    >
      <h2>Les quatre niveaux</h2>
      <div className="not-prose my-4 space-y-3">
        {(
          [
            ["partenaire", "Au moins 10 commandes clôturées, une note d'au moins 4,2 sur 5, aucun litige perdu depuis six mois. Attribué automatiquement, révocable."],
            ["verifie", "Les six pièces obligatoires ont été examinées et acceptées. Débloque le paiement en ligne et le tri « vérifiés d'abord »."],
            ["en_cours", "Des pièces ont été déposées, l'examen est en cours."],
            ["non_verifie", "Aucune pièce examinée. Le fournisseur peut publier un catalogue, mais pas encaisser en ligne."],
          ] as const
        ).map(([niveau, texte]) => (
          <div key={niveau} className="carte flex flex-wrap items-start gap-3 p-3">
            <BadgeVerification niveau={niveau} />
            <p className="min-w-[12rem] flex-1 text-legende text-muted-foreground">{texte}</p>
          </div>
        ))}
      </div>

      <h2>Les six pièces obligatoires</h2>
      <ol>
        <li>
          <strong>Carte fiscale (NIF)</strong> — numéro et scan.
        </li>
        <li>
          <strong>Carte statistique (STAT)</strong> — numéro et scan.
        </li>
        <li>
          <strong>Registre du commerce (RCS)</strong> — numéro et scan.
        </li>
        <li>
          <strong>Pièce d'identité du gérant</strong> — recto et verso.
        </li>
        <li>
          <strong>Photo de l'enseigne et du dépôt</strong> — la preuve qu'un lieu existe vraiment.
        </li>
        <li>
          <strong>Numéro mobile money de versement</strong> — celui sur lequel Akora reverse les ventes.
        </li>
      </ol>
      <p>
        La photo des véhicules et la carte grise sont facultatives, mais elles rassurent sur la
        capacité à livrer.
      </p>

      <h2>Ce qui est public, ce qui ne l'est pas</h2>
      <p>
        Les <strong>numéros</strong> NIF, STAT et RCS sont affichés sur la fiche du fournisseur :
        ce sont des identifiants d'entreprise, ils figurent déjà sur les factures.
      </p>
      <p>
        Les <strong>scans</strong>, la pièce d'identité du gérant et toute pièce personnelle ne sont
        jamais montrés à qui que ce soit d'autre qu'un administrateur d'Akora. Ils sont rangés dans
        un stockage privé, accessibles uniquement par un lien temporaire de soixante secondes, et
        chaque consultation est écrite dans un journal.
      </p>
      <p>
        Le badge, au survol, dit <em>ce qui</em> a été vérifié et <em>quand</em>. Jamais le document.
      </p>

      <h2>Ce que le badge ne dit pas</h2>
      <p>
        Il ne juge <strong>pas la qualité des matériaux</strong>, ni les délais, ni le sérieux d'une
        livraison. Ça, ce sont les avis qui le disent — et un avis n'est possible qu'après une
        commande clôturée, jamais avant.
      </p>

      <h2>Vous êtes fournisseur ?</h2>
      <p>
        La vérification est gratuite.{" "}
        <Link to="/devenir-fournisseur">Voir comment monter son dossier</Link>.
      </p>
    </PageTexte>
  );
}
