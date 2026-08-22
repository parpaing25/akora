-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 33. L'annuaire des depots, filtrable par ce qu'ils vendent
-- ═══════════════════════════════════════════════════════════════════════════
-- Chercher un fournisseur par son nom suppose de le connaitre deja. On cherche
-- « qui vend des hourdis a moins de 25 km de mon chantier » — donc par famille,
-- par type de materiau, par distance et par verification.
--
-- La distance est calculee ici, en SQL : a vol d'oiseau puis majoree de 30 %
-- (regle B6), sans PostGIS ni service de routage. C'est approximatif et c'est
-- annonce comme tel — mais c'est calculable pour tout le monde, tout le temps,
-- et cela suffit pour trier et pour repondre a « livre-t-il chez moi ».

alter table public.fournisseurs
  add column if not exists metier            text,
  add column if not exists photo_depot       text,
  add column if not exists retrait_sur_place boolean not null default false;

comment on column public.fournisseurs.metier is
  'Depot, Briqueterie, Carriere, Scierie, Centrale a beton... Ce que le fournisseur EST, en un mot, sous son nom.';

-- ── L'annuaire ────────────────────────────────────────────────────────────
-- SECURITY DEFINER : elle lit `produits` et `fournisseurs`, fermees au
-- visiteur anonyme. Elle ne rend AUCUNE donnee personnelle — ni telephone, ni
-- e-mail, ni adresse exacte. Le telephone reste derriere sa fonction dediee.
create or replace function public.annuaire_fournisseurs(
  _lat                double precision default null,
  _lng                double precision default null,
  _famille            text    default null,
  _type               text    default null,
  _verifies_seulement boolean default false,
  _livre_chez_moi     boolean default false,
  _tri                text    default 'distance'
)
returns table (
  id                  uuid,
  raison_sociale      text,
  slug                text,
  metier              text,
  localite_nom        text,
  distance_km         numeric,
  niveau_verification text,
  note_moyenne        numeric,
  nb_avis             integer,
  rayon_max_km        integer,
  nb_produits         bigint,
  photo_depot         text,
  logo_url            text,
  familles            text[],
  types               text[],
  produit_phare       jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      f.id, f.raison_sociale, f.slug, f.metier, f.niveau_verification,
      f.note_moyenne, f.nb_avis, f.rayon_max_km, f.photo_depot, f.logo_url,
      l.nom as localite_nom,
      case
        when _lat is null or _lng is null or f.lat is null or f.lng is null then null
        else round((6371 * acos(least(1, greatest(-1,
               cos(radians(_lat)) * cos(radians(f.lat)) * cos(radians(f.lng) - radians(_lng))
               + sin(radians(_lat)) * sin(radians(f.lat))
             ))) * coalesce(f.coef_sinuosite, 1.30))::numeric, 1)
      end as distance_km
    from public.fournisseurs f
    left join public.localites l on l.id = f.localite_id
    where f.statut = 'actif'
  ),
  enrichi as (
    select
      b.*,
      (select count(*) from public.produits p
        where p.fournisseur_id = b.id and p.statut = 'actif') as nb_produits,
      (select coalesce(array_agg(distinct c.nom order by c.nom), '{}')
         from public.produits p
         join public.categories c on c.id = p.categorie_id
        where p.fournisseur_id = b.id and p.statut = 'actif') as familles,
      (select coalesce(array_agg(distinct t.nom order by t.nom), '{}')
         from public.produits p
         join public.materiaux_ref m on m.id = p.materiau_ref_id
         join public.types_materiaux t on t.id = m.type_id
        where p.fournisseur_id = b.id and p.statut = 'actif') as types,
      -- Le produit phare : le moins cher. C'est celui qui donne le « des ».
      (select jsonb_build_object(
                'nom', p.nom_affiche,
                'slug', p.slug,
                'prix', coalesce(p.prix_promo, p.prix_unitaire),
                'unite', p.unite)
         from public.produits p
        where p.fournisseur_id = b.id and p.statut = 'actif'
        order by coalesce(p.prix_promo, p.prix_unitaire)
        limit 1) as produit_phare
    from base b
  )
  select
    e.id, e.raison_sociale, e.slug, e.metier, e.localite_nom, e.distance_km,
    e.niveau_verification::text, e.note_moyenne, e.nb_avis, e.rayon_max_km,
    e.nb_produits, e.photo_depot, e.logo_url, e.familles, e.types, e.produit_phare
  from enrichi e
  where (not _verifies_seulement or e.niveau_verification in ('verifie', 'partenaire'))
    and (not _livre_chez_moi or (e.distance_km is not null and e.distance_km <= e.rayon_max_km))
    and (_famille is null or exists (
          select 1 from public.produits p
            join public.categories c on c.id = p.categorie_id
           where p.fournisseur_id = e.id and p.statut = 'actif' and c.slug = _famille))
    and (_type is null or exists (
          select 1 from public.produits p
            join public.materiaux_ref m on m.id = p.materiau_ref_id
            join public.types_materiaux t on t.id = m.type_id
           where p.fournisseur_id = e.id and p.statut = 'actif' and t.slug = _type))
  order by
    case when _tri = 'distance' then e.distance_km end nulls last,
    case when _tri = 'note'     then -e.note_moyenne end nulls last,
    case when _tri = 'offres'   then -e.nb_produits end,
    case when _tri = 'nom'      then e.raison_sociale end,
    e.raison_sociale;
$$;

comment on function public.annuaire_fournisseurs is
  'Annuaire filtrable par famille et type de materiau vendu. Distance a vol d''oiseau majoree du coefficient de sinuosite du depot (regle B6). Aucune donnee personnelle.';

revoke all on function public.annuaire_fournisseurs(double precision, double precision, text, text, boolean, boolean, text) from public;
grant execute on function public.annuaire_fournisseurs(double precision, double precision, text, text, boolean, boolean, text) to anon, authenticated, service_role;
