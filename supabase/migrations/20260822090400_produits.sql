-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 05. Catalogue des fournisseurs
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.produits (
  id                      uuid primary key default gen_random_uuid(),
  fournisseur_id          uuid not null references public.fournisseurs(id) on delete cascade,
  materiau_ref_id         uuid references public.materiaux_ref(id) on delete restrict,
  demande_materiau_id     uuid references public.demandes_materiau(id) on delete set null,
  categorie_id            uuid not null references public.categories(id) on delete restrict,
  nom_affiche             text not null,
  slug                    text not null,
  description             text,
  unite                   public.unite not null,
  prix_unitaire           bigint not null,
  prix_promo              bigint,
  prix_maj_le             timestamptz not null default now(),
  tva_taux                numeric(5,2) not null default 0,
  quantite_min            integer not null default 1,
  poids_kg_unite          numeric(10,3) not null,
  volume_m3_unite         numeric(10,5) not null,
  stock_statut            public.stock_statut not null default 'en_stock',
  delai_preparation_jours integer not null default 0,
  photos                  text[] not null default '{}',
  caracteristiques        jsonb not null default '{}'::jsonb,
  statut                  public.statut_produit not null default 'brouillon',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (fournisseur_id, slug),
  constraint produits_prix_positif  check (prix_unitaire > 0),
  constraint produits_promo_coherente
    check (prix_promo is null or (prix_promo > 0 and prix_promo < prix_unitaire)),
  constraint produits_tva_bornee check (tva_taux >= 0 and tva_taux <= 30),
  constraint produits_quantite_min_positive check (quantite_min >= 1),
  constraint produits_delai_positif check (delai_preparation_jours >= 0),
  constraint produits_poids_positif  check (poids_kg_unite > 0),
  constraint produits_volume_positif check (volume_m3_unite > 0),
  constraint produits_photos_bornees check (cardinality(photos) <= 8),
  -- Un produit sans reference validee n'est JAMAIS publie (recette F11).
  constraint produits_publiable_avec_reference
    check (statut <> 'actif' or materiau_ref_id is not null),
  -- Et l'attente de reference suppose une demande en cours.
  constraint produits_attente_liee_a_une_demande
    check (statut <> 'en_attente_materiau' or demande_materiau_id is not null)
);
create index if not exists idx_produits_fournisseur on public.produits(fournisseur_id, statut);
create index if not exists idx_produits_materiau on public.produits(materiau_ref_id) where statut = 'actif';
create index if not exists idx_produits_categorie on public.produits(categorie_id) where statut = 'actif';
create index if not exists idx_produits_nom_trgm
  on public.produits using gin (nom_affiche extensions.gin_trgm_ops);

drop trigger if exists trg_produits_updated on public.produits;
create trigger trg_produits_updated before update on public.produits
  for each row execute function public.toucher_updated_at();

alter table public.produits enable row level security;

-- Le public lit `produits_publics`, jamais la table : elle porte le lien vers
-- le fournisseur et servirait a moissonner l'annuaire.
revoke all on public.produits from anon;

drop policy if exists "produits lisibles par leur fournisseur ou un admin" on public.produits;
create policy "produits lisibles par leur fournisseur ou un admin" on public.produits
  for select to authenticated
  using (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "produits geres par leur fournisseur" on public.produits;
create policy "produits geres par leur fournisseur" on public.produits
  for all to authenticated
  using (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'))
  with check (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'));

-- ── Le nom normalise et la famille viennent de la reference, pas du vendeur ─
-- « C'est ce qui rend votre offre comparable » : le fournisseur ajuste le poids
-- et le volume (son parpaing est peut-etre plus lourd), jamais la famille.
create or replace function public.aligner_produit_sur_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref record;
begin
  if new.materiau_ref_id is null then
    return new;
  end if;
  select categorie_id, unite_defaut, poids_kg_unite_defaut, volume_m3_unite_defaut
    into ref from public.materiaux_ref where id = new.materiau_ref_id;
  if not found then
    raise exception 'Materiau de reference introuvable.';
  end if;
  new.categorie_id := ref.categorie_id;
  if new.unite is null then new.unite := ref.unite_defaut; end if;
  if new.poids_kg_unite is null then new.poids_kg_unite := ref.poids_kg_unite_defaut; end if;
  if new.volume_m3_unite is null then new.volume_m3_unite := ref.volume_m3_unite_defaut; end if;
  return new;
end;
$$;

drop trigger if exists trg_produits_aligner on public.produits;
create trigger trg_produits_aligner
  before insert or update of materiau_ref_id on public.produits
  for each row execute function public.aligner_produit_sur_reference();

-- ── produits_paliers : les remises par quantite ───────────────────────────
create table if not exists public.produits_paliers (
  id            uuid primary key default gen_random_uuid(),
  produit_id    uuid not null references public.produits(id) on delete cascade,
  quantite_min  integer not null,
  prix_unitaire bigint not null,
  unique (produit_id, quantite_min),
  constraint paliers_quantite_positive check (quantite_min > 1),
  constraint paliers_prix_positif check (prix_unitaire > 0)
);
create index if not exists idx_paliers_produit on public.produits_paliers(produit_id, quantite_min);

alter table public.produits_paliers enable row level security;

drop policy if exists "paliers lisibles par tous" on public.produits_paliers;
create policy "paliers lisibles par tous" on public.produits_paliers
  for select to anon, authenticated using (true);

drop policy if exists "paliers geres par le fournisseur du produit" on public.produits_paliers;
create policy "paliers geres par le fournisseur du produit" on public.produits_paliers
  for all to authenticated
  using (exists (select 1 from public.produits p
                  where p.id = produit_id
                    and (public.est_membre_fournisseur(p.fournisseur_id)
                         or public.has_role(auth.uid(), 'admin'))))
  with check (exists (select 1 from public.produits p
                       where p.id = produit_id
                         and (public.est_membre_fournisseur(p.fournisseur_id)
                              or public.has_role(auth.uid(), 'admin'))));

-- Un palier plus cher que le prix de base n'est pas une remise.
create or replace function public.verifier_palier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prix_base bigint;
begin
  select prix_unitaire into prix_base from public.produits where id = new.produit_id;
  if prix_base is null then
    raise exception 'Produit introuvable.';
  end if;
  if new.prix_unitaire >= prix_base then
    raise exception 'Un palier degressif doit etre strictement inferieur au prix de base (% Ar).', prix_base;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_paliers_verifier on public.produits_paliers;
create trigger trg_paliers_verifier
  before insert or update on public.produits_paliers
  for each row execute function public.verifier_palier();

-- ── prix_historique : alimente par trigger a chaque changement de prix ────
create table if not exists public.prix_historique (
  id            bigserial primary key,
  produit_id    uuid not null references public.produits(id) on delete cascade,
  prix_unitaire bigint not null,
  releve_le     timestamptz not null default now()
);
create index if not exists idx_prix_historique_produit
  on public.prix_historique(produit_id, releve_le desc);

alter table public.prix_historique enable row level security;

drop policy if exists "historique de prix lisible par tous" on public.prix_historique;
create policy "historique de prix lisible par tous" on public.prix_historique
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.prix_historique from anon, authenticated;

create or replace function public.historiser_prix()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.prix_unitaire is distinct from old.prix_unitaire then
    insert into public.prix_historique (produit_id, prix_unitaire)
    values (new.id, new.prix_unitaire);
    new.prix_maj_le := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_produits_historiser_prix on public.produits;
create trigger trg_produits_historiser_prix
  before insert or update of prix_unitaire on public.produits
  for each row execute function public.historiser_prix();

-- ── vues_produit_jour : un agregat par jour, jamais une ligne par vue ─────
create table if not exists public.vues_produit_jour (
  produit_id uuid not null references public.produits(id) on delete cascade,
  jour       date not null,
  vues       integer not null default 0,
  primary key (produit_id, jour)
);

alter table public.vues_produit_jour enable row level security;
revoke all on public.vues_produit_jour from anon, authenticated;

drop policy if exists "compteur de vues lisible par le fournisseur" on public.vues_produit_jour;
create policy "compteur de vues lisible par le fournisseur" on public.vues_produit_jour
  for select to authenticated
  using (exists (select 1 from public.produits p
                  where p.id = produit_id
                    and (public.est_membre_fournisseur(p.fournisseur_id)
                         or public.has_role(auth.uid(), 'admin'))));

create or replace function public.compter_vue_produit(_produit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.vues_produit_jour (produit_id, jour, vues)
  values (_produit_id, (now() at time zone 'Indian/Antananarivo')::date, 1)
  on conflict (produit_id, jour) do update set vues = public.vues_produit_jour.vues + 1;
end;
$$;

-- ── favoris ───────────────────────────────────────────────────────────────
create table if not exists public.favoris (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  produit_id     uuid references public.produits(id) on delete cascade,
  fournisseur_id uuid references public.fournisseurs(id) on delete cascade,
  created_at     timestamptz not null default now(),
  constraint favoris_cible_unique check (num_nonnulls(produit_id, fournisseur_id) = 1)
);
create unique index if not exists idx_favoris_produit on public.favoris(user_id, produit_id) where produit_id is not null;
create unique index if not exists idx_favoris_fournisseur on public.favoris(user_id, fournisseur_id) where fournisseur_id is not null;

alter table public.favoris enable row level security;
revoke all on public.favoris from anon;

drop policy if exists "favoris prives" on public.favoris;
create policy "favoris prives" on public.favoris
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
