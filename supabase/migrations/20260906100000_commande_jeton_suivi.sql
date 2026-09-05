-- F-01 (audit du 05/09/2026) : un acheteur SANS compte pouvait commander
-- (Commander.tsx : « Vous pouvez commander sans compte et régler à la
-- livraison ») mais ne pouvait pas relire sa commande : la table `commandes`
-- n'a aucun droit SELECT pour anon, PostgREST répondait 401 et l'écran de
-- confirmation disait « Commande introuvable ». Zéro commande n'avait jamais
-- été passée en production, personne ne l'avait vu.
--
-- Remède : un jeton secret de 128 bits remis une fois à la création, et une
-- lecture par (numéro, jeton) qui rend commande + lignes + paiements.
-- Retour arrière : drop function public.lire_commande_invitee, public.confirmer_livraison_invitee ;
--                  alter table public.commandes drop column jeton_suivi ;
begin;

alter table public.commandes
  add column if not exists jeton_suivi text not null default encode(gen_random_bytes(16), 'hex');
create unique index if not exists commandes_jeton_suivi_idx on public.commandes (jeton_suivi);
comment on column public.commandes.jeton_suivi is
  'Secret 128 bits remis à l''acheteur à la création. Seule preuve de propriété pour une commande sans compte. Jamais renvoyé par une vue publique.';

create or replace function public.lire_commande_invitee(_numero text, _jeton text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c public.commandes%rowtype;
begin
  if _numero is null or _jeton is null or length(_jeton) <> 32 then
    return null;
  end if;
  select * into c from public.commandes where numero = _numero and jeton_suivi = _jeton;
  if not found then
    perform pg_sleep(0.25);   -- ralentit une énumération, sans coûter à un vrai client
    return null;
  end if;
  return jsonb_build_object(
    'commande', to_jsonb(c) - 'jeton_suivi' - 'acheteur_id',
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'produit_id', l.produit_id, 'designation_snapshot', l.designation_snapshot,
        'unite_snapshot', l.unite_snapshot, 'prix_unitaire_snapshot', l.prix_unitaire_snapshot,
        'quantite', l.quantite, 'total_ligne', l.total_ligne))
      from public.lignes_commande l where l.commande_id = c.id), '[]'::jsonb),
    'paiements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'operateur', p.operateur, 'mode', p.mode, 'montant', p.montant, 'statut', p.statut,
        'reference_saisie', p.reference_saisie, 'reference_externe', p.reference_externe,
        'initie_le', p.initie_le, 'confirme_le', p.confirme_le, 'libere_le', p.libere_le)
        order by p.initie_le desc)
      from public.paiements p where p.commande_id = c.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.lire_commande_invitee(text, text) from public;
grant execute on function public.lire_commande_invitee(text, text) to anon, authenticated;

-- Confirmer la réception sans compte : même preuve (numéro + jeton), puis la
-- RPC existante confirmer_livraison fait tout le reste (clôture, compteur du
-- fournisseur, libération du séquestre, journal, notification). Pour une
-- commande sans compte, acheteur_id et auth.uid() sont tous deux null : son
-- contrôle « seul l'acheteur confirme » passe ; pour la commande d'un compte,
-- il refuse — il faut alors se connecter.
create or replace function public.confirmer_livraison_invitee(_numero text, _jeton text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c public.commandes%rowtype;
begin
  if _numero is null or _jeton is null or length(_jeton) <> 32 then
    return false;
  end if;
  select * into c from public.commandes where numero = _numero and jeton_suivi = _jeton;
  if not found then
    perform pg_sleep(0.25);
    return false;
  end if;
  if c.statut <> 'livree' then
    return false;
  end if;
  perform public.confirmer_livraison(c.id);
  return true;
end;
$$;
revoke all on function public.confirmer_livraison_invitee(text, text) from public;
grant execute on function public.confirmer_livraison_invitee(text, text) to anon, authenticated;

commit;
