import * as React from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normaliserTelephone, telephoneValide } from "@/lib/format";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { GroupeRadio, OptionRadio } from "@/components/ui/radio-group";

/** Profil de l'acheteur. On filtre par `id`, jamais par un `user_id`. */
export default function Profil() {
  const { profil, utilisateur } = useAuth();
  const [nom, setNom] = React.useState("");
  const [telephone, setTelephone] = React.useState("");
  const [ville, setVille] = React.useState("");
  const [type, setType] = React.useState<"particulier" | "entreprise">("particulier");
  const [raisonSociale, setRaisonSociale] = React.useState("");
  const [nif, setNif] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);

  React.useEffect(() => {
    if (!profil) return;
    setNom(profil.nom_complet ?? "");
    setTelephone(profil.telephone ?? "");
    setVille(profil.ville ?? "");
    setType(profil.type_client ?? "particulier");
    setRaisonSociale(profil.raison_sociale ?? "");
  }, [profil]);

  const enregistrer = async () => {
    if (telephone && !telephoneValide(telephone)) {
      toast.error("Numéro invalide", { description: "Format attendu : 034 12 345 67." });
      return;
    }
    setEnCours(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nom_complet: nom.trim() || null,
        telephone: telephone ? normaliserTelephone(telephone) : null,
        ville: ville.trim() || null,
        type_client: type,
        raison_sociale: type === "entreprise" ? raisonSociale.trim() || null : null,
        nif: type === "entreprise" ? nif.trim() || null : null,
      })
      .eq("id", utilisateur?.id ?? "")
      .select("id");
    setEnCours(false);
    if (error) toast.error("Enregistrement impossible", { description: error.message });
    else toast.success("Profil mis à jour");
  };

  return (
    <>
      <Seo titre="Mon profil" chemin="/compte" indexable={false} />
      <h2 className="text-section">Mon profil</h2>

      <Carte className="mt-4 p-4">
        <div className="space-y-3">
          <Champ etiquette="Nom et prénom">
            {(a) => <Saisie {...a} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" />}
          </Champ>
          <Champ etiquette="Téléphone" aide="Sert aux fournisseurs pour la livraison.">
            {(a) => (
              <Saisie {...a} type="tel" inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            )}
          </Champ>
          <Champ etiquette="Ville">
            {(a) => <Saisie {...a} value={ville} onChange={(e) => setVille(e.target.value)} />}
          </Champ>

          <fieldset>
            <legend className="text-legende font-semibold">Je suis</legend>
            <GroupeRadio className="mt-1.5" value={type} onValueChange={(v) => setType(v as never)}>
              <OptionRadio id="type-particulier" valeur="particulier" titre="Un particulier" />
              <OptionRadio id="type-entreprise" valeur="entreprise" titre="Une entreprise" />
            </GroupeRadio>
          </fieldset>

          {type === "entreprise" ? (
            <>
              <Champ etiquette="Raison sociale">
                {(a) => <Saisie {...a} value={raisonSociale} onChange={(e) => setRaisonSociale(e.target.value)} />}
              </Champ>
              <Champ etiquette="NIF" aide="Figurera sur vos reçus.">
                {(a) => <Saisie {...a} value={nif} onChange={(e) => setNif(e.target.value)} inputMode="numeric" />}
              </Champ>
            </>
          ) : null}

          <Bouton disabled={enCours} onClick={() => void enregistrer()}>
            {enCours ? "Enregistrement" : "Enregistrer"}
          </Bouton>
        </div>
      </Carte>
    </>
  );
}
