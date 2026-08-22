import * as React from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { PageTexte } from "@/components/PageTexte";
import { useAntiAbus } from "@/hooks/useAntiAbus";
import { Champ } from "@/components/ui/champ";
import { Saisie, ZoneTexte } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Carte } from "@/components/ui/card";

/**
 * Contact. Le formulaire ouvre le client de messagerie du visiteur : Akora
 * n'a pas de serveur SMTP, et prétendre en avoir un ferait disparaître des
 * messages en silence.
 */
export default function Contact() {
  const antiAbus = useAntiAbus();
  const [sujet, setSujet] = React.useState("");
  const [message, setMessage] = React.useState("");

  const envoyer = (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const refus = antiAbus.verifier();
    if (refus) {
      toast.error(refus);
      return;
    }
    if (sujet.trim().length < 3 || message.trim().length < 10) {
      toast.error("Message incomplet", { description: "Un sujet et quelques lignes suffisent." });
      return;
    }
    const adresse = "contact@akora.fonenako.mg";
    window.location.href =
      "mailto:" + adresse + "?subject=" + encodeURIComponent(sujet.trim()) + "&body=" + encodeURIComponent(message.trim());
  };

  return (
    <PageTexte
      titre="Contact"
      chemin="/contact"
      chapeau="Une question, un signalement, une candidature de fournisseur."
    >
      <p>
        Pour une commande en cours, passez plutôt par la page de la commande : le fournisseur y est
        joignable directement, c'est plus rapide.
      </p>

      <Carte className="not-prose mt-6 p-4">
        <form onSubmit={envoyer} className="space-y-3" noValidate>
          <input type="text" {...antiAbus.proprietesLeurre} />
          <Champ etiquette="Sujet" obligatoire>
            {(a) => <Saisie {...a} value={sujet} onChange={(e) => setSujet(e.target.value)} />}
          </Champ>
          <Champ etiquette="Message" obligatoire>
            {(a) => <ZoneTexte {...a} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />}
          </Champ>
          <Bouton type="submit" pleineLargeur>
            Ouvrir mon application de messagerie
          </Bouton>
          <p className="text-[0.78rem] text-muted-foreground">
            Le bouton prépare un e-mail dans votre application. Akora n'enregistre rien de ce
            formulaire.
          </p>
        </form>
      </Carte>

      <h2>Signaler un contenu</h2>
      <p>
        Une annonce trompeuse, un avis injurieux, un fournisseur qui ne répond plus : utilisez le
        lien de signalement présent sur la fiche concernée. Le signalement arrive directement dans
        la file de modération, avec la référence de l'élément.
      </p>

      <h2>Vous êtes fournisseur ?</h2>
      <p>
        Tout se fait en ligne, sans passer par nous :{" "}
        <Link to="/devenir-fournisseur">comment monter son dépôt</Link>.
      </p>
    </PageTexte>
  );
}
