-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 26. L'adresse verifiee devient un fait, pas un ecran
-- ═══════════════════════════════════════════════════════════════════════════
-- Le flux repris de Fonenako desactive la confirmation native de Supabase
-- (`mailer_autoconfirm = true`) pour que l'inscription n'echoue jamais faute
-- de SMTP cote Supabase. Consequence : `auth.users.email_confirmed_at` est
-- rempli des l'inscription et ne prouve plus rien.
--
-- Sur Fonenako, le code a six chiffres n'est donc verrouille QUE par
-- l'interface : un appel direct a l'API le contourne. Ici, on ajoute le fait
-- manquant. `profiles.email_verifie` n'est ecrit que par
-- `verifier_code_email`, et le paiement en ligne s'y adosse.

alter table public.profiles
  add column if not exists email_verifie boolean not null default false,
  add column if not exists email_verifie_le timestamptz;

comment on column public.profiles.email_verifie is
  'Vrai uniquement apres saisie du code a six chiffres. Ni le navigateur ni un appel direct a l''API ne peuvent le poser : seule verifier_code_email l''ecrit.';

-- Un fournisseur ne s'auto-verifie pas non plus : la colonne est remise a sa
-- valeur precedente sur toute mise a jour venant du navigateur.
create or replace function public.proteger_colonnes_profil()
returns trigger
language plpgsql
-- SECURITY INVOKER volontaire (cf. est_appel_systeme).
set search_path = public
as $$
begin
  if public.est_appel_systeme() or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  new.email_verifie := old.email_verifie;
  new.email_verifie_le := old.email_verifie_le;
  return new;
end;
$$;

drop trigger if exists trg_profiles_colonnes_protegees on public.profiles;
create trigger trg_profiles_colonnes_protegees
  before update on public.profiles
  for each row execute function public.proteger_colonnes_profil();

revoke all on function public.proteger_colonnes_profil() from public, anon, authenticated;

-- ── La verification pose desormais le fait ────────────────────────────────
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

  perform set_config('akora.systeme', 'on', true);
  update public.profiles
     set email_verifie = true, email_verifie_le = now()
   where id = v_user_id;
  perform set_config('akora.systeme', 'off', true);

  return true;
end;
$$;

revoke all on function public.verifier_code_email(text, text) from public, anon, authenticated;
grant execute on function public.verifier_code_email(text, text) to service_role;
