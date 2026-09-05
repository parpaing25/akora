-- ═══════════════════════════════════════════════════════════════════════════
-- Correctifs X-02, X-10, Q-06 — durcissement de deux fonctions SECURITY DEFINER
-- et un index manquant. Audit akora.fonenako.mg du 05/09/2026.
--
-- À poser comme migration : supabase/migrations/20260906090000_durcissement_quota_vues.sql
-- puis `npx supabase db push` — ou coller dans l'éditeur SQL du tableau de bord.
-- (Une écriture de production depuis une session Claude peut être refusée : la
--  migration est écrite ici, Andry l'applique.)
--
-- Relevé avant correction (SQL du 05/09) :
--   · 23 fonctions SECURITY DEFINER exécutables par `anon` ; 21 vérifient leurs
--     droits dans leur corps, deux ne vérifient rien :
--   · consommer_quota(text,text,int)  → écrit dans rate_limits pour N'IMPORTE
--     QUELLE clé : un visiteur peut épuiser le quota d'un autre (IP, e-mail,
--     numéro) et lui faire refuser sa commande ou son code — déni de service
--     ciblé et gratuit. Seules les Edge Functions l'appellent, avec la clé
--     service_role (_commun.ts:66).
--   · compter_vue_produit(uuid)       → incrémente un compteur pour n'importe
--     quel uuid, même inexistant, sans plafond : pollution de la table
--     vues_produit_jour et statistiques fournisseur gonflables.
--   · fil_publications.publie_le      → aucun index alors que le fil trie dessus.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── X-02 · consommer_quota : réservée au service ────────────────────────────
revoke execute on function public.consommer_quota(text, text, integer) from public;
revoke execute on function public.consommer_quota(text, text, integer) from anon;
revoke execute on function public.consommer_quota(text, text, integer) from authenticated;
grant  execute on function public.consommer_quota(text, text, integer) to service_role;

comment on function public.consommer_quota(text, text, integer) is
  'Compteur glissant par heure. Réservée à service_role (Edge Functions) depuis le 06/09/2026 : exécutable par anon, elle permettait d''épuiser le quota d''un tiers.';

-- ── X-10 · compter_vue_produit : produit actif seulement, plafond journalier ─
create or replace function public.compter_vue_produit(_produit_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Un produit qui n'est pas actif (ou n'existe pas) ne se compte pas :
  -- avant, n'importe quel uuid créait une ligne.
  if not exists (
    select 1 from public.produits p where p.id = _produit_id and p.statut = 'actif'
  ) then
    return;
  end if;

  insert into public.vues_produit_jour (produit_id, jour, vues)
  values (_produit_id, (now() at time zone 'Indian/Antananarivo')::date, 1)
  on conflict (produit_id, jour)
  -- Plafond : 100 000 vues/jour/produit. Au-delà c'est un robot, pas un client,
  -- et le compteur n'est plus une information.
  do update set vues = least(public.vues_produit_jour.vues + 1, 100000);
end;
$$;

comment on function public.compter_vue_produit(uuid) is
  'Compteur de vues agrégé par jour (politique de confidentialité : jamais une ligne par visite). Gardé le 06/09/2026 : produit actif seulement, plafond 100 000/jour.';

-- ── Q-06 · index manquant sur le tri du fil ────────────────────────────────
create index if not exists fil_publications_publie_le_idx
  on public.fil_publications (publie_le desc);

-- ── Hygiène : purge des fenêtres de quota (table rate_limits, 9 lignes aujourd'hui,
--    une par clé et par heure : sans purge elle grossit indéfiniment) ─────────
select cron.schedule(
  'akora-purge-rate-limits',
  '30 4 * * *',
  $$delete from public.rate_limits where fenetre < now() - interval '2 days'$$
);

commit;

-- ── Contrôle après application ─────────────────────────────────────────────
-- select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') anon_exec
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname in ('consommer_quota', 'compter_vue_produit');
-- attendu : consommer_quota → false ; compter_vue_produit → true
--
-- select public.compter_vue_produit('00000000-0000-0000-0000-000000000000');
-- select count(*) from public.vues_produit_jour where produit_id = '00000000-0000-0000-0000-000000000000';
-- attendu : 0
--
-- node scripts/verifier-securite.mjs   → toujours 48/48 tables sous RLS
