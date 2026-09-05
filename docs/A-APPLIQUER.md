# À appliquer


## Audit pré-lancement du 05/09/2026 — appliqué le 06/09/2026, reste à faire par Andry

Tout ce qui pouvait l'être sans compte tiers est en production (`docs/audit-2026-09-05/03-corrections/README.md` § État d'application). Ce qui suit demande TES comptes ou TA décision.

### Bloquant avant lancement (P0 encore ouvert)
1. **Sauvegardes** — GitHub › dépôt `parpaing25/akora` › Settings › Secrets and variables › Actions :
   - `SUPABASE_DB_URL` = chaîne « Session pooler » (Dashboard Supabase › Connect › Session pooler, IPv4) ;
   - `SAUVEGARDE_PASSPHRASE` = `openssl rand -base64 32` (à garder aussi dans ton coffre : sans elle l'archive est illisible) ;
   - puis Actions › « Sauvegarde nocturne de la base Akora » › Run workflow, et « Test de restauration (mensuel) » › Run workflow → les deux verts. Vérifier que le dépôt est **privé**.
2. **Second facteur** — te connecter, `/compte/securite` › « Second facteur » › Activer (Google Authenticator ou Aegis), puis en base :
   `update public.parametres set valeur = '{"actif": true}' where cle = 'mfa_admin_obligatoire';`
   Dès lors /admin et les fonctions de paiement exigent le code. Créer un **second administrateur** (avec son facteur) pour ne pas dépendre d'un seul téléphone.

### Courriel (sinon : codes d'inscription limités à 2/heure pour tout le site, aucune confirmation de commande)
3. Compte **Brevo** gratuit (300 mails/jour) avec `contact.fonenako@gmail.com` ; authentifier le domaine `akora.fonenako.mg` (DKIM + SPF `include:spf.brevo.com`) ; générer une clé SMTP.
4. Supabase › Authentication › SMTP Settings : host `smtp-relay.brevo.com`, port 587, expéditeur `contact@akora.fonenako.mg` ; Rate limits › e-mails : 60/h.
5. Supabase › Edge Functions › Secrets : `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER=…`, `SMTP_PASS=…`, `SMTP_FROM=contact@akora.fonenako.mg`, `SITE_URL=https://akora.fonenako.mg`. Test : inscription avec un Gmail → code < 1 min ; commande de test avec e-mail → récapitulatif reçu.
6. cPanel o2switch : créer la boîte **`contact@akora.fonenako.mg`** (ou une redirection vers le Gmail) — imprimée sur 5 pages, **son existence n'est pas vérifiée** ; ajouter `akora.fonenako.mg. MX 0 mail.fonenako.mg.` ; DMARC `_dmarc.fonenako.mg` → `v=DMARC1; p=none; rua=mailto:dmarc@fonenako.mg` une semaine, puis `p=quarantine`.

### Authentification (tableau de bord Supabase, 10 min)
7. Authentication › URL Configuration : retirer `http://localhost:*` des Redirect URLs de production.
8. Authentication › Providers › Email : longueur minimale du mot de passe 10.
9. Attack Protection › Captcha : Turnstile (compte Cloudflare gratuit) ; puis widget dans Inscription / Connexion / MotDePasseOublie (`@marsidev/react-turnstile`) et `https://challenges.cloudflare.com` dans la CSP (`script-src`, `frame-src`). Non fait côté code faute de clé.

### Décisions
10. **Délai de vérification des paiements** : la FAQ annonce « 24 heures ouvrées ». Si c'est faux, corriger `src/pages/contenu/FAQ.tsx` (question « payer »).
11. **NIF / STAT / RCS** : les mentions légales disent « communiqués sur demande écrite ». Dès que tu me les donnes, je les publie (`src/pages/contenu/MentionsLegales.tsx`, bloc `EDITEUR`).
12. **Supabase Pro (25 $/mois)** : dès le premier paiement réel encaissé.
13. **Cloudflare devant o2switch** (gratuit) : seul levier restant pour le LCP (serveur en France, clients à Madagascar) et pour remplacer l'anti-flood o2switch qui sert une page « tigre » aux robots ; à décider après une semaine de vitals réels (`select * from public.rapport_vitals_7j`).

### Recette manuelle (checklist J-3 de `docs/audit-2026-09-05/07-checklist-lancement.md`)
14. Vrai Android en 4G puis 3G : commande en invité → écran de suivi avec numéro et total ; **paiement réel de 1 000 Ar** par MVola ; suppression d'un compte de test ; TalkBack sur le parcours d'achat ; largeurs 360/414/768/1024/1536.
15. Search Console : vérifier `https://akora.fonenako.mg/`, soumettre le sitemap, « test en direct » sur `/` et une fiche produit.
16. Après la recette : purger le compte `recette.akora.1787421700@example.com` (`docs/audit-2026-09-05/03-corrections/16-donnees-de-test.sql`).
