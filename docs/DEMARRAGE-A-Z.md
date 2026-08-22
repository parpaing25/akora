# Akora — de A à Z : ce que tu fais, et où

Onze étapes, dans l'ordre. Les trois premières sont bloquantes, le reste peut
attendre. À chaque fois : **où** aller, **quoi** faire, **comment savoir que
c'est bon**.

**Mise à jour du 22/08/2026, 21 h** : les étapes A, B, C et H sont FAITES.
Le certificat Let's Encrypt est passé, l'authentification est configurée, ton
compte `onjaniaina27@gmail.com` est administrateur, et l'envoi d'e-mails
fonctionne. Il reste **D à G**, plus I, J, K quand tu voudras.

---

## A. ~~Le certificat HTTPS~~ — FAIT le 22/08 à 16 h 05

**Où** : cPanel o2switch → `SSL/TLS Status` (pas « Installer un certificat »).

**Quoi** : coche la ligne `akora.fonenako.mg`, clique **« Exécuter AutoSSL »**.
Si la ligne affiche « exclu », clique d'abord sur **« Inclure pendant AutoSSL »**.

**Pourquoi ce n'est pas déjà fait** : le message « Ce certificat SSL a déjà été
installé » parlait du certificat auto-signé posé automatiquement à la création
du sous-domaine. Ce n'est pas un vrai certificat, c'est un bouche-trou.

**Comment savoir** : ouvre https://akora.fonenako.mg, plus d'avertissement
rouge. Pour comparaison, `fonenako.mg` et `hourdis.fonenako.mg` ont déjà leur
certificat Let's Encrypt.

> Tant que ce n'est pas fait, **rien d'autre n'est testable** : le navigateur
> refusera de laisser le site parler à Supabase.

---

## B. ~~Réglages d'authentification~~ — FAIT, configurés par script

**Où** : tableau de bord Supabase, **Authentication → URL Configuration**.

- *Site URL* : `https://akora.fonenako.mg`
- *Redirect URLs* : ajoute `https://akora.fonenako.mg/**` et
  `http://localhost:8080/**`

Puis **Authentication → Providers → Email** : *Confirm email* **activé**.

**Pourquoi** : sans ça, le lien de confirmation d'inscription renvoie vers
`localhost:3000` et personne ne peut valider son compte.

---

## C. ~~Ton compte et le rôle admin~~ — FAIT

**Où** : https://akora.fonenako.mg/inscription

Crée ton compte en cochant **« Vendre des matériaux »** — tu auras ainsi les
deux rôles, acheteur et fournisseur. Ouvre le mail de confirmation.

Puis **dis-moi l'adresse e-mail utilisée**. Je lance :

```
npm run admin -- ton@email.mg
```

Ce geste ne peut pas se faire depuis le site : le navigateur n'a aucun droit
d'écriture sur les rôles. C'est voulu, sinon n'importe qui se déclarerait
administrateur.

**Comment savoir** : déconnecte-toi, reconnecte-toi, le menu affiche
**« Administration »**.

---

## D. Monter ton premier dépôt — 15 minutes

**Où** : https://akora.fonenako.mg/pro

C'est le meilleur test du produit : tu vois exactement ce que verront tes
fournisseurs.

1. **Créer le dépôt** : raison sociale, téléphone, et surtout **la position sur
   la carte**. Sans elle, aucun prix rendu chantier ne s'affiche.
2. **Onglet Livraison** : déclare au moins un véhicule — nom, volume utile,
   charge utile, forfait de sortie, prix au kilomètre, prix plancher. Bouge le
   curseur de distance à droite : le tarif se calcule en direct, formule
   comprise. C'est exactement ce que verra l'acheteur.
3. **Onglet Catalogue → Ajouter un produit** : cherche « parpaing », choisis la
   référence, fixe ton prix, publie.

**Comment savoir** : va sur `/materiaux/agglomeres/parpaing-creux-15`, ton offre
apparaît avec son prix rendu chantier.

> Le tableau de bord `/pro` liste en permanence ce qui manque pour vendre.

---

## E. Vérifier que la boucle complète tourne — 10 minutes

1. `/materiaux`, une famille, un matériau. **Fixe un point de livraison** :
   « Ma position », un clic sur la carte, ou tape « Analakely ».
2. Le comparateur affiche le prix rendu chantier. Bouge le curseur de quantité.
3. Ajoute au panier, va sur `/panier`, puis **Commander**.
4. Reviens sur `/pro/commandes` : la commande est là, avec ses suites possibles.

**Comment savoir** : la commande arrive côté pro, et `/commande/AK-…` affiche le
reçu imprimable.

---

## F. Recruter deux ou trois vrais dépôts — la vraie étape

**Où** : au téléphone, puis envoie-leur
https://akora.fonenako.mg/devenir-fournisseur

**Pourquoi c'est la seule qui compte** : un comparateur avec un seul fournisseur
ne compare rien. Le site devient utile à partir de **deux offres sur le même
matériau**, et la page « prix du marché » ne se publie qu'à partir de trois.

Vise trois dépôts sur un même produit courant — ciment, sable de rivière ou
parpaing 15 — plutôt que dix dépôts sur dix produits différents.

**Argument à leur donner** : Akora ne prend rien sur la livraison, 3 % sur les
matériaux, pas d'abonnement. Et leur transport court devient un avantage au lieu
d'être invisible.

---

## G. Valider leur dossier de vérification — à leur rythme

**Où** : https://akora.fonenako.mg/admin

Les pièces arrivent dans la file « Vérifications ». Pour chacune, bouton
**« Ouvrir (lien 60 s) »** : le lien expire en une minute et chaque ouverture
écrit une ligne au journal d'audit. Valide, ou refuse **avec un motif en clair**
— le fournisseur doit savoir quoi corriger.

Six pièces obligatoires : NIF, STAT, RCS, CIN du gérant, photo du dépôt, numéro
mobile money de versement.

**Comment savoir** : à la sixième validée, le badge bleu apparaît sur sa fiche et
le paiement en ligne se débloque pour lui.

---

## H. Les numéros marchands Akora — l'envoi d'e-mails est déjà en place

**Où** : Supabase, **Edge Functions → Secrets**.

Les numéros mobile money d'Akora, ceux sur lesquels les acheteurs enverront
l'argent :

```
AKORA_MSISDN_MVOLA=+26134...
AKORA_MSISDN_ORANGE=+26132...
AKORA_MSISDN_AIRTEL=+26133...
```

Puis dis-le-moi, je relance le déploiement des fonctions.

**Pourquoi maintenant** : le paiement par référence saisie fonctionne **dès
aujourd'hui**, sans contrat marchand. Sans ces numéros, il affiche « opérateur
non configuré ».

---

## I. Les API marchandes — quand tu voudras automatiser

**Où** : les trois portails, avec ton dossier d'entreprise (NIF, STAT, RCS).

| | |
|---|---|
| MVola | [developer.mvola.mg](https://developer.mvola.mg/devportal/) |
| Orange Money | [demande marchand](https://developer.orange.com/products/payment-financial-services/apply-orange-money/) |
| Airtel Money | [developers.airtel.africa](https://developers.airtel.africa/) |

Tu me transmets les identifiants, je les mets dans les secrets. Le basculement
est automatique : dès que `BASE_URL`, `CLIENT_ID` et `CLIENT_SECRET` d'un
opérateur sont présents, Akora cesse de demander la référence à la main.

Détail complet dans `docs/PAIEMENT-MOBILE-MONEY.md`.

**Ce qui ne change pas** : le séquestre. L'argent reste retenu jusqu'à la
confirmation de livraison, webhook ou pas.

---

## J. Les notifications push — optionnel, 2 minutes

Dis-le-moi et je lance `node scripts/generer-vapid.mjs`. Rien à acheter : c'est
une paire de clés fabriquée en local. La publique va dans le bundle, la privée
dans les secrets Supabase.

---

## K. La tâche quotidienne — à programmer une fois

**Quoi** : un appel par jour à `paiement-reconciliation`. Elle expire les
paiements abandonnés, **libère les séquestres 72 heures après livraison** sans
contestation, et recalcule les badges « Partenaire ».

**Où** : au choix, le planificateur d'o2switch ou `pg_cron` dans Supabase.
Dis-moi lequel tu préfères, je le mets en place. Il faut d'abord un secret
`AKORA_CRON_SECRET` : cette fonction bouge de l'argent, elle refuse tout appel
non signé.

**Tant que ce n'est pas fait** : les séquestres se libèrent quand même, mais
seulement quand l'acheteur confirme lui-même sa réception.

---

## En résumé

| Étape | Où | Bloquant |
|---|---|---|
| ~~**A** AutoSSL~~ | cPanel | ✅ fait |
| ~~**B** URL d'authentification~~ | Supabase | ✅ fait |
| ~~**C** Ton compte, puis rôle admin~~ | fait par script | ✅ fait |
| **D** Ton premier dépôt | `/pro` | non |
| **E** Test de bout en bout | le site | non |
| **F** Recruter 2-3 dépôts | téléphone | c'est la vraie étape |
| **G** Valider leurs dossiers | `/admin` | à leur rythme |
| **H** Numéros marchands Akora | Supabase, Secrets | avant tout paiement |
| **I** API marchandes | 3 portails | plus tard |
| **J** Clés VAPID | moi | optionnel |
| **K** Tâche quotidienne | o2switch ou pg_cron | avant les vraies ventes |

**Commence par A, B, C. Ensuite dis-moi « c'est fait » avec ton e-mail, et je te
passe administrateur.**

---

## Mise à jour du 22/08/2026, 22 h — authentification

Ce qui a changé, et ce qu'il vous reste à faire.

### Corrigé sans action de votre part

**L'inscription se validait toute seule.** La page de confirmation lisait
`email_confirmed_at`, que Supabase remplit *dès l'inscription* quand on
désactive sa confirmation native — elle affichait donc « Adresse confirmée » à
des comptes n'ayant jamais vu le moindre code. Elle lit désormais
`profiles.email_verifie`, qui n'est écrit que par la saisie du code.

**Votre navigateur exécutait la version de la veille.** Le service worker
attendait la fermeture de *tous* les onglets pour céder la place. Sur un
téléphone, cela n'arrive jamais. Il prend la main immédiatement, et un onglet
resté ouvert se recharge de lui-même à la version suivante.

**La vérification est devenue obligatoire.** Sans adresse confirmée, plus
d'accès à `/compte`, `/pro` ni à l'administration — et le paiement en ligne
refusait déjà côté serveur.

**Mot de passe oublié** passe par un code à six chiffres, notre SMTP et notre
gabarit, comme l'inscription. Le lien natif de Supabase partait d'un domaine
inconnu du destinataire : il finissait en indésirables.

### Ce qu'il reste à faire : activer Google (15 minutes)

1. Ouvrez **console.cloud.google.com** → créez un projet (« Akora »).
2. **APIs et services → Écran de consentement OAuth** : externe, nom « Akora »,
   assistance `akora@akora.fonenako.mg`, domaine `akora.fonenako.mg`.
3. **Identifiants → Créer → ID client OAuth → Application Web** :
   - Origine JavaScript autorisée : `https://akora.fonenako.mg`
   - URI de redirection autorisée : celle que la commande ci-dessous affiche.
     C'est l'adresse de **Supabase**, pas celle du site — Google renvoie vers
     Supabase, qui pose la session et nous ramène ensuite.
4. Copiez l'identifiant et le secret, puis :

```bash
npm run google                              # affiche l'URI à coller, sans rien changer
npm run google -- <client_id> <client_secret>
```

Le bouton « Continuer avec Google » **apparaît tout seul** sur l'inscription et
la connexion : il interroge la configuration avant de s'afficher. Tant que rien
n'est renseigné, il n'existe pas — plutôt qu'un bouton qui mène à une erreur.

Un compte créé par Google est vérifié d'emblée : Google a déjà prouvé
l'adresse, la redemander serait une cérémonie.

---

## Mise à jour du 22/08/2026, 23 h — le fil, les push et le cron

### Fait, sans action de votre part

**L'accueil est devenu un fil.** Dépôts et acheteurs y publient ; le prix rendu
chantier est calculé sur chaque carte depuis votre point de livraison.
Deux écrans nouveaux : `/pro/publier` et `/demandes/nouvelle`.

**Les notifications push fonctionnent.** Les clés VAPID sont générées et
déposées dans les secrets ; suivre un dépôt déclenche une notification à
chacune de ses publications. La clé publique est dans le bundle — c'est son
rôle ; la privée n'a jamais quitté `~/.akora-secrets/vapid.txt` et les secrets
Supabase.

**Un bug qui aurait bloqué le lancement.** Aucun produit ne pouvait être créé :
un déclencheur d'historique de prix s'exécutait avant l'insertion et référençait
une ligne qui n'existait pas encore. Corrigé et vérifié.

### ~~K.~~ Le cron — deux lignes à coller dans cPanel

C'est la dernière pièce technique, et elle vous prend deux minutes.

**cPanel → Tâches Cron → Ajouter une tâche Cron.**

Le secret d'appel est dans `~/.akora-secrets/vapid.txt`, ligne
`AKORA_CRON_SECRET`. Remplacez `<SECRET>` par sa valeur, et `<PROJET>` par la
référence Supabase (visible dans `~/.akora-secrets/supabase.txt`).

**1. Les notifications push, chaque minute :**

```
* * * * * curl -s -X POST -H "x-akora-secret: <SECRET>" https://<PROJET>.supabase.co/functions/v1/envoyer-push > /dev/null
```

**2. La réconciliation des paiements, chaque jour à 3 h :**

```
0 3 * * * curl -s -X POST -H "x-akora-secret: <SECRET>" https://<PROJET>.supabase.co/functions/v1/paiement-reconciliation > /dev/null
```

Pourquoi le cron plutôt qu'un déclencheur de base : appeler la fonction depuis
un trigger SQL obligerait à écrire ce secret **en clair dans la base**. Une
minute de latence sur l'annonce d'une baisse de parpaing n'a jamais fait perdre
une vente ; un secret en base, si.

### Ce qui reste, et qui ne dépend plus que de vous

| | |
|---|---|
| **D** | Créer votre dépôt sur `/pro` — débloqué, le bug est corrigé |
| **E** | Tester la boucle complète : publier, commander, payer |
| **F** | **Recruter 2-3 vrais dépôts** — le fil restera vide sans eux |
| **G** | Valider leurs dossiers de vérification |
| **I** | Identifiants marchands MVola / Orange / Airtel |
| **Google** | Créer l'ID client (voir la section précédente), puis `npm run google` |
| **MX** | Ajouter un enregistrement MX sur `akora.fonenako.mg`, sinon personne ne peut répondre à `akora@akora.fonenako.mg` |
