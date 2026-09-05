import { clientAdmin, enTetesCors, quotaOk, reponse, adresse } from "../_commun.ts";
import { envoyer, gabaritCode } from "../_courriel.ts";

/**
 * « Mot de passe oublié » — premier temps : l'envoi du code.
 *
 * Le lien natif de Supabase a été écarté pour la même raison qu'à
 * l'inscription : il part d'un domaine que le destinataire ne connaît pas et
 * finit en indésirables. Même remède, même SMTP, même gabarit.
 *
 * Cette fonction répond TOUJOURS `{envoye:true}`, que l'adresse soit inscrite
 * ou non. C'est délibéré : distinguer les deux cas transformerait ce
 * formulaire en annuaire des comptes existants. Le délai d'une minute et le
 * plafond quotidien s'appliquent aussi aux adresses inconnues — sans quoi la
 * différence de comportement rétablirait la fuite qu'on vient de fermer.
 */

const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response("ok", { headers: enTetesCors });
  if (requete.method !== "POST") return reponse(405, { erreur: "Méthode non autorisée." });

  let corps: { email?: string };
  try {
    corps = await requete.json();
  } catch {
    return reponse(400, { erreur: "Corps de requête illisible." });
  }

  const email = (corps.email ?? "").trim().toLowerCase();
  if (!MOTIF_EMAIL.test(email)) {
    return reponse(400, { erreur: "Adresse e-mail valide requise." });
  }

  const client = clientAdmin();

  // Plafond par IP, en plus du plafond par adresse tenu en base : sans lui, on
  // pourrait arroser mille adresses depuis un seul poste.
  if (!(await quotaOk(client, "mdp_code", adresse(requete), 30, true))) {
    return reponse(429, { erreur: "Trop de demandes. Réessayez dans une heure." });
  }

  const { data, error } = await client.rpc("creer_code_reinitialisation", { _email: email });

  if (error) {
    const trop = String(error.message ?? "").includes("TROP_DE_DEMANDES");
    return reponse(trop ? 429 : 500, {
      erreur: trop
        ? String(error.message).replace("TROP_DE_DEMANDES: ", "")
        : "Génération du code impossible.",
    });
  }

  const resultat = data as { code: string; existe: boolean } | null;

  // Adresse inconnue : la ligne a bien été écrite (pour les quotas), mais on
  // n'envoie rien. Et on répond comme si de rien n'était.
  if (!resultat?.existe) return reponse(200, { envoye: true });

  const envoi = await envoyer({
    destinataire: email,
    sujet: `${resultat.code} — réinitialisation de votre mot de passe Akora`,
    texte: [
      `Votre code de réinitialisation Akora : ${resultat.code}`,
      "",
      "Il est valable 15 minutes.",
      "Si vous n'avez pas demandé à changer votre mot de passe, ignorez ce message :",
      "votre mot de passe actuel reste valable.",
    ].join("\n"),
    html: gabaritCode({
      code: resultat.code,
      intro: "Voici votre code pour choisir un nouveau mot de passe :",
      pied:
        "Si vous n'avez pas demandé ce changement, ignorez ce message : votre mot de passe actuel reste valable, et personne ne peut le modifier sans ce code.",
    }),
  });

  // Même en cas d'échec SMTP on ne dit pas que l'adresse existe : on rend une
  // panne d'envoi, pas un renseignement.
  if (!envoi.ok) return reponse(envoi.statut, { erreur: envoi.erreur });

  return reponse(200, { envoye: true });
});
