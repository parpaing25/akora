-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 19. Trois tables encore atteignables par un visiteur
-- ═══════════════════════════════════════════════════════════════════════════
-- Constat du controle de recette (scripts/verifier-securite.mjs) : `profiles`,
-- `user_roles` et `audit_log` repondaient 200 avec une liste VIDE a la cle
-- anon. Aucune donnee ne sortait — la RLS filtrait tout — mais le droit de
-- lecture au niveau des GRANT etait toujours la.
--
-- Ce n'est pas une nuance theorique : le jour ou quelqu'un ajoutera une
-- politique un peu large sur l'une de ces tables, la difference entre « aucune
-- ligne ne passe le filtre » et « le visiteur n'a meme pas le droit de
-- demander » sera exactement la difference entre une fuite et un refus.

revoke all on public.profiles from anon;
revoke all on public.user_roles from anon;
revoke all on public.audit_log from anon;
