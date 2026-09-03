-- ═══════════════════════════════════════════════════════════════════════════
-- Durcissement des droits (03/09/2026) — relevé de sécurité du site
--
-- Ce que le relevé a montré (API de gestion, lecture seule) :
--   · RLS est activé sur les 47 tables, aucune policy n'ouvre une ÉCRITURE à
--     anon — et pourtant anon détient INSERT, UPDATE, DELETE, TRUNCATE,
--     REFERENCES et TRIGGER sur 23 tables et vues : ce sont les droits que
--     Supabase accorde par défaut à la création. RLS retient les lignes, mais
--     TRUNCATE n'est pas soumis à RLS, et un droit qu'on ne veut pas exercer
--     ne se garde pas « au cas où ».
--   · authenticated détient TRUNCATE, REFERENCES et TRIGGER sur 47 tables :
--     aucun écran ne s'en sert, PostgREST ne les expose pas.
--   · 23 fonctions sont exécutables par anon ; 8 d'entre elles exigent un
--     utilisateur connecté (elles lèvent quand auth.uid() est nul). Les lever
--     est juste ; ne pas être appelables du tout l'est davantage.
--
-- Principe : un garde-fou se pose à CHAQUE bout du chemin qu'il protège. RLS
-- est le premier ; les privilèges sont le second. Rien ici ne change ce que
-- le site FAIT — chaque droit retiré est un droit qu'aucune requête n'exerce.
-- Rejoué à blanc avant : 0 policy d'écriture anon, 0 fonction anon écrivant
-- sans lire auth.uid().
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. anon ne modifie rien, jamais : lecture seule, gouvernée par RLS.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;

-- 2. authenticated garde insert/update/delete (RLS décide), perd le reste.
revoke truncate, references, trigger
  on all tables in schema public from authenticated;

-- 3. Les tables créées demain naîtront avec les mêmes limites.
--    ⚠ Les migrations passent par l'API de gestion, donc par le rôle postgres :
--      c'est pour ce rôle que les privilèges par défaut se règlent.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;

-- 4. Les RPC qui exigent un compte ne répondent plus à anon.
--    Gardées pour anon, à dessein : annuaire_fournisseurs, observatoire_prix,
--    offres_pour_materiaux, rechercher_referentiel, compter_abonnes,
--    compter_vue_produit (le fil public compte ses vues), fiche_reservee et
--    refuser_fiche (accès par jeton, sans compte), has_role (lu par les
--    policies), taux_commission.
-- Signatures relevées dans pg_proc le 03/09/2026 (pg_get_function_identity_arguments).
revoke execute on function public.creer_demande(jsonb, uuid, double precision, double precision, text, date, text) from anon;
revoke execute on function public.fermer_demande(uuid) from anon;
revoke execute on function public.ma_demande() from anon;
revoke execute on function public.mon_fournisseur_id() from anon;
revoke execute on function public.repondre_proposition(uuid, text) from anon;
revoke execute on function public.revendiquer_fiche(text) from anon;
revoke execute on function public.demandes_pour_mon_depot() from anon;
revoke execute on function public.proposer(uuid, jsonb, bigint, integer, text) from anon;
