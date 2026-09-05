-- ═══════════════════════════════════════════════════════════════════════════
-- Le tableau de bord d'administration (03/09/2026)
--
-- Transposé de la console superadmin de Fonenako (AdminDashboard.tsx et ses
-- RPC `superadmin_v2`) : les chiffres viennent de fonctions SECURITY DEFINER
-- gardées par `has_role(auth.uid(), 'admin')`, jamais de lectures directes —
-- `profiles` n'est lisible que par son propriétaire (policy), les courriels
-- vivent dans `auth.users`, et un tableau de bord qui ferait dix requêtes
-- depuis le navigateur coûterait dix allers-retours sur une 3G.
--
-- Deux niveaux : `admin` LIT et traite les files ; `super_admin` GOUVERNE
-- les rôles (Fonenako : seul le super_admin supprime un compte).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Les gardes ───────────────────────────────────────────────────────────────
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function public.exiger_admin()
returns void
language plpgsql stable
set search_path = public
as $$
begin
  if auth.uid() is null or not has_role(auth.uid(), 'admin') then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
end;
$$;

-- ── Les chiffres du jour ─────────────────────────────────────────────────────
-- Un seul aller-retour : tout ce que les cartes du tableau de bord affichent.
create or replace function public.tableau_de_bord_admin()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  resultat jsonb;
begin
  perform exiger_admin();
  select jsonb_build_object(
    'utilisateurs', (select count(*) from auth.users),
    'utilisateurs_7j', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'actifs_7j', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'fournisseurs', (select jsonb_object_agg(statut, n) from (
        select statut::text, count(*) n from public.fournisseurs group by statut) f),
    'fournisseurs_verifies', (select count(*) from public.fournisseurs where niveau_verification in ('verifie','partenaire')),
    'produits_actifs', (select count(*) from public.produits where statut = 'actif'),
    'produits_total', (select count(*) from public.produits),
    'commandes', (select coalesce(jsonb_object_agg(statut, n), '{}'::jsonb) from (
        select statut::text, count(*) n from public.commandes group by statut) c),
    'commandes_7j', (select count(*) from public.commandes where created_at > now() - interval '7 days'),
    'volume_7j', (select coalesce(sum(montant_total), 0) from public.commandes
        where created_at > now() - interval '7 days'
          and statut in ('payee','en_preparation','en_livraison','livree','cloturee')),
    'commissions_7j', (select coalesce(sum(montant_commission), 0) from public.commandes
        where created_at > now() - interval '7 days' and statut in ('payee','en_preparation','en_livraison','livree','cloturee')),
    'paiements_a_verifier', (select count(*) from public.paiements where statut = 'en_verification'),
    'litiges_ouverts', (select count(*) from public.litiges where statut in ('ouvert','en_examen')),
    'retraits_a_traiter', (select count(*) from public.retraits where statut in ('demande','en_cours')),
    'kyc_en_attente', (select count(distinct fournisseur_id) from public.documents_fournisseur where statut = 'en_attente'),
    'materiaux_demandes', (select count(*) from public.demandes_materiau where statut::text in ('en_attente','ouverte')),
    'publications', (select count(*) from public.publications where statut = 'publiee'),
    'publications_signalees', (select count(*) from public.publications where statut = 'signalee'),
    'demandes_ouvertes', (select count(*) from public.demandes where statut = 'ouverte'),
    'releves_prix', (select count(*) from public.releves_prix),
    'vues_7j', (select coalesce(sum(vues), 0) from public.vues_produit_jour where jour > current_date - 7),
    'avis_en_attente', (select count(*) from public.avis where statut::text = 'en_attente'),
    'calcule_le', now()
  ) into resultat;
  return resultat;
end;
$$;

-- ── Les séries des trente derniers jours ─────────────────────────────────────
-- Une ligne par jour : inscriptions, commandes, vues de produits. Les jours
-- sans rien sont RENDUS à zéro — une courbe qui saute un jour ment.
create or replace function public.series_admin(_jours integer default 30)
returns table (jour date, inscriptions bigint, commandes bigint, vues bigint, volume bigint)
language sql stable security definer
set search_path = public
as $$
  select
    j.jour,
    (select count(*) from auth.users u where u.created_at::date = j.jour),
    (select count(*) from public.commandes c where c.created_at::date = j.jour),
    (select coalesce(sum(v.vues), 0) from public.vues_produit_jour v where v.jour = j.jour),
    (select coalesce(sum(c.montant_total), 0) from public.commandes c
       where c.created_at::date = j.jour
         and c.statut in ('payee','en_preparation','en_livraison','livree','cloturee'))
  from (
    select (current_date - offs)::date as jour
    from generate_series(least(greatest(_jours, 1), 365) - 1, 0, -1) as offs
  ) j
  where (select exiger_admin()) is null
  order by j.jour;
$$;

-- ── Les comptes ──────────────────────────────────────────────────────────────
-- Ce que la console Fonenako appelle « Utilisateurs » : identité, courriel,
-- rôles, dépôt, dernière connexion. Le courriel vient d'auth.users — il n'est
-- lisible QUE par cette fonction, jamais par une policy.
create or replace function public.lister_utilisateurs_admin(_q text default null, _limite integer default 200)
returns table (
  id uuid, email text, nom_complet text, telephone text, ville text,
  type_client text, roles text[], fournisseur text, fournisseur_statut text,
  cree_le timestamptz, derniere_connexion timestamptz, email_verifie boolean
)
language sql stable security definer
set search_path = public
as $$
  select
    u.id,
    u.email::text,
    p.nom_complet,
    p.telephone,
    p.ville,
    p.type_client::text,
    coalesce((select array_agg(r.role::text order by r.role) from public.user_roles r where r.user_id = u.id), '{}'),
    f.raison_sociale,
    f.statut::text,
    u.created_at,
    u.last_sign_in_at,
    coalesce(p.email_verifie, u.email_confirmed_at is not null)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.fournisseurs f on f.owner_id = u.id
  where (select exiger_admin()) is null
    and (
      _q is null or _q = ''
      or u.email ilike '%' || _q || '%'
      or p.nom_complet ilike '%' || _q || '%'
      or p.telephone ilike '%' || _q || '%'
      or f.raison_sociale ilike '%' || _q || '%'
    )
  order by u.created_at desc
  limit least(greatest(_limite, 1), 1000);
$$;

-- ── Gouverner un rôle : super_admin seulement ────────────────────────────────
-- ⚠ On ne se retire jamais soi-même super_admin : la console resterait sans
--   personne pour la gouverner. Et « admin » suit « super_admin » : donner
--   l'un donne l'autre, retirer super_admin laisse admin — l'inverse se fait
--   en deux gestes, à dessein.
create or replace function public.definir_role_admin(_user_id uuid, _role app_role, _actif boolean)
returns text[]
language plpgsql security definer
set search_path = public
as $$
declare
  avant text[];
  apres text[];
begin
  if auth.uid() is null or not is_super_admin() then
    raise exception 'Réservé au super-administrateur' using errcode = '42501';
  end if;
  if _user_id = auth.uid() and _role = 'super_admin' and not _actif then
    raise exception 'Vous ne pouvez pas vous retirer le rôle super_admin' using errcode = '22023';
  end if;
  select coalesce(array_agg(role::text order by role), '{}') into avant from public.user_roles where user_id = _user_id;

  if _actif then
    insert into public.user_roles (user_id, role) values (_user_id, _role) on conflict (user_id, role) do nothing;
    if _role = 'super_admin' then
      insert into public.user_roles (user_id, role) values (_user_id, 'admin') on conflict (user_id, role) do nothing;
    end if;
  else
    delete from public.user_roles where user_id = _user_id and role = _role;
    if _role = 'admin' then
      delete from public.user_roles where user_id = _user_id and role = 'super_admin';
    end if;
  end if;

  select coalesce(array_agg(role::text order by role), '{}') into apres from public.user_roles where user_id = _user_id;
  perform journaliser('role.' || (case when _actif then 'ajoute' else 'retire' end), 'user_roles', _user_id::text,
                      jsonb_build_object('roles', avant), jsonb_build_object('roles', apres));
  return apres;
end;
$$;

-- ── L'activité récente, lisible ──────────────────────────────────────────────
-- Le journal d'audit est déjà lisible par un admin (policy), mais il ne porte
-- que des identifiants : ici, le nom de l'acteur avec.
create or replace function public.activite_admin(_limite integer default 30)
returns table (id bigint, quand timestamptz, acteur text, action text, entite text, entite_id text)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.created_at, coalesce(p.nom_complet, u.email::text, 'système'), a.action, a.entite, a.entite_id
  from public.audit_log a
  left join public.profiles p on p.id = a.acteur_id
  left join auth.users u on u.id = a.acteur_id
  where (select exiger_admin()) is null
  order by a.created_at desc
  limit least(greatest(_limite, 1), 200);
$$;

-- ── Les droits d'exécution : jamais anon ─────────────────────────────────────
revoke execute on function public.is_super_admin() from anon;
revoke execute on function public.exiger_admin() from anon;
revoke execute on function public.tableau_de_bord_admin() from anon;
revoke execute on function public.series_admin(integer) from anon;
revoke execute on function public.lister_utilisateurs_admin(text, integer) from anon;
revoke execute on function public.definir_role_admin(uuid, app_role, boolean) from anon;
revoke execute on function public.activite_admin(integer) from anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.exiger_admin() to authenticated;
grant execute on function public.tableau_de_bord_admin() to authenticated;
grant execute on function public.series_admin(integer) to authenticated;
grant execute on function public.lister_utilisateurs_admin(text, integer) to authenticated;
grant execute on function public.definir_role_admin(uuid, app_role, boolean) to authenticated;
grant execute on function public.activite_admin(integer) to authenticated;
