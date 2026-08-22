-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 24. Abonnements push
-- ═══════════════════════════════════════════════════════════════════════════
-- Une ligne par navigateur abonné. L'envoi reel exige une paire de cles VAPID,
-- qui vivra dans les secrets des Edge Functions — jamais dans le depot.

create table if not exists public.abonnements_push (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  cle_p256dh  text not null,
  cle_auth    text not null,
  agent       text,
  created_at  timestamptz not null default now(),
  vu_le       timestamptz not null default now()
);
create index if not exists idx_push_user on public.abonnements_push(user_id);

alter table public.abonnements_push enable row level security;
revoke all on public.abonnements_push from anon;

drop policy if exists "abonnements push prives" on public.abonnements_push;
create policy "abonnements push prives" on public.abonnements_push
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.abonnements_push to authenticated;
grant select, delete on public.abonnements_push to service_role;

comment on table public.abonnements_push is
  'Abonnements Web Push. Un endpoint expire silencieusement : la tache d''envoi supprime les lignes rejetees en 404 ou 410.';
