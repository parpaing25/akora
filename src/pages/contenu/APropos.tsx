import { Link } from "react-router-dom";
import { PageTexte } from "@/components/PageTexte";

/**
 * À propos — étoffé le 06/09/2026 (audit C-02).
 *
 * L'ancienne page disait bien le problème et la méthode, mais ni QUI, ni
 * DEPUIS QUAND, ni COMBIEN, ni COMMENT Akora gagne sa vie. Une page de
 * confiance sans ces quatre réponses ne rassure personne qui s'apprête à payer
 * 400 000 Ar par MVola.
 *
 * Chiffres recomptés en base le 05/09/2026 et arrondis VERS LE BAS (8 familles,
 * 37 types, 112 formats). À relire avant chaque mise à jour de la page.
 * Identité de l'éditeur : mentions légales publiées de fonenako.mg.
 */
const CHIFFRES = [
  { valeur: "8", libelle: "familles de matériaux" },
  { valeur: "37", libelle: "types référencés" },
  { valeur: "110+", libelle: "formats avec leurs cotes et leur poids" },
  { valeur: "0 %", libelle: "de commission sur la livraison" },
];

export default function APropos() {
  return (
    <PageTexte
      titre="À propos d'Akora"
      chemin="/a-propos"
      description="Akora compare les fournisseurs de matériaux de gros œuvre au prix rendu chantier à Madagascar. Qui le fait, depuis quand, comment il gagne sa vie, ce qu'il refuse de faire."
      chapeau="Akora compare les fournisseurs de matériaux de gros œuvre au prix rendu chantier, à Madagascar. Voici qui le fait, et comment."
      majLe="06/09/2026"
      donneesStructurees={{
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "À propos d'Akora",
        url: "https://akora.fonenako.mg/a-propos",
        about: { "@type": "Organization", name: "Akora", url: "https://akora.fonenako.mg" },
      }}
    >
      <h2>Le problème</h2>
      <p>
        À Antananarivo comme en province, le prix affiché au dépôt ne dit presque rien du prix réel.
        Un mètre cube de sable à 90 000 Ar livré à 8 km revient moins cher qu'un mètre cube à
        75 000 Ar livré à 40 km. Tout le monde le sait, personne ne peut le calculer avant d'avoir
        appelé cinq dépôts — et la plupart des annonces de dépôts ne donnent pas leur prix : il faut
        téléphoner.
      </p>

      <h2>Ce qu'Akora fait</h2>
      <p>
        Il calcule. Vous dites où livrer, vous choisissez un matériau, et vous voyez le prix rendu
        chantier de chaque fournisseur : matériau, transport, total, et le prix ramené à l'unité
        livrée. La formule est affichée, pas cachée. Puis vous commandez, le fournisseur vous appelle,
        et si vous payez par mobile money l'argent reste sous séquestre jusqu'à ce que vous ayez reçu
        la marchandise.
      </p>

      <ul className="not-prose my-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Akora en chiffres">
        {CHIFFRES.map((c) => (
          <li key={c.libelle} className="carte p-3 text-center">
            <span className="nombres block text-section text-primary">{c.valeur}</span>
            <span className="block text-legende text-muted-foreground">{c.libelle}</span>
          </li>
        ))}
      </ul>

      <h2>Comment Akora gagne sa vie</h2>
      <p>
        Une seule façon : <strong>3 % du montant des matériaux</strong> payés en ligne, retenus au
        moment où le séquestre est libéré au fournisseur. Rien sur la livraison, rien à l'inscription,
        rien pour être « vérifié », rien sur les commandes payées à la livraison. Pas de publicité, pas
        de vente de données. Si un jour cela change, ce sera écrit ici et dans les{" "}
        <Link to="/conditions-utilisation">conditions</Link> avant, pas après.
      </p>

      <h2>Ce qu'Akora ne fait pas</h2>
      <ul>
        <li>
          Il ne vend rien lui-même. Les fournisseurs sont des dépôts, des briqueteries, des carrières
          et des scieries indépendants, qui fixent leurs prix et livrent.
        </li>
        <li>
          Il ne référence que le <strong>gros œuvre</strong> : agglomérés, briques, granulats, liants,
          bois, couverture, acier de construction, béton prêt à l'emploi. Ni quincaillerie, ni
          plomberie, ni électricité, ni finitions.
        </li>
        <li>
          Il n'invente jamais un prix. Hors zone de livraison, il le dit et vous donne le numéro du
          fournisseur. Un prix indicatif est toujours daté et sourcé.
        </li>
        <li>
          Il ne promet pas ce qu'il ne contrôle pas : le badge « vérifié » dit exactement{" "}
          <Link to="/verification">ce qui a été contrôlé, et quand</Link>.
        </li>
      </ul>

      <h2>D'où viennent les dépôts</h2>
      <p>
        Une partie des fiches est créée par les fournisseurs eux-mêmes. Une autre est constituée par
        Akora à partir des annonces publiques des dépôts (groupes Facebook de matériaux, pages de
        briqueteries), avec les prix qu'ils ont publiés et leurs coordonnées. Le dépôt peut
        revendiquer sa fiche en une minute, la corriger ou la faire retirer. Un produit n'entre sur le
        site qu'avec une référence du catalogue, un prix et une photo — sinon il attend.
      </p>

      <h2>Qui</h2>
      <p>
        Akora est fait à Antananarivo par l'équipe de <strong>Fonenako</strong>, la plateforme
        immobilière malgache (fonenako.mg), fondée par Onjaniaina Andrianirina, ingénieur en génie
        civil. Même exigence, même refus des données inventées, même attention au réseau lent : la
        majorité de nos visiteurs sont sur un téléphone Android en 3G, et le site est conçu pour eux
        d'abord. Le projet est né en août 2026 ; le site s'ouvre au public en septembre 2026.
      </p>
      <p>
        L'éditeur, ses coordonnées et l'hébergement sont dans les{" "}
        <Link to="/mentions-legales">mentions légales</Link>.
      </p>

      <h2>Nous écrire</h2>
      <p>
        <Link to="/contact">La page contact</Link> pour une question, un signalement, une fiche de dépôt
        à revendiquer ou une candidature de fournisseur. Les réponses courtes sont dans la{" "}
        <Link to="/faq">FAQ</Link>.
      </p>
    </PageTexte>
  );
}
