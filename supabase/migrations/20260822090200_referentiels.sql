-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 03. Referentiels : familles, materiaux, localites
-- ═══════════════════════════════════════════════════════════════════════════
-- Le catalogue est une LISTE FERMEE (spec B4). C'est ce qui rend deux offres
-- comparables et ce qui empeche la base de deriver. Seul un admin ecrit ici.

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  nom        text not null,
  nom_mg     text,
  icone      text,
  parent_id  uuid references public.categories(id) on delete restrict,
  ordre      integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_categories_parent on public.categories(parent_id, ordre);

alter table public.categories enable row level security;

drop policy if exists "familles lisibles par tous" on public.categories;
create policy "familles lisibles par tous" on public.categories
  for select to anon, authenticated using (active);

drop policy if exists "familles ecrites par un admin" on public.categories;
create policy "familles ecrites par un admin" on public.categories
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ── materiaux_ref : LE referentiel commun ─────────────────────────────────
create table if not exists public.materiaux_ref (
  id                       uuid primary key default gen_random_uuid(),
  categorie_id             uuid not null references public.categories(id) on delete restrict,
  nom                      text not null,
  slug                     text not null unique,
  unite_defaut             public.unite not null,
  poids_kg_unite_defaut    numeric(10,3) not null,
  volume_m3_unite_defaut   numeric(10,5) not null,
  attributs                jsonb not null default '{}'::jsonb,
  actif                    boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint materiaux_ref_poids_positif  check (poids_kg_unite_defaut > 0),
  constraint materiaux_ref_volume_positif check (volume_m3_unite_defaut > 0),
  constraint materiaux_ref_nom_unique_par_famille unique (categorie_id, nom)
);
create index if not exists idx_materiaux_ref_categorie on public.materiaux_ref(categorie_id) where actif;
create index if not exists idx_materiaux_ref_nom_trgm
  on public.materiaux_ref using gin (nom extensions.gin_trgm_ops);

drop trigger if exists trg_materiaux_ref_updated on public.materiaux_ref;
create trigger trg_materiaux_ref_updated before update on public.materiaux_ref
  for each row execute function public.toucher_updated_at();

alter table public.materiaux_ref enable row level security;

drop policy if exists "materiaux lisibles par tous" on public.materiaux_ref;
create policy "materiaux lisibles par tous" on public.materiaux_ref
  for select to anon, authenticated using (actif);

-- Un fournisseur ne peut creer AUCUN materiau de reference (recette F11).
drop policy if exists "materiaux ecrits par un admin" on public.materiaux_ref;
create policy "materiaux ecrits par un admin" on public.materiaux_ref
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ── localites : aucune coordonnee inventee ────────────────────────────────
-- Si la position est inconnue, lat/lng restent NULL et le site affiche
-- « distance non calculable » plutot qu'un chiffre faux (regle A2.8).
create table if not exists public.localites (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  type       public.type_localite not null,
  parent_id  uuid references public.localites(id) on delete restrict,
  lat        double precision,
  lng        double precision,
  slug       text not null unique,
  created_at timestamptz not null default now(),
  constraint localites_lat_plausible check (lat is null or (lat between -26.0 and -11.0)),
  constraint localites_lng_plausible check (lng is null or (lng between 42.0 and 51.5)),
  constraint localites_coordonnees_completes check ((lat is null) = (lng is null))
);
create index if not exists idx_localites_parent on public.localites(parent_id);
create index if not exists idx_localites_nom_trgm
  on public.localites using gin (nom extensions.gin_trgm_ops);

comment on constraint localites_lat_plausible on public.localites is
  'Madagascar tient entre 11 deg S et 26 deg S : une latitude hors de cette plage est une erreur de saisie, pas une localite.';

alter table public.localites enable row level security;

drop policy if exists "localites lisibles par tous" on public.localites;
create policy "localites lisibles par tous" on public.localites
  for select to anon, authenticated using (true);

drop policy if exists "localites ecrites par un admin" on public.localites;
create policy "localites ecrites par un admin" on public.localites
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ── ratios_metre : les calculateurs ne codent RIEN en dur ─────────────────
create table if not exists public.ratios_metre (
  id          uuid primary key default gen_random_uuid(),
  calculateur text not null,
  cle         text not null,
  valeur      numeric(12,5) not null,
  unite       text not null,
  libelle     text not null,
  note        text,
  updated_at  timestamptz not null default now(),
  unique (calculateur, cle)
);

drop trigger if exists trg_ratios_updated on public.ratios_metre;
create trigger trg_ratios_updated before update on public.ratios_metre
  for each row execute function public.toucher_updated_at();

alter table public.ratios_metre enable row level security;

drop policy if exists "ratios lisibles par tous" on public.ratios_metre;
create policy "ratios lisibles par tous" on public.ratios_metre
  for select to anon, authenticated using (true);

drop policy if exists "ratios ecrits par un admin" on public.ratios_metre;
create policy "ratios ecrits par un admin" on public.ratios_metre
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ── commissions : taux Akora, par categorie, historises ───────────────────
create table if not exists public.commissions (
  id           uuid primary key default gen_random_uuid(),
  categorie_id uuid references public.categories(id) on delete cascade,
  taux_pct     numeric(5,2) not null,
  actif_du     timestamptz not null default now(),
  actif_au     timestamptz,
  created_at   timestamptz not null default now(),
  constraint commissions_taux_plausible check (taux_pct >= 0 and taux_pct <= 30),
  constraint commissions_periode_coherente check (actif_au is null or actif_au > actif_du)
);
-- Un seul taux courant par categorie (et un seul taux courant par defaut).
create unique index if not exists idx_commission_courante_categorie
  on public.commissions(categorie_id) where actif_au is null and categorie_id is not null;
create unique index if not exists idx_commission_courante_defaut
  on public.commissions((categorie_id is null)) where actif_au is null and categorie_id is null;

alter table public.commissions enable row level security;

drop policy if exists "commissions lisibles par tous" on public.commissions;
create policy "commissions lisibles par tous" on public.commissions
  for select to anon, authenticated using (true);

drop policy if exists "commissions ecrites par un admin" on public.commissions;
create policy "commissions ecrites par un admin" on public.commissions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Taux par defaut : 3 % du montant produits, 0 % sur la livraison (spec B10).
insert into public.commissions (categorie_id, taux_pct)
select null, 3.00
where not exists (
  select 1 from public.commissions where categorie_id is null and actif_au is null
);

create or replace function public.taux_commission(_categorie_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select taux_pct from public.commissions
      where categorie_id = _categorie_id and actif_au is null limit 1),
    (select taux_pct from public.commissions
      where categorie_id is null and actif_au is null limit 1),
    3.00
  );
$$;
