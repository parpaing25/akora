-- ═══════════════════════════════════════════════════════════════════════════
-- RELEVÉS DE PRIX — l'observatoire du bot devient un bien public du site.
-- Demandé par Andry le 01/09/2026 : « les moyennes du prix de marché sur
-- chaque région, ou ville ou quartier », alimentées par ce que le bot lit
-- sur Facebook.
--
-- Mesure du 01/09 (session bot) : 176 offres gardées à prospect vivant, dont
-- 29 seulement portent déjà une référence catalogue. D'où la décision — la
-- référence est NULLABLE et le libellé brut est gardé : un prix relevé qu'on
-- jetterait faute de référence est un prix qu'il faudrait recollecter. La
-- ligne se réapparie plus tard ; seules les lignes référencées entrent dans
-- les agrégats publics.
--
-- Anonyme PAR CONSTRUCTION : ni nom, ni numéro, ni lien vers un prospect.
-- L'empreinte (sha256 du téléphone normalisé) ne sert qu'à compter les
-- dépôts distincts et à ne garder que LE DERNIER prix de chaque dépôt —
-- règle d'Andry : un nouveau prix remplace l'ancien, il ne s'empile pas.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.releves_prix (
  id uuid primary key default gen_random_uuid(),
  materiau_ref_id uuid references public.materiaux_ref(id) on delete cascade,
  libelle_brut text,
  localite_id uuid references public.localites(id) on delete set null,
  prix bigint not null check (prix > 0),
  unite public.unite,
  source text not null default 'collecte',
  empreinte_depot text,
  releve_le date not null default current_date,
  cree_le timestamptz not null default now(),
  constraint releves_prix_identifiable
    check (materiau_ref_id is not null or nullif(libelle_brut, '') is not null)
);

comment on table public.releves_prix is
  'Prix observés sur le marché (collecte Facebook du bot, saisies manuelles). Aucune identité : empreinte_depot est un hash, jamais un numéro ni un nom. materiau_ref_id NULL = en attente d''appariement, le libellé brut fait mémoire.';

-- Un même dépôt, un même matériau ou libellé, un même jour, un même prix : une ligne.
create unique index releves_prix_uniques on public.releves_prix
  (coalesce(materiau_ref_id::text, ''), coalesce(libelle_brut, ''),
   coalesce(empreinte_depot, ''), releve_le, prix);

create index releves_prix_par_materiau on public.releves_prix (materiau_ref_id, releve_le desc)
  where materiau_ref_id is not null;
create index releves_prix_par_localite on public.releves_prix (localite_id);

alter table public.releves_prix enable row level security;

-- Lecture publique : la ligne ne porte aucune identité.
create policy "releves_lecture_publique" on public.releves_prix
  for select using (true);
-- Aucune policy d'écriture : seule l'API Management (postgres) écrit.

-- ═══════════════════════════════════════════════════════════════════════════
-- L'OBSERVATOIRE : médiane, min, max, nb de dépôts — par matériau, à
-- n'importe quel étage de la hiérarchie des localités (région → commune →
-- quartier, via parent_id). La MÉDIANE, jamais la moyenne : un prix de gros
-- fausse une moyenne, pas une médiane (règle du bot, marche.py).
--
-- Deux sources fusionnées :
--   1. les produits ACTIFS du site (prix vivants, un par produit) ;
--   2. les relevés du bot — LE DERNIER relevé de chaque dépôt (empreinte),
--      lignes RÉFÉRENCÉES uniquement, à l'unité de la référence.
-- fiable = au moins 3 sources distinctes. En dessous, le chiffre s'affiche
-- « indicatif » — il ne sert pas d'argument (règle du LISEZ-MOI du bot).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.observatoire_prix(
    _famille text default null,
    _localite_slug text default null)
 returns table(
    materiau_ref_id uuid, materiau_slug text, materiau_nom text,
    famille_slug text, unite text,
    nb_sources integer, nb_depots integer,
    prix_min bigint, prix_median bigint, prix_max bigint,
    dernier_releve date, fiable boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with recursive perimetre as (
    -- La localité demandée et toute sa descendance. NULL = tout Madagascar.
    select l.id from public.localites l
     where _localite_slug is not null and l.slug = _localite_slug
    union all
    select l.id from public.localites l
      join perimetre p on l.parent_id = p.id
  ),
  releves_dernier as (
    -- Le DERNIER prix de chaque dépôt pour chaque matériau (règle d'Andry).
    select distinct on (r.materiau_ref_id, coalesce(r.empreinte_depot, r.id::text))
      r.materiau_ref_id,
      coalesce(r.empreinte_depot, r.id::text) as depot,
      r.prix, r.releve_le
    from public.releves_prix r
    join public.materiaux_ref m on m.id = r.materiau_ref_id
    where r.materiau_ref_id is not null
      and (r.unite is null or r.unite = m.unite_defaut)  -- une autre unité ne se compare pas
      and (_localite_slug is null or r.localite_id in (select id from perimetre))
    order by r.materiau_ref_id, coalesce(r.empreinte_depot, r.id::text),
             r.releve_le desc
  ),
  produits_actifs as (
    select p.materiau_ref_id,
           'produit:' || p.id::text as depot,
           coalesce(p.prix_promo, p.prix_unitaire) as prix,
           coalesce(p.prix_maj_le::date, p.updated_at::date) as releve_le
    from public.produits p
    join public.fournisseurs f on f.id = p.fournisseur_id
    join public.materiaux_ref m on m.id = p.materiau_ref_id
    where p.statut = 'actif' and f.statut = 'actif'
      and p.unite = m.unite_defaut
      and (_localite_slug is null or f.localite_id in (select id from perimetre))
  ),
  tout as (
    select * from releves_dernier
    union all
    select * from produits_actifs
  )
  select
    m.id, m.slug, m.nom, c.slug, m.unite_defaut::text,
    count(*)::integer as nb_sources,
    count(distinct t.depot)::integer as nb_depots,
    min(t.prix),
    percentile_cont(0.5) within group (order by t.prix::double precision)::bigint,
    max(t.prix),
    max(t.releve_le),
    (count(distinct t.depot) >= 3) as fiable
  from tout t
  join public.materiaux_ref m on m.id = t.materiau_ref_id
  join public.categories c on c.id = m.categorie_id
  where (_famille is null or c.slug = _famille)
  group by m.id, m.slug, m.nom, c.slug, m.unite_defaut
  order by c.slug, m.slug;
$function$;
