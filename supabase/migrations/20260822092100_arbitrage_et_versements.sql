-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 22. Arbitrage des litiges
-- ═══════════════════════════════════════════════════════════════════════════
-- Le geste qui décide où va l'argent bloqué. Il passe par une fonction, jamais
-- par un UPDATE depuis un écran : c'est ce qui garantit qu'une écriture de
-- ledger accompagne toujours un mouvement de solde.

create or replace function public.arbitrer_litige(
  _litige_id uuid, _decision text, _montant_rembourse bigint default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l record;
  c record;
  p record;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Reserve aux administrateurs.';
  end if;
  if coalesce(btrim(_decision), '') = '' then
    raise exception 'Une decision doit etre motivee : le perdant a le droit de savoir pourquoi.';
  end if;

  select * into l from public.litiges where id = _litige_id for update;
  if not found then raise exception 'Litige introuvable.'; end if;
  if l.statut = 'tranche' then raise exception 'Ce litige est deja tranche.'; end if;

  select * into c from public.commandes where id = l.commande_id;
  if _montant_rembourse > c.montant_total then
    raise exception 'Le remboursement ne peut pas depasser le montant de la commande.';
  end if;

  perform set_config('akora.systeme', 'on', true);

  update public.litiges
     set statut = 'tranche', decision = _decision,
         montant_rembourse = greatest(0, coalesce(_montant_rembourse, 0)),
         arbitre_par = auth.uid()
   where id = _litige_id;

  for p in select * from public.paiements
            where commande_id = c.id and statut = 'sequestre'
  loop
    if coalesce(_montant_rembourse, 0) >= p.montant then
      update public.paiements set statut = 'rembourse' where id = p.id;
      update public.portefeuilles
         set solde_sequestre = greatest(0, solde_sequestre - p.montant), maj_le = now()
       where fournisseur_id = c.fournisseur_id;
    else
      perform public.liberer_sequestre(p.id);
      if coalesce(_montant_rembourse, 0) > 0 then
        perform public.ecrire_ledger(
          c.fournisseur_id, 'remboursement', -_montant_rembourse,
          'Remboursement partiel apres litige, commande ' || c.numero, c.id, p.id);
      end if;
    end if;
  end loop;

  update public.commandes set statut = 'cloturee' where id = c.id;
  perform set_config('akora.systeme', 'off', true);

  perform public.journaliser('arbitrer_litige', 'litiges', _litige_id::text, null,
    jsonb_build_object('decision', _decision, 'rembourse', _montant_rembourse));
  perform public.notifier(l.ouvert_par, 'Litige tranche', _decision,
    '/commande/' || c.numero, 'litige');
  perform public.notifier((select owner_id from public.fournisseurs where id = c.fournisseur_id),
    'Litige tranche ' || c.numero, _decision, '/pro/commandes', 'litige');
end;
$$;

revoke all on function public.arbitrer_litige(uuid, text, bigint) from public, anon;
grant execute on function public.arbitrer_litige(uuid, text, bigint) to authenticated;
