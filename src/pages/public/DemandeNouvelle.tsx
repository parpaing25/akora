import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { publier } from "@/lib/donnees/fil";
import { usePointLivraison } from "@/lib/point-livraison";
import { Seo } from "@/components/Seo";
import { Champ } from "@/components/ui/champ";
import { Bouton } from "@/components/ui/button";
import { Carte } from "@/components/ui/card";

/**
 * Publier une demande de materiaux.
 *
 * C'est l'autre moitie du fil : l'acheteur decrit ce qu'il cherche, et les
 * depots viennent a lui. Utile des le premier jour — une demande ne suppose
 * aucun fournisseur inscrit, alors qu'une annonce, si.
 *
 * Modere par construction : cinq demandes par jour et par personne, aucune
 * coordonnee dans le texte public. Les fournisseurs repondent par la
 * messagerie du site, jamais par un numero laisse en clair dans le fil.
 */
export default function DemandeNouvelle() {
  const naviguer = useNavigate();
  const client = useQueryClient();
  const { session, utilisateur, profil, chargementProfil } = useAuth();
  const { point } = usePointLivraison();
  const [texte, setTexte] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);

  const soumettre = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    if (!utilisateur) return;
    if (texte.trim().length < 10) {
      toast.error("Dites-en un peu plus", { description: "Dix caractères au minimum." });
      return;
    }
    setEnCours(true);
    try {
      await publier({
        type: "demande",
        texte: texte.trim(),
        auteurId: utilisateur.id,
        localiteId: point?.localiteId ?? null,
        // Une demande de chantier ne vaut plus rien un mois plus tard.
        expireLe: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      });
      await client.invalidateQueries({ queryKey: ["fil"] });
      toast.success("Votre demande est dans le fil");
      naviguer("/", { replace: true });
    } catch (erreur) {
      toast.error("Publication impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  if (!session) {
    return (
      <div className="container max-w-lg py-10">
        <Seo titre="Publier une demande" chemin="/demandes/nouvelle" indexable={false} />
        <h1 className="text-page">Publier une demande</h1>
        <Carte className="mt-5 p-4">
          <p className="text-courant">
            Décrivez ce que vous cherchez, et les dépôts viennent à vous avec leur prix rendu
            chantier. Il faut un compte : c'est ce qui permet aux fournisseurs de vous répondre.
          </p>
          <Bouton asChild className="mt-4" pleineLargeur>
            <Link to="/connexion" state={{ retour: "/demandes/nouvelle" }}>
              Se connecter
            </Link>
          </Bouton>
        </Carte>
      </div>
    );
  }

  if (!chargementProfil && profil && profil.email_verifie !== true) {
    return (
      <div className="container max-w-lg py-10">
        <Seo titre="Publier une demande" chemin="/demandes/nouvelle" indexable={false} />
        <h1 className="text-page">Confirmez votre adresse d'abord</h1>
        <Carte className="mt-5 p-4">
          <p className="text-courant">
            Une demande engage des dépôts à préparer un devis. On ne l'ouvre donc qu'à des comptes
            dont l'adresse est confirmée.
          </p>
          <Bouton asChild className="mt-4" pleineLargeur>
            <Link to="/verification-email">Confirmer mon adresse</Link>
          </Bouton>
        </Carte>
      </div>
    );
  }

  return (
    <div className="container max-w-lg py-10">
      <Seo titre="Publier une demande" chemin="/demandes/nouvelle" indexable={false} />
      <h1 className="text-page">Publier une demande</h1>
      <p className="mt-1 text-legende text-muted-foreground">
        Décrivez ce que vous cherchez : les dépôts vous répondent avec leur prix rendu chantier.
        Cinq demandes par jour au maximum.
      </p>

      <Carte className="mt-5 p-4">
        <form onSubmit={soumettre} className="space-y-4" noValidate>
          <Champ
            etiquette="Ce que vous cherchez"
            aide="Matériau, quantité, date de livraison souhaitée. Ne mettez pas votre numéro ici : il serait public."
            obligatoire
          >
            {(attributs) => (
              <textarea
                {...attributs}
                value={texte}
                onChange={(e) => setTexte(e.target.value.slice(0, 1200))}
                rows={5}
                placeholder="Je cherche 40 tôles bac galva 0,30 et 6 m³ de sable, livraison mardi matin à Anosizato. Quel est votre meilleur prix rendu ?"
                className="w-full rounded-md border border-input bg-card p-3 text-courant outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
          </Champ>

          <div className="rounded-md bg-muted p-3 text-legende">
            {point ? (
              <>
                Livraison à <strong className="text-foreground">{point.libelle}</strong>. Les dépôts
                proches verront votre demande en premier.{" "}
                <Link to="/materiaux" className="lien-souligne">
                  Changer
                </Link>
              </>
            ) : (
              <>
                Vous n'avez pas encore indiqué où livrer. La demande partira quand même, mais sans
                secteur les dépôts ne sauront pas s'ils peuvent vous servir.{" "}
                <Link to="/materiaux" className="lien-souligne">
                  Choisir un point
                </Link>
              </>
            )}
          </div>

          <Bouton type="submit" disabled={enCours} pleineLargeur>
            {enCours ? "Publication en cours" : "Publier ma demande"}
          </Bouton>
        </form>
      </Carte>
    </div>
  );
}
