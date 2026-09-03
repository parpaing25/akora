import * as React from "react";
import { toast } from "sonner";
import { envoyerCode, verifierCode } from "@/lib/donnees/otp";
import { Dialogue, DialogueContenu, DialogueDescription, DialogueTitre } from "@/components/ui/dialog";
import { SaisieCode, LONGUEUR_CODE } from "@/components/ui/saisie-code";
import { Bouton } from "@/components/ui/button";
import { LogoAkora } from "@/components/marque/LogoAkora";

/**
 * Saisie du code à six chiffres reçu par e-mail, à l'inscription.
 *
 * Pas de fermeture au clic extérieur, pas d'échappement, pas de croix : ce
 * dialogue n'est pas une option. Le 22/08/2026, on pouvait le contourner —
 * l'adresse s'affichait « confirmée » sans que personne n'ait rien saisi.
 * Sortir d'ici sans code, c'est désormais se déconnecter.
 */
const DELAI_RENVOI_S = 60;

export function DialogueCode({
  ouvert,
  email,
  userId,
  onVerifie,
  onAbandon,
}: {
  ouvert: boolean;
  email: string;
  userId: string;
  onVerifie: () => void;
  /** Proposé seulement quand il y a un ailleurs où aller — sinon rien. */
  onAbandon?: () => void;
}) {
  const [code, setCode] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);
  const [secondes, setSecondes] = React.useState(DELAI_RENVOI_S);

  React.useEffect(() => {
    if (!ouvert) return;
    setSecondes(DELAI_RENVOI_S);
    const minuteur = window.setInterval(() => setSecondes((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(minuteur);
  }, [ouvert]);

  const soumettre = React.useCallback(
    async (valeur: string) => {
      if (valeur.length !== LONGUEUR_CODE || enCours) return;
      setEnCours(true);
      try {
        if (await verifierCode(email, valeur)) {
          toast.success("Adresse confirmée");
          onVerifie();
        } else {
          toast.error("Code incorrect ou expiré", {
            description: "Il vous reste des essais, vérifiez le mail.",
          });
          setCode("");
        }
      } catch (erreur) {
        toast.error("Vérification impossible", { description: (erreur as Error).message });
      } finally {
        setEnCours(false);
      }
    },
    [email, enCours, onVerifie],
  );

  const renvoyer = async () => {
    try {
      await envoyerCode(userId, email);
      setSecondes(DELAI_RENVOI_S);
      toast.success("Nouveau code envoyé");
    } catch (erreur) {
      toast.error("Envoi impossible", { description: (erreur as Error).message });
    }
  };

  return (
    <Dialogue open={ouvert}>
      <DialogueContenu
        className="max-w-sm"
        sansFermeture
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex justify-center">
          <LogoAkora variante="logo" className="h-9 w-auto" />
        </div>
        <DialogueTitre className="text-center">Confirmez votre adresse</DialogueTitre>
        <DialogueDescription className="text-center">
          Un code à six chiffres vient de partir vers <strong>{email}</strong>. Il est valable
          quinze minutes.
        </DialogueDescription>

        <SaisieCode valeur={code} onChange={setCode} onComplet={(v) => void soumettre(v)} desactive={enCours} />

        <Bouton
          pleineLargeur
          disabled={enCours || code.length < LONGUEUR_CODE}
          onClick={() => void soumettre(code)}
        >
          {enCours ? "Vérification" : "Confirmer"}
        </Bouton>

        <p className="text-center text-legende text-muted-foreground" aria-live="polite">
          {secondes > 0 ? (
            <>
              Pas reçu ? Vous pourrez en redemander un dans{" "}
              <span className="nombres">{secondes}</span> s.
            </>
          ) : (
            <button type="button" onClick={() => void renvoyer()} className="lien-souligne">
              Renvoyer le code
            </button>
          )}
        </p>

        {onAbandon ? (
          <button
            type="button"
            onClick={onAbandon}
            className="text-center text-legende text-muted-foreground underline underline-offset-2"
          >
            Plus tard — me déconnecter
          </button>
        ) : null}

        <p className="text-center text-[0.75rem] text-muted-foreground">
          Regardez aussi dans les courriers indésirables. Personne d'Akora ne vous demandera jamais
          ce code.
        </p>
      </DialogueContenu>
    </Dialogue>
  );
}
