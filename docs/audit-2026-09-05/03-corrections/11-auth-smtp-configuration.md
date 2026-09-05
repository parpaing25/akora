# Correctif X-04 / X-11 — authentification et courriel : configuration à faire dans le tableau de bord (P1)

Lu le 05/09/2026 au matin via l'API Management (`GET /v1/projects/lvhnqrnmkajhlohympcs/config/auth`) ; une relecture à 14 h a été refusée (403, jeton à portée réduite) → **à revérifier dans Dashboard › Authentication avant d'appliquer**.

| Réglage | Valeur lue | Problème | Cible |
|---|---|---|---|
| SMTP personnalisé | **absent** | GoTrue utilise le mailer intégré Supabase : **2 courriels par heure pour tout le projet** (`rate_limit_email_sent = 2`), expéditeur `noreply@mail.app.supabase.io`, réservé aux tests | SMTP Brevo (gratuit 300/jour) ; limite 60/h |
| `mailer_autoconfirm` | `true` | Tout compte est actif sans preuve d'e-mail. **Voulu** : Akora vérifie l'e-mail par son propre code (`envoyer-code`/`verifier-code`, `profiles.email_verifie`). À garder, mais alors le flux de code doit **marcher** (il dépend des secrets SMTP des Edge Functions, absents eux aussi) | inchangé + secrets `SMTP_*` |
| HIBP (mots de passe compromis) | off | Fonction du plan Pro | Remplacer par la longueur minimale 10 et un contrôle client (zxcvbn) |
| Captcha | off | Aucune protection anti-robot sur inscription / connexion / mot de passe oublié hors quotas | Turnstile (gratuit) : `security_captcha_enabled`, `security_captcha_provider = turnstile` + widget dans `Inscription.tsx`, `Connexion.tsx`, `MotDePasseOublie.tsx` |
| `uri_allow_list` | contient `http://localhost:*` | Une redirection OAuth vers localhost est acceptée en production | Retirer ; garder `https://akora.fonenako.mg/**` |
| MFA TOTP | non proposé | Le compte admin unique confirme les paiements et libère le séquestre **sans second facteur** (barème 2.2, ligne [P0] « MFA disponible pour les comptes admin ») | Inscription TOTP obligatoire pour le rôle admin |
| Rotation du jeton de rafraîchissement | à relire | | `refresh_token_rotation_enabled = true`, `reuse_interval = 10` |

**Effort** : 1 h de configuration + 4 h pour la MFA admin (écran d'inscription TOTP + garde).

---

## 1. SMTP — Brevo (ex-Sendinblue), gratuit jusqu'à 300 courriels/jour

1. Créer le compte Brevo avec `contact.fonenako@gmail.com` ; **Expéditeurs & IP › Domaines** : authentifier `akora.fonenako.mg` (DKIM + inclusion SPF, voir `12-dns-courriel-dmarc.md`) ; **SMTP & API** : générer une clé SMTP.
2. **Supabase › Authentication › SMTP Settings** : Enable custom SMTP · Sender `contact@akora.fonenako.mg` (Akora) · Host `smtp-relay.brevo.com` · Port `587` · User `<login Brevo>` · Pass `<clé SMTP>`. Puis **Rate limits › Email** : 60/h.
3. **Edge Functions › Secrets** (ou `npx supabase secrets set …`) :
   ```
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=<login Brevo>
   SMTP_PASS=<clé SMTP>
   SMTP_FROM=contact@akora.fonenako.mg
   SITE_URL=https://akora.fonenako.mg
   ```
4. `_courriel.ts:52-56` : le transport fait `secure: port === "465"` ; en 587 il faut exiger STARTTLS et **retirer** `tls: { rejectUnauthorized: false }` (il accepte n'importe quel certificat, donc un intermédiaire) :
   ```diff
   -      secure: port === "465",
   +      secure: port === "465",
   +      requireTLS: port !== "465",
          auth: { user: utilisateur, pass: motDePasse },
   -      tls: { rejectUnauthorized: false },
   ```
5. Test : `/inscription` avec un Gmail → code reçu en < 1 min, expéditeur Akora, pas en spam.

## 2. Mot de passe et robots

- **Authentication › Providers › Email** : *Minimum password length* **10**, *Password requirements* « lettres et chiffres ».
- **Turnstile** (Cloudflare, gratuit, sans compte Cloudflare payant) : créer un site Turnstile pour `akora.fonenako.mg` (mode *Managed*) → **Authentication › Attack Protection** : Enable Captcha, provider Turnstile, clé secrète. Côté client, `@marsidev/react-turnstile` (5 Ko) dans les trois formulaires, jeton passé en `options.captchaToken` à `signUp`/`signInWithPassword`/`resetPasswordForEmail`. Ajouter `https://challenges.cloudflare.com` à `script-src` et `frame-src` de la CSP (`.htaccess`). Le honeypot existant (`useAntiAbus`) reste.
- **URL Configuration** : *Site URL* `https://akora.fonenako.mg` ; *Redirect URLs* : `https://akora.fonenako.mg/**` uniquement (retirer localhost ; le développement local s'ajoute dans le projet de préprod, pas en prod).

## 3. Sessions

**Authentication › Sessions** : *Refresh token rotation* activé, *reuse interval* 10 s ; *Time-box user sessions* 7 jours pour tous ; *Inactivity timeout* 24 h pour le rôle admin **via garde applicative** (le réglage global s'applique à tous ; côté client, `RouteProtegee` peut exiger une reconnexion si `session.user.last_sign_in_at` > 24 h pour un admin).

## 4. MFA TOTP pour les administrateurs (X-11)

GoTrue propose le TOTP sur le plan Free (`mfa_totp_enroll_enabled`, `mfa_totp_verify_enabled` → **on**). Le code manquant :

`src/pages/compte/Securite.tsx` — section « Second facteur » :
```tsx
const inscrire = async () => {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Akora admin" });
  if (error) return toast.error(error.message);
  setQr(data.totp.qr_code); setFacteur(data.id);          // afficher le QR (image SVG data:) + le secret en clair
};
const verifier = async (code: string) => {
  const { data: defi, error } = await supabase.auth.mfa.challenge({ factorId: facteur });
  if (error) return toast.error(error.message);
  const { error: e2 } = await supabase.auth.mfa.verify({ factorId: facteur, challengeId: defi.id, code });
  if (e2) return toast.error("Code refusé"); toast.success("Second facteur activé");
};
```
`src/components/RouteProtegee.tsx` — pour `roleRequis === "admin"` :
```ts
const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
if (data?.currentLevel !== "aal2") {
  if (data?.nextLevel === "aal2") return <Navigate to="/connexion/second-facteur" state={{ retour }} />;   // facteur inscrit, défi à passer
  return <Navigate to="/compte/securite?mfa=obligatoire" />;                                          // aucun facteur : inscription forcée
}
```
Et une policy SQL en ceinture : les fonctions d'admin sensibles (`confirmer_paiement`, `liberer_sequestre`, `definir_role_admin`) vérifient `(auth.jwt() ->> 'aal') = 'aal2'` — sinon `raise exception 'second facteur requis'`. Ainsi même un jeton admin volé sans TOTP ne libère pas d'argent.

## 5. Vérification

- Inscription : code reçu ; 6e demande de code dans l'heure refusée (X-03).
- Connexion admin sans TOTP → redirigé vers l'inscription du facteur ; avec TOTP → `/admin`.
- `select (auth.jwt() ->> 'aal')` dans une requête admin = `aal2`.
- Turnstile : soumission sans jeton → erreur GoTrue « captcha verification process failed ».
