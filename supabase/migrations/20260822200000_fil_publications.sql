-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 28. L'accueil devient un fil, plus une vitrine
-- ═══════════════════════════════════════════════════════════════════════════
-- Un fournisseur de materiaux n'a pas un catalogue stable : il a du stock qui
-- arrive, un camion qui part demain a Talatamaty, un prix qui baisse jusqu'a
-- samedi. Une vitrine ne dit rien de tout cela. Un fil, si.
--
-- Trois natures de publication :
--   · le fournisseur annonce (stock, baisse de prix, tournee de livraison) ;
--   · Akora publie les prix du marche, et personne d'autre ne le peut ;
--   · l'acheteur ouvre une demande, a laquelle les fournisseurs repondent.
--
-- Rien n'est en Realtime (regle A2.7) : le fil se rafraichit au retour de
-- focus. Un fil temps reel sur mutualise, c'est l'egress de Fonenako.

create type public.type_publication as enum (
  'stock', 'baisse_prix', 'livraison', 'prix_marche', 'demande'
);
create type public.statut_publication as enum (
  'publiee', 'masquee', 'signalee', 'supprimee'
);

create table if not exists public.publications (
  id             uuid primary key default gen_random_uuid(),
  type           public.type_publication not null,
  -- Nul pour une publication Akora ou pour une demande d'acheteur.
  fournisseur_id uuid references public.fournisseurs(id) on delete cascade,
  auteur_id      uuid references public.profiles(id) on delete set null,
  texte          text not null check (char_length(texte) between 10 and 1200),
  photos         text[] not null default '{}'
                 check (coalesce(array_length(photos, 1), 0) <= 4),
  localite_id    uuid references public.localites(id),
  statut         public.statut_publication not null default 'publiee',
  epingle        boolean not null default false,
  publie_le      timestamptz not null default now(),
  expire_le      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Une demande n'a PAS de fournisseur. Sans cette precision, un acheteur
  -- pourrait publier une demande rattachee au depot de son choix, et elle
  -- s'afficherait dans le fil sous le nom de ce depot.
  constraint publication_coherente check (
    (type = 'demande' and auteur_id is not null and fournisseur_id is null)
    or (type = 'prix_marche' and fournisseur_id is null)
    or (type in ('stock', 'baisse_prix', 'livraison') and fournisseur_id is not null)
  )
);

-- Produits mis en avant dans une publication (0 a 4).
create table if not exists public.publication_produits (
  publication_id uuid not null references public.publications(id) on delete cascade,
  produit_id     uuid not null references public.produits(id) on delete cascade,
  ordre          smallint not null default 0,
  primary key (publication_id, produit_id)
);

-- Abonnements acheteur → fournisseur.
create table if not exists public.abonnements (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, fournisseur_id)
);

create index if not exists idx_publications_fil on public.publications (statut, publie_le desc);
create index if not exists idx_publications_fournisseur on public.publications (fournisseur_id, publie_le desc);
create index if not exists idx_publications_auteur on public.publications (auteur_id);
create index if not exists idx_publications_localite on public.publications (localite_id);
create index if not exists idx_publications_texte on public.publications using gin (texte gin_trgm_ops);
create index if not exists idx_pubprod_produit on public.publication_produits (produit_id);
create index if not exists idx_abonnements_fournisseur on public.abonnements (fournisseur_id);

drop trigger if exists trg_publications_updated on public.publications;
create trigger trg_publications_updated before update on public.publications
  for each row execute function public.toucher_updated_at();

-- ── Plafonds anti-abus ────────────────────────────────────────────────────
-- Dix annonces par jour et par depot, cinq demandes par jour et par acheteur.
-- Au-dela, ce n'est plus un fil, c'est un mur d'affichage.
create or replace function public.limiter_publications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if new.fournisseur_id is not null then
    select count(*) into n
      from public.publications
     where fournisseur_id = new.fournisseur_id
       and publie_le > now() - interval '1 day';
    if n >= 10 then
      raise exception 'Limite de 10 publications par jour atteinte pour ce depot.'
        using errcode = 'P0001';
    end if;
  elsif new.type = 'demande' and new.auteur_id is not null then
    select count(*) into n
      from public.publications
     where auteur_id = new.auteur_id and type = 'demande'
       and publie_le > now() - interval '1 day';
    if n >= 5 then
      raise exception 'Limite de 5 demandes par jour atteinte.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_publications_plafond on public.publications;
create trigger trg_publications_plafond before insert on public.publications
  for each row execute function public.limiter_publications();

-- ── Colonnes qu'un auteur ne decide pas ───────────────────────────────────
-- La RLS autorise une LIGNE, jamais une COLONNE. Sans ce garde-fou, l'auteur
-- d'une publication pourrait la reclasser en « prix du marche », l'epingler en
-- tete de fil, ou defaire une moderation. En SECURITY INVOKER volontairement :
-- c'est ce qui permet a `est_appel_systeme()` de distinguer un appel du
-- navigateur d'un appel interne.
create or replace function public.proteger_colonnes_publication()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.est_appel_systeme() or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  new.type           := old.type;
  new.fournisseur_id := old.fournisseur_id;
  new.auteur_id      := old.auteur_id;
  new.epingle        := old.epingle;
  -- L'auteur peut retirer sa publication, jamais la relever ni lever un
  -- signalement.
  if new.statut is distinct from old.statut and new.statut <> 'supprimee' then
    new.statut := old.statut;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_publications_colonnes on public.publications;
create trigger trg_publications_colonnes before update on public.publications
  for each row execute function public.proteger_colonnes_publication();

revoke all on function public.limiter_publications() from public, anon, authenticated;
revoke all on function public.proteger_colonnes_publication() from public, anon, authenticated;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.publications          enable row level security;
alter table public.publication_produits  enable row level security;
alter table public.abonnements           enable row level security;

-- Le navigateur anonyme ne touche AUCUNE table de base : il lit le fil par la
-- vue publique, et rien d'autre. Le refus tombe au niveau du GRANT, avant
-- meme la RLS.
revoke all on public.publications         from anon;
revoke all on public.publication_produits from anon;
revoke all on public.abonnements          from anon;

grant select, insert, update on public.publications        to authenticated;
grant select, insert, delete on public.publication_produits to authenticated;
grant select, insert, delete on public.abonnements          to authenticated;
grant all on public.publications, public.publication_produits, public.abonnements to service_role;

drop policy if exists "publications lisibles si publiees" on public.publications;
create policy "publications lisibles si publiees" on public.publications
  for select to authenticated
  using (
    statut = 'publiee'
    or auteur_id = (select auth.uid())
    or fournisseur_id in (select id from public.fournisseurs where owner_id = (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin')
  );

drop policy if exists "un depot actif publie chez lui" on public.publications;
create policy "un depot actif publie chez lui" on public.publications
  for insert to authenticated
  with check (
    fournisseur_id in (
      select id from public.fournisseurs
       where owner_id = (select auth.uid()) and statut = 'actif'
    )
    or (type = 'demande' and auteur_id = (select auth.uid()))
  );

drop policy if exists "chacun modifie ses publications" on public.publications;
create policy "chacun modifie ses publications" on public.publications
  for update to authenticated
  using (
    auteur_id = (select auth.uid())
    or fournisseur_id in (select id from public.fournisseurs where owner_id = (select auth.uid()))
  )
  with check (
    auteur_id = (select auth.uid())
    or fournisseur_id in (select id from public.fournisseurs where owner_id = (select auth.uid()))
  );

drop policy if exists "un admin gouverne le fil" on public.publications;
create policy "un admin gouverne le fil" on public.publications
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

drop policy if exists "produits mis en avant, lecture" on public.publication_produits;
create policy "produits mis en avant, lecture" on public.publication_produits
  for select to authenticated
  using (publication_id in (select id from public.publications where statut = 'publiee'));

drop policy if exists "produits mis en avant, ecriture" on public.publication_produits;
create policy "produits mis en avant, ecriture" on public.publication_produits
  for all to authenticated
  using (
    publication_id in (
      select p.id from public.publications p
        join public.fournisseurs f on f.id = p.fournisseur_id
       where f.owner_id = (select auth.uid())
    )
  )
  with check (
    publication_id in (
      select p.id from public.publications p
        join public.fournisseurs f on f.id = p.fournisseur_id
       where f.owner_id = (select auth.uid())
    )
    -- Et le produit mis en avant doit appartenir au meme depot : sans cela on
    -- vitrine le catalogue du voisin sous son propre nom.
    and produit_id in (
      select pr.id from public.produits pr
        join public.fournisseurs f on f.id = pr.fournisseur_id
       where f.owner_id = (select auth.uid())
    )
  );

drop policy if exists "chacun gere ses abonnements" on public.abonnements;
create policy "chacun gere ses abonnements" on public.abonnements
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "un admin lit les abonnements" on public.abonnements;
create policy "un admin lit les abonnements" on public.abonnements
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'));

-- ── La vue publique du fil ────────────────────────────────────────────────
-- SECURITY DEFINER, comme `fournisseurs_publics` et `produits_publics` : les
-- tables de base sont fermees au navigateur, et cette vue est le seul chemin
-- de lecture. Elle n'expose AUCUNE donnee personnelle — ni telephone, ni
-- e-mail, ni adresse exacte du depot. Les coordonnees du depot y sont, elles,
-- parce que le prix rendu chantier se calcule depuis elles, et qu'elles sont
-- deja publiques dans `fournisseurs_publics`.
--
-- `suivi` se calcule pour l'appelant : faux pour un visiteur anonyme. La
-- sous-requete ne lit que la ligne de l'appelant, jamais celles des autres.
create or replace view public.fil_publications
with (security_barrier = true)
as
select
  p.id,
  p.type,
  p.texte,
  p.photos,
  p.publie_le,
  p.epingle,
  f.id                  as fournisseur_id,
  f.raison_sociale      as fournisseur_nom,
  f.slug                as fournisseur_slug,
  f.niveau_verification as fournisseur_niveau,
  f.note_moyenne        as fournisseur_note,
  f.nb_avis             as fournisseur_nb_avis,
  l.nom                 as localite_nom,
  f.lat                 as fournisseur_lat,
  f.lng                 as fournisseur_lng,
  f.rayon_max_km        as fournisseur_rayon_max_km,
  f.coef_sinuosite      as fournisseur_coef_sinuosite,
  exists (
    select 1 from public.abonnements a
     where a.fournisseur_id = f.id and a.user_id = auth.uid()
  ) as suivi,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object(
               'id', pr.id,
               'slug', pr.slug,
               'nom_affiche', pr.nom_affiche,
               'unite', pr.unite,
               'prix_unitaire', pr.prix_unitaire,
               'prix_promo', pr.prix_promo,
               'stock_statut', pr.stock_statut,
               'quantite_min', pr.quantite_min,
               'poids_kg_unite', pr.poids_kg_unite,
               'volume_m3_unite', pr.volume_m3_unite,
               'photo', pr.photos[1]
             ) order by pp.ordre)
        from public.publication_produits pp
        join public.produits pr on pr.id = pp.produit_id
       where pp.publication_id = p.id and pr.statut = 'actif'
    ), '[]'::jsonb
  ) as produits
from public.publications p
left join public.fournisseurs f on f.id = p.fournisseur_id
left join public.localites l on l.id = coalesce(p.localite_id, f.localite_id)
where p.statut = 'publiee'
  and (p.expire_le is null or p.expire_le > now())
  and (p.fournisseur_id is null or f.statut = 'actif');

comment on view public.fil_publications is
  'Fil d''accueil, sans donnee personnelle. Le tri par proximite se fait cote client, depuis lat/lng et le point de livraison choisi.';

grant select on public.fil_publications to anon, authenticated;

-- ── S'abonner sans lire la table des autres ───────────────────────────────
-- Le bouton « Suivre » a besoin de savoir combien de personnes suivent un
-- depot. Ouvrir `abonnements` en lecture pour cela reviendrait a publier qui
-- suit qui. Une fonction rend le compte, et rien que le compte.
create or replace function public.compter_abonnes(_fournisseur_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.abonnements where fournisseur_id = _fournisseur_id;
$$;

revoke all on function public.compter_abonnes(uuid) from public;
grant execute on function public.compter_abonnes(uuid) to anon, authenticated, service_role;
