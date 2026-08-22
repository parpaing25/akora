import { clientAdmin, enTetesCors, reponse } from "../_commun.ts";

/**
 * Envoi du code de vérification à six chiffres.
 *
 * Pourquoi un code plutôt que le lien natif de Supabase : sur Fonenako, le
 * lien partait d'un domaine inconnu du destinataire, atterrissait en courriers
 * indésirables, et les comptes restaient non confirmés. Un code qu'on recopie
 * traverse tout — et il se lit aussi bien sur un téléphone d'entrée de gamme.
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

  const expediteur = Deno.env.get("SMTP_FROM");
  const hote = Deno.env.get("SMTP_HOST");
  const port = Deno.env.get("SMTP_PORT") ?? "465";
  const utilisateur = Deno.env.get("SMTP_USER");
  const motDePasse = Deno.env.get("SMTP_PASS");

  if (!hote || !utilisateur || !motDePasse || !expediteur) {
    return reponse(503, {
      erreur:
        "L'envoi d'e-mails n'est pas encore configuré. Renseignez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS et SMTP_FROM dans les secrets.",
    });
  }

  try {
    const nodemailer = await import("npm:nodemailer@6.9.8");
    const transport = nodemailer.default.createTransport({
      host: hote,
      port: Number.parseInt(port, 10),
      secure: port === "465",
      auth: { user: utilisateur, pass: motDePasse },
      tls: { rejectUnauthorized: false },
    });

    await transport.sendMail({
      from: `"Akora" <${expediteur}>`,
      to: email,
      subject: `${code} — votre code Akora`,
      text: [
        `Votre code de vérification Akora : ${code}`,
        "",
        "Il est valable 15 minutes.",
        "Si vous n'avez pas créé de compte sur akora.fonenako.mg, ignorez ce message.",
      ].join("\n"),
      html: gabarit(String(code)),
    });
  } catch (erreur) {
    console.error("Envoi SMTP impossible :", erreur);
    return reponse(502, {
      erreur: "L'e-mail n'a pas pu partir. Réessayez dans un instant.",
    });
  }

  return reponse(200, { envoye: true });
});

/**
 * Gabarit de l'e-mail. Aux couleurs d'Akora — latérite sur sable — mais en
 * tableaux et styles en ligne : les clients de messagerie, Outlook en tête,
 * ne comprennent ni flexbox ni variables CSS.
 *
 * Le code est en gros, espacé, en police à chasse fixe : il doit se lire d'un
 * coup d'œil sur un écran de téléphone, au soleil, sur un chantier.
 */
function gabarit(code: string): string {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fcfaf6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2a323b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fcfaf6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e6e1d9;border-radius:12px;overflow:hidden;">

        <tr><td style="background:#bb4a18;padding:18px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px;vertical-align:middle;">
              <img src="https://akora.fonenako.mg/akora-mark-blanc.png" width="32" height="32"
                   alt="" style="display:block;border:0;width:32px;height:32px;">
            </td>
            <td style="vertical-align:middle;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">AKORA</span>
            </td>
          </tr></table>
          <div style="color:#ffffff;opacity:.85;font-size:13px;margin-top:6px;">
            Le prix rendu chantier, pas le prix au dépôt.
          </div>
        </td></tr>

        <tr><td style="padding:24px;">
          <p style="margin:0 0 4px;font-size:15px;">Voici votre code de vérification :</p>

          <div style="margin:16px 0;padding:18px;background:#fdf2ec;border:1px solid #bb4a18;border-radius:10px;text-align:center;">
            <span style="font-family:'Courier New',Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#7d3110;">${code}</span>
          </div>

          <p style="margin:0 0 12px;font-size:15px;">
            Saisissez-le sur la page d'inscription. Il est valable <strong>15 minutes</strong>.
          </p>

          <p style="margin:0;padding:12px;background:#f4f1ec;border-left:4px solid #e6a70a;border-radius:6px;font-size:13px;color:#5f5648;">
            Personne d'Akora ne vous demandera jamais ce code, ni votre code secret mobile money.
            Si vous n'avez pas créé de compte sur akora.fonenako.mg, ignorez ce message : aucun
            compte ne sera activé sans ce code.
          </p>
        </td></tr>

        <tr><td style="padding:14px 24px;border-top:1px solid #e6e1d9;font-size:12px;color:#6b7280;">
          Akora — matériaux de construction à Madagascar<br>
          <a href="https://akora.fonenako.mg" style="color:#1f6a92;text-decoration:none;">akora.fonenako.mg</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
