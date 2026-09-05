-- ═══════════════════════════════════════════════════════════════════════════
-- DEMANDES STRUCTURÉES — demandé par Andry le 02/09/2026.
--
-- Avant : « Publier une demande » = un texte libre dans le fil, illisible
-- par une machine, sans réponse possible autrement qu'en devinant. Après :
--   - une demande = plusieurs LIGNES (matériau du catalogue fermé + quantité),
--     un lieu de livraison, une date souhaitée, une note courte ;
--   - UNE SEULE demande ouverte par personne (index partiel) ;
--   - elle reste visible dans le fil (publication type 'demande' générée) ;
--   - les dépôts qui vendent ces matériaux dans leur rayon sont NOTIFIÉS et
--     PROPOSENT depuis leur espace pro : un prix par ligne, la livraison, un
--     délai ;
--   - l'acheteur voit les propositions sur la page de sa demande, accepte ou
--     refuse ; accepter clôt la demande (« pourvue »).
--
-- Tout passe par des RPC SECURITY DEFINER : les tables n'ont AUCUNE policy
-- d'écriture, et la lecture ne se fait que par ces fonctions — ni le lieu
-- précis de l'acheteur ni les propositions ne sont listables.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.demandes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  statut text not null default 'ouverte'
    check (statut in ('ouverte', 'pourvue', 'fermee')),
  localite_id uuid references public.localites(id) on delete set null,
  lat double precision,
  lng double precision,
  libelle_lieu text,
  date_souhaitee date,
  note text check (note is null or char_length(note) <= 300),
  publication_id uuid references public.publications(id) on delete set null,
  created_at timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '14 days'
);
comment on table public.demandes is 'Une demande d''achat structurée : ses lignes sont dans demandes_lignes. Une seule ouverte par personne.';
create unique index demandes_une_ouverte_par_personne on public.demandes (user_id) where statut = 'ouverte';
create index demandes_ouvertes on public.demandes (statut, expire_le) where statut = 'ouverte';

create table public.demandes_lignes (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes(id) on delete cascade,
  materiau_ref_id uuid not null references public.materiaux_ref(id),
  quantite numeric(12,2) not null check (quantite > 0),
  unite public.unite not null,
  precision text check (precision is null or char_length(precision) <= 120),
  ordre smallint not null default 0
);
create index demandes_lignes_par_demande on public.demandes_lignes (demande_id);
create index demandes_lignes_par_materiau on public.demandes_lignes (materiau_ref_id);

create table public.propositions (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes(id) on delete cascade,
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  livraison bigint check (livraison is null or livraison >= 0),
  delai_jours smallint check (delai_jours is null or delai_jours between 0 and 90),
  message text check (message is null or char_length(message) <= 300),
  statut text not null default 'envoyee'
    check (statut in ('envoyee', 'acceptee', 'refusee', 'retiree')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (demande_id, fournisseur_id)
);
comment on column public.propositions.livraison is 'Montant de la livraison jusqu''au lieu de la demande. NULL = à convenir.';

create table public.propositions_lignes (
  proposition_id uuid not null references public.propositions(id) on delete cascade,
  ligne_id uuid not null references public.demandes_lignes(id) on delete cascade,
  prix_unitaire bigint check (prix_unitaire is null or prix_unitaire > 0),
  disponible boolean not null default true,
  primary key (proposition_id, ligne_id)
);

alter table public.demandes enable row level security;
alter table public.demandes_lignes enable row level security;
alter table public.propositions enable row level security;
alter table public.propositions_lignes enable row level security;
-- Aucune policy : lecture et écriture UNIQUEMENT par les RPC ci-dessous.

-- ── Le fournisseur de l'utilisateur connecté (propriétaire ou membre) ────
create or replace function public.mon_fournisseur_id()
 returns uuid
 language sql stable security definer set search_path to 'public'
as $function$
  select f.id from public.fournisseurs f where f.owner_id = auth.uid() and f.statut = 'actif'
  union all
  select m.fournisseur_id from public.fournisseur_membres m
    join public.fournisseurs f on f.id = m.fournisseur_id
   where m.user_id = auth.uid() and f.statut = 'actif'
  limit 1;
$function$;

-- ── Créer une demande ──────────────────────────────────────────────────────
-- _lignes : [{"materiau_ref_id": uuid, "quantite": 100, "precision": "..."}]
create or replace function public.creer_demande(
    _lignes jsonb,
    _localite_id uuid default null,
    _lat double precision default null,
    _lng double precision default null,
    _libelle_lieu text default null,
    _date_souhaitee date default null,
    _note text default null)
 returns uuid
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  demandeur uuid := auth.uid();
  nouvelle uuid;
  ligne jsonb;
  ref record;
  n integer := 0;
  resume text := '';
  loc_nom text;
  pub uuid;
  f record;
  distance double precision;
  notifies integer := 0;
begin
  if demandeur is null then
    raise exception 'Il faut être connecté pour publier une demande.' using errcode = '42501';
  end if;
  if exists (select 1 from public.demandes d where d.user_id = demandeur and d.statut = 'ouverte') then
    raise exception 'Vous avez déjà une demande ouverte : clôturez-la avant d''en publier une autre.'
      using errcode = 'P0001';
  end if;
  if _lignes is null or jsonb_typeof(_lignes) <> 'array'
     or jsonb_array_length(_lignes) < 1 or jsonb_array_length(_lignes) > 10 then
    raise exception 'Une demande porte entre 1 et 10 matériaux.' using errcode = 'P0001';
  end if;

  insert into public.demandes (user_id, localite_id, lat, lng, libelle_lieu, date_souhaitee, note)
  values (demandeur, _localite_id, _lat, _lng, nullif(trim(_libelle_lieu), ''), _date_souhaitee, nullif(trim(_note), ''))
  returning id into nouvelle;

  for ligne in select * from jsonb_array_elements(_lignes) loop
    select m.id, m.nom, m.unite_defaut into ref
      from public.materiaux_ref m
     where m.id = (ligne->>'materiau_ref_id')::uuid and m.actif;
    if not found then
      raise exception 'Matériau inconnu du catalogue.' using errcode = 'P0001';
    end if;
    if coalesce((ligne->>'quantite')::numeric, 0) <= 0 then
      raise exception 'Chaque matériau demande une quantité.' using errcode = 'P0001';
    end if;
    insert into public.demandes_lignes (demande_id, materiau_ref_id, quantite, unite, precision, ordre)
    values (nouvelle, ref.id, (ligne->>'quantite')::numeric, ref.unite_defaut,
            nullif(trim(ligne->>'precision'), ''), n);
    resume := resume || case when n > 0 then ', ' else '' end
              || trim(to_char((ligne->>'quantite')::numeric, 'FM999999990.##')) || ' ' || ref.unite_defaut::text
              || ' ' || ref.nom;
    n := n + 1;
  end loop;

  -- La demande reste visible dans le fil, dans un texte lisible, SANS le
  -- lieu précis ni aucun numéro. Le trigger limiter_publications garde sa
  -- règle des 5 par jour.
  select l.nom into loc_nom from public.localites l where l.id = _localite_id;
  insert into public.publications (type, auteur_id, texte, localite_id, expire_le)
  values ('demande', demandeur,
          'Je cherche : ' || resume
          || case when coalesce(nullif(trim(_libelle_lieu), ''), loc_nom) is not null
                  then ' — livraison à ' || coalesce(loc_nom, nullif(trim(_libelle_lieu), '')) else '' end
          || case when _date_souhaitee is not null
                  then ', pour le ' || to_char(_date_souhaitee, 'DD/MM') else '' end
          || '. Dépôts : proposez votre prix rendu chantier.',
          _localite_id, now() + interval '14 days')
  returning id into pub;
  update public.demandes set publication_id = pub where id = nouvelle;

  -- Les dépôts qui vendent ces matériaux, dans leur rayon (× 1,5 : un dépôt
  -- accepte souvent un peu plus loin pour un vrai chantier). 30 au plus.
  for f in
    select distinct fo.id, fo.owner_id, fo.lat, fo.lng, fo.rayon_max_km, fo.coef_sinuosite
      from public.fournisseurs fo
      join public.produits p on p.fournisseur_id = fo.id and p.statut = 'actif'
     where fo.statut = 'actif' and fo.owner_id is not null and fo.owner_id <> demandeur
       and p.materiau_ref_id in (select dl.materiau_ref_id from public.demandes_lignes dl where dl.demande_id = nouvelle)
     limit 80
  loop
    if _lat is null or _lng is null or f.lat is null or f.lng is null then
      distance := null;
    else
      distance := 6371 * acos(least(1, greatest(-1,
        cos(radians(_lat)) * cos(radians(f.lat)) * cos(radians(f.lng) - radians(_lng))
        + sin(radians(_lat)) * sin(radians(f.lat))))) * coalesce(f.coef_sinuosite, 1.30);
    end if;
    if distance is null or distance <= coalesce(f.rayon_max_km, 40) * 1.5 then
      perform public.notifier(f.owner_id, 'Une demande près de chez vous',
        left('Je cherche : ' || resume, 200), '/pro/demandes', 'demande');
      notifies := notifies + 1;
      exit when notifies >= 30;
    end if;
  end loop;

  return nouvelle;
end;
$function$;

-- ── Ma demande, ses lignes, ses propositions ───────────────────────────────
create or replace function public.ma_demande()
 returns jsonb
 language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id', d.id, 'statut', d.statut, 'localite_id', d.localite_id,
    'localite_nom', (select l.nom from public.localites l where l.id = d.localite_id),
    'lat', d.lat, 'lng', d.lng, 'libelle_lieu', d.libelle_lieu,
    'date_souhaitee', d.date_souhaitee, 'note', d.note,
    'created_at', d.created_at, 'expire_le', d.expire_le,
    'lignes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', dl.id, 'materiau_ref_id', dl.materiau_ref_id, 'materiau_slug', m.slug,
        'nom', m.nom, 'quantite', dl.quantite, 'unite', dl.unite, 'precision', dl.precision
      ) order by dl.ordre), '[]'::jsonb)
      from public.demandes_lignes dl join public.materiaux_ref m on m.id = dl.materiau_ref_id
      where dl.demande_id = d.id),
    'propositions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pr.id, 'statut', pr.statut, 'livraison', pr.livraison, 'delai_jours', pr.delai_jours,
        'message', pr.message, 'created_at', pr.created_at,
        'fournisseur', jsonb_build_object(
          'id', f.id, 'slug', f.slug, 'raison_sociale', f.raison_sociale,
          'niveau_verification', f.niveau_verification, 'localite_nom',
          (select l.nom from public.localites l where l.id = f.localite_id),
          'lat', f.lat, 'lng', f.lng),
        'lignes', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'ligne_id', pl.ligne_id, 'prix_unitaire', pl.prix_unitaire, 'disponible', pl.disponible)), '[]'::jsonb)
          from public.propositions_lignes pl where pl.proposition_id = pr.id)
      ) order by pr.created_at desc), '[]'::jsonb)
      from public.propositions pr join public.fournisseurs f on f.id = pr.fournisseur_id
      where pr.demande_id = d.id and pr.statut <> 'retiree')
  )
  from public.demandes d
  where d.user_id = auth.uid() and d.statut in ('ouverte', 'pourvue')
  order by d.created_at desc
  limit 1;
$function$;

-- ── Clore sa demande (pour pouvoir en ouvrir une autre) ────────────────────
create or replace function public.fermer_demande(_demande_id uuid)
 returns void
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  update public.demandes set statut = 'fermee'
   where id = _demande_id and user_id = auth.uid() and statut in ('ouverte', 'pourvue');
  if not found then
    raise exception 'Demande introuvable.' using errcode = 'P0002';
  end if;
  update public.publications set statut = 'masquee'
   where id = (select publication_id from public.demandes where id = _demande_id);
end;
$function$;

-- ── Les demandes qui concernent MON dépôt ──────────────────────────────────
create or replace function public.demandes_pour_mon_depot()
 returns table(
   id uuid, libelle_lieu text, localite_nom text, distance_km numeric,
   date_souhaitee date, note text, created_at timestamptz, expire_le timestamptz,
   lignes jsonb, nb_correspondances integer, deja_propose boolean, statut_proposition text)
 language sql stable security definer set search_path to 'public'
as $function$
  with moi as (
    select f.id, f.lat, f.lng, f.coef_sinuosite
      from public.fournisseurs f where f.id = public.mon_fournisseur_id()
  )
  select
    d.id,
    d.libelle_lieu,
    (select l.nom from public.localites l where l.id = d.localite_id),
    case
      when d.lat is null or d.lng is null or moi.lat is null or moi.lng is null then null
      else round((6371 * acos(least(1, greatest(-1,
             cos(radians(d.lat)) * cos(radians(moi.lat)) * cos(radians(moi.lng) - radians(d.lng))
             + sin(radians(d.lat)) * sin(radians(moi.lat))
           ))) * coalesce(moi.coef_sinuosite, 1.30))::numeric, 1)
    end,
    d.date_souhaitee, d.note, d.created_at, d.expire_le,
    (select coalesce(jsonb_agg(jsonb_build_object(
        'id', dl.id, 'materiau_ref_id', dl.materiau_ref_id, 'nom', m.nom,
        'quantite', dl.quantite, 'unite', dl.unite, 'precision', dl.precision,
        'mon_produit_id', p.id, 'mon_prix', coalesce(p.prix_promo, p.prix_unitaire)
      ) order by dl.ordre), '[]'::jsonb)
      from public.demandes_lignes dl
      join public.materiaux_ref m on m.id = dl.materiau_ref_id
      left join public.produits p on p.materiau_ref_id = dl.materiau_ref_id
        and p.fournisseur_id = moi.id and p.statut = 'actif'
      where dl.demande_id = d.id),
    (select count(*)::integer from public.demandes_lignes dl
      join public.produits p on p.materiau_ref_id = dl.materiau_ref_id
       and p.fournisseur_id = moi.id and p.statut = 'actif'
      where dl.demande_id = d.id),
    exists (select 1 from public.propositions pr where pr.demande_id = d.id and pr.fournisseur_id = moi.id and pr.statut <> 'retiree'),
    (select pr.statut from public.propositions pr where pr.demande_id = d.id and pr.fournisseur_id = moi.id limit 1)
  from public.demandes d, moi
  where d.statut = 'ouverte' and d.expire_le > now()
    and exists (select 1 from public.demandes_lignes dl
                 join public.produits p on p.materiau_ref_id = dl.materiau_ref_id
                  and p.fournisseur_id = moi.id and p.statut = 'actif'
                where dl.demande_id = d.id)
  order by 4 nulls last, d.created_at desc
  limit 50;
$function$;

-- ── Proposer un prix ───────────────────────────────────────────────────────
-- _lignes : [{"ligne_id": uuid, "prix_unitaire": 3400, "disponible": true}]
create or replace function public.proposer(
    _demande_id uuid, _lignes jsonb, _livraison bigint default null,
    _delai_jours integer default null, _message text default null)
 returns uuid
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  moi uuid := public.mon_fournisseur_id();
  acheteur uuid;
  prop uuid;
  ligne jsonb;
  nom_depot text;
begin
  if moi is null then
    raise exception 'Seul un dépôt actif peut proposer un prix.' using errcode = '42501';
  end if;
  select d.user_id into acheteur from public.demandes d
   where d.id = _demande_id and d.statut = 'ouverte' and d.expire_le > now();
  if acheteur is null then
    raise exception 'Cette demande n''est plus ouverte.' using errcode = 'P0002';
  end if;

  insert into public.propositions (demande_id, fournisseur_id, livraison, delai_jours, message, statut)
  values (_demande_id, moi, _livraison, _delai_jours, nullif(trim(_message), ''), 'envoyee')
  on conflict (demande_id, fournisseur_id) do update
    set livraison = excluded.livraison, delai_jours = excluded.delai_jours,
        message = excluded.message, statut = 'envoyee', updated_at = now()
  returning id into prop;

  delete from public.propositions_lignes where proposition_id = prop;
  for ligne in select * from jsonb_array_elements(coalesce(_lignes, '[]'::jsonb)) loop
    if exists (select 1 from public.demandes_lignes dl
                where dl.id = (ligne->>'ligne_id')::uuid and dl.demande_id = _demande_id) then
      insert into public.propositions_lignes (proposition_id, ligne_id, prix_unitaire, disponible)
      values (prop, (ligne->>'ligne_id')::uuid,
              nullif((ligne->>'prix_unitaire')::bigint, 0),
              coalesce((ligne->>'disponible')::boolean, true));
    end if;
  end loop;

  select raison_sociale into nom_depot from public.fournisseurs where id = moi;
  perform public.notifier(acheteur, nom_depot || ' vous propose un prix',
    'Une proposition est arrivée sur votre demande.', '/demandes/nouvelle', 'demande');
  return prop;
end;
$function$;

-- ── Accepter ou refuser une proposition ────────────────────────────────────
create or replace function public.repondre_proposition(_proposition_id uuid, _decision text)
 returns void
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  dem uuid;
  depot_owner uuid;
begin
  if _decision not in ('acceptee', 'refusee') then
    raise exception 'Décision inconnue.' using errcode = 'P0001';
  end if;
  select pr.demande_id, f.owner_id into dem, depot_owner
    from public.propositions pr
    join public.demandes d on d.id = pr.demande_id
    join public.fournisseurs f on f.id = pr.fournisseur_id
   where pr.id = _proposition_id and d.user_id = auth.uid();
  if dem is null then
    raise exception 'Proposition introuvable.' using errcode = 'P0002';
  end if;
  update public.propositions set statut = _decision, updated_at = now() where id = _proposition_id;
  if _decision = 'acceptee' then
    update public.demandes set statut = 'pourvue' where id = dem;
    update public.publications set statut = 'masquee'
     where id = (select publication_id from public.demandes where id = dem);
    perform public.notifier(depot_owner, 'Votre proposition est acceptée',
      'L''acheteur va vous contacter pour la livraison.', '/pro/demandes', 'demande');
  end if;
end;
$function$;

grant execute on function public.mon_fournisseur_id() to authenticated;
grant execute on function public.creer_demande(jsonb, uuid, double precision, double precision, text, date, text) to authenticated;
grant execute on function public.ma_demande() to authenticated;
grant execute on function public.fermer_demande(uuid) to authenticated;
grant execute on function public.demandes_pour_mon_depot() to authenticated;
grant execute on function public.proposer(uuid, jsonb, bigint, integer, text) to authenticated;
grant execute on function public.repondre_proposition(uuid, text) to authenticated;
revoke execute on function public.creer_demande(jsonb, uuid, double precision, double precision, text, date, text) from anon;
revoke execute on function public.proposer(uuid, jsonb, bigint, integer, text) from anon;
