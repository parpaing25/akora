import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useInvaliderMaFiche } from "@/hooks/useMaFiche";
import { creerMaFiche } from "@/lib/donnees/fournisseurs";
import { telephoneMalgache } from "@/lib/validation";
import type { Point } from "@/lib/livraison";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { ChoixLocalite } from "./ChoixLocalite";
import { CartePoint } from "@/components/carte/CartePoint";

const schema = z.object({
  raison_sociale: z.string().trim().min(2, "Indiquez le nom de votre dépôt.").max(160),
  telephone: telephoneMalgache,
  adresse: z.string().trim().max(240).optional(),
});
type Valeurs = z.infer<typeof schema>;

/**
 * Première visite de l'espace pro : on crée le dépôt.
 *
 * La position sur la carte est demandée dès maintenant, et pas plus tard :
 * sans elle, aucune livraison n'est calculable, donc la vitrine ne sert à rien.
 * On l'explique au lieu de la rendre obligatoire en silence.
 */
export function CreerFiche() {
  const { utilisateur } = useAuth();
  const invalider = useInvaliderMaFiche();
  const [localiteId, setLocaliteId] = React.useState<string | null>(null);
  const [point, setPoint] = React.useState<Point | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Valeurs>({ resolver: zodResolver(schema) });

  const soumettre = async (valeurs: Valeurs) => {
    if (!utilisateur) return;
    setEnCours(true);
    try {
      await creerMaFiche(utilisateur.id, {
        raison_sociale: valeurs.raison_sociale,
        telephone: valeurs.telephone,
        adresse: valeurs.adresse?.trim() || null,
        localite_id: localiteId,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
      });
      await invalider();
      toast.success("Dépôt créé", { description: "Vous pouvez maintenant monter votre catalogue." });
    } catch (erreur) {
      toast.error("Création impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <Seo titre="Créer mon dépôt" chemin="/pro" indexable={false} />
      <h1 className="text-page">Créer mon dépôt</h1>
      <p className="mt-1 text-legende text-muted-foreground">
        Quelques informations suffisent pour commencer. La vérification et le catalogue viennent
        ensuite.
      </p>

      <Carte className="mt-5 p-4">
        <form onSubmit={handleSubmit(soumettre)} className="space-y-4" noValidate>
          <Champ etiquette="Raison sociale" erreur={errors.raison_sociale?.message} obligatoire>
            {(a) => <Saisie {...a} {...register("raison_sociale")} autoComplete="organization" />}
          </Champ>

          <Champ
            etiquette="Téléphone"
            aide="Visible seulement des acheteurs connectés, et chaque consultation est journalisée."
            erreur={errors.telephone?.message}
            obligatoire
          >
            {(a) => <Saisie {...a} {...register("telephone")} type="tel" inputMode="tel" />}
          </Champ>

          <ChoixLocalite valeur={localiteId} onChange={(l) => { setLocaliteId(l?.id ?? null); if (l?.lat != null && l.lng != null) setPoint({ lat: l.lat, lng: l.lng }); }} />

          <Champ etiquette="Adresse du dépôt" aide="Rue, quartier, point de repère." erreur={errors.adresse?.message}>
            {(a) => <Saisie {...a} {...register("adresse")} autoComplete="street-address" />}
          </Champ>

          <div className="space-y-1.5">
            <p className="text-legende font-semibold">Position du dépôt sur la carte</p>
            <p className="text-[0.78rem] text-muted-foreground">
              Touchez la carte à l'endroit exact de votre dépôt. C'est ce point qui sert à calculer
              la distance jusqu'au chantier de l'acheteur. Sans lui, aucune livraison ne sera
              chiffrée sur vos produits.
            </p>
            <CartePoint point={point} onChange={setPoint} intitule="Choisir la position du dépôt" className="h-64" />
            {point ? (
              <p className="nombres text-[0.78rem] text-muted-foreground">
                {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
              </p>
            ) : null}
          </div>

          <Bouton type="submit" pleineLargeur disabled={enCours}>
            {enCours ? "Création en cours" : "Créer mon dépôt"}
          </Bouton>
        </form>
      </Carte>
    </div>
  );
}
