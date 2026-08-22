# Partie serveur d'Akora (o2switch)

Le site est une SPA statique : ce dossier contient les **trois seuls fichiers
PHP** qui vivent sur le serveur, et le durcissement du dossier des photos.

| Fichier | Destination sur o2switch | Rôle |
|---|---|---|
| `api/env.php` | `akora.fonenako.mg/api/env.php` | charge les secrets depuis `~/.env_akora` |
| `api/o2upload.php` | `akora.fonenako.mg/api/o2upload.php` | reçoit une photo, écrit dans `uploads/`, génère la vignette |
| `api/o2delete.php` | `akora.fonenako.mg/api/o2delete.php` | supprime une photo **et** sa vignette |
| `uploads.htaccess` | `akora.fonenako.mg/uploads/.htaccess` | aucun script ne s'exécute dans les photos |

Adaptés du code éprouvé de Fonenako. Différences : périmètre des dossiers
(`produits`, `fournisseurs`, `profils`), projet Supabase d'Akora, préfixe `ak_`.

## Ce qui n'est pas ici, et pourquoi

Les valeurs d'environnement sont **retirées de cette copie versionnée**. Sur le
serveur, elles vivent dans `/home2/<login>/.env_akora`, **hors racine web** et
hors dépôt — un déploiement FTP n'écrase que le docroot, donc le fichier
survit :

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
O2SWITCH_UPLOAD_API_KEY=...
```

La clé d'API sert aux imports en masse (sans compte connecté). Son miroir local
est dans `~/.akora-secrets/o2switch.txt`.

## Garde-fous déjà en place

- **Authentification obligatoire** : jeton Supabase validé auprès de
  `/auth/v1/user`, ou clé d'API serveur.
- **Anti-IDOR** : un compte connecté n'écrit et ne supprime que sous
  `uploads/<dossier>/<son id>/`.
- **Contenu vérifié** : extension *et* magic bytes. Un `.js` renommé `.jpg` est
  refusé.
- **Aucune exécution** dans `uploads/` : moteur PHP coupé, handlers retirés,
  listing interdit.
- **Vignette** `.thumb.webp` 480 px générée à l'envoi (mesuré : un PNG de
  102 Ko donne une vignette de 1,7 Ko), et supprimée avec l'original.
