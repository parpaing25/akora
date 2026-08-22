import { clientAdmin, enTetesCors, reponse } from "../_commun.ts";
import { envoyer, gabaritCode } from "../_courriel.ts";

/**
 * Envoi du code de verification a six chiffres, a l'inscription.
 *
 * Pourquoi un code plutot que le lien natif de Supabase : sur Fonenako, le
 * lien partait d'un domaine inconnu du destinataire, atterrissait en courriers
 * indesirables, et les comptes restaient non confirmes. Un code qu'on recopie
 * traverse tout — et il se lit aussi bien sur un telephone d'entree de gamme.
 *
 * Le code est produit en base (`creer_code_verification`), avec ses deux
 * garde-fous : une minute entre deux envois, dix par jour et par adresse.
 */

const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response("ok", { headers: enTetesCors });
  if (requete.method !== "POST") return reponse(405, { erreur: "Méthode non autorisée." });

  let corps: { userId?: string; email?: string };
  try {
    corps = await requete.json();
  } catch {
    return reponse(400, { erreur: "Corps de requête illisible." });
  }

  const email = (corps.email ?? "").trim().toLowerCase();
  if (!corps.userId || !MOTIF_EMAIL.test(email)) {
    return reponse(400, { erreur: "Identifiant de compte et adresse e-mail valides sont requis." });
  }

  const client = clientAdmin();

  const { data: code, error } = await client.rpc("creer_code_verification", {
    _user_id: corps.userId,
    _email: email,
    _usage: "inscription",
  });

  if (error) {
    // Les deux plafonds remontent un message métier lisible : on le transmet
    // tel quel plutôt que de dire « erreur interne » à quelqu'un qui a
    // simplement cliqué deux fois.
    const trop = String(error.message ?? "").includes("TROP_DE_DEMANDES");
    return reponse(trop ? 429 : 500, {
      erreur: trop
        ? String(error.message).replace("TROP_DE_DEMANDES: ", "")
        : "Génération du code impossible.",
    });
  }

  const envoi = await envoyer({
    destinataire: email,
    sujet: `${code} — votre code Akora`,
    texte: [
      `Votre code de vérification Akora : ${code}`,
      "",
      "Il est valable 15 minutes.",
      "Si vous n'avez pas créé de compte sur akora.fonenako.mg, ignorez ce message.",
    ].join("\n"),
    html: gabaritCode({
      code: String(code),
      intro: "Voici votre code de vérification :",
      pied:
        "Si vous n'avez pas créé de compte sur akora.fonenako.mg, ignorez ce message : aucun compte ne sera activé sans ce code.",
    }),
  });

  if (!envoi.ok) return reponse(envoi.statut, { erreur: envoi.erreur });

  return reponse(200, { envoye: true });
});
