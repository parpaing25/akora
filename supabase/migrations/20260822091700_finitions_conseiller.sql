-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 18. Dernieres finitions signalees par le conseiller
-- ═══════════════════════════════════════════════════════════════════════════

-- Doublon de ma part : la migration 14 a recree un index deja pose en 04.
drop index if exists public.idx_fournisseurs_owner_fk;

-- `rls_auto_enable` est une fonction de la PLATEFORME Supabase (elle porte le
-- declencheur evenementiel `ensure_rls`, qui active la RLS sur toute nouvelle
-- table de `public`). On ne la modifie pas — on lui retire seulement le droit
-- d'execution accorde par defaut a tout le monde. Le declencheur, lui, tourne
-- sous l'identite de son proprietaire et n'en depend pas.
do $$ begin
  execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
exception when undefined_function then null; end $$;

-- ── Ce qui reste signale, et qui est voulu ────────────────────────────────
-- Trois vues en SECURITY DEFINER. Le conseiller les remonte en ERREUR parce
-- que, dans le cas general, une telle vue contourne la RLS de ses tables.
-- C'est precisement ce qu'on lui demande ici : exposer une PROJECTION sure
-- (sans telephone, sans e-mail, sans adresse exacte, sans piece KYC) alors
-- que les tables sous-jacentes restent fermees a anon, au niveau des GRANT
-- comme au niveau des politiques. L'alternative — ouvrir `fournisseurs` en
-- lecture publique et compter sur la liste des colonnes du client — est
-- exactement l'erreur que la spec interdit.
comment on view public.fournisseurs_publics is
  'SECURITY DEFINER VOULU. Projection publique des fournisseurs actifs : ni telephone, ni e-mail, ni adresse exacte, ni numero de versement. La table fournisseurs reste revoquee pour anon.';
comment on view public.produits_publics is
  'SECURITY DEFINER VOULU. Produits publies de fournisseurs actifs, sans donnee personnelle. Un produit en attente de reference n''y figure jamais.';
comment on view public.prix_marche is
  'SECURITY DEFINER VOULU. Agregat de prix par materiau et par localite, publie a partir de 3 offres actives seulement.';
