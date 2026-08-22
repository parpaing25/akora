-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 21. Paiement par référence saisie
-- ═══════════════════════════════════════════════════════════════════════════
-- Le mode qui fonctionne dès le premier jour, sans contrat marchand :
-- l'acheteur paie depuis son téléphone puis recopie la référence du SMS.
-- Un administrateur confirme. Tant qu'il ne l'a pas fait, la commande n'avance
-- pas d'un pouce.

create or replace function public.enregistrer_reference_paiement(
  _paiement_id uuid, _reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  c record;
begin
  if coalesce(btrim(_reference), '') = '' then
    raise exception 'La référence de transaction est obligatoire.';
  end if;

  select * into p from public.paiements where id = _paiement_id;
  if not found then raise exception 'Paiement introuvable.'; end if;

  select * into c from public.commandes where id = p.commande_id;
  if c.acheteur_id is distinct from auth.uid() then
    raise exception 'Ce paiement ne vous appartient pas.';
  end if;
  if p.statut <> 'en_attente_client' then
    raise exception 'Ce paiement n''attend plus de référence (statut : %).', p.statut;
  end if;

  perform set_config('akora.systeme', 'on', true);
  update public.paiements
     set reference_saisie = btrim(_reference), statut = 'en_verification'
   where id = _paiement_id;
  perform set_config('akora.systeme', 'off', true);

  perform public.journaliser('reference_saisie', 'paiements', _paiement_id::text,
                             null, jsonb_build_object('reference', btrim(_reference)));
end;
$$;

revoke all on function public.enregistrer_reference_paiement(uuid, text) from public, anon;
grant execute on function public.enregistrer_reference_paiement(uuid, text) to authenticated;

-- ── Confirmation par un administrateur ────────────────────────────────────
-- Le pendant humain du webhook : même effet, même traçabilité. Le passage en
-- séquestre est fait ici, pas laissé au hasard d'un appel client.
create or replace function public.confirmer_paiement_manuel(_paiement_id uuid, _accepte boolean, _motif text default null)
returns public.statut_paiement
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  c record;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Réservé aux administrateurs.';
  end if;

  select * into p from public.paiements where id = _paiement_id for update;
  if not found then raise exception 'Paiement introuvable.'; end if;
  if p.statut <> 'en_verification' then
    raise exception 'Seul un paiement en vérification peut être tranché (statut : %).', p.statut;
  end if;

  select * into c from public.commandes where id = p.commande_id;

  perform set_config('akora.systeme', 'on', true);

  if not _accepte then
    update public.paiements set statut = 'rejete' where id = _paiement_id;
    perform set_config('akora.systeme', 'off', true);
    perform public.journaliser('rejeter_paiement', 'paiements', _paiement_id::text,
                               jsonb_build_object('statut', 'en_verification'),
                               jsonb_build_object('statut', 'rejete', 'motif', _motif));
    perform public.notifier(c.acheteur_id, 'Paiement non retrouvé',
      coalesce(_motif, 'La référence saisie n''a pas pu être vérifiée.') ||
      ' Vérifiez la référence, ou contactez-nous.', '/commande/' || c.numero, 'paiement');
    return 'rejete';
  end if;

  -- confirme puis sequestre : les deux transitions sont valides et verifiees
  -- par le trigger de machine a etats.
  update public.paiements set statut = 'confirme' where id = _paiement_id;
  update public.paiements set statut = 'sequestre' where id = _paiement_id;

  insert into public.portefeuilles (fournisseur_id) values (c.fournisseur_id)
    on conflict (fournisseur_id) do nothing;
  update public.portefeuilles
     set solde_sequestre = solde_sequestre + p.montant, maj_le = now()
   where fournisseur_id = c.fournisseur_id;

  if c.statut = 'en_attente_paiement' then
    update public.commandes set statut = 'payee' where id = c.id;
  end if;

  perform set_config('akora.systeme', 'off', true);

  perform public.journaliser('confirmer_paiement', 'paiements', _paiement_id::text,
                             jsonb_build_object('statut', 'en_verification'),
                             jsonb_build_object('statut', 'sequestre', 'montant', p.montant));
  perform public.notifier(c.acheteur_id, 'Paiement confirmé',
    'Votre paiement pour la commande ' || c.numero || ' est sous séquestre jusqu''à la livraison.',
    '/commande/' || c.numero, 'paiement');
  perform public.notifier((select owner_id from public.fournisseurs where id = c.fournisseur_id),
    'Paiement reçu ' || c.numero, 'La somme est sous séquestre jusqu''à la confirmation de livraison.',
    '/pro/commandes', 'paiement');

  return 'sequestre';
end;
$$;

revoke all on function public.confirmer_paiement_manuel(uuid, boolean, text) from public, anon;
grant execute on function public.confirmer_paiement_manuel(uuid, boolean, text) to authenticated;
grant execute on function public.confirmer_paiement_manuel(uuid, boolean, text) to service_role;
