import * as React from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motDePasse as schemaMotDePasse } from "@/lib/validation";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { GestionSecondFacteur } from "@/components/auth/SecondFacteur";
import {
  Confirmation,
  ConfirmationAnnuler,
  ConfirmationContenu,
  ConfirmationDeclencheur,
  ConfirmationTexte,
  ConfirmationTitre,
  ConfirmationValider,
} from "@/components/ui/alert-dialog";

/**
 * Sécurité du compte, export et suppression.
 *
 * L'export et la suppression ne sont pas des options : ce sont des droits
 * (règle A3). L'export ne lit que ce que la RLS laisse voir à l'utilisateur —
 * donc ses données, et rien d'autre.
 */
export default function Securite() {
  const { utilisateur, deconnexion, aRole } = useAuth();
  const [nouveau, setNouveau] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);

  const changerMotDePasse = async () => {
    const verdict = schemaMotDePasse.safeParse(nouveau);
    if (!verdict.success) {
      toast.error("Mot de passe refusé", { description: verdict.error.issues[0]?.message });
      return;
    }
    setEnCours(true);
    const { error } = await supabase.auth.updateUser({ password: nouveau });
    setEnCours(false);
    if (error) {
      toast.error("Changement impossible", { description: error.message });
      return;
    }
    setNouveau("");
    toast.success("Mot de passe changé");
  };

  const exporter = async () => {
    const id = utilisateur?.id;
    if (!id) return;
    const [profil, commandes, adresses, favoris, avis] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id),
      supabase.from("commandes").select("*").eq("acheteur_id", id),
      supabase.from("adresses_chantier").select("*").eq("user_id", id),
      supabase.from("favoris").select("*").eq("user_id", id),
      supabase.from("avis").select("*").eq("auteur_id", id),
    ]);
    const contenu = JSON.stringify(
      {
        exporte_le: new Date().toISOString(),
        compte: { id, email: utilisateur.email },
        profil: profil.data,
        commandes: commandes.data,
        adresses_chantier: adresses.data,
        favoris: favoris.data,
        avis: avis.data,
      },
      null,
      2,
    );
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob([contenu], { type: "application/json" }));
    lien.download = "akora-mes-donnees.json";
    lien.click();
    URL.revokeObjectURL(lien.href);
    toast.success("Export téléchargé");
  };

  const supprimer = async () => {
    // Suppression RÉELLE via la fonction compte-supprimer (auth.admin.deleteUser) :
    // effacer la ligne profiles laissait l'utilisateur GoTrue en place (audit F-06, 06/09/2026).
    const { data, error } = await supabase.functions.invoke("compte-supprimer", { body: {} });
    if (error) {
      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
      toast.error("Suppression impossible", {
        description: (detail as { erreur?: string } | null)?.erreur ?? error.message,
      });
      return;
    }
    if (!(data as { ok?: boolean } | null)?.ok) {
      toast.error("Suppression impossible");
      return;
    }
    await deconnexion();
    toast.success("Compte supprimé", {
      description: "Vos données personnelles sont effacées. Les montants de vos commandes passées sont conservés sans votre nom.",
    });
  };

  return (
    <>
      <Seo titre="Sécurité" chemin="/compte/securite" indexable={false} />
      <h2 className="text-section">Sécurité</h2>

      <Carte className="mt-4 p-4">
        <h3 className="text-produit">Changer mon mot de passe</h3>
        <div className="mt-3 space-y-3">
          <Champ etiquette="Nouveau mot de passe" aide="8 caractères minimum, une lettre et un chiffre.">
            {(a) => (
              <Saisie
                {...a}
                type="password"
                autoComplete="new-password"
                value={nouveau}
                onChange={(e) => setNouveau(e.target.value)}
              />
            )}
          </Champ>
          <Bouton disabled={enCours} onClick={() => void changerMotDePasse()}>
            {enCours ? "Changement" : "Changer le mot de passe"}
          </Bouton>
        </div>
      </Carte>

      <GestionSecondFacteur estAdmin={aRole("admin")} />

      <Carte className="mt-4 p-4">
        <h3 className="text-produit">Mes données</h3>
        <p className="mt-1 text-legende text-muted-foreground">
          Téléchargez tout ce qu'Akora conserve sur vous, au format JSON.
        </p>
        <Bouton variante="secondaire" className="mt-3" onClick={() => void exporter()}>
          Exporter mes données
        </Bouton>
      </Carte>

      <Carte className="mt-4 border-destructive/30 p-4">
        <h3 className="text-produit text-destructive-strong">Supprimer mon compte</h3>
        <p className="mt-1 text-legende text-muted-foreground">
          Votre profil, vos adresses, favoris, avis et notifications sont effacés définitivement, et
          votre identifiant de connexion avec eux. Vos commandes terminées sont conservées sans votre
          nom ni votre numéro : la comptabilité du fournisseur l'exige. Un dépôt, un litige ou une
          commande en cours bloque la suppression tant qu'il n'est pas clos.
        </p>
        <Confirmation>
          <ConfirmationDeclencheur asChild>
            <Bouton variante="destructif" className="mt-3">
              Supprimer mon compte
            </Bouton>
          </ConfirmationDeclencheur>
          <ConfirmationContenu>
            <ConfirmationTitre>Supprimer définitivement ?</ConfirmationTitre>
            <ConfirmationTexte>
              Cette action est irréversible. Exportez vos données avant, si vous en avez besoin.
            </ConfirmationTexte>
            <div className="flex flex-wrap justify-end gap-2">
              <ConfirmationAnnuler>Annuler</ConfirmationAnnuler>
              <ConfirmationValider onClick={() => void supprimer()}>Supprimer</ConfirmationValider>
            </div>
          </ConfirmationContenu>
        </Confirmation>
      </Carte>
    </>
  );
}
