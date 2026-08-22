-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 31. Un niveau de plus : famille › type › format
-- ═══════════════════════════════════════════════════════════════════════════
-- La page Materiaux alignait 92 references dans une liste unique, ou le
-- parpaing creux 15 voisinait avec le ciment CEM II. Personne ne cherche comme
-- ca : on cherche « hourdis », puis on choisit l'epaisseur.
--
-- On intercale donc un niveau. La famille (Agglomeres) ouvre ses TYPES
-- (parpaing creux, hourdis, bordure...), le type ouvre ses FORMATS (12, 15,
-- 16, 20). Trois niveaux, trois URL indexables — une page par type vaut mieux
-- en referencement qu'une liste unique.
--
-- Le tri par `ordre_format` n'est pas un detail : par ordre alphabetique, un
-- catalogue d'epaisseurs donne 12, 120, 15, 16, 20. La colonne est numerique
-- et calculee par trigger, donc jamais oubliee.

-- `unaccent` est STABLE, donc interdit dans un index. La forme a deux
-- arguments, avec le dictionnaire nomme explicitement, est IMMUTABLE : c'est
-- le contournement documente, et le seul qui permette d'indexer.
create or replace function public.sans_accent(texte text)
returns text
language sql
immutable
strict
parallel safe
set search_path = extensions, public
as $$ select extensions.unaccent('extensions.unaccent', lower(texte)) $$;

comment on function public.sans_accent(text) is
  'Minuscules sans accents, IMMUTABLE donc indexable. La forme unaccent(dictionnaire, texte) est ce qui rend la fonction immuable.';

-- ── Le niveau « type » ────────────────────────────────────────────────────
create table if not exists public.types_materiaux (
  id           uuid primary key default gen_random_uuid(),
  categorie_id uuid not null references public.categories(id) on delete restrict,
  nom          text not null,
  nom_mg       text,
  slug         text not null unique,
  description  text,
  photo        text,
  -- « biriky », « entrevous », « bloc »... : ce que les gens tapent vraiment.
  synonymes    text[] not null default '{}',
  ordre        smallint not null default 0,
  actif        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (categorie_id, nom)
);

drop trigger if exists trg_types_updated on public.types_materiaux;
create trigger trg_types_updated before update on public.types_materiaux
  for each row execute function public.toucher_updated_at();

-- ── Les attributs de format, sur le referentiel ───────────────────────────
alter table public.materiaux_ref
  add column if not exists type_id       uuid references public.types_materiaux(id) on delete restrict,
  add column if not exists libelle_court text,
  add column if not exists dimensions    text,
  add column if not exists photo         text,
  add column if not exists epaisseur_cm  numeric(6,2),
  add column if not exists longueur_cm   numeric(6,2),
  add column if not exists largeur_cm    numeric(6,2),
  add column if not exists diametre_mm   integer,
  add column if not exists ordre_format  numeric(10,2),
  add column if not exists note          text;

comment on column public.materiaux_ref.libelle_court is
  'Ce qui distingue ce format des autres du meme type : « 15 », « 12x33x33 », « O400 », « T2 ». C''est ce qui s''affiche en puce.';
comment on column public.materiaux_ref.ordre_format is
  'Cle de tri NUMERIQUE. Sans elle, 12 / 120 / 15 / 16 / 20 par ordre alphabetique.';

create or replace function public.calculer_ordre_format()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.ordre_format := coalesce(
    new.epaisseur_cm,
    new.diametre_mm::numeric / 10,
    new.longueur_cm,
    999
  );
  return new;
end;
$$;

drop trigger if exists trg_materiaux_ordre_format on public.materiaux_ref;
create trigger trg_materiaux_ordre_format
  before insert or update of epaisseur_cm, diametre_mm, longueur_cm
  on public.materiaux_ref
  for each row execute function public.calculer_ordre_format();

create index if not exists idx_materiaux_type on public.materiaux_ref (type_id, ordre_format);
create index if not exists idx_types_categorie on public.types_materiaux (categorie_id, ordre);
create index if not exists idx_types_recherche on public.types_materiaux
  using gin ((public.sans_accent(nom) || ' ' || public.sans_accent(coalesce(nom_mg, ''))) extensions.gin_trgm_ops);
create index if not exists idx_materiaux_recherche on public.materiaux_ref
  using gin (public.sans_accent(nom) extensions.gin_trgm_ops);

-- ── Droits ────────────────────────────────────────────────────────────────
alter table public.types_materiaux enable row level security;

-- Le referentiel est FERME : seuls les administrateurs y ajoutent une ligne.
-- C'est ce qui garde les offres comparables — si chacun creait sa reference,
-- il y aurait quinze facons d'ecrire « parpaing 15 » et plus rien a comparer.
revoke all on public.types_materiaux from anon;
grant select on public.types_materiaux to authenticated;
grant all on public.types_materiaux to service_role;

drop policy if exists "types lisibles par un compte" on public.types_materiaux;
create policy "types lisibles par un compte" on public.types_materiaux
  for select to authenticated using (actif or public.has_role((select auth.uid()), 'admin'));

drop policy if exists "un admin gouverne le referentiel" on public.types_materiaux;
create policy "un admin gouverne le referentiel" on public.types_materiaux
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

-- ── Vue : les types d'une famille ─────────────────────────────────────────
-- SECURITY DEFINER, comme les autres vues publiques d'Akora : les tables de
-- base sont fermees au navigateur anonyme, la vue est le seul chemin.
create or replace view public.types_vitrine as
select
  t.id,
  t.nom,
  t.nom_mg,
  t.slug,
  t.photo,
  t.description,
  t.ordre,
  c.slug as famille_slug,
  c.nom  as famille_nom,
  count(distinct m.id)                          as nb_formats,
  count(distinct p.id)                          as nb_offres,
  count(distinct p.fournisseur_id)              as nb_fournisseurs,
  min(coalesce(p.prix_promo, p.prix_unitaire))  as prix_des,
  coalesce(min(m.unite_defaut::text), 'piece')  as unite,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('slug', m2.slug, 'libelle_court', m2.libelle_court)
                       order by m2.ordre_format)
        from (
          select m3.slug, m3.libelle_court, m3.ordre_format
            from public.materiaux_ref m3
           where m3.type_id = t.id and m3.actif and m3.libelle_court is not null
           order by m3.ordre_format
           limit 6
        ) m2
    ), '[]'::jsonb
  ) as formats_apercu
from public.types_materiaux t
join public.categories c on c.id = t.categorie_id
left join public.materiaux_ref m on m.type_id = t.id and m.actif
left join public.produits p on p.materiau_ref_id = m.id and p.statut = 'actif'
where t.actif
group by t.id, t.nom, t.nom_mg, t.slug, t.photo, t.description, t.ordre, c.slug, c.nom;

-- ── Vue : les formats d'un type ───────────────────────────────────────────
create or replace view public.formats_vitrine as
select
  m.id,
  m.nom,
  m.slug,
  m.libelle_court,
  m.dimensions,
  m.photo,
  m.unite_defaut as unite,
  m.poids_kg_unite_defaut  as poids_kg_unite,
  m.volume_m3_unite_defaut as volume_m3_unite,
  m.ordre_format,
  m.note,
  t.slug as type_slug,
  t.nom  as type_nom,
  c.slug as famille_slug,
  c.nom  as famille_nom,
  count(p.id)                                                            as nb_offres,
  count(p.id) filter (where f.niveau_verification in ('verifie', 'partenaire')) as nb_offres_verifiees,
  min(coalesce(p.prix_promo, p.prix_unitaire))                           as prix_des,
  -- Le point de depart de l'estimation : l'offre la moins chere.
  (array_agg(f.lat order by coalesce(p.prix_promo, p.prix_unitaire)))[1] as offre_lat,
  (array_agg(f.lng order by coalesce(p.prix_promo, p.prix_unitaire)))[1] as offre_lng,
  (array_agg(f.rayon_max_km order by coalesce(p.prix_promo, p.prix_unitaire)))[1] as offre_rayon_max_km,
  (array_agg(f.coef_sinuosite order by coalesce(p.prix_promo, p.prix_unitaire)))[1] as offre_coef_sinuosite,
  (array_agg(f.id order by coalesce(p.prix_promo, p.prix_unitaire)))[1]  as offre_fournisseur_id
from public.materiaux_ref m
join public.types_materiaux t on t.id = m.type_id
join public.categories c on c.id = t.categorie_id
left join public.produits p on p.materiau_ref_id = m.id and p.statut = 'actif'
left join public.fournisseurs f on f.id = p.fournisseur_id and f.statut = 'actif'
where m.actif and t.actif
group by m.id, m.nom, m.slug, m.libelle_court, m.dimensions, m.photo, m.unite_defaut,
         m.poids_kg_unite_defaut, m.volume_m3_unite_defaut, m.ordre_format, m.note,
         t.slug, t.nom, c.slug, c.nom;

grant select on public.types_vitrine, public.formats_vitrine to anon, authenticated;

-- ── Recherche a trois niveaux ─────────────────────────────────────────────
-- Les TYPES passent avant les FORMATS : taper « hou » doit proposer d'abord
-- « Hourdis » — les six formats d'un coup — et seulement ensuite chaque
-- format un par un. C'est l'inverse qui fatigue : six lignes presque
-- identiques la ou une seule suffisait.
--
-- SECURITY DEFINER parce qu'elle lit des tables fermees au visiteur anonyme,
-- et STABLE parce qu'elle ne fait que lire. Elle ne prend qu'un texte : rien
-- a injecter, tout passe en parametre.
create or replace function public.rechercher_referentiel(
  requete text,
  portee  text default null,
  limite  integer default 8
)
returns table (
  kind         text,
  id           uuid,
  nom          text,
  famille_nom  text,
  famille_slug text,
  type_nom     text,
  type_slug    text,
  format_slug  text,
  nb_formats   bigint,
  nb_offres    bigint,
  prix_des     numeric,
  rang         real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with q as (select public.sans_accent(trim(requete)) as t)
  -- 1. Les types.
  select
    'type'::text, t.id, t.nom, c.nom, c.slug, t.nom, t.slug, null::text,
    v.nb_formats, v.nb_offres, v.prix_des,
    -- Un debut de mot passe devant une correspondance au milieu : qui tape
    -- « bord » cherche « Bordure », pas « Panneau de bordure ».
    ((case when public.sans_accent(t.nom) like (select t from q) || '%' then 2.0 else 1.0 end)
      + extensions.similarity(public.sans_accent(t.nom), (select t from q)))::real
  from public.types_materiaux t
  join public.categories c on c.id = t.categorie_id
  join public.types_vitrine v on v.id = t.id
  where t.actif
    and (portee is null or c.slug = portee or t.slug = portee)
    and (
      public.sans_accent(t.nom) like '%' || (select t from q) || '%'
      or public.sans_accent(coalesce(t.nom_mg, '')) like '%' || (select t from q) || '%'
      or exists (select 1 from unnest(t.synonymes) s
                  where public.sans_accent(s) like '%' || (select t from q) || '%')
    )

  union all

  -- 2. Les formats.
  select
    'format'::text, m.id, m.nom, c.nom, c.slug, t.nom, t.slug, m.slug,
    null::bigint, v.nb_offres, v.prix_des,
    (0.5 + extensions.similarity(public.sans_accent(m.nom), (select t from q)))::real
  from public.materiaux_ref m
  join public.types_materiaux t on t.id = m.type_id
  join public.categories c on c.id = t.categorie_id
  join public.formats_vitrine v on v.id = m.id
  where m.actif and t.actif
    and (portee is null or c.slug = portee or t.slug = portee)
    and public.sans_accent(m.nom) like '%' || (select t from q) || '%'

  union all

  -- 3. La famille, en dernier recours.
  select
    'famille'::text, c.id, c.nom, c.nom, c.slug, null::text, null::text, null::text,
    count(t.id), null::bigint, null::numeric,
    (0.2 + extensions.similarity(public.sans_accent(c.nom), (select t from q)))::real
  from public.categories c
  left join public.types_materiaux t on t.categorie_id = c.id and t.actif
  where public.sans_accent(c.nom) like '%' || (select t from q) || '%'
     or public.sans_accent(coalesce(c.nom_mg, '')) like '%' || (select t from q) || '%'
  group by c.id, c.nom, c.slug

  order by 12 desc, 3
  limit greatest(least(limite, 20), 1);
$$;

comment on function public.rechercher_referentiel(text, text, integer) is
  'Autocompletion du referentiel : les types avant les formats, puis les familles. Insensible aux accents et a la casse, synonymes malgaches compris.';

revoke all on function public.rechercher_referentiel(text, text, integer) from public;
grant execute on function public.rechercher_referentiel(text, text, integer) to anon, authenticated, service_role;
revoke all on function public.calculer_ordre_format() from public, anon, authenticated;
