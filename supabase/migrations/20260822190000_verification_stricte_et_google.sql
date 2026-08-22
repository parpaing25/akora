-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 27. La verification cesse d'etre un ecran
-- ═══════════════════════════════════════════════════════════════════════════
-- Trois manques constates a la recette du 22/08 :
--
--   1. Le code a six chiffres partait bien, mais rien n'obligeait a le saisir.
--      On fermait la fenetre et on continuait. C'etait une politesse, pas une
--      verification. Elle devient un peage : sans code, pas d'espace compte.
--
--   2. « Mot de passe oublie » passait par le lien natif de Supabase — celui-la
--      meme qu'on a abandonne pour l'inscription parce qu'il part d'un domaine
--      inconnu et finit en indesirables. Meme maladie, meme remede : un code a
--      six chiffres, notre SMTP, notre gabarit.
--
--   3. Google a deja verifie l'adresse de ses utilisateurs. Leur redemander de
--      prouver ce qui est prouve, c'est de la ceremonie.

-- ── A. Un code sert desormais a deux choses ───────────────────────────────
alter table public.codes_verification_email
  add column if not exists usage text not null default 'inscription';

alter table public.codes_verification_email
  drop constraint if exists codes_usage_connu;
alter table public.codes_verification_email
  add constraint codes_usage_connu check (usage in ('inscription', 'reinitialisation'));

comment on column public.codes_verification_email.usage is
  'inscription | reinitialisation. Les deux usages ne partagent NI leur quota NI leurs codes : un code d''inscription ne remet pas un mot de passe.';

create index if not exists idx_codes_email_usage
  on public.codes_verification_email(email, usage, created_at desc);

-- ── B. Creation d'un code, cloisonnee par usage ───────────────────────────
drop function if exists public.creer_code_verification(uuid, text);

create or replace function public.creer_code_verification(
  _user_id uuid,
  _email   text,
  _usage   text default 'inscription'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text;
  v_dernier timestamptz;
  v_recents integer;
begin
  if _usage not in ('inscription', 'reinitialisation') then
    raise exception 'Usage inconnu : %', _usage using errcode = '22023';
  end if;

  -- Une minute entre deux envois. Sans ce delai, le bouton « renvoyer »
  -- devient une machine a inonder une adresse qui n'est pas la sienne.
  select max(created_at) into v_dernier
    from public.codes_verification_email
   where email = _email and usage = _usage;
  if v_dernier is not null and v_dernier > now() - interval '60 seconds' then
    raise exception 'TROP_DE_DEMANDES: un code vient d''etre envoye, patientez une minute.'
      using errcode = 'P0001';
  end if;

  -- Dix par jour et par adresse. Au-dela, ce n'est plus une inscription.
  select count(*) into v_recents
    from public.codes_verification_email
   where email = _email and usage = _usage and created_at > now() - interval '24 hours';
  if v_recents >= 10 then
    raise exception 'TROP_DE_DEMANDES: trop de codes demandes pour cette adresse aujourd''hui.'
      using errcode = 'P0001';
  end if;

  v_code := public.generer_code_otp();

  -- Un seul code valide a la fois, pour cet usage.
  update public.codes_verification_email
     set verifie = true
   where email = _email and usage = _usage and verifie = false and expire_le > now();

  insert into public.codes_verification_email (user_id, email, code, expire_le, usage)
  values (_user_id, _email, v_code, now() + interval '15 minutes', _usage);

  return v_code;
end;
$$;

-- ── C. Verification d'un code d'inscription ───────────────────────────────
drop function if exists public.verifier_code_email(text, text);

create or replace function public.verifier_code_email(
  _email text,
  _code  text,
  _usage text default 'inscription'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id         uuid;
  v_user_id    uuid;
  v_code_reel  text;
  v_tentatives integer;
begin
  select id, user_id, code, tentatives
    into v_id, v_user_id, v_code_reel, v_tentatives
    from public.codes_verification_email
   where email = _email and usage = _usage and verifie = false and expire_le > now()
   order by created_at desc limit 1;

  if v_id is null then return false; end if;

  -- Cinq essais, puis le code est brule. Six chiffres se devinent en un
  -- million d'essais ; cinq, c'est ce qu'il faut pour une faute de frappe.
  if v_tentatives >= 5 then
    update public.codes_verification_email set verifie = true where id = v_id;
    return false;
  end if;

  if v_code_reel <> _code then
    update public.codes_verification_email set tentatives = tentatives + 1 where id = v_id;
    return false;
  end if;

  update public.codes_verification_email set verifie = true where id = v_id;

  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = v_user_id;

  -- C'est ICI, et nulle part ailleurs, que l'adresse devient un fait.
  perform set_config('akora.systeme', 'on', true);
  update public.profiles
     set email_verifie = true, email_verifie_le = now()
   where id = v_user_id;
  perform set_config('akora.systeme', 'off', true);

  return true;
end;
$$;

-- ── D. Mot de passe oublie ────────────────────────────────────────────────
-- Une adresse inconnue et une adresse inscrite doivent se comporter a
-- l'identique, sinon ce formulaire devient un annuaire des comptes existants.
-- On enregistre donc TOUJOURS une ligne — quitte a ce que `user_id` soit nul —
-- pour que le delai d'une minute et le plafond quotidien s'appliquent aussi
-- aux adresses qui n'existent pas. Seul l'envoi du mail differe.
create or replace function public.creer_code_reinitialisation(_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_code    text;
begin
  select id into v_user_id from auth.users
   where lower(email) = lower(_email) and deleted_at is null
   limit 1;

  v_code := public.creer_code_verification(v_user_id, lower(_email), 'reinitialisation');

  return jsonb_build_object('code', v_code, 'existe', v_user_id is not null);
end;
$$;

-- Consomme le code et rend l'utilisateur a qui remettre un mot de passe.
-- NULL veut dire « non », sans jamais dire pourquoi.
create or replace function public.consommer_code_reinitialisation(_email text, _code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id         uuid;
  v_user_id    uuid;
  v_code_reel  text;
  v_tentatives integer;
begin
  select id, user_id, code, tentatives
    into v_id, v_user_id, v_code_reel, v_tentatives
    from public.codes_verification_email
   where email = lower(_email) and usage = 'reinitialisation'
     and verifie = false and expire_le > now()
   order by created_at desc limit 1;

  if v_id is null then return null; end if;

  if v_tentatives >= 5 then
    update public.codes_verification_email set verifie = true where id = v_id;
    return null;
  end if;

  if v_code_reel <> _code then
    update public.codes_verification_email set tentatives = tentatives + 1 where id = v_id;
    return null;
  end if;

  update public.codes_verification_email set verifie = true where id = v_id;
  if v_user_id is null then return null; end if;

  -- Qui releve son courrier prouve son adresse. La verifier une seconde fois
  -- apres une reinitialisation serait redondant.
  perform set_config('akora.systeme', 'on', true);
  update public.profiles
     set email_verifie = true, email_verifie_le = coalesce(email_verifie_le, now())
   where id = v_user_id;
  perform set_config('akora.systeme', 'off', true);

  return v_user_id;
end;
$$;

-- Un mot de passe change doit chasser les sessions ouvertes ailleurs : c'est
-- souvent la raison meme du changement. Le schema `auth` ne nous appartient
-- pas ; si la permission manque, on ne fait pas echouer la reinitialisation
-- pour autant.
create or replace function public.revoquer_sessions(_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.sessions where user_id = _user_id;
  return true;
exception when insufficient_privilege or undefined_table then
  raise notice 'Sessions non revoquees : permission manquante sur auth.sessions.';
  return false;
end;
$$;

-- ── E. Connexion Google ───────────────────────────────────────────────────
-- Google publie `email_verified` dans son jeton : l'adresse est deja prouvee.
-- On reprend aussi le nom, car un compte Google n'a pas de formulaire ou le
-- saisir. Le telephone, lui, restera vide : il sera demande au moment ou il
-- sert vraiment, c'est-a-dire a la livraison.
create or replace function public.gerer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  demande      text := coalesce(new.raw_user_meta_data ->> 'profil_demande', 'acheteur');
  role_accorde public.app_role;
  v_google     boolean := coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google';
  v_nom        text := nullif(coalesce(
                         new.raw_user_meta_data ->> 'nom_complet',
                         new.raw_user_meta_data ->> 'full_name',
                         new.raw_user_meta_data ->> 'name'
                       ), '');
begin
  insert into public.profiles (id, nom_complet, telephone, raison_sociale, type_client, email_verifie, email_verifie_le)
  values (
    new.id,
    v_nom,
    nullif(new.raw_user_meta_data ->> 'telephone', ''),
    nullif(new.raw_user_meta_data ->> 'raison_sociale', ''),
    case when demande = 'fournisseur' then 'entreprise'::public.type_client
         else 'particulier'::public.type_client end,
    v_google,
    case when v_google then now() else null end
  )
  on conflict (id) do nothing;

  role_accorde := case when demande = 'fournisseur'
                       then 'fournisseur'::public.app_role
                       else 'acheteur'::public.app_role end;

  insert into public.user_roles (user_id, role)
  values (new.id, role_accorde)
  on conflict (user_id, role) do nothing;

  -- Un fournisseur reste aussi un acheteur : il peut commander chez un confrere.
  if role_accorde = 'fournisseur' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'acheteur')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

-- Cas du compte cree au mot de passe puis rattache a Google plus tard : le
-- trigger d'insertion est deja passe. Cette fonction rattrape, et elle ne
-- croit que le jeton — signe par GoTrue, donc infalsifiable depuis un
-- navigateur. Aucun parametre : rien a mentir.
create or replace function public.confirmer_email_oauth()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid  := auth.uid();
  v_jeton  jsonb := auth.jwt();
  v_liste  jsonb;
begin
  if v_uid is null then return false; end if;

  v_liste := coalesce(v_jeton -> 'app_metadata' -> 'providers', '[]'::jsonb);
  if coalesce(v_jeton -> 'app_metadata' ->> 'provider', '') <> 'google'
     and not (v_liste ? 'google') then
    return false;
  end if;

  perform set_config('akora.systeme', 'on', true);
  update public.profiles
     set email_verifie = true, email_verifie_le = coalesce(email_verifie_le, now())
   where id = v_uid and email_verifie = false;
  perform set_config('akora.systeme', 'off', true);

  return true;
end;
$$;

-- ── F. Droits ─────────────────────────────────────────────────────────────
revoke all on function public.creer_code_verification(uuid, text, text) from public, anon, authenticated;
revoke all on function public.verifier_code_email(text, text, text) from public, anon, authenticated;
revoke all on function public.creer_code_reinitialisation(text) from public, anon, authenticated;
revoke all on function public.consommer_code_reinitialisation(text, text) from public, anon, authenticated;
revoke all on function public.revoquer_sessions(uuid) from public, anon, authenticated;

grant execute on function public.creer_code_verification(uuid, text, text) to service_role;
grant execute on function public.verifier_code_email(text, text, text) to service_role;
grant execute on function public.creer_code_reinitialisation(text) to service_role;
grant execute on function public.consommer_code_reinitialisation(text, text) to service_role;
grant execute on function public.revoquer_sessions(uuid) to service_role;

-- Seule exception : celle-ci est appelee par le navigateur, au retour de
-- Google. Elle ne prend aucun parametre et ne lit que le jeton.
revoke all on function public.confirmer_email_oauth() from public, anon;
grant execute on function public.confirmer_email_oauth() to authenticated;
