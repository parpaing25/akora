# Brancher les paiements mobile money

Akora encaisse déjà, aujourd'hui, par **référence saisie** : l'acheteur paie
depuis son téléphone et recopie la référence du SMS, un administrateur
confirme. Rien n'attend personne.

Ce document explique comment passer au **paiement automatique**, opérateur par
opérateur. Le code est prêt : les trois adaptateurs existent, seule la
configuration manque. Aucune ligne de code n'est à écrire.

> **Pourquoi rien n'est en dur.** Chaque adaptateur lit ses URL dans
> l'environnement (`MVOLA_BASE_URL`, `ORANGE_MONEY_BASE_URL`,
> `AIRTEL_MONEY_BASE_URL`…). Tant qu'une variable manque, l'opérateur se
> déclare indisponible et Akora retombe sur la référence saisie — sans jamais
> échouer sous les doigts d'un acheteur.

---

## Ce qu'il faut obtenir, dans l'ordre

Les trois opérateurs exigent la **même chose avant tout accès** : un compte
marchand enregistré, avec NIF, STAT, RCS et pièce du gérant. C'est exactement
le dossier de vérification qu'Akora demande déjà à ses fournisseurs.

| Opérateur | Portail | Ce qui bloque |
|---|---|---|
| **MVola** (Telma) | [developer.mvola.mg](https://developer.mvola.mg/devportal/) | inscription au portail, puis passage en production |
| **Orange Money** | [developer.orange.com](https://developer.orange.com/products/payment-financial-services/apply-orange-money/) | dossier marchand validé par Orange Madagascar |
| **Airtel Money** | [developers.airtel.africa](https://developers.airtel.africa/) | inscription, puis KYC pour la production |

---

## 1. MVola (préfixes 034 et 038)

C'est le mieux documenté publiquement des trois.

| Variable | Valeur |
|---|---|
| `MVOLA_BASE_URL` | `https://api.mvola.mg` (production) |
| `MVOLA_TOKEN_PATH` | `/token` |
| `MVOLA_TRANSACTION_PATH` | `/mvola/mm/transactions/type/merchantpay/1.0.0/` |
| `MVOLA_STATUS_PATH` | `/mvola/mm/transactions/type/merchantpay/1.0.0/status/{reference}` |
| `MVOLA_CLIENT_ID` | votre *consumer key* |
| `MVOLA_CLIENT_SECRET` | votre *consumer secret* |
| `MVOLA_PARTNER_MSISDN` | le numéro marchand Akora, format `+261…` |
| `MVOLA_PARTNER_NAME` | `Akora` |
| `MVOLA_WEBHOOK_SECRET` | à définir dans le portail, pour signer les rappels |

Le bac à sable utilise une autre base et deux numéros de test, `0343500003` et
`0343500004`. Vérifiez l'URL du sandbox dans le portail : elle change parfois.

**À confirmer dans le portail** : le scope OAuth (`EXT_INT_MVOLA_SCOPE` d'après
les bibliothèques publiques) et les en-têtes obligatoires
`Version`, `X-CorrelationID`, `UserLanguage`, `UserAccountIdentifier`,
`partnerName`. L'adaptateur envoie déjà `X-Correlation-ID` ; les autres se
règlent en trois lignes dans `src/lib/paiement/mvola.ts` si le portail les
exige différemment.

## 2. Orange Money (préfixe 032)

Madagascar fait partie des pays couverts par **Orange Money Web Payment**, avec
le Mali, le Cameroun, la Côte d'Ivoire, le Sénégal, le Botswana, la Guinée, la
Sierra Leone, la RDC et la Centrafrique.

| Variable | Valeur |
|---|---|
| `ORANGE_MONEY_BASE_URL` | fournie à la validation du dossier |
| `ORANGE_MONEY_TOKEN_PATH` | `/oauth/v3/token` (à confirmer) |
| `ORANGE_MONEY_TRANSACTION_PATH` | `/orange-money-webpay/dev/v1/webpayment` (à confirmer) |
| `ORANGE_MONEY_CLIENT_ID` / `_CLIENT_SECRET` | portail Orange Developer |
| `ORANGE_MONEY_MERCHANT_ID` | votre *merchant key* |
| `ORANGE_MONEY_WEBHOOK_URL` | `https://…/functions/v1/paiement-webhook?operateur=orange_money` |
| `ORANGE_MONEY_WEBHOOK_SECRET` | à définir |

Orange ne publie pas ses chemins sans compte : ils arrivent avec le dossier
validé. C'est précisément pour ça qu'ils sont paramétrables.

## 3. Airtel Money (préfixe 033)

| Variable | Valeur |
|---|---|
| `AIRTEL_MONEY_BASE_URL` | `https://openapi.airtel.africa` (production) |
| | `https://openapiuat.airtel.africa` (recette) |
| `AIRTEL_MONEY_TOKEN_PATH` | `/auth/oauth2/token` (à confirmer) |
| `AIRTEL_MONEY_TRANSACTION_PATH` | `/merchant/v1/payments/` (à confirmer) |
| `AIRTEL_MONEY_STATUS_PATH` | `/standard/v1/payments/{reference}` (à confirmer) |
| `AIRTEL_MONEY_CLIENT_ID` / `_CLIENT_SECRET` | portail Airtel |
| `AIRTEL_MONEY_WEBHOOK_SECRET` | à définir |

Airtel exige aussi les en-têtes `X-Country: MG` et `X-Currency: MGA`. Ils se
posent dans `src/lib/paiement/airtel-money.ts`, méthode `initier`.

---

## Où déposer ces valeurs

**Tableau de bord Supabase → Edge Functions → Secrets.** Nulle part ailleurs :
ni dans `.env.local`, ni dans le dépôt, ni dans un fichier PHP. Les adaptateurs
tournent côté serveur, ce sont eux qui les lisent.

Après avoir ajouté les secrets, redéployez :

```bash
npm run fonctions:deploy
```

Rien d'autre à faire : dès que les trois variables minimales d'un opérateur
(`BASE_URL`, `CLIENT_ID`, `CLIENT_SECRET`) sont présentes, `prestataire()`
bascule automatiquement de la référence saisie vers l'API.

## L'URL de rappel à donner aux opérateurs

```
https://<votre-projet>.supabase.co/functions/v1/paiement-webhook?operateur=mvola
https://<votre-projet>.supabase.co/functions/v1/paiement-webhook?operateur=orange_money
https://<votre-projet>.supabase.co/functions/v1/paiement-webhook?operateur=airtel_money
```

Cette fonction est **publique** — les opérateurs n'ont pas de jeton Supabase —
mais elle refuse d'appliquer quoi que ce soit sans signature valide. Un rappel
non signé est enregistré et laissé sans effet.

## Ce qui ne changera pas

Le **séquestre**. Que le paiement soit confirmé par un webhook ou par un
administrateur, la somme reste retenue jusqu'à la confirmation de livraison,
ou 72 heures après celle-ci sans contestation. Brancher les API supprime une
étape manuelle, pas une garantie.

---

## Annexe — les clés VAPID (notifications push)

Rien à demander à personne : VAPID, c'est une simple paire de clés ECDSA P-256
qu'on fabrique en local.

```bash
node scripts/generer-vapid.mjs
```

La commande affiche deux valeurs :

- **`VITE_VAPID_PUBLIC_KEY`** — publique par nature, elle part dans le bundle.
  Ajoutez-la à `~/.akora-secrets/supabase.txt`, puis relancez
  `node scripts/ecrire-env.mjs` et rebâtissez.
- **`VAPID_PRIVATE_KEY`** — secret d'Edge Function, avec
  `VAPID_SUBJECT=mailto:contact@akora.fonenako.mg`. Elle ne doit apparaître
  nulle part ailleurs.

Tant que la clé publique manque, Akora **ne demande même pas** la permission
d'envoyer des notifications : mieux vaut ne rien proposer que griller le seul
consentement que l'utilisateur accordera.

Si la clé privée fuite, régénérez la paire. Les abonnements existants
deviennent caducs, et c'est tout : aucune donnée n'est exposée par une clé
VAPID.

---

## Sources

- [MVola — portail développeur](https://developer.mvola.mg/devportal/)
- [mvola-api-lib (PyPI) — chemins de l'API merchant pay](https://pypi.org/project/mvola-api-lib/)
- [Orange Money Web Payment — présentation et pays couverts](https://developer.orange.com/apis/om-webpay)
- [Orange — demande d'accès marchand](https://developer.orange.com/products/payment-financial-services/apply-orange-money/)
- [Airtel Africa — portail développeur](https://developers.airtel.africa/)
