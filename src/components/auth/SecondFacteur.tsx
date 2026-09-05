import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";

/**
 * Second facteur TOTP (application d'authentification : Google Authenticator,
 * Aegis, Authy…). Audit X-11 du 05/09/2026 : l'administrateur qui confirme les
 * paiements et libère le séquestre n'avait qu'un mot de passe.
 *
 * Trois pièces :
 *   · `InscriptionTotp`   — inscrire un facteur (QR code + code de contrôle) ;
 *   · `DefiTotp`          — saisir le code à la connexion pour passer en aal2 ;
 *   · `GestionSecondFacteur` — la carte de la page Sécurité (état, inscription, retrait).
 * L'exigence pour le rôle admin se déclenche dans RouteProtegee, pilotée par le
 * paramètre `mfa_admin_obligatoire` (table parametres) — d'abord à false, pour
 * qu'Andry inscrive son facteur avant que la porte se ferme.
 */

type Facteur = { id: string; friendly_name?: string | null; status: string; created_at: string };

async function listerFacteursTotp(): Promise<Facteur[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp ?? []) as Facteur[];
}

const CODE_VALIDE = /^\d{6}$/;

export function InscriptionTotp({ onValide }: { onValide: () => void }) {
  const [facteurId, setFacteurId] = React.useState<string | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);

  const demarrer = async () => {
    setEnCours(true);
    setErreur(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Akora" });
    setEnCours(false);
    if (error || !data) {
      setErreur(error?.message ?? "Inscription impossible.");
      return;
    }
    setFacteurId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  };

  const verifier = async () => {
    if (!facteurId || !CODE_VALIDE.test(code)) {
      toast.error("Code à six chiffres attendu.");
      return;
    }
    setEnCours(true);
    const defi = await supabase.auth.mfa.challenge({ factorId: facteurId });
    if (defi.error || !defi.data) {
      setEnCours(false);
      toast.error("Vérification impossible", { description: defi.error?.message });
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId: facteurId, challengeId: defi.data.id, code });
    setEnCours(false);
    if (error) {
      toast.error("Code refusé", { description: "Vérifiez l'heure du téléphone et réessayez." });
      return;
    }
    toast.success("Second facteur activé");
    onValide();
  };

  if (!facteurId) {
    return (
      <div className="space-y-3">
        <p className="text-legende text-muted-foreground">
          Installez une application d'authentification (Google Authenticator, Aegis, Authy), puis
          scannez le code qui s'affichera. À chaque connexion sensible, un code à six chiffres vous sera
          demandé en plus du mot de passe.
        </p>
        {erreur ? (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-legende text-destructive-strong">
            {erreur} — si le message parle d'un second facteur désactivé, activez « TOTP » dans
            Supabase › Authentication › Multi-factor.
          </p>
        ) : null}
        <Bouton disabled={enCours} onClick={() => void demarrer()}>
          {enCours ? "Préparation…" : "Activer le second facteur"}
        </Bouton>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-legende text-muted-foreground">
        1. Scannez ce code avec l'application. Si le scan échoue, saisissez la clé à la main.
      </p>
      {qr ? <img src={qr} alt="Code QR à scanner dans l'application d'authentification" width={180} height={180} className="rounded-md border border-border bg-white p-2" /> : null}
      {secret ? (
        <p className="nombres break-all rounded-md bg-muted px-3 py-2 text-legende">Clé : {secret}</p>
      ) : null}
      <Champ etiquette="2. Code affiché par l'application" aide="Six chiffres, ils changent toutes les 30 secondes.">
        {(a) => (
          <Saisie
            {...a}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        )}
      </Champ>
      <Bouton disabled={enCours || !CODE_VALIDE.test(code)} onClick={() => void verifier()}>
        {enCours ? "Vérification…" : "Confirmer l'activation"}
      </Bouton>
    </div>
  );
}

/** Défi à la connexion : un facteur existe, la session est encore en aal1. */
export function DefiTotp({ onValide }: { onValide: () => void }) {
  const facteurs = useQuery({ queryKey: ["facteurs-totp"], queryFn: listerFacteursTotp, staleTime: 60_000 });
  const [code, setCode] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);
  const facteur = facteurs.data?.find((f) => f.status === "verified") ?? facteurs.data?.[0];

  const valider = async () => {
    if (!facteur || !CODE_VALIDE.test(code)) return;
    setEnCours(true);
    const defi = await supabase.auth.mfa.challenge({ factorId: facteur.id });
    if (defi.error || !defi.data) {
      setEnCours(false);
      toast.error("Vérification impossible", { description: defi.error?.message });
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId: facteur.id, challengeId: defi.data.id, code });
    setEnCours(false);
    if (error) {
      toast.error("Code refusé");
      setCode("");
      return;
    }
    onValide();
  };

  return (
    <div className="container max-w-md py-10">
      <Carte className="p-5">
        <h1 className="text-section">Second facteur</h1>
        <p className="mt-2 text-legende text-muted-foreground">
          Cet espace manipule des paiements. Saisissez le code de votre application d'authentification.
        </p>
        <div className="mt-4 space-y-3">
          <Champ etiquette="Code à six chiffres">
            {(a) => (
              <Saisie
                {...a}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void valider();
                }}
              />
            )}
          </Champ>
          <Bouton pleineLargeur disabled={enCours || !facteur || !CODE_VALIDE.test(code)} onClick={() => void valider()}>
            {enCours ? "Vérification…" : "Continuer"}
          </Bouton>
        </div>
      </Carte>
    </div>
  );
}

/** Carte de la page Sécurité : état du second facteur, inscription, retrait. */
export function GestionSecondFacteur({ estAdmin }: { estAdmin: boolean }) {
  const facteurs = useQuery({ queryKey: ["facteurs-totp"], queryFn: listerFacteursTotp, staleTime: 30_000 });
  const actif = facteurs.data?.find((f) => f.status === "verified");

  const retirer = async () => {
    if (!actif) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: actif.id });
    if (error) {
      toast.error("Retrait impossible", {
        description: error.message.includes("AAL2") || error.message.toLowerCase().includes("aal")
          ? "Reconnectez-vous avec votre code, puis retirez le facteur."
          : error.message,
      });
      return;
    }
    toast.success("Second facteur retiré");
    void facteurs.refetch();
  };

  return (
    <Carte className="mt-4 p-4">
      <h3 className="text-produit">Second facteur</h3>
      {estAdmin ? (
        <p className="mt-1 text-legende text-attention-strong">
          Obligatoire pour un administrateur : vous confirmez des paiements et libérez des séquestres.
        </p>
      ) : (
        <p className="mt-1 text-legende text-muted-foreground">
          Recommandé si vous êtes fournisseur : votre portefeuille en dépend.
        </p>
      )}
      <div className="mt-3">
        {facteurs.isPending ? (
          <p className="text-legende text-muted-foreground">Lecture…</p>
        ) : actif ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-legende">
              Actif depuis le{" "}
              <span className="nombres">{new Date(actif.created_at).toLocaleDateString("fr-MG")}</span>
              {actif.friendly_name ? ` (${actif.friendly_name})` : ""}.
            </p>
            <Bouton variante="secondaire" taille="compact" onClick={() => void retirer()}>
              Retirer
            </Bouton>
          </div>
        ) : (
          <InscriptionTotp onValide={() => void facteurs.refetch()} />
        )}
      </div>
    </Carte>
  );
}
