import { clientAdmin, enTetesCors, quotaOk, reponse, adresse } from "../_commun.ts";

/**
 * « Mot de passe oublié » — second temps : le code contre un mot de passe.
 *
 * Le navigateur n'écrit jamais dans `auth.users` : il présente une adresse, un
 * code et un mot de passe, et c'est cette fonction — seule détentrice de la
 * clé de service — qui tranche. Le code est consommé en base, avec son
 * compteur de cinq tentatives.
 *
 * La règle du formulaire (8 caractères, une lettre, un chiffre) est revérifiée
 * ici : Zod protège l'utilisateur distrait, pas l'appelant malveillant.
 */

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response("ok", { headers: enTetesCors });
  if (requete.method !== "POST") return reponse(405, { erreur: "Méthode non autorisée." });

  let corps: { email?: string; code?: string; motDePasse?: string };
  try {
    corps = await requete.json();
  } catch {
    return reponse(400, { erreur: "Corps de requête illisible." });
  }

  const email = (corps.email ?? "").trim().toLowerCase();
  const code = (corps.code ?? "").trim();
  const motDePasse = corps.motDePasse ?? "";

  if (!email || !/^\d{6}$/.test(code)) {
    return reponse(400, { erreur: "Adresse e-mail et code à six chiffres requis." });
  }
  if (motDePasse.length < 8 || motDePasse.length > 72) {
    return reponse(400, { erreur: "Le mot de passe doit faire entre 8 et 72 caractères." });
  }
  if (!/[a-zA-Z]/.test(motDePasse) || !/\d/.test(motDePasse)) {
    return reponse(400, { erreur: "Le mot de passe doit contenir au moins une lettre et un chiffre." });
  }

  const client = clientAdmin();

  if (!(await quotaOk(client, "mdp_reinit", adresse(requete), 60, true))) {
    return reponse(429, { erreur: "Trop de tentatives. Réessayez dans une heure." });
  }

  const { data, error } = await client.rpc("consommer_code_reinitialisation", {
    _email: email,
    _code: code,
  });
  if (error) return reponse(500, { erreur: "Réinitialisation impossible." });

  const utilisateur = data as string | null;
  if (!utilisateur) {
    return reponse(400, { erreur: "Code incorrect ou expiré. Demandez-en un nouveau si besoin." });
  }

  const { error: erreurMaj } = await client.auth.admin.updateUserById(utilisateur, {
    password: motDePasse,
  });
  if (erreurMaj) {
    console.error("Mise à jour du mot de passe impossible :", erreurMaj);
    return reponse(500, { erreur: "Réinitialisation impossible." });
  }

  // Changer son mot de passe, c'est très souvent vouloir chasser quelqu'un.
  // Les sessions ouvertes ailleurs tombent donc avec l'ancien mot de passe.
  await client.rpc("revoquer_sessions", { _user_id: utilisateur });

  return reponse(200, { reinitialise: true });
});
