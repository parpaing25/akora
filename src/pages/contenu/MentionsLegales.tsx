import { PageTexte } from "@/components/PageTexte";

export default function MentionsLegales() {
  return (
    <PageTexte titre="Mentions légales" chemin="/mentions-legales" majLe="22/08/2026">
      <h2>Éditeur</h2>
      <p>
        Akora est édité par l'équipe de Fonenako, à Antananarivo, Madagascar.
        <br />
        Contact : contact@akora.fonenako.mg
      </p>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par o2switch (France). La base de données et l'authentification sont
        hébergées par Supabase, sur des serveurs situés dans l'Union européenne.
      </p>

      <h2>Nature du service</h2>
      <p>
        Akora est une <strong>place de marché</strong>. Il met en relation des acheteurs et des
        fournisseurs indépendants de matériaux de construction. Il n'est ni vendeur, ni
        transporteur, ni fabricant des produits présentés.
      </p>
      <p>
        Les prix, les disponibilités, les caractéristiques et les délais sont renseignés par les
        fournisseurs sous leur responsabilité. Les coûts de livraison affichés sont des
        <strong> estimations</strong> calculées à partir des barèmes déclarés par chaque
        fournisseur ; le prix final est confirmé par lui.
      </p>

      <h2>Paiement</h2>
      <p>
        Les règlements en ligne se font exclusivement par mobile money (MVola, Orange Money, Airtel
        Money). <strong>Aucune donnée de carte bancaire n'est collectée, stockée ou transmise</strong>{" "}
        par Akora.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        La structure du site, ses textes et son identité visuelle appartiennent à son éditeur. Les
        photographies de produits et les logos appartiennent aux fournisseurs qui les ont déposés.
      </p>

      <h2>Cartographie</h2>
      <p>
        Les fonds de carte proviennent d'OpenStreetMap, sous licence ODbL, et sont attribués comme
        tels sur chaque carte affichée.
      </p>
    </PageTexte>
  );
}
