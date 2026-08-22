# Brancher le projet Supabase d'Akora — 5 minutes

Tu as créé un **compte Supabase séparé** pour Akora. Mon accès automatique (le connecteur
Supabase de Claude) est rattaché à l'ancien compte : je **ne vois pas** ton nouveau projet.
Il me faut donc quatre valeurs, que tu vas récupérer ci-dessous.

> **Aucune de ces valeurs ne sera écrite dans le dépôt.** Elles vont dans
> `C:\Users\ANDRIANIRINA\.akora-secrets\` (hors dépôt) et dans `.env.local` (ignoré par git).

---

## 1. Créer le projet (si ce n'est pas déjà fait)

Sur https://supabase.com/dashboard → **New project**.

| Champ | Valeur à saisir |
|---|---|
| Name | `Akora` |
| Database Password | génère-en un long, **et garde-le** — j'en ai besoin (valeur ④) |
| Region | **West EU (Paris)** — `eu-west-3` |
| Plan | Free suffit pour démarrer |

> **Pourquoi Paris et pas Singapour ?** Le trafic Internet malgache sort par les câbles
> EASSy / LION / METISS et transite par Marseille : Paris est le point de peering le plus
> proche en temps de réponse. Fonenako est à Singapour pour des raisons historiques ;
> pour Akora, Paris est le bon choix. Dis-le-moi si tu préfères autre chose — c'est
> irréversible après création.

---

## 2. Les quatre valeurs à me donner

### ① L'URL du projet
`Dashboard → Project Settings → General → Project URL`
Ça ressemble à : `https://abcdefghijklmnop.supabase.co`

### ② La clé publique (anon / publishable)
`Dashboard → Project Settings → API Keys`
Prends la clé marquée **`anon` / `public`** (ou **`sb_publishable_…`** dans la nouvelle
interface).

> ⚠️ **Ne me donne JAMAIS la clé `service_role`** (ni `sb_secret_…`). Elle contourne toute
> la sécurité RLS. Si tu me l'envoies par erreur, va immédiatement la faire tourner
> (*Rotate*) dans le tableau de bord. Le navigateur d'Akora n'utilisera que la clé anon.

### ③ Un jeton d'accès personnel (pour que j'applique les migrations)
`https://supabase.com/dashboard/account/tokens` → **Generate new token**
Nom : `akora-cli`. Copie la valeur `sbp_…` — elle ne s'affiche **qu'une seule fois**.

C'est ce jeton qui me permet de faire, sans que tu aies à copier-coller du SQL :
- appliquer les ~15 migrations (tables, RLS, triggers, vues) ;
- **générer** les types TypeScript (jamais écrits à la main, règle A7) ;
- déployer les 4 Edge Functions de paiement ;
- créer le bucket privé `kyc`.

### ④ Le mot de passe de la base
Celui saisi à l'étape 1. Si tu l'as perdu :
`Project Settings → Database → Reset database password`.

---

## 3. Où déposer ces valeurs

Crée le dossier et le fichier suivants **en dehors du dépôt** :

```
C:\Users\ANDRIANIRINA\.akora-secrets\supabase.txt
```

avec exactement ces quatre lignes :

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_DB_PASSWORD=...
```

Puis dis-moi simplement « **c'est déposé** ». Je m'occupe du reste :
je fabrique `.env.local`, je lie le projet, j'applique les migrations, je génère les types.

> Si tu préfères ne pas déposer le jeton ③ : donne-moi seulement ① et ②, et je te
> fournirai un unique fichier `supabase/migrations-a-coller.sql` à exécuter toi-même
> dans le **SQL Editor** du tableau de bord. C'est plus long mais aucun jeton ne circule.

---

## 4. Deux réglages à faire dans le tableau de bord (je ne peux pas les faire à ta place)

1. **Authentication → URL Configuration**
   - *Site URL* : `https://akora.fonenako.mg`
   - *Redirect URLs* : ajoute `https://akora.fonenako.mg/**` et `http://localhost:8080/**`
   Sans ça, les liens de confirmation d'e-mail renvoient vers `localhost:3000`.

2. **Authentication → Providers → Email**
   - *Confirm email* : **activé** (Akora exige un e-mail vérifié pour payer).

---

## 5. Ce qui reste chez toi, jamais chez moi

| Secret | Où il vit | Pourquoi pas dans le dépôt |
|---|---|---|
| `service_role` | nulle part, jamais | contourne la RLS |
| Identifiants marchands Mvola / Orange / Airtel | secrets des Edge Functions | règle A2.5 |
| Mot de passe FTP o2switch | `~/.deploy-sites/ftp_deploy.py` | déjà en place |
| Clé de l'API d'envoi de photos | `~/.akora-secrets/` côté serveur | règle A2.5 |
