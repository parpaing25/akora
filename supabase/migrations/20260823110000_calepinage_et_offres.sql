-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 36. De quoi calepiner une dalle, et de quoi choisir son depot
-- ═══════════════════════════════════════════════════════════════════════════
-- Le calculateur multipliait une surface par un ratio « pieces au m2 ». Ce
-- nombre ne correspond a aucune dalle constructible : une dalle se pose en
-- FILES entieres, chaque file demande une poutrelle de plus, et la derniere
-- compte autant que les autres meme si elle deborde.
--
-- Sur 22 m2, le ratio annonçait 184 hourdis et 37 ml de poutrelles la ou il en
-- faut 196 et 44 — six et vingt pour cent de manque. Le macon retourne au
-- depot. Pour calepiner, il faut les DEUX dimensions de pose du hourdis, pas
-- seulement son epaisseur : c'est ce que ces colonnes portent.

-- `longueur_cm` : la dimension qui franchit l'espace entre deux poutrelles,
--                 donc l'entraxe.
-- `largeur_cm`  : la dimension le long de la poutrelle, donc le pas de pose.
update public.materiaux_ref set longueur_cm = 60, largeur_cm = 20
 where slug in ('hourdis-12', 'hourdis-16', 'hourdis-20');
update public.materiaux_ref set longueur_cm = 33, largeur_cm = 33
 where slug in ('hourdis-tc-12', 'hourdis-tc-15', 'hourdis-tc-20');

-- Parpaings : 40 x 20 de parement, d'ou les 12,5 blocs au m2 hors joints.
update public.materiaux_ref set longueur_cm = 40, largeur_cm = 20
 where slug in ('parpaing-creux-10', 'parpaing-creux-15', 'parpaing-creux-20',
                'parpaing-plein-10', 'parpaing-plein-15', 'parpaing-plein-20');
update public.materiaux_ref set longueur_cm = 40, largeur_cm = 20
 where slug in ('brique-creuse-10x20x40', 'brique-creuse-15x20x40', 'brique-creuse-20x20x40');

-- ── Toutes les offres d'un materiau, pas seulement la moins chere ─────────
-- Le calculateur retient la moins chere RENDUE par defaut, mais l'acheteur
-- doit pouvoir en choisir une autre : le moins cher n'est pas toujours celui
-- qu'on veut — on connait le voisin, on lui doit un service, il livre le
-- samedi. La fonction rend donc la liste entiere, triee.
--
-- SECURITY DEFINER : elle lit `produits` et `fournisseurs`, fermees au
-- visiteur anonyme. Aucune donnee personnelle ne sort d'ici.
create or replace function public.offres_pour_materiaux(
  _slugs text[],
  _lat   double precision default null,
  _lng   double precision default null
)
returns table (
  materiau_slug       text,
  materiau_nom        text,
  produit_id          uuid,
  produit_slug        text,
  produit_nom         text,
  unite               text,
  prix_unitaire       numeric,
  quantite_min        integer,
  stock_statut        text,
  poids_kg_unite      numeric,
  volume_m3_unite     numeric,
  fournisseur_id      uuid,
  fournisseur_slug    text,
  fournisseur_nom     text,
  fournisseur_niveau  text,
  fournisseur_lat     double precision,
  fournisseur_lng     double precision,
  rayon_max_km        integer,
  coef_sinuosite      numeric,
  distance_km         numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.slug, m.nom,
    p.id, p.slug, p.nom_affiche,
    p.unite::text,
    coalesce(p.prix_promo, p.prix_unitaire),
    p.quantite_min,
    p.stock_statut::text,
    p.poids_kg_unite,
    p.volume_m3_unite,
    f.id, f.slug, f.raison_sociale,
    f.niveau_verification::text,
    f.lat, f.lng, f.rayon_max_km, f.coef_sinuosite,
    case
      when _lat is null or _lng is null or f.lat is null or f.lng is null then null
      else round((6371 * acos(least(1, greatest(-1,
             cos(radians(_lat)) * cos(radians(f.lat)) * cos(radians(f.lng) - radians(_lng))
             + sin(radians(_lat)) * sin(radians(f.lat))
           ))) * coalesce(f.coef_sinuosite, 1.30))::numeric, 1)
    end
  from public.produits p
  join public.materiaux_ref m on m.id = p.materiau_ref_id
  join public.fournisseurs f on f.id = p.fournisseur_id
  where p.statut = 'actif' and f.statut = 'actif' and m.slug = any(_slugs)
  order by m.slug, coalesce(p.prix_promo, p.prix_unitaire);
$$;

comment on function public.offres_pour_materiaux is
  'Toutes les offres actives pour une liste de references, triees par prix au depot. Le prix RENDU se calcule ensuite cote client, avec les quantites reelles (regle B6). Aucune donnee personnelle.';

revoke all on function public.offres_pour_materiaux(text[], double precision, double precision) from public;
grant execute on function public.offres_pour_materiaux(text[], double precision, double precision) to anon, authenticated, service_role;
