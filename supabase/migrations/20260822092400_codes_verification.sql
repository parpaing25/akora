-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 25. Codes de verification par e-mail
-- ═══════════════════════════════════════════════════════════════════════════
-- Meme mecanique que Fonenako : la confirmation native de Supabase est
-- desactivee, et c'est Akora qui envoie un code a six chiffres par SMTP
-- o2switch. Raison d'origine : le lien de confirmation de Supabase partait
-- d'un domaine inconnu, atterrissait en indesirables, et personne ne validait
-- son compte. Un code qu'on recopie traverse tout.
--
-- La confirmation reste OBLIGATOIRE : c'est `verifier_code_email` qui pose
-- `email_confirmed_at`, apres verification du code.

create table if not exists public.codes_verification_email (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  email       text not null,
  code        text not null,
  expire_le   timestamptz not null,
  verifie     boolean not null default false,
  tentatives  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_codes_email on public.codes_verification_email(email, created_at desc);
create index if not exists idx_codes_expiration on public.codes_verification_email(expire_le);

alter table public.codes_verification_email enable row level security;

-- Personne ne lit ni n'ecrit cette table depuis le navigateur : un code
-- lisible par son destinataire n'aurait plus rien d'un code.
revoke all on public.codes_verification_email from anon, authenticated;

drop policy if exists "codes lisibles par un admin" on public.codes_verification_email;
create policy "codes lisibles par un admin" on public.codes_verification_email
  for select to authenticated using (public.has_role((select auth.uid()), 'admin'));

grant select, insert, update, delete on public.codes_verification_email to service_role;

-- ── Generation ────────────────────────────────────────────────────────────
create or replace function public.generer_code_otp()
returns text
language sql
volatile
set search_path = public
as $$
  select lpad(floor(random() * 1000000)::text, 6, '0');
$$;

-- ── Creation d'un code, avec les deux garde-fous anti-abus ────────────────
create or replace function public.creer_code_verification(_user_id uuid, _email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_dernier timestamptz;
  v_recents integer;
begin
  -- Une minute entre deux envois : sans ce delai, le bouton « renvoyer »
  -- devient une machine a spammer une adresse qui n'est pas la sienne.
  select max(created_at) into v_dernier
    from public.codes_verification_email where email = _email;
  if v_dernier is not null and v_dernier > now() - interval '60 seconds' then
    raise exception 'TROP_DE_DEMANDES: un code vient d''etre envoye, patientez une minute.'
      using errcode = 'P0001';
  end if;

  -- Dix par jour et par adresse. Au-dela, ce n'est plus une inscription.
  select count(*) into v_recents
    from public.codes_verification_email
   where email = _email and created_at > now() - interval '24 hours';
  if v_recents >= 10 then
    raise exception 'TROP_DE_DEMANDES: trop de codes demandes pour cette adresse aujourd''hui.'
      using errcode = 'P0001';
  end if;

  v_code := public.generer_code_otp();

  -- Un seul code valide a la fois : les precedents sont neutralises.
  update public.codes_verification_email
     set verifie = true
   where email = _email and verifie = false and expire_le > now();

  insert into public.codes_verification_email (user_id, email, code, expire_le)
  values (_user_id, _email, v_code, now() + interval '15 minutes');

  return v_code;
end;
$$;

-- ── Verification ──────────────────────────────────────────────────────────
create or replace function public.verifier_code_email(_email text, _code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user_id uuid;
  v_code_reel text;
  v_tentatives integer;
begin
  select id, user_id, code, tentatives
    into v_id, v_user_id, v_code_reel, v_tentatives
    from public.codes_verification_email
   where email = _email and verifie = false and expire_le > now()
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

  -- C'est ICI, et nulle part ailleurs, que l'adresse devient confirmee.
  update auth.users
     set email_confirmed_at = now()
   where id = v_user_id and email_confirmed_at is null;

  return true;
end;
$$;

-- ── Menage ────────────────────────────────────────────────────────────────
create or replace function public.purger_codes_expires()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_supprimes integer;
begin
  delete from public.codes_verification_email where expire_le < now() - interval '7 days';
  get diagnostics v_supprimes = row_count;
  return v_supprimes;
end;
$$;

revoke all on function public.generer_code_otp() from public, anon, authenticated;
revoke all on function public.creer_code_verification(uuid, text) from public, anon, authenticated;
revoke all on function public.verifier_code_email(text, text) from public, anon, authenticated;
revoke all on function public.purger_codes_expires() from public, anon, authenticated;
grant execute on function public.generer_code_otp() to service_role;
grant execute on function public.creer_code_verification(uuid, text) to service_role;
grant execute on function public.verifier_code_email(text, text) to service_role;
grant execute on function public.purger_codes_expires() to service_role;
