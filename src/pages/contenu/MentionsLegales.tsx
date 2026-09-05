import { Link } from "react-router-dom";
import { PageTexte } from "@/components/PageTexte";
import { CONTACT_PUBLIC } from "@/lib/seo/jsonld";

/**
 * Mentions légales — complétées le 06/09/2026 (audit C-03).
 *
 * L'ancienne page disait « édité par l'équipe de Fonenako » sans nom, ni
 * qualité, ni directeur de publication, ni téléphone. Pour une place de marché
 * qui garde de l'argent sous séquestre, l'acheteur doit savoir QUI il paie.
 *
 * Source des valeurs : les mentions légales publiées de fonenako.mg
 * (public/mentions-legales.html du dépôt Fonenako) — même éditeur. La région
 * d'hébergement Supabase a été vérifiée le 05/09/2026 sur les plages d'adresses
 * AWS (eu-central-1, Francfort). Les identifiants fiscaux (NIF, STAT) ne sont
 * pas publiés : ils se communiquent sur demande écrite — à publier ici dès
 * qu'Andry les transmet (docs/A-APPLIQUER.md).
 */
const EDITEUR = {
  nom: "Fanomezantsoa Onjaniaina ANDRIANIRINA",
  qualite: "fondateur et président-directeur de Fonenako",
  nomCommercial: "Fonenako",
  adresse: "Antananarivo, Madagascar",
  telephone: CONTACT_PUBLIC.telephoneAffiche,
  telephoneE164: CONTACT_PUBLIC.telephoneE164,
  courriel: CONTACT_PUBLIC.courriel,
};

export default function MentionsLegales() {
  return (
    <PageTexte
      titre="Mentions légales"
      chemin="/mentions-legales"
      description="Éditeur, hébergeurs, nature du service de place de marché, paiement mobile money et séquestre, données personnelles, propriété intellectuelle, droit applicable."
      majLe="06/09/2026"
    >
      <h2>Éditeur</h2>
      <p>
        Le site akora.fonenako.mg est édité par <strong>{EDITEUR.nom}</strong>, {EDITEUR.qualite}{" "}
        (nom commercial : {EDITEUR.nomCommercial}), {EDITEUR.adresse}.
        <br />
        Directeur de la publication : {EDITEUR.nom}.
        <br />
        Téléphone : <a href={`tel:${EDITEUR.telephoneE164}`} className="nombres">{EDITEUR.telephone}</a> ·
        Courriel : <a href={`mailto:${EDITEUR.courriel}`}>{EDITEUR.courriel}</a>
        <br />
        Identifiants fiscaux (NIF, STAT) et registre du commerce : communiqués sur demande écrite à
        l'adresse ci-dessus.
      </p>
      <p>
        Akora fait partie de la famille <strong>Fonenako</strong>, la plateforme immobilière malgache
        (fonenako.mg), du même éditeur.
      </p>

      <h2>Hébergement</h2>
      <p>
        Site et photos : <strong>o2switch</strong>, 222-224 boulevard Gustave Flaubert, 63000
        Clermont-Ferrand, France (o2switch.fr).
        <br />
        Base de données, comptes et fonctions serveur : <strong>Supabase Inc.</strong> (supabase.com),
        projet hébergé dans la région <strong>Francfort, Allemagne</strong> (Union européenne).
      </p>

      <h2>Nature du service</h2>
      <p>
        Akora est une <strong>place de marché</strong> : il met en relation des acheteurs et des
        fournisseurs indépendants de matériaux de construction (dépôts, briqueteries, carrières,
        scieries, transporteurs). Akora n'est ni vendeur, ni transporteur, ni fabricant des produits
        présentés. Le contrat de vente se forme entre l'acheteur et le fournisseur ; Akora fournit
        l'outil de comparaison, de commande, de séquestre et d'arbitrage décrit dans les{" "}
        <Link to="/conditions-utilisation">conditions d'utilisation</Link>.
      </p>
      <p>
        Les prix, disponibilités, caractéristiques et délais sont renseignés par les fournisseurs sous
        leur responsabilité. Certaines fiches de dépôts sont constituées par Akora à partir d'annonces
        publiques du fournisseur, avec les prix qu'il a lui-même publiés ; le fournisseur peut les
        revendiquer, les corriger ou en demander le retrait. Les coûts de livraison affichés sont des{" "}
        <strong>estimations</strong> calculées à partir des barèmes déclarés par chaque fournisseur ;
        le prix final est confirmé par lui.
      </p>

      <h2>Paiement et séquestre</h2>
      <p>
        Les règlements en ligne se font exclusivement par mobile money (MVola, Orange Money, Airtel
        Money). <strong>Aucune donnée de carte bancaire n'est collectée, stockée ou transmise</strong>{" "}
        par Akora. Les sommes payées en ligne sont conservées par l'éditeur pour le compte des parties
        jusqu'à la confirmation de réception ou la décision d'arbitrage, puis versées au fournisseur
        après retenue de la commission de 3 % sur le montant des matériaux. Les paiements à la
        livraison se font directement entre l'acheteur et le fournisseur, sans passer par Akora.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Les traitements sont décrits dans la{" "}
        <Link to="/politique-confidentialite">politique de confidentialité</Link> (loi n° 2014-038
        relative à la protection des données à caractère personnel). Responsable du traitement :
        l'éditeur ci-dessus. Autorité de contrôle : Commission malagasy de l'informatique et des
        libertés (CMIL).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        La structure du site, ses textes, son code et son identité visuelle appartiennent à l'éditeur.
        Les photographies de produits, de dépôts et les logos appartiennent aux fournisseurs qui les
        ont déposés ou publiés ; ils sont reproduits pour présenter leur offre. Toute reproduction à
        d'autres fins demande l'accord de leur titulaire.
      </p>

      <h2>Cartographie</h2>
      <p>
        Les fonds de carte proviennent d'OpenStreetMap, sous licence ODbL, et sont attribués comme
        tels sur chaque carte affichée.
      </p>

      <h2>Signalement</h2>
      <p>
        Un contenu illicite, une annonce trompeuse ou une atteinte à un droit se signalent depuis la
        fiche concernée ou par courriel à {EDITEUR.courriel}. Pour une faille de sécurité :{" "}
        <code>akora.fonenako.mg/.well-known/security.txt</code>.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Le site et les conditions d'utilisation sont soumis au droit malgache. À défaut d'accord
        amiable, les tribunaux d'Antananarivo sont compétents.
      </p>
    </PageTexte>
  );
}
