/**
 * Envoi d'e-mails et gabarit du code a six chiffres.
 *
 * Ecrit UNE fois, appele par `envoyer-code` et `mot-de-passe-code`. Deux
 * copies du meme gabarit auraient diverge des la premiere retouche, et un
 * mail de reinitialisation qui ne ressemble pas au mail d'inscription est
 * exactement ce dont se sert l'hameconnage.
 *
 * Les clients de messagerie, Outlook en tete, ne comprennent ni flexbox ni
 * variables CSS : d'ou les tableaux et les styles en ligne. Les couleurs sont
 * celles d'AKORA-DESIGN, recopiees ici parce qu'un e-mail ne charge pas notre
 * feuille de style — c'est la seule exception a la regle « jamais de couleur
 * en dur ».
 */

const LATERITE = "#bb4a18";
const LATERITE_SOMBRE = "#7d3110";
const SABLE = "#fcfaf6";
const ENCRE = "#2a323b";
const BORDURE = "#e6e1d9";

export interface Courriel {
  destinataire: string;
  sujet: string;
  texte: string;
  html: string;
}

/**
 * Envoie, ou explique pourquoi il n'a pas pu. On ne renvoie jamais l'erreur
 * SMTP brute a l'appelant : elle contient l'hote et l'identifiant.
 */
export async function envoyer(courriel: Courriel): Promise<{ ok: true } | { ok: false; statut: number; erreur: string }> {
  const expediteur = Deno.env.get("SMTP_FROM");
  const hote = Deno.env.get("SMTP_HOST");
  const port = Deno.env.get("SMTP_PORT") ?? "465";
  const utilisateur = Deno.env.get("SMTP_USER");
  const motDePasse = Deno.env.get("SMTP_PASS");

  if (!hote || !utilisateur || !motDePasse || !expediteur) {
    return {
      ok: false,
      statut: 503,
      erreur:
        "L'envoi d'e-mails n'est pas encore configure. Renseignez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS et SMTP_FROM dans les secrets.",
    };
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
      to: courriel.destinataire,
      subject: courriel.sujet,
      text: courriel.texte,
      html: courriel.html,
    });
    return { ok: true };
  } catch (erreur) {
    console.error("Envoi SMTP impossible :", erreur);
    return { ok: false, statut: 502, erreur: "L'e-mail n'a pas pu partir. Reessayez dans un instant." };
  }
}

/**
 * Gabarit commun. `intro` et `pied` changent selon qu'il s'agit d'une
 * inscription ou d'un mot de passe oublie ; le reste ne bouge pas, pour que le
 * destinataire reconnaisse Akora du premier coup d'oeil.
 */
export function gabaritCode(options: { code: string; intro: string; pied: string }): string {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${SABLE};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${ENCRE};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SABLE};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid ${BORDURE};border-radius:12px;overflow:hidden;">

        <tr><td style="background:${LATERITE};padding:18px 24px;">
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
            Le prix rendu chantier, pas le prix au depot.
          </div>
        </td></tr>

        <tr><td style="padding:24px;">
          <p style="margin:0 0 4px;font-size:15px;">${options.intro}</p>

          <div style="margin:16px 0;padding:18px;background:#fdf2ec;border:1px solid ${LATERITE};border-radius:10px;text-align:center;">
            <span style="font-family:'Courier New',Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${LATERITE_SOMBRE};">${options.code}</span>
          </div>

          <p style="margin:0 0 12px;font-size:15px;">
            Il est valable <strong>15 minutes</strong>.
          </p>

          <p style="margin:0;padding:12px;background:#f4f1ec;border-left:4px solid #e6a70a;border-radius:6px;font-size:13px;color:#5f5648;">
            Personne d'Akora ne vous demandera jamais ce code, ni votre code secret mobile money.
            ${options.pied}
          </p>
        </td></tr>

        <tr><td style="padding:14px 24px;border-top:1px solid ${BORDURE};font-size:12px;color:#6b7280;">
          Akora — materiaux de construction a Madagascar<br>
          <a href="https://akora.fonenako.mg" style="color:#1f6a92;text-decoration:none;">akora.fonenako.mg</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
