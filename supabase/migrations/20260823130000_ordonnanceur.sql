-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 38. L'ordonnanceur vit dans la base, plus dans un cPanel
-- ═══════════════════════════════════════════════════════════════════════════
-- Les notifications push et la reconciliation des paiements attendaient deux
-- lignes de cron sur o2switch. Une tache posee a la main dans une interface
-- web n'est ni versionnee, ni testee, ni visible : elle disparait au premier
-- changement d'hebergeur et personne ne s'en apercoit avant qu'un paiement
-- reste en suspens.
--
-- `pg_cron` la met DANS la base, a cote du reste, et `pg_net` fait l'appel.
--
-- J'avais d'abord refuse cette voie : elle semblait imposer d'ecrire le secret
-- d'appel en clair dans une fonction SQL. Elle ne l'impose pas — Supabase
-- fournit `vault`, ou le secret est chiffre au repos et ne se lit que par une
-- fonction SECURITY DEFINER. Le secret n'apparait donc ni dans cette
-- migration, ni dans le depot, ni dans le journal des requetes.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ── L'appel, une fois pour toutes ─────────────────────────────────────────
create or replace function public.appeler_fonction_akora(_nom text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
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
    raise notice 'Ordonnanceur : secrets absents du coffre, appel ignore.';
    return null;
  end if;

  -- Appel NON bloquant : pg_net poste en arriere-plan. Une fonction lente ne
  -- retient jamais l'ordonnanceur, et un echec ne fait pas echouer la tache.
  return extensions.net.http_post(
    url     := v_url || '/' || _nom,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-akora-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

comment on function public.appeler_fonction_akora(text) is
  'Appelle une Edge Function depuis l''ordonnanceur. Le secret vient du coffre chiffre, jamais du code.';

revoke all on function public.appeler_fonction_akora(text) from public, anon, authenticated;

-- ── Les deux taches ───────────────────────────────────────────────────────
-- Une minute pour les push : au-dela, l'annonce d'une baisse de prix arrive
-- quand le camion est deja parti.
select cron.unschedule('akora-push') where exists (select 1 from cron.job where jobname = 'akora-push');
select cron.schedule('akora-push', '* * * * *', $$select public.appeler_fonction_akora('envoyer-push')$$);

-- Trois heures du matin pour la reconciliation : les operateurs mobile money
-- sont au plus calme, et un paiement reste en suspens une nuit au maximum.
select cron.unschedule('akora-reconciliation') where exists (select 1 from cron.job where jobname = 'akora-reconciliation');
select cron.schedule('akora-reconciliation', '0 3 * * *', $$select public.appeler_fonction_akora('paiement-reconciliation')$$);

-- Menage des codes expires, une fois par semaine.
select cron.unschedule('akora-purge-codes') where exists (select 1 from cron.job where jobname = 'akora-purge-codes');
select cron.schedule('akora-purge-codes', '0 4 * * 0', $$select public.purger_codes_expires()$$);
