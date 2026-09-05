-- X-02, X-10 (audit du 05/09/2026) — durcissement de deux fonctions
-- SECURITY DEFINER exécutables par anon sans garde, index manquant, purge.
--
--   · consommer_quota : écrivait dans rate_limits pour N'IMPORTE QUELLE clé →
--     un visiteur pouvait épuiser le quota d'un tiers (IP, e-mail). Seules les
--     Edge Functions l'appellent, avec la clé service_role (_commun.ts).
--   · compter_vue_produit : incrémentait un compteur pour n'importe quel uuid,
--     sans plafond.
-- Retour arrière : grant execute … to anon, authenticated ; recréer l'ancienne
-- version de compter_vue_produit (sans garde) ; drop index ; cron.unschedule.
begin;

revoke execute on function public.consommer_quota(text, text, integer) from public;
revoke execute on function public.consommer_quota(text, text, integer) from anon;
revoke execute on function public.consommer_quota(text, text, integer) from authenticated;
grant  execute on function public.consommer_quota(text, text, integer) to service_role;
comment on function public.consommer_quota(text, text, integer) is
  'Compteur glissant par heure. Réservée à service_role (Edge Functions) depuis le 06/09/2026 : exécutable par anon, elle permettait d''épuiser le quota d''un tiers.';

create or replace function public.compter_vue_produit(_produit_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from public.produits p where p.id = _produit_id and p.statut = 'actif'
  ) then
    return;
  end if;
  insert into public.vues_produit_jour (produit_id, jour, vues)
  values (_produit_id, (now() at time zone 'Indian/Antananarivo')::date, 1)
  on conflict (produit_id, jour)
  do update set vues = least(public.vues_produit_jour.vues + 1, 100000);
end;
$$;
comment on function public.compter_vue_produit(uuid) is
  'Compteur de vues agrégé par jour (politique de confidentialité : jamais une ligne par visite). Gardé le 06/09/2026 : produit actif seulement, plafond 100 000/jour.';

-- (Q-06 retiré : fil_publications est une VUE sur publications, déjà indexée par
--  idx_publications_fil (statut, publie_le desc) — vérifié le 06/09/2026.)

-- Une fenêtre par clé et par heure dans rate_limits : sans purge elle grossit sans fin.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'akora-purge-rate-limits') then
    perform cron.schedule('akora-purge-rate-limits', '30 4 * * *',
      $cron$delete from public.rate_limits where fenetre < now() - interval '2 days'$cron$);
  end if;
end $$;

commit;
