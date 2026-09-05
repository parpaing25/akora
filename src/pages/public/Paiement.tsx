import * as React from "react";
import { emettre } from "@/lib/evenements";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import {
  enregistrerReference,
  initierPaiement,
  lireCommandeParNumero,
  listerPaiements,
  verifierPaiement,
  type InitiationPaiement,
} from "@/lib/donnees/commandes";
import { formaterAriary, NOM_OPERATEUR, normaliserTelephone, operateurProbable, telephoneValide } from "@/lib/format";
import { LIBELLE_PAIEMENT, type OperateurPaiement } from "@/lib/types-metier";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Progression } from "@/components/ui/progress";
import { GroupeRadio, OptionRadio } from "@/components/ui/radio-group";
import { AvertissementMetier } from "@/components/ui/etats";
import { Squelette } from "@/components/ui/skeleton";

const OPERATEURS: OperateurPaiement[] = ["mvola", "orange_money", "airtel_money"];

/**
 * Tunnel de paiement : PLEIN ÉCRAN, une étape par écran, avec un en-tête
 * sombre qui garde le montant et le numéro de commande sous les yeux
 * (AKORA-DESIGN §8). C'est le moment où l'utilisateur a le plus besoin de
 * savoir où il en est.
 */
export default function Paiement() {
  const { numero } = useParams<{ numero: string }>();
  const naviguer = useNavigate();
  const { session } = useAuth();
  const [etape, setEtape] = React.useState<1 | 2 | 3>(1);
  const [operateur, setOperateur] = React.useState<OperateurPaiement>("mvola");
  const [msisdn, setMsisdn] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [initiation, setInitiation] = React.useState<InitiationPaiement | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  const commande = useQuery({
    queryKey: ["commande", numero],
    queryFn: () => lireCommandeParNumero(numero as string),
    enabled: Boolean(numero),
  });
  const paiements = useQuery({
    queryKey: ["paiements-commande", commande.data?.id],
    queryFn: () => listerPaiements(commande.data?.id as string),
    enabled: Boolean(commande.data?.id),
  });

  const c = commande.data;
  const enCoursExistant = (paiements.data ?? []).find((p) =>
    ["en_attente_client", "en_verification", "confirme", "sequestre"].includes(String(p.statut)),
  );

  // Présélection de l'opérateur d'après le préfixe : 032 Orange, 033 Airtel,
  // 034 et 038 MVola. On avertit sans bloquer : beaucoup ont plusieurs numéros.
  const devine = operateurProbable(msisdn);
  const desaccord = devine !== null && devine !== operateur;

  const lancer = async () => {
    if (!c) return;
    if (!telephoneValide(msisdn)) {
      toast.error("Numéro invalide", { description: "Format attendu : 034 12 345 67." });
      return;
    }
    setEnCours(true);
    try {
      const resultat = await initierPaiement({
        commande_id: c.id,
        operateur,
        mode: c.mode_paiement === "en_ligne_acompte" ? "en_ligne_acompte" : "en_ligne_integral",
        msisdn: normaliserTelephone(msisdn) as string,
      });
      setInitiation(resultat);
      setEtape(2);
    } catch (erreur) {
      toast.error("Paiement impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  const envoyerReference = async () => {
    if (!initiation) return;
    setEnCours(true);
    try {
      await enregistrerReference(initiation.paiement_id, reference);
      emettre("paiement_reference_saisie");
      setEtape(3);
      toast.success("Référence enregistrée", { description: "Un administrateur va la vérifier." });
    } catch (erreur) {
      toast.error("Enregistrement impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  if (commande.isPending) {
    return (
      <div className="container max-w-lg space-y-3 py-8" aria-busy="true">
        <Squelette className="h-20 w-full" />
        <Squelette className="h-64 w-full" />
      </div>
    );
  }
  if (!c) {
    return (
      <div className="container max-w-lg py-10">
        <Seo titre="Paiement" chemin={"/paiement/" + numero} indexable={false} />
        <p>Commande introuvable.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-svh max-w-lg">
      <Seo titre={"Paiement " + c.numero} chemin={"/paiement/" + c.numero} indexable={false} />

      <header className="bg-foreground px-4 py-4 text-background">
        <p className="nombres font-mono text-[0.78rem] opacity-80">{c.numero}</p>
        <p className="nombres mt-0.5 text-[1.75rem] font-bold tracking-tight">
          {formaterAriary(Number(initiation?.montant ?? c.montant_total))}
        </p>
        <p className="text-[0.78rem] opacity-80">
          {c.mode_paiement === "en_ligne_acompte" ? "Acompte à régler maintenant" : "Montant total"}
        </p>
        <Progression className="mt-3" ton="accent" value={(etape / 3) * 100} />
        <p className="mt-1 text-[0.75rem] opacity-80">Étape {etape} sur 3</p>
      </header>

      <div className="p-4">
        {!session ? (
          <AvertissementMetier
            titre="Connectez-vous pour payer"
            action={
              <Bouton asChild variante="secondaire" taille="compact">
                <Link to="/connexion" state={{ retour: "/paiement/" + c.numero }}>
                  Se connecter
                </Link>
              </Bouton>
            }
          >
            Le séquestre suppose de savoir à qui rendre l'argent en cas de litige.
          </AvertissementMetier>
        ) : enCoursExistant && etape === 1 ? (
          <AvertissementMetier
            titre="Un paiement est déjà en cours"
            action={
              <Bouton asChild variante="secondaire" taille="compact">
                <Link to={"/commande/" + c.numero}>Voir la commande</Link>
              </Bouton>
            }
          >
            Statut actuel : {LIBELLE_PAIEMENT[enCoursExistant.statut]}. Inutile de payer deux fois.
          </AvertissementMetier>
        ) : etape === 1 ? (
          <div className="space-y-4">
            <div>
              <h1 className="text-section">Avec quel opérateur ?</h1>
              <GroupeRadio
                className="mt-3"
                value={operateur}
                onValueChange={(v) => setOperateur(v as OperateurPaiement)}
              >
                {OPERATEURS.map((o) => (
                  <OptionRadio key={o} id={"op-" + o} valeur={o} titre={NOM_OPERATEUR[o]} />
                ))}
              </GroupeRadio>
            </div>

            <Champ
              etiquette="Numéro qui paie"
              aide="032 Orange · 033 Airtel · 034 et 038 MVola."
              obligatoire
            >
              {(a) => (
                <Saisie
                  {...a}
                  type="tel"
                  inputMode="tel"
                  value={msisdn}
                  onChange={(e) => {
                    setMsisdn(e.target.value);
                    const suppose = operateurProbable(e.target.value);
                    if (suppose) setOperateur(suppose);
                  }}
                />
              )}
            </Champ>

            {desaccord ? (
              <AvertissementMetier titre="Le préfixe ne correspond pas à l'opérateur choisi">
                Ce numéro ressemble à un compte {NOM_OPERATEUR[devine]}. Ce n'est pas bloquant — on
                a souvent plusieurs numéros — mais vérifiez avant de valider.
              </AvertissementMetier>
            ) : null}

            <Bouton pleineLargeur taille="large" disabled={enCours} onClick={() => void lancer()}>
              {enCours ? "Initiation en cours" : "Continuer"}
            </Bouton>
          </div>
        ) : etape === 2 ? (
          <div className="space-y-4">
            <h1 className="text-section">Payez, puis recopiez la référence</h1>
            {initiation?.instructions ? (
              <ol className="space-y-2 rounded-md bg-muted p-3 text-[0.9375rem]">
                {initiation.instructions.split("\n").map((ligne, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="nombres font-bold text-primary">{i + 1}.</span>
                    <span>{ligne}</span>
                  </li>
                ))}
              </ol>
            ) : null}

            <Champ
              etiquette="Référence de la transaction"
              aide="Elle figure dans le SMS de confirmation de votre opérateur."
              obligatoire
            >
              {(a) => (
                <Saisie
                  {...a}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="font-mono"
                />
              )}
            </Champ>

            <Bouton
              pleineLargeur
              taille="large"
              disabled={enCours || reference.trim().length < 4}
              onClick={() => void envoyerReference()}
            >
              {enCours ? "Envoi" : "J'ai payé, envoyer la référence"}
            </Bouton>

            {initiation?.mode_prestataire === "api" ? (
              <Bouton
                variante="secondaire"
                pleineLargeur
                onClick={async () => {
                  const etat = await verifierPaiement(initiation.paiement_id);
                  toast.info("Statut : " + etat.statut);
                  if (etat.statut === "confirme" || etat.statut === "sequestre") setEtape(3);
                }}
              >
                Vérifier auprès de l'opérateur
              </Bouton>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <h1 className="text-section">C'est enregistré</h1>
            <p className="text-[0.9375rem] text-muted-foreground">
              Votre paiement est en cours de vérification. Dès qu'il est confirmé, la somme reste
              <strong> sous séquestre</strong> chez Akora et n'est versée au fournisseur qu'après
              votre confirmation de livraison.
            </p>
            <Bouton pleineLargeur onClick={() => naviguer("/commande/" + c.numero)}>
              Suivre ma commande
            </Bouton>
          </div>
        )}
      </div>
    </div>
  );
}
