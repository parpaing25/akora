import { clientAdmin, enTetesCors, quotaOk, reponse, adresse } from "../_commun.ts";

/**
 * Vérification du code à six chiffres.
 *
 * C'est cette fonction — et elle seule — qui pose `email_confirmed_at` sur le
 * compte, via `verifier_code_email`. Le client ne peut pas se confirmer
 * lui-même : il n'a aucun droit sur la table des codes ni sur `auth.users`.
 *
 * Les cinq tentatives sont comptées en base, pas ici : un attaquant qui
 * appellerait l'API directement se heurte au même compteur.
 */

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response("ok", { headers: enTetesCors });
  if (requete.method !== "POST") return reponse(405, { erreur: "Méthode non autorisée." });

  let corps: { email?: string; code?: string };
  try {
    corps = await requete.json();
  } catch {
    return reponse(400, { erreur: "Corps de requête illisible." });
  }

  const email = (corps.email ?? "").trim().toLowerCase();
  const code = (corps.code ?? "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return reponse(400, { erreur: "Adresse e-mail et code à six chiffres requis." });
  }

  const client = clientAdmin();

  // Plafond par IP en plus du compteur de tentatives par code : sans lui, on
  // pourrait balayer les codes de plusieurs adresses en parallele.
  if (!(await quotaOk(client, "verifier_code", adresse(requete), 60))) {
    return reponse(429, { erreur: "Trop de tentatives. Réessayez dans une heure." });
  }

  const { data, error } = await client.rpc("verifier_code_email", {
    _email: email,
    _code: code,
  });
  if (error) return reponse(500, { erreur: "Vérification impossible." });

  if (data !== true) {
    return reponse(400, {
      valide: false,
      erreur: "Code incorrect ou expiré. Demandez-en un nouveau si besoin.",
    });
  }

  return reponse(200, { valide: true });
});
