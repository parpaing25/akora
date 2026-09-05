-- ═══════════════════════════════════════════════════════════════════════════
-- Correctif F-04 — données de test en production (P1, barème 2.8 : −10)
-- Audit akora.fonenako.mg du 05/09/2026.
--
-- Relevé (SQL) : auth.users contient recette.akora.1787421700@example.com
--   (créé et connecté le 22/08/2026, jamais depuis). 7 comptes au total.
-- À exécuter APRÈS la campagne de tests manuels de la checklist (J-3), qui
-- se sert encore de ce compte, et AVANT l'ouverture publique (J0).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Ce que le compte possède (RESTRICT sur fournisseurs.owner_id et litiges.ouvert_par
--    ferait échouer la suppression : on regarde d'abord).
select
  u.id,
  (select count(*) from public.fournisseurs f where f.owner_id = u.id)      as depots,
  (select count(*) from public.commandes c where c.acheteur_id = u.id)      as commandes,
  (select count(*) from public.litiges l where l.ouvert_par = u.id)         as litiges,
  (select count(*) from public.publications p where p.auteur_id = u.id)     as publications,
  (select count(*) from public.avis a where a.auteur_id = u.id)             as avis
from auth.users u
where u.email like '%@example.com' or u.email ilike 'recette.%' or u.email ilike 'test%';

-- 2. Si tout est à 0 (ou seulement des commandes de test) : suppression.
--    Les CASCADE effacent profil, favoris, adresses, notifications, rôles, avis.
--    Un dépôt de test rattaché se supprime AVANT (delete from public.fournisseurs where owner_id = …).
begin;
delete from public.commandes
 where acheteur_id in (select id from auth.users where email like '%@example.com');   -- commandes de recette : pas de comptabilité à garder
delete from auth.users
 where email like '%@example.com' or email ilike 'recette.%';
commit;

-- 3. Autres traces de recette à passer en revue (lecture seule, décision humaine) :
select id, type, left(texte, 80) texte, publie_le from public.fil_publications order by publie_le desc;         -- une publication « test » ?
select id, raison_sociale, slug, niveau_verification from public.fournisseurs order by created_at;             -- un dépôt fictif ?
select count(*) filter (where produit_id not in (select id from public.produits)) as vues_orphelines from public.vues_produit_jour;  -- après X-10 : 0 attendu

-- 4. Contrôle
select count(*) as comptes_test_restants from auth.users where email like '%@example.com' or email ilike 'recette.%';   -- 0
