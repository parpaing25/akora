# Correctif X-01 / O-01 — zéro sauvegarde de la base, zéro plan de retour arrière (P0)

**Constat** (API Management, 05/09/2026) : projet `lvhnqrnmkajhlohympcs` sur le plan **Free** : `database/backups` → aucune sauvegarde, PITR désactivé. Une migration ratée, un `delete` sans `where`, un compte compromis ou une suspension du projet (le plan Free **met en pause** un projet inactif 7 jours) = perte du catalogue (6 fournisseurs, 40 produits, 112 formats, 4 matériaux de référence… 21 Mo) et de tout l'historique dès qu'il y aura des commandes. Les photos ne sont pas dans Supabase mais sur o2switch (`/uploads`), sans sauvegarde non plus (NON VÉRIFIÉ : o2switch propose des sauvegardes hebdomadaires cPanel — à confirmer dans *Sauvegardes* du cPanel).

Le barème 2.2 compte « backups automatiques testés (restauration réellement essayée), plan de rollback » ; 2.11 exige un test **mensuel scripté**. Rien n'existe.

**Trois options**, cumulables :

| | A. GitHub Actions nocturne (retenue, gratuit) | B. Cron sur le VPS des bots (gratuit) | C. Supabase Pro |
|---|---|---|---|
| Quoi | `pg_dump` chaque nuit, chiffré, gardé 30 jours en artefact + copie Google Drive ; **restauration testée chaque mois** dans un Postgres jetable | Même script, sur la machine qui héberge déjà Hermes | Sauvegardes quotidiennes 7 jours, incluses ; PITR en supplément |
| Coût | 0 (dépôt privé : 2 000 min/mois inclus, ~3 min/nuit) | 0 | **25 $/mois** (+ 100 $/mois pour PITR) |
| Délai | 2 h | 1 h | 10 min |
| Limite | Dépend de GitHub ; la chaîne DB doit passer par le *pooler* (IPv4) | Dépend d'une machine à soi | Ne couvre pas les photos ; restauration = ticket ou bouton, pas testée par nous |

Recommandation : **A maintenant** (avant le lancement), **C dès le premier paiement réel** (le séquestre d'argent d'autrui justifie 25 $/mois), A reste en second filet.

**Effort** : 2 h + 30 min de test de restauration.

---

## A1. Secrets GitHub (dépôt **privé** — vérifier : Settings › General › Visibility)

| Secret | Valeur | Où la trouver |
|---|---|---|
| `SUPABASE_DB_URL` | `postgresql://postgres.lvhnqrnmkajhlohympcs:<mot de passe>@aws-0-<region>.pooler.supabase.com:5432/postgres` | Dashboard › Connect › **Session pooler** (IPv4 ; l'adresse directe `db.<ref>.supabase.co` est IPv6 seulement, les runners GitHub n'en ont pas) |
| `SAUVEGARDE_PASSPHRASE` | 32+ caractères aléatoires, **gardée aussi dans le coffre d'Andry** (sans elle l'archive est illisible) | `openssl rand -base64 32` |
| `GDRIVE_RCLONE_CONF` (optionnel) | contenu de `rclone.conf` avec un remote `drive:` | `rclone config` sur le PC, puis `rclone config show` |

## A2. `.github/workflows/sauvegarde-nocturne.yml`

```yaml
name: Sauvegarde nocturne de la base Akora
on:
  schedule:
    - cron: "30 22 * * *"        # 01:30 à Antananarivo (UTC+3)
  workflow_dispatch:

jobs:
  sauvegarder:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Client Postgres 16 (même majeure que Supabase)
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y -qq postgresql-client-16 age
      - name: pg_dump (schémas public + auth, sans les tables internes de Supabase)
        env:
          URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          set -euo pipefail
          nom="akora-$(date -u +%Y%m%d-%H%M).dump"
          pg_dump "$URL" --format=custom --no-owner --no-privileges \
            --schema=public --schema=auth \
            --exclude-table-data='auth.audit_log_entries' \
            --exclude-table-data='public.rate_limits' \
            --file="$nom"
          # Deux contrôles AVANT de déclarer la sauvegarde bonne (le code de retour ne suffit pas) :
          taille=$(stat -c %s "$nom"); [ "$taille" -gt 200000 ] || { echo "archive trop petite : $taille o"; exit 1; }
          tables=$(pg_restore --list "$nom" | grep -c "TABLE DATA public"); [ "$tables" -ge 45 ] || { echo "seulement $tables tables : anormal (48 attendues)"; exit 1; }
          echo "archive $nom : $taille octets, $tables tables"
          echo "NOM=$nom" >> "$GITHUB_ENV"
      - name: Chiffrer (age, phrase secrète)
        env:
          PASS: ${{ secrets.SAUVEGARDE_PASSPHRASE }}
        run: |
          set -euo pipefail
          printf '%s' "$PASS" | age --passphrase --output "$NOM.age" "$NOM" 2>/dev/null || \
          AGE_PASSPHRASE="$PASS" age -p -o "$NOM.age" "$NOM"
          shred -u "$NOM"
      - name: Garder 30 jours dans GitHub
        uses: actions/upload-artifact@v4
        with:
          name: ${{ env.NOM }}
          path: ${{ env.NOM }}.age
          retention-days: 30
      - name: Copie Google Drive (si configuré)
        if: ${{ secrets.GDRIVE_RCLONE_CONF != '' }}
        env:
          CONF: ${{ secrets.GDRIVE_RCLONE_CONF }}
        run: |
          curl -fsSL https://rclone.org/install.sh | sudo bash >/dev/null
          mkdir -p ~/.config/rclone && printf '%s' "$CONF" > ~/.config/rclone/rclone.conf
          rclone copy "$NOM.age" "drive:Sauvegardes Akora/" --quiet
          rclone delete "drive:Sauvegardes Akora/" --min-age 90d --quiet   # garde 90 jours
```

`age --passphrase` lit la phrase sur le terminal : selon la version, l'une des deux formes ci-dessus fonctionne ; la première qui passe gagne, le `shred` ne s'exécute qu'après. Sortie attendue dans le journal : `archive akora-…dump : N octets, 48 tables`.

## A3. `.github/workflows/test-restauration-mensuel.yml` — la sauvegarde n'existe que si on l'a restaurée

```yaml
name: Test de restauration (mensuel)
on:
  schedule:
    - cron: "0 3 1 * *"          # le 1er du mois, 06:00 Antananarivo
  workflow_dispatch:

jobs:
  restaurer:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 5s --health-retries 20
    steps:
      - name: Outils
        run: sudo apt-get update -qq && sudo apt-get install -y -qq postgresql-client-16 age jq
      - name: Dernière archive
        env: { GH_TOKEN: ${{ github.token }} }
        run: |
          set -euo pipefail
          id=$(gh api "repos/${{ github.repository }}/actions/artifacts?per_page=50" --jq '[.artifacts[] | select(.name|startswith("akora-")) | select(.expired==false)] | sort_by(.created_at) | last | .id')
          [ -n "$id" ] && [ "$id" != "null" ] || { echo "aucune archive"; exit 1; }
          gh api "repos/${{ github.repository }}/actions/artifacts/$id/zip" > archive.zip && unzip -o archive.zip
          ls -la *.age
      - name: Déchiffrer et restaurer dans le Postgres jetable
        env: { PASS: ${{ secrets.SAUVEGARDE_PASSPHRASE }} }
        run: |
          set -euo pipefail
          f=$(ls *.age | head -1)
          AGE_PASSPHRASE="$PASS" age -d -o restauree.dump "$f" 2>/dev/null || printf '%s' "$PASS" | age -d -o restauree.dump "$f"
          export PGPASSWORD=test
          psql -h localhost -U postgres -c "create role anon; create role authenticated; create role service_role; create role supabase_admin; create role authenticator;" || true
          psql -h localhost -U postgres -c "create extension if not exists pgcrypto; create extension if not exists \"uuid-ossp\";"
          # auth.* dépend d'extensions Supabase : on restaure public seulement pour le test.
          pg_restore -h localhost -U postgres -d postgres --no-owner --no-privileges --schema=public restauree.dump || true
      - name: Compter ce qui doit être là (invariants, pas des valeurs figées)
        run: |
          set -euo pipefail
          export PGPASSWORD=test
          n=$(psql -h localhost -U postgres -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")
          f=$(psql -h localhost -U postgres -tAc "select count(*) from public.fournisseurs")
          p=$(psql -h localhost -U postgres -tAc "select count(*) from public.produits")
          echo "tables=$n fournisseurs=$f produits=$p"
          [ "$n" -ge 45 ] && [ "$f" -ge 1 ] && [ "$p" -ge 1 ] || { echo "restauration incomplète"; exit 1; }
```

Un échec de ce workflow envoie un courriel GitHub à Andry : c'est **l'alerte** « la sauvegarde ne vaut rien ».

## A4. Photos (o2switch `/uploads`) — hebdomadaire

Ajouter au workflow nocturne, le dimanche seulement (`if: github.event.schedule == …` ou un second workflow) : `lftp -e "mirror --only-newer /public_html/uploads ./uploads; quit" -u $FTP_USER,$FTP_PASS ftp.o2switch…` puis `tar czf` + `age` + artefact 30 jours. Volume actuel faible (quelques dizaines de Mo) ; à surveiller.

## A5. Plan de retour arrière (O-01) — à imprimer

| Panne | Geste | Durée |
|---|---|---|
| Déploiement front cassé | `node scripts/deployer.mjs` depuis le **tag précédent** (`git checkout v2026.09.06 && npm run build && …`) — les tags n'existent pas encore : poser `v<date>` à chaque déploiement (07-checklist) | 10 min |
| Migration SQL ratée | Écrire la migration inverse **avant** d'appliquer (chaque migration du dossier 03 en a une en commentaire) ; sinon restaurer l'archive de la nuit dans un projet Supabase neuf et rebrancher `VITE_SUPABASE_URL` | 15 min / 2 h |
| Projet Supabase en pause (Free, 7 jours d'inactivité) | Dashboard › Restore ; le cron `akora-push` (chaque minute) compte comme activité : le risque est faible tant qu'il tourne | 5 min |
| Compromission de la clé service_role | Dashboard › API › régénérer ; redéployer les Edge Functions ; le bot de collecte (`bot-fournisseurs`) a la clé dans ses secrets : le mettre à jour | 30 min |

## Vérification

`workflow_dispatch` une première fois → artefact présent, journal « 48 tables » ; puis lancer le test de restauration à la main → vert. Noter la date dans `07-checklist-lancement.md` (J-5).
