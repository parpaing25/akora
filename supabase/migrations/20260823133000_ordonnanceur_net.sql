-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 39. L'ordonnanceur appelait dans le vide
-- ═══════════════════════════════════════════════════════════════════════════
-- `extensions.net.http_post` est un nom a TROIS parties : Postgres l'a lu
-- comme base.schema.fonction et a repondu « cross-database references are not
-- implemented ». `pg_net` s'installe dans le schema `net`, quel que soit le
-- schema demande a la creation de l'extension — c'est `net.http_post`.
--
-- La tache passait donc pour reussie tout en n'emettant aucune requete. Une
-- panne silencieuse : le pire genre, puisque rien ne la signale.

create or replace function public.appeler_fonction_akora(_nom text)
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'akora_url_fonctions';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'akora_cron_secret';

  if v_url is null or v_secret is null then
    raise exception 'Ordonnanceur : secrets absents du coffre.';
  end if;

  return net.http_post(
    url     := v_url || '/' || _nom,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-akora-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.appeler_fonction_akora(text) from public, anon, authenticated;
