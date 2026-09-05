# Runbook d'incident — akora.fonenako.mg

Une page. À imprimer. Écrit le 06/09/2026 (audit O-06). Mise à jour à chaque incident réel : cause, durée, correctif, date, en bas.

## Qui

| Rôle | Qui | Joignable |
|---|---|---|
| Responsable du service | Onjaniaina Andrianirina | +261 32 72 090 33 (WhatsApp) |
| Second administrateur (à créer, avec second facteur) | — | — |
| Hébergeur site | o2switch | support via cPanel / o2switch.fr, 24 h/7 |
| Base, comptes, fonctions | Supabase (plan Free : support communautaire) | status.supabase.com |

## Où regarder, dans cet ordre

1. **Le site répond-il ?** `curl -sI https://akora.fonenako.mg/ | head -1` → attendu `HTTP/2 200`. Si 429 « tigre » : c'est l'anti-flood o2switch (demander le déblocage au support, donner l'IP). Si 5xx : cPanel › Erreurs.
2. **La base répond-elle ?** `curl -s "https://lvhnqrnmkajhlohympcs.supabase.co/rest/v1/types_vitrine?select=slug&limit=1" -H "apikey: <clé anon>"` → attendu `[{"slug":…}]`. Sinon : Dashboard Supabase › Project health, puis status.supabase.com. Projet **en pause** (Free, 7 jours d'inactivité) → Dashboard › Restore.
3. **Les fonctions ?** Dashboard › Edge Functions › Logs (`commande-creer` en premier).
4. **Le front ?** Console du navigateur sur la page qui casse ; `errors-in-console` du dernier Lighthouse (Actions › Lighthouse).
5. **Journaux d'erreurs** : Sentry si `VITE_SENTRY_DSN` est posé (aucun pour l'instant) ; sinon la frontière d'erreurs affiche « Quelque chose a cassé » et `console.error` dans le navigateur.

## Dire quelque chose aux utilisateurs (5 minutes)

Bandeau sur toutes les pages, sans déploiement :
```sql
update public.parametres set valeur = '{"actif": true, "texte": "Les paiements MVola sont vérifiés avec retard aujourd''hui : votre commande est bien enregistrée."}'::jsonb where cle = 'bandeau_incident';
-- retour :
update public.parametres set valeur = '{"actif": false, "texte": ""}'::jsonb where cle = 'bandeau_incident';
```
Visible en 5 minutes au plus (cache client). Page Facebook : un message court, factuel, avec l'heure de retour prévue.

## Les quatre pannes et le geste

| Panne | Geste | Durée |
|---|---|---|
| **Déploiement front cassé** (page blanche, erreurs console partout) | Revenir au tag précédent : `git checkout <tag précédent> -- .` puis `npm run deploy` ; vérifier le hash en ligne (`curl -s https://akora.fonenako.mg/ \| grep -o 'index-[^"]*\.js'` = `dist/index.html`) | 10 min |
| **Migration SQL ratée** | Chaque migration de `supabase/migrations/2026090610*` porte sa commande de retour arrière en commentaire ; sinon restaurer l'archive de la nuit (Actions › Sauvegarde nocturne › artefact `akora-AAAAMMJJ.dump.age`, déchiffrer avec `age -d`, `pg_restore --schema=public`) | 15 min / 2 h |
| **Site injoignable, o2switch en cause** | Créer le fichier vide `MAINTENANCE` à la racine (cPanel › Gestionnaire de fichiers) → page de maintenance en 503 ; ticket o2switch ; supprimer le fichier au retour | 5 min |
| **Clé service_role compromise** | Dashboard › Settings › API › régénérer ; redéployer les fonctions (`npm run fonctions:deploy`) ; mettre à jour le bot de collecte (`bot-fournisseurs`, ses secrets) ; vérifier `journaliser` pour les actions suspectes | 30 min |

Panne « argent » (séquestre libéré à tort, double paiement) : **ne rien corriger à la main en base** avant d'avoir exporté `paiements`, `commandes`, `audit_log` de la journée ; puis corriger par une migration nommée, avec la pièce justificative.

## Après

Compte rendu en cinq lignes, ici même : date, durée, cause racine, correctif, ce qui aurait permis de voir plus tôt. Puis une règle dans `CLAUDE.md` si une leçon en sort.

| Date | Durée | Cause | Correctif | Vu grâce à |
|---|---|---|---|---|
| — | — | — | — | — |
