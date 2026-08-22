-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 02. Identite, roles, journal d'audit, garde-fous transverses
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Horodatage automatique, reutilise par toutes les tables ───────────────
create or replace function public.toucher_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles : la cle primaire EST auth.uid() ─────────────────────────────
-- On filtre donc TOUJOURS par `id`, jamais par un hypothetique `user_id`.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nom_complet   text,
  telephone     text,
  ville         text,
  avatar_url    text,
  type_client   public.type_client not null default 'particulier',
  raison_sociale text,
  nif           text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_telephone_valide
    check (telephone is null or telephone ~ '^\+2613[2-9][0-9]{7}$')
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.toucher_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profil lisible par son proprietaire" on public.profiles;
create policy "profil lisible par son proprietaire" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profil modifiable par son proprietaire" on public.profiles;
create policy "profil modifiable par son proprietaire" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profil supprimable par son proprietaire" on public.profiles;
create policy "profil supprimable par son proprietaire" on public.profiles
  for delete to authenticated using (id = auth.uid());

-- ── user_roles : les roles NE VIVENT PAS dans profiles ────────────────────
-- Un role range dans une ligne que l'utilisateur peut modifier, c'est une
-- escalade de privileges en une requete. Ici, personne n'ecrit sauf un admin.
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists idx_user_roles_user on public.user_roles(user_id);

alter table public.user_roles enable row level security;

-- ── has_role : l'autorite unique en matiere de droits ─────────────────────
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

comment on function public.has_role is
  'Verifie un role. SECURITY DEFINER + search_path fige : appelable depuis une politique RLS sans recursion.';

drop policy if exists "roles lisibles par soi ou par un admin" on public.user_roles;
create policy "roles lisibles par soi ou par un admin" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "roles ecrits par un admin seulement" on public.user_roles;
create policy "roles ecrits par un admin seulement" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ── Creation du profil et attribution du role a l'inscription ─────────────
-- Le navigateur n'ecrit JAMAIS dans user_roles. Il depose son intention dans
-- les metadonnees du compte ; c'est ce trigger, en SECURITY DEFINER, qui
-- tranche. Et il n'accorde jamais 'admin', quoi qu'on lui demande.
create or replace function public.gerer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  demande text := coalesce(new.raw_user_meta_data ->> 'profil_demande', 'acheteur');
  role_accorde public.app_role;
begin
  insert into public.profiles (id, nom_complet, telephone, raison_sociale, type_client)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'nom_complet', ''),
    nullif(new.raw_user_meta_data ->> 'telephone', ''),
    nullif(new.raw_user_meta_data ->> 'raison_sociale', ''),
    case when demande = 'fournisseur' then 'entreprise'::public.type_client
         else 'particulier'::public.type_client end
  )
  on conflict (id) do nothing;

  role_accorde := case when demande = 'fournisseur'
                       then 'fournisseur'::public.app_role
                       else 'acheteur'::public.app_role end;

  insert into public.user_roles (user_id, role)
  values (new.id, role_accorde)
  on conflict (user_id, role) do nothing;

  -- Un fournisseur reste aussi un acheteur : il peut commander chez un confrere.
  if role_accorde = 'fournisseur' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'acheteur')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_nouvel_utilisateur on auth.users;
create trigger trg_nouvel_utilisateur
  after insert on auth.users
  for each row execute function public.gerer_nouvel_utilisateur();

-- ── audit_log : qui, quand, avant, apres, depuis quelle IP ────────────────
create table if not exists public.audit_log (
  id          bigserial primary key,
  acteur_id   uuid references auth.users(id) on delete set null,
  action      text not null,
  entite      text not null,
  entite_id   text,
  avant       jsonb,
  apres       jsonb,
  ip          inet,
  agent       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_entite on public.audit_log(entite, entite_id, created_at desc);
create index if not exists idx_audit_acteur on public.audit_log(acteur_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "journal lisible par un admin" on public.audit_log;
create policy "journal lisible par un admin" on public.audit_log
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Personne n'ecrit dans le journal depuis le navigateur : seules les fonctions
-- SECURITY DEFINER et les Edge Functions y ajoutent des lignes.
revoke insert, update, delete on public.audit_log from anon, authenticated;

create or replace function public.journaliser(
  _action text, _entite text, _entite_id text,
  _avant jsonb default null, _apres jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (acteur_id, action, entite, entite_id, avant, apres)
  values (auth.uid(), _action, _entite, _entite_id, _avant, _apres);
end;
$$;

-- ── rate_limits : le vrai plafond anti-abus ───────────────────────────────
-- Le leurre et le delai de 3 s cote formulaire ne protegent que des robots
-- naifs. Le plafond N/heure vit ici, hors de portee du navigateur.
create table if not exists public.rate_limits (
  id         bigserial primary key,
  cle        text not null,
  sujet      text not null,
  fenetre    timestamptz not null,
  compteur   integer not null default 1,
  unique (cle, sujet, fenetre)
);
create index if not exists idx_rate_limits_fenetre on public.rate_limits(fenetre);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.consommer_quota(_cle text, _sujet text, _plafond integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  debut timestamptz := date_trunc('hour', now());
  valeur integer;
begin
  insert into public.rate_limits (cle, sujet, fenetre, compteur)
  values (_cle, _sujet, debut, 1)
  on conflict (cle, sujet, fenetre) do update set compteur = public.rate_limits.compteur + 1
  returning compteur into valeur;
  return valeur <= _plafond;
end;
$$;

comment on function public.consommer_quota is
  'Incremente le compteur horaire et dit si l''action reste sous le plafond. Renvoie false quand le plafond est depasse.';

-- ── parametres : les reglages globaux, modifiables par un admin ───────────
create table if not exists public.parametres (
  cle         text primary key,
  valeur      jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_parametres_updated on public.parametres;
create trigger trg_parametres_updated before update on public.parametres
  for each row execute function public.toucher_updated_at();

alter table public.parametres enable row level security;

drop policy if exists "parametres lisibles par tous" on public.parametres;
create policy "parametres lisibles par tous" on public.parametres
  for select to anon, authenticated using (true);

drop policy if exists "parametres ecrits par un admin" on public.parametres;
create policy "parametres ecrits par un admin" on public.parametres
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.parametres (cle, valeur, description) values
  ('coef_sinuosite', '1.30'::jsonb,
   'Coefficient appliquer a la distance a vol d''oiseau pour approcher la distance routiere. Surchargeable par fournisseur.'),
  ('commission_defaut_pct', '3'::jsonb,
   'Commission Akora par defaut, en pourcentage du montant produits. Zero sur la livraison.'),
  ('taux_acompte_defaut_pct', '30'::jsonb,
   'Part payee en ligne dans le mode acompte, quand le fournisseur n''a rien regle.'),
  ('delai_liberation_heures', '72'::jsonb,
   'Delai apres passage en livree au terme duquel le sequestre est libere sans contestation.'),
  ('marge_metre_pct', '5'::jsonb,
   'Marge de securite par defaut des calculateurs de metre, pour les chutes et les pertes.'),
  ('retrait_minimum_ar', '50000'::jsonb,
   'Montant minimal d''une demande de versement, en Ariary.'),
  ('partenaire_commandes_min', '10'::jsonb,
   'Nombre de commandes cloturees exige pour le badge Partenaire Akora.'),
  ('partenaire_note_min', '4.2'::jsonb,
   'Note moyenne exigee pour le badge Partenaire Akora.')
on conflict (cle) do nothing;
