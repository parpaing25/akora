import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Phone, Store, Truck } from "lucide-react";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import {
  lireFicheReservee,
  revendiquerFiche,
  refuserFiche,
} from "@/lib/donnees/fiches-reservees";
import { formaterAriary } from "@/lib/format";
import { AvertissementMetier, EtatErreur, EtatVide } from "@/components/ui/etats";
import { Squelette } from "@/components/ui/skeleton";
import { Bouton } from "@/components/ui/button";
import { Champ } from "@/components/ui/champ";
import { ZoneTexte } from "@/components/ui/input";
import {
  Confirmation,
  ConfirmationAnnuler,
  ConfirmationContenu,
  ConfirmationTexte,
  ConfirmationTitre,
  ConfirmationValider,
} from "@/components/ui/alert-dialog";

/**
 * /depot-reserve/:jeton — la fiche qu'Akora a préparée pour un dépôt repéré
 * par le bot de prospection, AVANT qu'il ait un compte.
 *
 * Cette page est le seul accès à ces données : la table est fermée à tous,
 * seule la RPC `fiche_reservee` répond, et uniquement au porteur du jeton
 * (24 octets aléatoires, envoyé au dépôt par message). Rien ici n'est public,
 * rien n'est indexable — ces informations ont été relevées dans des
 * publications Facebook publiques sans que la personne l'ait demandé, et le
 * respect de ce fait est ce qui rend la démarche défendable.
 *
 * Trois sorties, et seulement trois :
 *   • revendiquer — connecté, la fiche devient un vrai fournisseur en
 *     BROUILLON : le dépôt relit SES prix avant toute publication ;
 *   • refuser — sans compte, définitif : exiger une inscription pour se
 *     faire retirer d'une liste serait le contraire de la promesse ;
 *   • partir — la fiche reste en attente, et le compteur de vues aura dit
 *     au bot qu'un appel vaut mieux qu'un message de plus.
 */
export default function DepotReserve() {
  const { jeton } = useParams<{ jeton: string }>();
  const naviguer = useNavigate();
  const client = useQueryClient();
  const { session } = useAuth();

  const [revendicationEnCours, setRevendicationEnCours] = React.useState(false);
  const [dialogueRefus, setDialogueRefus] = React.useState(false);
  const [motif, setMotif] = React.useState("");
  const [refusEnCours, setRefusEnCours] = React.useState(false);
  const [retiree, setRetiree] = React.useState(false);

  const requete = useQuery({
    queryKey: ["fiche-reservee", jeton],
    enabled: Boolean(jeton),
    // Chaque lecture incrémente nb_vues côté base — c'est la mesure qui dit
    // au bot quand téléphoner plutôt que relancer. On ne relit donc JAMAIS en
    // arrière-plan : un onglet laissé ouvert gonflerait le compteur pour rien.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: () => lireFicheReservee(jeton as string),
  });

  const fiche = requete.data ?? null;

  const revendiquer = async () => {
    if (!jeton) return;
    if (!session) {
      // Pas de compte : l'inscription pré-cochée « fournisseur », et le retour
      // ICI une fois l'adresse confirmée — le jeton voyage dans l'URL, comme
      // il est déjà arrivé dans le message du bot.
      naviguer(
        "/inscription?profil=fournisseur&retour=" +
          encodeURIComponent("/depot-reserve/" + jeton),
      );
      return;
    }
    setRevendicationEnCours(true);
    try {
      await revendiquerFiche(jeton);
      toast.success("La fiche est à vous", {
        description:
          "Relisez vos prix dans votre espace : rien n'est publié tant que vous ne l'avez pas validé.",
      });
      // /pro exige le rôle fournisseur : on attend que les rôles soient relus
      // AVANT de naviguer, sinon la garde de route renverrait à l'accueil.
      await client.invalidateQueries({ queryKey: ["roles"] });
      await client.invalidateQueries({ queryKey: ["profil"] });
      naviguer("/pro", { replace: true });
    } catch (erreur) {
      toast.error("Récupération impossible", { description: (erreur as Error).message });
      setRevendicationEnCours(false);
    }
  };

  const refuser = async () => {
    if (!jeton) return;
    setRefusEnCours(true);
    try {
      await refuserFiche(jeton, motif);
      // Même si la fiche était déjà partie, le résultat pour la personne est
      // identique : elle n'existe plus. Un seul message, pas deux.
      setDialogueRefus(false);
      setRetiree(true);
    } catch (erreur) {
      toast.error("Retrait impossible", { description: (erreur as Error).message });
    } finally {
      setRefusEnCours(false);
    }
  };

  /* ── États sans fiche ─────────────────────────────────────────────────── */

  const enveloppe = (contenu: React.ReactNode) => (
    <div className="container max-w-3xl py-8">
      <Seo
        titre="Fiche réservée"
        chemin={"/depot-reserve/" + (jeton ?? "")}
        indexable={false}
        description="Une fiche préparée par Akora, lisible uniquement par son destinataire."
      />
      {contenu}
    </div>
  );

  if (requete.isPending) {
    return enveloppe(
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <span className="sr-only">Chargement de la fiche</span>
        <Squelette className="h-8 w-1/2" />
        <Squelette className="h-4 w-2/3" />
        <Squelette className="h-64 w-full" />
      </div>,
    );
  }

  if (requete.isError) {
    return enveloppe(
      <EtatErreur
        message={(requete.error as Error).message}
        onReessayer={() => void requete.refetch()}
      />,
    );
  }

  if (retiree) {
    return enveloppe(
      <EtatVide
        titre="Fiche retirée"
        phrase="C'est noté : cette fiche n'existe plus et vous ne serez pas recontacté à son sujet."
      />,
    );
  }

  // Jeton inconnu, fiche refusée, retirée ou déjà revendiquée : la base ne
  // distingue pas, exprès — et cette page non plus.
  if (!fiche) {
    return enveloppe(
      <EtatVide
        titre="Cette fiche n'est plus disponible"
        phrase="Elle a peut-être déjà été récupérée ou retirée. Vous pouvez créer votre fiche fournisseur normalement."
        action={
          <Bouton asChild>
            <a href="/devenir-fournisseur">Devenir fournisseur</a>
          </Bouton>
        }
      />,
    );
  }

  /* ── La fiche ─────────────────────────────────────────────────────────── */

  const estTransporteur = fiche.nature === "transporteur";
  const localite = [fiche.quartier, fiche.ville].filter(Boolean).join(", ");

  return enveloppe(
    <div className="space-y-5">
      <AvertissementMetier titre="Cette fiche a été préparée pour vous par Akora — elle n'est pas encore publiée">
        Nous avons relevé ces informations dans vos publications publiques pour vous faire gagner
        du temps. Personne d'autre ne voit cette page, et rien ne sera mis en ligne sans vous :
        si vous la récupérez, tout reste en brouillon jusqu'à ce que vous ayez relu vos prix.
      </AvertissementMetier>

      <header>
        <p className="flex items-center gap-1.5 text-legende font-semibold uppercase tracking-wide text-muted-foreground">
          {estTransporteur ? (
            <Truck size={14} aria-hidden="true" />
          ) : (
            <Store size={14} aria-hidden="true" />
          )}
          {fiche.metier ?? (estTransporteur ? "Transporteur" : "Dépôt de matériaux")}
        </p>
        <h1 className="mt-1 text-[1.6875rem] font-bold tracking-tight">{fiche.raison_sociale}</h1>
        <div className="mt-1.5 space-y-0.5 text-courant text-muted-foreground">
          {localite !== "" && (
            <p className="flex items-center gap-1.5">
              <MapPin size={15} className="shrink-0" aria-hidden="true" />
              {localite}
              {fiche.adresse ? " — " + fiche.adresse : ""}
            </p>
          )}
          {fiche.telephone && (
            <p className="flex items-center gap-1.5">
              <Phone size={15} className="shrink-0" aria-hidden="true" />
              <span className="nombres">{fiche.telephone}</span>
            </p>
          )}
        </div>
      </header>

      {fiche.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fiche.photos.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={"Photo " + (i + 1) + " — " + fiche.raison_sociale}
              loading="lazy"
              className="aspect-[4/3] w-full rounded-md border border-border bg-muted object-cover"
            />
          ))}
        </div>
      )}

      {fiche.produits.length > 0 && (
        <section className="carte p-4">
          <h2 className="text-section">Produits repérés</h2>
          <p className="mt-0.5 text-legende text-muted-foreground">
            Les prix viennent de vos publications : vous pourrez tous les corriger avant
            publication.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {fiche.produits.map((p) => (
              <li key={p.materiau_slug} className="flex items-baseline justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-produit">{p.materiau}</p>
                  <p className="text-legende text-muted-foreground">
                    {p.famille}
                    {p.libelle !== p.materiau ? " · relevé : « " + p.libelle + " »" : ""}
                  </p>
                </div>
                <p className="shrink-0 text-right">
                  {p.prix_unitaire != null ? (
                    <>
                      <span className="nombres font-semibold">
                        {formaterAriary(p.prix_unitaire)}
                      </span>
                      {p.unite ? (
                        <span className="text-legende text-muted-foreground"> / {p.unite}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-legende text-muted-foreground">prix à confirmer</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fiche.vehicules.length > 0 && (
        <section className="carte p-4">
          <h2 className="text-section">Véhicules repérés</h2>
          <p className="mt-0.5 text-legende text-muted-foreground">
            C'est ce qui permettra d'afficher un prix rendu chantier. Capacités et tarifs se
            complètent après récupération.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {fiche.vehicules.map((v) => (
              <li key={v.nom} className="flex items-baseline justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-produit">{v.nom}</p>
                  {v.categorie && <p className="text-legende text-muted-foreground">{v.categorie}</p>}
                </div>
                <p className="shrink-0 text-right text-legende text-muted-foreground">
                  {v.capacite_m3 != null ? v.capacite_m3 + " m³" : null}
                  {v.capacite_m3 != null && v.capacite_kg != null ? " · " : null}
                  {v.capacite_kg != null ? v.capacite_kg + " kg" : null}
                  {v.capacite_m3 == null && v.capacite_kg == null ? "capacité à préciser" : null}
                </p>
              </li>
            ))}
          </ul>
          {fiche.rayon_km != null && (
            <p className="mt-2 text-legende text-muted-foreground">
              Zone de livraison annoncée : environ <span className="nombres">{fiche.rayon_km}</span>{" "}
              km.
            </p>
          )}
        </section>
      )}

      <div className="carte space-y-3 p-4">
        <Bouton
          taille="large"
          className="w-full"
          disabled={revendicationEnCours}
          onClick={() => void revendiquer()}
        >
          {revendicationEnCours
            ? "Récupération en cours…"
            : estTransporteur
              ? "C'est mon entreprise — je la récupère"
              : "C'est mon dépôt — je le récupère"}
        </Bouton>
        <p className="text-center text-legende text-muted-foreground">
          {session
            ? "La fiche sera rattachée à votre compte, en brouillon : rien ne se publie sans votre relecture."
            : "Vous créerez d'abord votre compte (gratuit, deux minutes), puis vous reviendrez ici automatiquement."}
        </p>

        <p className="border-t border-border pt-3 text-center">
          <button
            type="button"
            onClick={() => setDialogueRefus(true)}
            className="text-legende text-muted-foreground underline underline-offset-2"
          >
            Ce n'est pas moi / retirer cette fiche
          </button>
        </p>
      </div>

      <Confirmation open={dialogueRefus} onOpenChange={setDialogueRefus}>
        <ConfirmationContenu>
          <ConfirmationTitre>Retirer cette fiche ?</ConfirmationTitre>
          <ConfirmationTexte>
            La fiche et les prix relevés seront supprimés, et vous ne serez pas recontacté à son
            sujet. C'est définitif — aucun compte n'est nécessaire.
          </ConfirmationTexte>
          <Champ
            etiquette="Pourquoi ? (facultatif)"
            aide="Une phrase suffit, elle nous aide à mieux cibler."
          >
            {(attributs) => (
              <ZoneTexte
                {...attributs}
                required={false}
                rows={3}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex. : ce dépôt n'est pas le mien, j'ai fermé, je ne suis pas intéressé…"
              />
            )}
          </Champ>
          <div className="flex justify-end gap-2">
            <ConfirmationAnnuler disabled={refusEnCours}>Garder la fiche</ConfirmationAnnuler>
            <ConfirmationValider
              disabled={refusEnCours}
              onClick={(e) => {
                // Radix ferme le dialogue au clic : on garde la main jusqu'à
                // la réponse du serveur, pour pouvoir montrer une erreur.
                e.preventDefault();
                void refuser();
              }}
            >
              {refusEnCours ? "Retrait…" : "Retirer la fiche"}
            </ConfirmationValider>
          </div>
        </ConfirmationContenu>
      </Confirmation>
    </div>,
  );
}
