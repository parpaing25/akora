-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 08. Avis, notifications, signalements
-- ═══════════════════════════════════════════════════════════════════════════

-- Un avis n'existe que sur une commande CLOTUREE : pas d'avis sans achat.
create table if not exists public.avis (
  id                 uuid primary key default gen_random_uuid(),
  fournisseur_id     uuid not null references public.fournisseurs(id) on delete cascade,
  auteur_id          uuid not null references auth.users(id) on delete cascade,
  commande_id        uuid not null unique references public.commandes(id) on delete cascade,
  note               smallint not null,
  commentaire        text,
  statut             public.statut_moderation not null default 'en_attente',
  reponse_fournisseur text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint avis_note_bornee check (note between 1 and 5)
);
create index if not exists idx_avis_fournisseur on public.avis(fournisseur_id, created_at desc)
  where statut = 'publie';

drop trigger if exists trg_avis_updated on public.avis;
create trigger trg_avis_updated before update on public.avis
  for each row execute function public.toucher_updated_at();

alter table public.avis enable row level security;

drop policy if exists "avis publies lisibles par tous" on public.avis;
create policy "avis publies lisibles par tous" on public.avis
  for select to anon, authenticated using (statut = 'publie');

drop policy if exists "avis lisible par son auteur son fournisseur ou un admin" on public.avis;
create policy "avis lisible par son auteur son fournisseur ou un admin" on public.avis
  for select to authenticated
  using (auteur_id = auth.uid()
         or public.est_membre_fournisseur(fournisseur_id)
         or public.has_role(auth.uid(), 'admin'));

drop policy if exists "avis depose par l acheteur d une commande cloturee" on public.avis;
create policy "avis depose par l acheteur d une commande cloturee" on public.avis
  for insert to authenticated
  with check (auteur_id = auth.uid()
              and exists (select 1 from public.commandes c
                           where c.id = commande_id
                             and c.acheteur_id = auth.uid()
                             and c.statut = 'cloturee'
                             and c.fournisseur_id = avis.fournisseur_id));

drop policy if exists "avis modere par un admin" on public.avis;
create policy "avis modere par un admin" on public.avis
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin')
         or public.est_membre_fournisseur(fournisseur_id)
         or auteur_id = auth.uid())
  with check (public.has_role(auth.uid(), 'admin')
              or public.est_membre_fournisseur(fournisseur_id)
              or auteur_id = auth.uid());

-- L'auteur corrige son texte, le fournisseur ajoute sa reponse, mais aucun
-- des deux ne publie : la moderation reste a l'admin.
create or replace function public.proteger_colonnes_avis()
returns trigger
language plpgsql
-- SECURITY INVOKER volontaire (cf. est_appel_systeme).
set search_path = public
as $$
begin
  if public.est_appel_systeme() or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  new.statut := old.statut;
  new.note := case when auth.uid() = old.auteur_id then new.note else old.note end;
  new.commentaire := case when auth.uid() = old.auteur_id then new.commentaire else old.commentaire end;
  new.reponse_fournisseur := case
    when public.est_membre_fournisseur(old.fournisseur_id) then new.reponse_fournisseur
    else old.reponse_fournisseur end;
  return new;
end;
$$;

drop trigger if exists trg_avis_colonnes_protegees on public.avis;
create trigger trg_avis_colonnes_protegees
  before update on public.avis
  for each row execute function public.proteger_colonnes_avis();

-- Note moyenne recalculee sur les seuls avis publies.
create or replace function public.recalculer_note_fournisseur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cible uuid := coalesce(new.fournisseur_id, old.fournisseur_id);
  moyenne numeric;
  total integer;
begin
  select round(avg(note)::numeric, 2), count(*)
    into moyenne, total
    from public.avis where fournisseur_id = cible and statut = 'publie';

  perform set_config('akora.systeme', 'on', true);
  update public.fournisseurs
     set note_moyenne = moyenne, nb_avis = coalesce(total, 0)
   where id = cible;
  perform set_config('akora.systeme', 'off', true);
  return null;
end;
$$;

drop trigger if exists trg_avis_recalculer_note on public.avis;
create trigger trg_avis_recalculer_note
  after insert or update or delete on public.avis
  for each row execute function public.recalculer_note_fournisseur();

-- ── notifications : LA SEULE table abonnee au Realtime ────────────────────
-- Retour d'experience Fonenako : 19 canaux Realtime pesaient 70 a 80 % de
-- l'egress et ont fait exploser le quota. Ici, un seul canal, sur cette table.
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  titre      text not null,
  corps      text,
  lien       text,
  categorie  text not null default 'general',
  lue        boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_non_lues on public.notifications(user_id) where not lue;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert, delete on public.notifications from authenticated;

drop policy if exists "notifications privees" on public.notifications;
create policy "notifications privees" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notification marquee lue par son destinataire" on public.notifications;
create policy "notification marquee lue par son destinataire" on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

create or replace function public.notifier(
  _user_id uuid, _titre text, _corps text default null,
  _lien text default null, _categorie text default 'general')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user_id is null then return; end if;
  insert into public.notifications (user_id, titre, corps, lien, categorie)
  values (_user_id, _titre, _corps, _lien, _categorie);
end;
$$;

-- ── signalements ──────────────────────────────────────────────────────────
create table if not exists public.signalements (
  id           uuid primary key default gen_random_uuid(),
  signale_par  uuid references auth.users(id) on delete set null,
  entite       text not null,
  entite_id    uuid not null,
  motif        text not null,
  description  text,
  traite       boolean not null default false,
  traite_par   uuid references auth.users(id) on delete set null,
  traite_le    timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_signalements_a_traiter on public.signalements(traite, created_at) where not traite;

alter table public.signalements enable row level security;
revoke all on public.signalements from anon;

drop policy if exists "signalements lisibles par un admin" on public.signalements;
create policy "signalements lisibles par un admin" on public.signalements
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or signale_par = auth.uid());

drop policy if exists "signalement depose par un utilisateur connecte" on public.signalements;
create policy "signalement depose par un utilisateur connecte" on public.signalements
  for insert to authenticated with check (signale_par = auth.uid());

drop policy if exists "signalement traite par un admin" on public.signalements;
create policy "signalement traite par un admin" on public.signalements
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
