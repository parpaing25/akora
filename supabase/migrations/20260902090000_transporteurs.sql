-- ═══════════════════════════════════════════════════════════════════════════
-- TRANSPORTEURS — demandé par Andry le 01/09/2026.
-- Trouver un camion pour ses gravillons doit être aussi simple que trouver
-- un parpaing. Un fournisseur peut être un dépôt, un transporteur pur, ou
-- les deux ; ses camions portent marque, catégorie, « X roues », tonnage.
--
-- Le schéma colle à ce que le bot (bot-fournisseurs/bot/transport.py) sait
-- produire : nom, catégorie, capacité m³/kg, prix/km, forfait, km inclus,
-- aller-retour. On n'ajoute que ce que le terrain annonce vraiment.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) La nature du fournisseur ----------------------------------------------
alter table public.fournisseurs
  add column if not exists nature text not null default 'depot'
    constraint fournisseurs_nature_valide
    check (nature in ('depot', 'transporteur', 'mixte'));

comment on column public.fournisseurs.nature is
  'depot = vend des matériaux ; transporteur = loue ses camions ; mixte = les deux.';

-- 2) Les camions, tels qu''on les annonce à Madagascar ----------------------
alter table public.vehicules_livraison
  add column if not exists marque text,
  add column if not exists modele text,
  add column if not exists categorie text
    constraint vehicules_categorie_valide
    check (categorie is null or categorie in
      ('benne', 'plateau', 'semi', 'citerne', 'camion', 'fourgon', 'leger')),
  add column if not exists nb_roues smallint
    constraint vehicules_nb_roues_valide
    check (nb_roues is null or nb_roues between 3 and 22),
  add column if not exists materiaux_acceptes text[] not null default '{}',
  add column if not exists photo_url text;

comment on column public.vehicules_livraison.nb_roues is
  '« 6 roues », « 10 roues » : la mesure malgache de la taille d''un camion. On la garde telle quelle, jamais convertie en m³ (règle : aucune donnée inventée).';
comment on column public.vehicules_livraison.materiaux_acceptes is
  'Slugs de familles du catalogue (granulats, bois, …) ou ''tout''. Vide = non renseigné.';

-- Les fiches réservées du bot portent les mêmes champs (categorie y existe déjà).
alter table public.prospects_vehicules
  add column if not exists marque text,
  add column if not exists nb_roues smallint,
  add column if not exists materiaux_acceptes text[] not null default '{}',
  add column if not exists photo_url text;

-- 3) L''annuaire public des transporteurs -----------------------------------
-- Même règle PII que fournisseurs_publics : ni téléphone, ni email dans la
-- vue. Le contact passe par la fiche, comme pour les dépôts.
create or replace view public.transporteurs_publics as
select
  f.id, f.slug, f.raison_sociale, f.description, f.logo_url, f.couverture_url,
  f.photo_depot, f.localite_id, l.nom as localite_nom, f.lat, f.lng,
  f.rayon_max_km, f.niveau_verification, f.note_moyenne, f.nb_avis, f.nature,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'nom', v.nom, 'marque', v.marque, 'modele', v.modele,
      'categorie', v.categorie, 'nb_roues', v.nb_roues,
      'capacite_m3', v.capacite_m3, 'capacite_kg', v.capacite_kg,
      'prix_par_km', v.prix_par_km, 'forfait_base', v.forfait_base,
      'km_inclus', v.km_inclus, 'prix_minimum', v.prix_minimum,
      'facturer_aller_retour', v.facturer_aller_retour,
      'materiaux_acceptes', v.materiaux_acceptes, 'photo_url', v.photo_url
    ) order by v.ordre)
    from public.vehicules_livraison v
    where v.fournisseur_id = f.id and v.actif
  ), '[]'::jsonb) as vehicules
from public.fournisseurs f
left join public.localites l on l.id = f.localite_id
where f.statut = 'actif' and f.nature in ('transporteur', 'mixte');

grant select on public.transporteurs_publics to anon, authenticated;

-- 4) fournisseurs_publics expose la nature ----------------------------------
-- (recréée à l''identique + nature ; drop d''abord : remplacer une vue ne
-- permet pas d''insérer une colonne au milieu.)
drop view if exists public.fournisseurs_publics;
create view public.fournisseurs_publics as
 SELECT f.id,
    f.slug,
    f.raison_sociale,
    f.description,
    f.logo_url,
    f.couverture_url,
    f.nif,
    f.stat,
    f.rcs,
    f.localite_id,
    f.lat,
    f.lng,
    f.horaires,
    f.rayon_max_km,
    f.coef_sinuosite,
    f.assujetti_tva,
    f.niveau_verification,
    f.verifie_le,
    f.note_moyenne,
    f.nb_avis,
    f.nb_commandes_cloturees,
    f.modes_paiement_acceptes,
    f.taux_acompte,
    f.created_at,
    f.metier,
    f.photo_depot,
    f.retrait_sur_place,
    f.nature,
    COALESCE(( SELECT array_agg(v.nom ORDER BY v.capacite_kg) AS array_agg
           FROM vehicules_livraison v
          WHERE v.fournisseur_id = f.id AND v.actif), '{}'::text[]) AS vehicules,
    l.nom AS localite_nom
   FROM fournisseurs f
     LEFT JOIN localites l ON l.id = f.localite_id
  WHERE f.statut = 'actif'::statut_fournisseur;

grant select on public.fournisseurs_publics to anon, authenticated;

-- 5) L'annuaire filtre par nature -------------------------------------------
-- Ajouter un paramètre par défaut crée une SURCHARGE si l'ancienne signature
-- reste : PostgREST ne saurait plus laquelle appeler. Drop d'abord.
drop function if exists public.annuaire_fournisseurs(
  double precision, double precision, text, text, boolean, boolean, text);

CREATE OR REPLACE FUNCTION public.annuaire_fournisseurs(
    _lat double precision DEFAULT NULL::double precision,
    _lng double precision DEFAULT NULL::double precision,
    _famille text DEFAULT NULL::text,
    _type text DEFAULT NULL::text,
    _verifies_seulement boolean DEFAULT false,
    _livre_chez_moi boolean DEFAULT false,
    _tri text DEFAULT 'distance'::text,
    _nature text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, raison_sociale text, slug text, metier text, localite_nom text, distance_km numeric, niveau_verification text, note_moyenne numeric, nb_avis integer, rayon_max_km integer, nb_produits bigint, photo_depot text, logo_url text, familles text[], types text[], produit_phare jsonb, nature text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with base as (
    select
      f.id, f.raison_sociale, f.slug, f.metier, f.niveau_verification,
      f.note_moyenne, f.nb_avis, f.rayon_max_km, f.photo_depot, f.logo_url,
      f.nature,
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
      and (_nature is null or f.nature = _nature
           or (_nature in ('depot', 'transporteur') and f.nature = 'mixte'))
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
      -- Le produit phare : le moins cher. C'est celui qui donne le « dès ».
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
    e.nb_produits, e.photo_depot, e.logo_url, e.familles, e.types,
    e.produit_phare, e.nature
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
$function$;

-- 6) revendiquer_fiche : la nature et les specs camion survivent désormais
--    à la conversion prospect → fournisseur. Avant : prospects_vehicules.categorie
--    était PERDUE au passage vers vehicules_livraison (constat croisé bot + audit
--    site du 01/09/2026), et la nature (transporteur) n'était pas reportée.
--    Recréée depuis la définition EN BASE (pg_get_functiondef), pas depuis le
--    .sql du dépôt — règle : remonter à la source.
CREATE OR REPLACE FUNCTION public.revendiquer_fiche(_jeton text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  fiche       public.prospects_fournisseurs;
  demandeur   uuid := auth.uid();
  nouveau_id  uuid;
  base_slug   text;
  slug_final  text;
  suffixe     integer := 1;
  ligne       record;
begin
  if demandeur is null then
    raise exception 'Il faut être connecté pour revendiquer une fiche.'
      using errcode = '42501';
  end if;

  select * into fiche from public.prospects_fournisseurs
   where jeton = _jeton and statut = 'reserve'
   for update;
  if not found then
    raise exception 'Cette fiche n''existe pas, ou elle a déjà été revendiquée.'
      using errcode = 'P0002';
  end if;

  -- Un compte = un fournisseur. Sans ce garde-fou, un même utilisateur
  -- pourrait revendiquer dix fiches et se retrouver a la tete de dix depots.
  if exists (select 1 from public.fournisseurs where owner_id = demandeur) then
    raise exception 'Ce compte gère déjà un fournisseur.' using errcode = '23505';
  end if;

  -- ── Le bot a-t-il DEJA cree ce fournisseur ? ────────────────────────────
  -- Le bot peut inscrire un depot sur le site avant meme de le contacter : la
  -- fiche existe alors deja, portee par le compte Akora, avec ses produits.
  -- Dans ce cas on TRANSFERE la propriete au depot qui revendique — creer un
  -- second fournisseur du meme nom a cote du premier serait la pire des
  -- reponses, et c'est ce qui se serait passe sans ce bloc.
  if fiche.fournisseur_id is not null
     and exists (select 1 from public.fournisseurs where id = fiche.fournisseur_id) then
    update public.fournisseurs
       set owner_id = demandeur,
           -- Le depot reprend la main : sa fiche repasse en brouillon pour
           -- qu'il relise SES prix avant de les remettre en ligne.
           statut = 'brouillon',
           updated_at = now()
     where id = fiche.fournisseur_id;

    insert into public.user_roles (user_id, role)
    values (demandeur, 'fournisseur')
    on conflict (user_id, role) do nothing;

    update public.prospects_fournisseurs
       set statut = 'revendique', revendique_le = now()
     where id = fiche.id;

    return fiche.fournisseur_id;
  end if;

  base_slug := regexp_replace(
    lower(public.sans_accent(fiche.raison_sociale)), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'depot'; end if;
  slug_final := base_slug;
  while exists (select 1 from public.fournisseurs where slug = slug_final) loop
    suffixe := suffixe + 1;
    slug_final := base_slug || '-' || suffixe;
  end loop;

  insert into public.fournisseurs (
    owner_id, raison_sociale, slug, metier, telephone, whatsapp,
    adresse, localite_id, lat, lng, photo_depot, nature, statut, niveau_verification)
  values (
    demandeur, fiche.raison_sociale, slug_final, fiche.metier, fiche.telephone,
    case when fiche.whatsapp then fiche.telephone else null end,
    fiche.adresse, fiche.localite_id, fiche.lat, fiche.lng,
    nullif(fiche.photos[1], ''),
    coalesce(fiche.nature, 'depot'),
    -- BROUILLON, pas 'actif' : la fiche n'apparaît nulle part tant que son
    -- propriétaire ne l'a pas relue et envoyée en vérification.
    'brouillon', 'non_verifie')
  returning id into nouveau_id;

  insert into public.user_roles (user_id, role)
  values (demandeur, 'fournisseur')
  on conflict (user_id, role) do nothing;

  for ligne in
    select p.*, m.slug as ref_slug, m.nom as ref_nom, m.unite_defaut
      from public.prospects_produits p
      join public.materiaux_ref m on m.id = p.materiau_ref_id
     where p.prospect_id = fiche.id
     order by p.ordre
  loop
    -- `poids_kg_unite` et `volume_m3_unite` sont laissés NULL exprès :
    -- le trigger `aligner_produit_sur_reference` les remplit depuis la
    -- référence, et c'est lui qui doit faire autorite.
    insert into public.produits (
      fournisseur_id, materiau_ref_id, categorie_id, nom_affiche, slug,
      unite, prix_unitaire, quantite_min, poids_kg_unite, volume_m3_unite, statut)
    select
      nouveau_id, ligne.materiau_ref_id, m.categorie_id, ligne.ref_nom, ligne.ref_slug,
      coalesce(ligne.unite, ligne.unite_defaut),
      -- Un produit sans prix relevé part à 1 Ar : la contrainte exige un
      -- montant positif, et le dépôt corrigera. Le statut brouillon garantit
      -- que personne ne voit ce 1 Ar.
      coalesce(ligne.prix_unitaire, 1),
      coalesce(ligne.quantite_min, 1), null, null, 'brouillon'
      from public.materiaux_ref m where m.id = ligne.materiau_ref_id
    on conflict (fournisseur_id, slug) do nothing;
  end loop;

  -- La flotte relevee devient de VRAIS vehicules de livraison. Une capacite
  -- inconnue est remplacee par un minimum symbolique : la table l'exige
  -- positive, et le transporteur corrigera. Rien n'est visible tant que le
  -- fournisseur est en brouillon.
  for ligne in
    select * from public.prospects_vehicules
     where prospect_id = fiche.id order by ordre
  loop
    insert into public.vehicules_livraison (
      fournisseur_id, nom, capacite_m3, capacite_kg,
      prix_par_km, forfait_base, km_inclus, prix_minimum,
      facturer_aller_retour, categorie, marque, nb_roues,
      materiaux_acceptes, photo_url, actif)
    values (
      nouveau_id, ligne.nom,
      coalesce(ligne.capacite_m3, 1), coalesce(ligne.capacite_kg, 1000),
      coalesce(ligne.prix_par_km, 0), coalesce(ligne.forfait_base, 0),
      coalesce(ligne.km_inclus, 0), coalesce(ligne.prix_minimum, 0),
      ligne.aller_retour,
      ligne.categorie, ligne.marque, ligne.nb_roues,
      coalesce(ligne.materiaux_acceptes, '{}'), ligne.photo_url,
      -- Un vehicule sans capacite mesuree n'entre pas dans un calcul de
      -- livraison : il est cree, mais inactif, pour que le transporteur le
      -- complete au lieu de facturer sur une capacite inventee.
      ligne.capacite_m3 is not null or ligne.capacite_kg is not null);
  end loop;

  -- La zone annoncee, si elle a ete relevee.
  if fiche.rayon_km is not null then
    insert into public.zones_livraison (fournisseur_id, nom, rayon_km, actif)
    values (nouveau_id, 'Zone annoncee', fiche.rayon_km, true);
    update public.fournisseurs set rayon_max_km = fiche.rayon_km
     where id = nouveau_id;
  end if;

  update public.prospects_fournisseurs
     set statut = 'revendique', revendique_le = now(), fournisseur_id = nouveau_id
   where id = fiche.id;

  return nouveau_id;
end;
$function$
;
