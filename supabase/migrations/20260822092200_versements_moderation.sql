-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 23. Exécution des versements et modération
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.executer_retrait(_retrait_id uuid, _reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Reserve aux administrateurs.';
  end if;
  if coalesce(btrim(_reference), '') = '' then
    raise exception 'La reference du versement est obligatoire : sans elle, rien n''est prouvable.';
  end if;

  select * into r from public.retraits where id = _retrait_id for update;
  if not found then raise exception 'Versement introuvable.'; end if;
  if r.statut = 'paye' then raise exception 'Ce versement a deja ete execute.'; end if;

  perform set_config('akora.systeme', 'on', true);
  perform public.ecrire_ledger(
    r.fournisseur_id, 'retrait', -r.montant,
    'Versement mobile money, reference ' || btrim(_reference), null, null, r.id);
  update public.retraits
     set statut = 'paye', reference = btrim(_reference), traite_par = auth.uid(), traite_le = now()
   where id = _retrait_id;
  perform set_config('akora.systeme', 'off', true);

  perform public.journaliser('executer_retrait', 'retraits', _retrait_id::text, null,
    jsonb_build_object('montant', r.montant, 'reference', _reference));
  perform public.notifier((select owner_id from public.fournisseurs where id = r.fournisseur_id),
    'Versement effectue', r.montant || ' Ar envoyes sur ' || r.msisdn || '.',
    '/pro/portefeuille', 'paiement');
end;
$$;

create or replace function public.refuser_retrait(_retrait_id uuid, _motif text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Reserve aux administrateurs.';
  end if;
  if coalesce(btrim(_motif), '') = '' then
    raise exception 'Un refus doit etre motive.';
  end if;

  select * into r from public.retraits where id = _retrait_id;
  if not found then raise exception 'Versement introuvable.'; end if;

  perform set_config('akora.systeme', 'on', true);
  update public.retraits
     set statut = 'refuse', motif_refus = _motif, traite_par = auth.uid(), traite_le = now()
   where id = _retrait_id;
  perform set_config('akora.systeme', 'off', true);

  perform public.journaliser('refuser_retrait', 'retraits', _retrait_id::text, null,
    jsonb_build_object('motif', _motif));
  perform public.notifier((select owner_id from public.fournisseurs where id = r.fournisseur_id),
    'Versement refuse', _motif, '/pro/portefeuille', 'paiement');
end;
$$;

create or replace function public.moderer_avis(_avis_id uuid, _statut public.statut_moderation)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Reserve aux administrateurs.';
  end if;
  perform set_config('akora.systeme', 'on', true);
  update public.avis set statut = _statut where id = _avis_id;
  perform set_config('akora.systeme', 'off', true);
  perform public.journaliser('moderer_avis', 'avis', _avis_id::text, null,
    jsonb_build_object('statut', _statut));
end;
$$;

revoke all on function public.executer_retrait(uuid, text) from public, anon;
revoke all on function public.refuser_retrait(uuid, text) from public, anon;
revoke all on function public.moderer_avis(uuid, public.statut_moderation) from public, anon;
grant execute on function public.executer_retrait(uuid, text) to authenticated;
grant execute on function public.refuser_retrait(uuid, text) to authenticated;
grant execute on function public.moderer_avis(uuid, public.statut_moderation) to authenticated;
