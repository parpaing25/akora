import * as React from "react";
import { toast } from "sonner";
import { envoyerCode, verifierCode } from "@/lib/donnees/otp";
import { Dialogue, DialogueContenu, DialogueDescription, DialogueTitre } from "@/components/ui/dialog";
import { Bouton } from "@/components/ui/button";
import { LogoAkora } from "@/components/marque/LogoAkora";

/**
 * Saisie du code à six chiffres reçu par e-mail.
 *
 * Six cases plutôt qu'un champ : sur un téléphone, on recopie un code en
 * regardant le SMS ou le mail d'un œil. Le collage d'un coup fonctionne aussi,
 * parce que c'est ce que font les gens.
 *
 * Pas de fermeture au clic extérieur : ce dialogue n'est pas une option.
 */
const LONGUEUR = 6;
const DELAI_RENVOI_S = 60;

export function DialogueCode({
  ouvert,
  email,
  userId,
  onVerifie,
}: {
  ouvert: boolean;
  email: string;
  userId: string;
  onVerifie: () => void;
}) {
  const [chiffres, setChiffres] = React.useState<string[]>(Array(LONGUEUR).fill(""));
  const [enCours, setEnCours] = React.useState(false);
  const [secondes, setSecondes] = React.useState(DELAI_RENVOI_S);
  const cases = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    if (!ouvert) return;
    setSecondes(DELAI_RENVOI_S);
    const minuteur = window.setInterval(() => setSecondes((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(minuteur);
  }, [ouvert]);

  React.useEffect(() => {
    if (ouvert) cases.current[0]?.focus();
  }, [ouvert]);

  const code = chiffres.join("");

  const soumettre = React.useCallback(
    async (valeur: string) => {
      if (valeur.length !== LONGUEUR || enCours) return;
      setEnCours(true);
      try {
        if (await verifierCode(email, valeur)) {
          toast.success("Adresse confirmée");
          onVerifie();
        } else {
          toast.error("Code incorrect ou expiré", { description: "Il vous reste des essais, vérifiez le mail." });
          setChiffres(Array(LONGUEUR).fill(""));
          cases.current[0]?.focus();
        }
      } catch (erreur) {
        toast.error("Vérification impossible", { description: (erreur as Error).message });
      } finally {
        setEnCours(false);
      }
    },
    [email, enCours, onVerifie],
  );

  const poser = (index: number, valeur: string) => {
    const propre = valeur.replace(/\D/g, "");
    if (!propre) {
      const suivants = [...chiffres];
      suivants[index] = "";
      setChiffres(suivants);
      return;
    }
    // Collage d'un code entier depuis le presse-papiers.
    if (propre.length > 1) {
      const complet = propre.slice(0, LONGUEUR).split("");
      const suivants = Array(LONGUEUR).fill("");
      complet.forEach((c, i) => (suivants[i] = c));
      setChiffres(suivants);
      cases.current[Math.min(complet.length, LONGUEUR - 1)]?.focus();
      if (complet.length === LONGUEUR) void soumettre(complet.join(""));
      return;
    }
    const suivants = [...chiffres];
    suivants[index] = propre;
    setChiffres(suivants);
    if (index < LONGUEUR - 1) cases.current[index + 1]?.focus();
    const assemble = suivants.join("");
    if (assemble.length === LONGUEUR && !assemble.includes("")) void soumettre(assemble);
  };

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

        <div className="flex justify-center gap-1.5" role="group" aria-label="Code à six chiffres">
          {chiffres.map((chiffre, index) => (
            <React.Fragment key={index}>
              <label htmlFor={"code-" + index} className="sr-only">
                Chiffre {index + 1} sur {LONGUEUR}
              </label>
              <input
                id={"code-" + index}
                ref={(element) => {
                  cases.current[index] = element;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={LONGUEUR}
                value={chiffre}
                onChange={(e) => poser(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !chiffre && index > 0) cases.current[index - 1]?.focus();
                }}
                className="nombres size-11 rounded-md border border-input bg-card text-center text-[1.25rem] font-bold"
              />
            </React.Fragment>
          ))}
        </div>

        <Bouton pleineLargeur disabled={enCours || code.length < LONGUEUR} onClick={() => void soumettre(code)}>
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
        <p className="text-center text-[0.72rem] text-muted-foreground">
          Regardez aussi dans les courriers indésirables. Personne d'Akora ne vous demandera jamais
          ce code.
        </p>
      </DialogueContenu>
    </Dialogue>
  );
}
