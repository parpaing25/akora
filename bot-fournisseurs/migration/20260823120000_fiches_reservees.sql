-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 37. Fiches réservées : la place gardée d'un dépôt qui n'a pas encore
--             de compte, et la mécanique pour qu'il la revendique.
-- ═══════════════════════════════════════════════════════════════════════════
-- Le bot de prospection (bot-fournisseurs/) relève sur Facebook les dépôts qui
-- vendent des matériaux du catalogue, avec leurs produits et leurs prix. On ne
-- peut pas les écrire dans `fournisseurs` : cette table exige un `owner_id`
-- qui référence `auth.users`, et ces dépôts n'ont pas de compte. D'où une
-- table d'attente.
--
-- 🔒 CE QUI N'EST PAS NÉGOCIABLE ICI
--
-- Ces lignes portent des données relevées dans des publications publiques,
-- SANS que la personne l'ait demandé. Elles ne sont donc :
--   • **jamais publiques** — `anon` n'a aucun droit sur la table, la fiche ne
--     s'ouvre qu'avec son jeton, un par dépôt, tiré au hasard sur 24 octets ;
--   • **jamais dans l'annuaire** — `annuaire_fournisseurs` lit `fournisseurs`,
--     et rien de tout ceci n'y entre avant une revendication ;
--   • **jamais indexées** — la page /depot-reserve/<jeton> se sert en noindex.
--
-- Un refus (`statut = 'refuse'`) est définitif : la fiche cesse d'être lisible
-- par son jeton, et le bot garde le numéro en liste rouge de son côté.
--
-- La revendication crée un VRAI fournisseur en `brouillon` et des produits en
-- `brouillon` : rien de ce qui a été relevé sur Facebook ne part en ligne sous
-- le nom du dépôt sans qu'il l'ait relu. C'est le point qui fait tenir tout le
-- reste — un prix faux publié à sa place serait pire que pas de fiche du tout.

-- ── La fiche réservée ─────────────────────────────────────────────────────
create table if not exists public.prospects_fournisseurs (
  id                uuid primary key default gen_random_uuid(),
  jeton             text not null unique,
  raison_sociale    text not null,
  metier            text,
  telephone         text,
  whatsapp          boolean not null default false,
  page_url          text,
  ville             text,
  quartier          text,
  adresse           text,
  lat               double precision,
  lng               double precision,
  localite_id       uuid references public.localites(id) on delete set null,
  photos            text[] not null default '{}',
  langue            text not null default 'fr',
  -- 'depot' | 'transporteur' | 'mixte'. Un transporteur ne vend aucun
  -- materiau : il loue sa benne. Sans lui, aucun prix rendu chantier.
  nature            text not null default 'depot',
  rayon_km          numeric(6,1),
  seuil_franco      bigint,
  source            text not null default 'facebook',
  source_url        text,
  score             integer,
  statut            text not null default 'reserve',
  reserve_le        timestamptz not null default now(),
  vue_le            timestamptz,
  nb_vues           integer not null default 0,
  revendique_le     timestamptz,
  fournisseur_id    uuid references public.fournisseurs(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint prospects_statut_connu
    check (statut in ('reserve', 'revendique', 'refuse', 'retire')),
  constraint prospects_nature_connue
    check (nature in ('depot', 'transporteur', 'mixte')),
  constraint prospects_jeton_assez_long check (length(jeton) >= 20),
  constraint prospects_photos_bornees check (cardinality(photos) <= 8),
  constraint prospects_lat_plausible check (lat is null or (lat between -26.0 and -11.0)),
  constraint prospects_lng_plausible check (lng is null or (lng between 42.0 and 51.5)),
  constraint prospects_coordonnees_completes check ((lat is null) = (lng is null))
);

comment on table public.prospects_fournisseurs is
  'Fiches pre-remplies par le bot de prospection, en attente de revendication. Jamais publiques : lisibles uniquement par leur jeton, via fiche_reservee().';
comment on column public.prospects_fournisseurs.jeton is
  'Secret de lecture de la fiche. Tire une seule fois par le bot et jamais regenere : il figure dans le message envoye au depot.';

create index if not exists idx_prospects_statut on public.prospects_fournisseurs(statut);
create index if not exists idx_prospects_tel on public.prospects_fournisseurs(telephone);

drop trigger if exists trg_prospects_updated on public.prospects_fournisseurs;
create trigger trg_prospects_updated before update on public.prospects_fournisseurs
  for each row execute function public.toucher_updated_at();

-- ── Les produits relevés ──────────────────────────────────────────────────
create table if not exists public.prospects_produits (
  id              uuid primary key default gen_random_uuid(),
  prospect_id     uuid not null references public.prospects_fournisseurs(id) on delete cascade,
  materiau_ref_id uuid not null references public.materiaux_ref(id) on delete cascade,
  libelle         text not null,
  prix_unitaire   bigint,
  unite           public.unite,
  quantite_min    integer,
  ordre           smallint not null default 0,
  created_at      timestamptz not null default now(),
  unique (prospect_id, materiau_ref_id),
  constraint prospects_produits_prix_positif
    check (prix_unitaire is null or prix_unitaire > 0)
);
create index if not exists idx_prospects_produits on public.prospects_produits(prospect_id, ordre);

-- ── Les vehicules releves ─────────────────────────────────────────────────
-- Miroir de `vehicules_livraison`. C'est la piece qui rend le prix rendu
-- chantier calculable : un fournisseur sans vehicule ne peut livrer personne,
-- et la fiche la plus complete du monde ne sert alors a rien.
--
-- Capacite et tarif sont NULLABLES a dessein. « 10 roues » est la facon
-- malgache de dire la taille d'un camion, mais la convertir en metres cubes
-- serait une estimation deguisee en mesure (regle A2.8) : on garde le libelle,
-- on laisse le chiffre vide, et le transporteur le remplira.
create table if not exists public.prospects_vehicules (
  id            uuid primary key default gen_random_uuid(),
  prospect_id   uuid not null references public.prospects_fournisseurs(id) on delete cascade,
  nom           text not null,
  categorie     text,
  capacite_m3   numeric(8,2),
  capacite_kg   numeric(10,1),
  prix_par_km   bigint,
  forfait_base  bigint,
  km_inclus     numeric(6,1),
  prix_minimum  bigint,
  aller_retour  boolean not null default false,
  ordre         smallint not null default 0,
  created_at    timestamptz not null default now(),
  unique (prospect_id, nom),
  constraint prospects_vehicules_capacites_positives
    check ((capacite_m3 is null or capacite_m3 > 0)
       and (capacite_kg is null or capacite_kg > 0)),
  constraint prospects_vehicules_montants_positifs
    check ((prix_par_km is null or prix_par_km >= 0)
       and (forfait_base is null or forfait_base >= 0)
       and (prix_minimum is null or prix_minimum >= 0))
);
create index if not exists idx_prospects_vehicules
  on public.prospects_vehicules(prospect_id, ordre);

-- ── Droits : tout est fermé, on ne passe que par les fonctions ────────────
alter table public.prospects_fournisseurs enable row level security;
alter table public.prospects_produits     enable row level security;
alter table public.prospects_vehicules    enable row level security;

revoke all on public.prospects_fournisseurs from anon, authenticated;
revoke all on public.prospects_produits     from anon, authenticated;
revoke all on public.prospects_vehicules    from anon, authenticated;
grant all  on public.prospects_fournisseurs to service_role;
grant all  on public.prospects_produits     to service_role;
grant all  on public.prospects_vehicules    to service_role;

drop policy if exists "vehicules de prospect vus par un admin" on public.prospects_vehicules;
create policy "vehicules de prospect vus par un admin" on public.prospects_vehicules
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

drop policy if exists "prospects vus par un admin" on public.prospects_fournisseurs;
create policy "prospects vus par un admin" on public.prospects_fournisseurs
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

drop policy if exists "produits de prospect vus par un admin" on public.prospects_produits;
create policy "produits de prospect vus par un admin" on public.prospects_produits
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

-- ── Lire sa fiche, avec son jeton et rien d'autre ─────────────────────────
-- SECURITY DEFINER parce que la table est fermée à tout le monde. La fonction
-- ne prend qu'un jeton : il n'y a rien à énumérer, et une fiche refusée ou
-- déjà revendiquée ne répond plus.
create or replace function public.fiche_reservee(_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fiche public.prospects_fournisseurs;
  produits jsonb;
  flotte   jsonb;
begin
  if _jeton is null or length(_jeton) < 20 then
    return null;
  end if;

  select * into fiche from public.prospects_fournisseurs
   where jeton = _jeton and statut = 'reserve';
  if not found then
    return null;
  end if;

  -- Compteur de vues : c'est la seule mesure honnête de l'intérêt suscité,
  -- et elle sert au bot pour savoir quand relancer (une fiche ouverte trois
  -- fois sans revendication, c'est un appel a passer, pas un message de plus).
  update public.prospects_fournisseurs
     set nb_vues = nb_vues + 1, vue_le = now()
   where id = fiche.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'libelle', p.libelle,
           'materiau', m.nom,
           'materiau_slug', m.slug,
           'famille', c.nom,
           'prix_unitaire', p.prix_unitaire,
           'unite', coalesce(p.unite, m.unite_defaut)::text,
           'quantite_min', p.quantite_min
         ) order by p.ordre), '[]'::jsonb)
    into produits
    from public.prospects_produits p
    join public.materiaux_ref m on m.id = p.materiau_ref_id
    join public.categories c on c.id = m.categorie_id
   where p.prospect_id = fiche.id;

  -- La flotte compte autant que les produits : c'est elle qui rend le prix
  -- rendu chantier calculable, et le transporteur qui ouvre sa fiche veut y
  -- voir SON camion, pas une page vide.
  select coalesce(jsonb_agg(jsonb_build_object(
           'nom', v.nom,
           'categorie', v.categorie,
           'capacite_m3', v.capacite_m3,
           'capacite_kg', v.capacite_kg,
           'forfait_base', v.forfait_base,
           'prix_par_km', v.prix_par_km,
           'aller_retour', v.aller_retour
         ) order by v.ordre), '[]'::jsonb)
    into flotte
    from public.prospects_vehicules v
   where v.prospect_id = fiche.id;

  return jsonb_build_object(
    'jeton', fiche.jeton,
    'nature', fiche.nature,
    'rayon_km', fiche.rayon_km,
    'vehicules', flotte,
    'raison_sociale', fiche.raison_sociale,
    'metier', fiche.metier,
    'ville', fiche.ville,
    'quartier', fiche.quartier,
    'adresse', fiche.adresse,
    'telephone', fiche.telephone,
    'photos', to_jsonb(fiche.photos),
    'langue', fiche.langue,
    'source_url', fiche.source_url,
    'reserve_le', fiche.reserve_le,
    'produits', produits
  );
end;
$$;

comment on function public.fiche_reservee(text) is
  'La fiche pre-remplie d''un depot, lisible par son seul jeton. Ne rend jamais rien pour une fiche refusee, retiree ou deja revendiquee.';

-- ── Revendiquer : la fiche devient un vrai fournisseur ────────────────────
-- Le demandeur doit être connecté : `owner_id` référence `auth.users`, il n'y
-- a pas de revendication anonyme possible. Tout est créé en BROUILLON — le
-- dépôt relit ses prix avant que quoi que ce soit soit visible.
create or replace function public.revendiquer_fiche(_jeton text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
    adresse, localite_id, lat, lng, photo_depot, statut, niveau_verification)
  values (
    demandeur, fiche.raison_sociale, slug_final, fiche.metier, fiche.telephone,
    case when fiche.whatsapp then fiche.telephone else null end,
    fiche.adresse, fiche.localite_id, fiche.lat, fiche.lng,
    nullif(fiche.photos[1], ''),
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
      facturer_aller_retour, actif)
    values (
      nouveau_id, ligne.nom,
      coalesce(ligne.capacite_m3, 1), coalesce(ligne.capacite_kg, 1000),
      coalesce(ligne.prix_par_km, 0), coalesce(ligne.forfait_base, 0),
      coalesce(ligne.km_inclus, 0), coalesce(ligne.prix_minimum, 0),
      ligne.aller_retour,
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
$$;

comment on function public.revendiquer_fiche(text) is
  'Transforme une fiche reservee en vrai fournisseur, en BROUILLON, possede par le compte connecte. Un compte ne peut revendiquer qu''une seule fiche.';

-- ── Refuser : « ne me recontactez plus » ──────────────────────────────────
-- Accessible sans compte : exiger une inscription pour se faire retirer d'une
-- liste serait exactement le contraire de ce que la fonction promet.
create or replace function public.refuser_fiche(_jeton text, _motif text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  touchees integer;
begin
  if _jeton is null or length(_jeton) < 20 then
    return false;
  end if;
  update public.prospects_fournisseurs
     set statut = 'refuse', updated_at = now()
   where jeton = _jeton and statut = 'reserve';
  get diagnostics touchees = row_count;
  -- Les produits relevés partent avec la fiche : ne garder que l'entête
  -- laisserait des prix relevés sans consentement dans la base.
  if touchees > 0 then
    delete from public.prospects_produits
     where prospect_id = (select id from public.prospects_fournisseurs where jeton = _jeton);
  end if;
  return touchees > 0;
end;
$$;

comment on function public.refuser_fiche(text, text) is
  'Retire une fiche reservee a la demande du depot. Definitif, et sans compte a creer.';

revoke all on function public.fiche_reservee(text) from public;
revoke all on function public.revendiquer_fiche(text) from public;
revoke all on function public.refuser_fiche(text, text) from public;
grant execute on function public.fiche_reservee(text) to anon, authenticated, service_role;
grant execute on function public.revendiquer_fiche(text) to authenticated, service_role;
grant execute on function public.refuser_fiche(text, text) to anon, authenticated, service_role;
