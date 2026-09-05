-- R-01 → R-08, C-05 (audit du 05/09/2026) : le site n'avait ni vitals terrain,
-- ni analytics d'entonnoir, ni drapeaux de fonctionnalité, ni bandeau d'incident.
-- Trois tables sans aucune donnée personnelle, écrites par RPC gardées :
--   · vitals      : LCP/INP/CLS/FCP/TTFB réels (1 visite sur 4), purge 90 jours
--   · evenements  : étapes des parcours critiques, identifiant de session non
--                   persistant (sessionStorage), liste fermée de noms, purge 180 j
--   · parametres  : drapeaux et bandeau d'incident, lisibles par tous, écrits par l'admin
-- Retour arrière : drop table vitals, evenements, parametres cascade ; drop function …
begin;

-- ── Vitals terrain ──────────────────────────────────────────────────────────
create table if not exists public.vitals (
  id bigserial primary key,
  page text not null,
  nom text not null check (nom in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  valeur numeric not null,
  note text check (note in ('good', 'needs-improvement', 'poor')),
  connexion text,
  appareil text,
  created_at timestamptz not null default now()
);
alter table public.vitals enable row level security;   -- aucune policy : lecture par service_role seulement
create index if not exists vitals_created_idx on public.vitals (created_at);

create or replace function public.enregistrer_vital(
  _page text, _nom text, _valeur numeric, _note text, _connexion text, _appareil text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.vitals (page, nom, valeur, note, connexion, appareil)
  select left(_page, 120), _nom, _valeur, _note, left(_connexion, 10), left(_appareil, 20)
  where _nom in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')
    and _valeur between 0 and 60000
    and (_note is null or _note in ('good', 'needs-improvement', 'poor'));
$$;
revoke all on function public.enregistrer_vital(text, text, numeric, text, text, text) from public;
grant execute on function public.enregistrer_vital(text, text, numeric, text, text, text) to anon, authenticated;

-- ── Événements d'entonnoir ──────────────────────────────────────────────────
create table if not exists public.evenements (
  id bigserial primary key,
  nom text not null,
  page text,
  proprietes jsonb not null default '{}'::jsonb,
  session_id text not null,
  created_at timestamptz not null default now()
);
alter table public.evenements enable row level security;
create index if not exists evenements_created_idx on public.evenements (created_at);
create index if not exists evenements_nom_idx on public.evenements (nom, created_at);

create or replace function public.enregistrer_evenement(_nom text, _page text, _proprietes jsonb, _session_id text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if _nom is null or _nom not in (
    'voir_accueil', 'voir_type', 'voir_comparateur', 'voir_produit', 'ajouter_panier',
    'ouvrir_commander', 'commande_envoyee', 'paiement_reference_saisie',
    'voir_devenir_fournisseur', 'inscription', 'produit_publie', 'recherche', 'retour_page'
  ) then
    return;
  end if;
  if _session_id is null or length(_session_id) not between 8 and 64 then
    return;
  end if;
  -- 300 événements par session et par heure : au-delà c'est un robot.
  if not public.consommer_quota('evenement', _session_id, 300) then
    return;
  end if;
  insert into public.evenements (nom, page, proprietes, session_id)
  values (_nom, left(_page, 120), coalesce(_proprietes, '{}'::jsonb), _session_id);
end;
$$;
revoke all on function public.enregistrer_evenement(text, text, jsonb, text) from public;
grant execute on function public.enregistrer_evenement(text, text, jsonb, text) to anon, authenticated;

-- ── Paramètres : drapeaux et bandeau d'incident ─────────────────────────────
create table if not exists public.parametres (
  cle text primary key,
  valeur jsonb not null,
  maj_le timestamptz not null default now()
);
alter table public.parametres enable row level security;
drop policy if exists "parametres lisibles par tous" on public.parametres;
create policy "parametres lisibles par tous" on public.parametres
  for select to anon, authenticated using (true);
drop policy if exists "parametres modifiables par un admin" on public.parametres;
create policy "parametres modifiables par un admin" on public.parametres
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
grant select on public.parametres to anon, authenticated;
grant insert, update, delete on public.parametres to authenticated;

insert into public.parametres (cle, valeur) values
  ('bandeau_incident', '{"actif": false, "texte": ""}'::jsonb),
  ('recherche_ia', '{"actif": false, "part": 0}'::jsonb)
on conflict (cle) do nothing;

-- ── Vues pour le rapport hebdomadaire (agent d'amélioration) ────────────────
create or replace view public.rapport_vitals_7j as
  select nom, page,
         round(percentile_cont(0.75) within group (order by valeur)::numeric, 3) as p75,
         count(*) as n
    from public.vitals
   where created_at > now() - interval '7 days'
   group by nom, page;

create or replace view public.rapport_entonnoir_7j as
  select nom, count(*) as n, count(distinct session_id) as sessions
    from public.evenements
   where created_at > now() - interval '7 days'
   group by nom;

create or replace view public.rapport_recherches_vides_7j as
  select proprietes->>'q' as recherche, count(*) as n
    from public.evenements
   where nom = 'recherche' and (proprietes->>'nb_resultats')::int = 0
     and created_at > now() - interval '7 days'
   group by 1 order by 2 desc limit 20;

revoke all on public.rapport_vitals_7j, public.rapport_entonnoir_7j, public.rapport_recherches_vides_7j from anon, authenticated;

-- ── Purges ─────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'akora-purge-vitals') then
    perform cron.schedule('akora-purge-vitals', '0 5 * * 1',
      $cron$delete from public.vitals where created_at < now() - interval '90 days'$cron$);
  end if;
  if not exists (select 1 from cron.job where jobname = 'akora-purge-evenements') then
    perform cron.schedule('akora-purge-evenements', '10 5 * * 1',
      $cron$delete from public.evenements where created_at < now() - interval '180 days'$cron$);
  end if;
end $$;

commit;
