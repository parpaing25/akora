import * as React from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Phone, MessageCircle, Mail, Clock } from "lucide-react";
import { PageTexte } from "@/components/PageTexte";
import { useAntiAbus } from "@/hooks/useAntiAbus";
import { Champ } from "@/components/ui/champ";
import { Saisie, ZoneTexte } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Carte } from "@/components/ui/card";

/**
 * Contact — version construite par l'audit du 05/09/2026 (C-01).
 *
 * L'ancienne page n'offrait qu'un `mailto:` vers une boîte dont l'existence
 * n'est pas vérifiée, sans téléphone ni WhatsApp — pour une audience qui vit
 * au téléphone. Cette version met les canaux directs EN PREMIER, garde le
 * formulaire (qui ouvre toujours la messagerie : Akora n'a pas de serveur
 * SMTP côté site, et le dire vaut mieux qu'un formulaire qui avale les
 * messages), et annonce les horaires de réponse.
 *
 * 🔴 `[À COMPLÉTER]` : numéro de téléphone/WhatsApp (Q5). Sans lui, retirer
 * les deux cartes correspondantes plutôt que publier un faux numéro.
 */
const TELEPHONE_AFFICHE = "[À COMPLÉTER — 03x xx xxx xx]";
const TELEPHONE_E164 = "[À COMPLÉTER — 2613xxxxxxxx]"; // sans « + » pour wa.me
const HORAIRES = "Lundi – samedi, 8 h – 17 h (heure de Madagascar)";
const COURRIEL = "contact@akora.fonenako.mg";

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
    window.location.href =
      "mailto:" + COURRIEL + "?subject=" + encodeURIComponent(sujet.trim()) + "&body=" + encodeURIComponent(message.trim());
  };

  const messageWhatsApp = encodeURIComponent("Bonjour Akora, ");

  return (
    <PageTexte
      titre="Contact"
      chemin="/contact"
      description="Joindre Akora par WhatsApp, téléphone ou e-mail : questions sur une commande, un paiement mobile money, une fiche de dépôt, une candidature de fournisseur."
      chapeau="Le plus rapide : WhatsApp ou un appel. Pour une commande en cours, le fournisseur est joignable depuis la page de la commande."
      majLe="06/09/2026"
      donneesStructurees={{
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contact Akora",
        url: "https://akora.fonenako.mg/contact",
        mainEntity: {
          "@type": "Organization",
          name: "Akora",
          email: COURRIEL,
          telephone: TELEPHONE_AFFICHE,
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            telephone: TELEPHONE_AFFICHE,
            email: COURRIEL,
            availableLanguage: ["fr", "mg"],
            hoursAvailable: {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
              opens: "08:00",
              closes: "17:00",
            },
          },
        },
      }}
    >
      {/* Canaux directs — cibles ≥ 44 px, un canal par carte. */}
      <ul className="not-prose grid gap-3 sm:grid-cols-3" aria-label="Moyens de contact">
        <li>
          <a
            href={`https://wa.me/${TELEPHONE_E164}?text=${messageWhatsApp}`}
            className="carte flex min-h-24 flex-col justify-between p-4 hover:bg-muted"
            rel="noopener"
          >
            <MessageCircle className="size-6 text-secondary-strong" aria-hidden="true" />
            <span className="mt-2 block text-produit">WhatsApp</span>
            <span className="nombres text-legende text-muted-foreground">{TELEPHONE_AFFICHE}</span>
          </a>
        </li>
        <li>
          <a href={`tel:+${TELEPHONE_E164}`} className="carte flex min-h-24 flex-col justify-between p-4 hover:bg-muted">
            <Phone className="size-6 text-secondary-strong" aria-hidden="true" />
            <span className="mt-2 block text-produit">Appeler</span>
            <span className="nombres text-legende text-muted-foreground">{TELEPHONE_AFFICHE}</span>
          </a>
        </li>
        <li>
          <a href={`mailto:${COURRIEL}`} className="carte flex min-h-24 flex-col justify-between p-4 hover:bg-muted">
            <Mail className="size-6 text-secondary-strong" aria-hidden="true" />
            <span className="mt-2 block text-produit">E-mail</span>
            <span className="break-all text-legende text-muted-foreground">{COURRIEL}</span>
          </a>
        </li>
      </ul>
      <p className="mt-3 flex items-center gap-2 text-legende text-muted-foreground">
        <Clock className="size-4" aria-hidden="true" />
        {HORAIRES}. Réponse le jour même aux heures ouvrées, sous 24 h sinon.
      </p>

      <h2>Écrire depuis cette page</h2>
      <Carte className="not-prose mt-3 p-4">
        <form onSubmit={envoyer} className="space-y-3" noValidate>
          <input type="text" {...antiAbus.proprietesLeurre} />
          <Champ etiquette="Sujet" obligatoire aide="Ex. : commande AK-000123, fiche de mon dépôt, paiement MVola">
            {(a) => <Saisie {...a} value={sujet} onChange={(e) => setSujet(e.target.value)} autoComplete="off" />}
          </Champ>
          <Champ etiquette="Message" obligatoire>
            {(a) => <ZoneTexte {...a} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />}
          </Champ>
          <Bouton type="submit" pleineLargeur>
            Ouvrir mon application de messagerie
          </Bouton>
          <p className="text-legende text-muted-foreground">
            Le bouton prépare un e-mail dans votre application ; Akora n'enregistre rien de ce
            formulaire. Sans application de messagerie sur votre téléphone, passez par WhatsApp.
          </p>
        </form>
      </Carte>

      <h2>Selon votre cas</h2>
      <ul>
        <li>
          <strong>Une commande en cours</strong> : la page de la commande (lien reçu après l'achat, ou{" "}
          <Link to="/compte/commandes">Mes commandes</Link>) affiche le numéro du fournisseur — c'est
          lui qui livre.
        </li>
        <li>
          <strong>Un paiement mobile money envoyé</strong> mais toujours « en vérification » après le
          délai annoncé : écrivez-nous avec le numéro de commande et la référence de la transaction.
        </li>
        <li>
          <strong>Une annonce trompeuse, un avis injurieux, un fournisseur injoignable</strong> : le
          lien « Signaler » de la fiche concernée envoie le signalement en file de modération avec la
          référence exacte.
        </li>
        <li>
          <strong>Votre dépôt apparaît sur Akora sans que vous l'ayez créé</strong> : indiquez son nom
          et un numéro où vous joindre ; nous vous remettons l'accès à la fiche ou nous la retirons.
        </li>
        <li>
          <strong>Vous êtes fournisseur ou transporteur</strong> : tout se fait en ligne,{" "}
          <Link to="/devenir-fournisseur">voici comment monter son dépôt</Link>.
        </li>
        <li>
          <strong>Presse, partenariat, sécurité</strong> : {COURRIEL} ; failles de sécurité via{" "}
          <code>/.well-known/security.txt</code>.
        </li>
      </ul>

      <h2>Adresse</h2>
      <p>
        [À COMPLÉTER — adresse du siège], Antananarivo. Akora n'a pas de guichet : les matériaux se
        commandent en ligne et se livrent depuis les dépôts des fournisseurs.
      </p>
    </PageTexte>
  );
}
