import { PageTexte } from "@/components/PageTexte";

/**
 * Mentions légales — version complète construite par l'audit du 05/09/2026 (C-03).
 *
 * L'ancienne page disait « édité par l'équipe de Fonenako » sans forme
 * juridique, NIF, STAT, RCS, siège ni directeur de publication. Pour une
 * place de marché qui garde de l'argent sous séquestre, l'acheteur doit
 * pouvoir savoir QUI il paie et où l'assigner.
 *
 * 🔴 Chaque `[À COMPLÉTER]` bloque la publication : un champ légal faux ou
 * manquant est pire qu'absent. Réponses attendues d'Andry (Q1 de la fiche
 * d'identité). Les valeurs déjà connues sont laissées telles quelles.
 */
const EDITEUR = {
  denomination: "[À COMPLÉTER — dénomination sociale, ex. FONENAKO SARL]",
  forme: "[À COMPLÉTER — forme juridique et capital, ex. SARL au capital de … Ar]",
  siege: "[À COMPLÉTER — adresse du siège], Antananarivo, Madagascar",
  nif: "[À COMPLÉTER — NIF]",
  stat: "[À COMPLÉTER — numéro STAT]",
  rcs: "[À COMPLÉTER — RCS Antananarivo n° …]",
  directeur: "[À COMPLÉTER — nom du directeur de la publication]",
  telephone: "[À COMPLÉTER — +261 …]",
  courriel: "contact@akora.fonenako.mg",
};

export default function MentionsLegales() {
  return (
    <PageTexte
      titre="Mentions légales"
      chemin="/mentions-legales"
      description="Éditeur, hébergeurs, nature du service de place de marché, paiement mobile money, propriété intellectuelle, droit applicable."
      majLe="06/09/2026"
    >
      <h2>Éditeur</h2>
      <p>
        Le site akora.fonenako.mg est édité par <strong>{EDITEUR.denomination}</strong>, {EDITEUR.forme},
        dont le siège est {EDITEUR.siege}.
        <br />
        NIF : {EDITEUR.nif} · STAT : {EDITEUR.stat} · {EDITEUR.rcs}
        <br />
        Directeur de la publication : {EDITEUR.directeur}
        <br />
        Téléphone : {EDITEUR.telephone} · Courriel : <a href={`mailto:${EDITEUR.courriel}`}>{EDITEUR.courriel}</a>
      </p>
      <p>
        Akora fait partie de la famille <strong>Fonenako</strong>, plateforme immobilière malgache
        (fonenako.mg), éditée par la même société.
      </p>

      <h2>Hébergement</h2>
      <p>
        Site et photos : <strong>o2switch</strong>, SAS au capital de 100 000 €, 222-224 boulevard
        Gustave Flaubert, 63000 Clermont-Ferrand, France — +33 4 44 44 60 40.
        <br />
        Base de données, comptes et fonctions serveur : <strong>Supabase Inc.</strong>, 970 Toa Payoh
        North #07-04, Singapour 318992 — région d'hébergement du projet :{" "}
        [À COMPLÉTER — vérifier dans le tableau de bord Supabase › Settings › General ; l'ancienne
        page annonçait l'Union européenne].
      </p>

      <h2>Nature du service</h2>
      <p>
        Akora est une <strong>place de marché</strong> : il met en relation des acheteurs et des
        fournisseurs indépendants de matériaux de construction (dépôts, briqueteries, carrières,
        scieries, transporteurs). Akora n'est ni vendeur, ni transporteur, ni fabricant des produits
        présentés. Le contrat de vente se forme entre l'acheteur et le fournisseur ; Akora fournit
        l'outil de comparaison, de commande, de séquestre et d'arbitrage décrit dans les{" "}
        <a href="/conditions-utilisation">conditions d'utilisation</a>.
      </p>
      <p>
        Les prix, disponibilités, caractéristiques et délais sont renseignés par les fournisseurs sous
        leur responsabilité. Certaines fiches de dépôts sont créées par Akora à partir d'annonces
        publiques du fournisseur, avec les prix qu'il a lui-même publiés ; elles sont signalées comme
        telles et le fournisseur peut les revendiquer, les corriger ou en demander le retrait. Les coûts
        de livraison affichés sont des <strong>estimations</strong> calculées depuis les barèmes
        déclarés par chaque fournisseur ; le prix final est confirmé par lui.
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
        <a href="/politique-confidentialite">politique de confidentialité</a> (loi n° 2014-038 du
        9 janvier 2015 relative à la protection des données à caractère personnel). Responsable du
        traitement : l'éditeur ci-dessus. Déclaration auprès de la Commission malagasy de
        l'informatique et des libertés (CMIL) : [À COMPLÉTER — numéro de récépissé, ou « en cours »].
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
        fiche concernée ou par courriel à {EDITEUR.courriel}. Pour une faille de sécurité :
        akora.fonenako.mg/.well-known/security.txt.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Le site et les conditions d'utilisation sont soumis au droit malgache. À défaut d'accord
        amiable, les tribunaux d'Antananarivo sont compétents.
      </p>
    </PageTexte>
  );
}
