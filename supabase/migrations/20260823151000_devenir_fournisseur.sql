-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 42. Devenir fournisseur sans repasser par l'inscription
-- ═══════════════════════════════════════════════════════════════════════════
-- Un acheteur qui tient aussi un depot n'a aucune raison de se creer un
-- second compte : depuis /devenir-fournisseur, connecte, il active son espace
-- en un clic.
--
-- Le navigateur n'ecrit JAMAIS dans `user_roles` (regle A3) : la seule
-- ecriture passe par cette fonction SECURITY DEFINER, et elle n'accorde que
-- 'fournisseur' — pas de role en parametre, donc rien a escalader. C'est la
-- meme logique que le trigger d'inscription : demander, c'est obtenir
-- fournisseur, et rien d'autre.
--
-- L'adresse doit etre confirmee d'abord. Le signal lu est
-- `profiles.email_verifie` — surtout pas `email_confirmed_at`, que la
-- confirmation automatique de Supabase remplit des l'inscription et qui ne
-- prouve donc rien (defaut constate le 22/08/2026). Meme exigence que
-- RouteProtegee cote client et `paiement-initier` cote serveur.

create or replace function public.devenir_fournisseur()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  demandeur uuid := auth.uid();
  verifie   boolean;
  ajoutees  integer;
begin
  if demandeur is null then
    raise exception 'Il faut être connecté pour activer un espace fournisseur.'
      using errcode = '42501';
  end if;

  select p.email_verifie into verifie
    from public.profiles p
   where p.id = demandeur;
  if verifie is distinct from true then
    raise exception 'Confirmez d''abord votre adresse e-mail.'
      using errcode = '42501';
  end if;

  insert into public.user_roles (user_id, role)
  values (demandeur, 'fournisseur')
  on conflict (user_id, role) do nothing;
  get diagnostics ajoutees = row_count;

  -- Une ligne d'audit seulement quand quelque chose a reellement change :
  -- re-cliquer sur le bouton ne doit pas remplir le journal.
  if ajoutees > 0 then
    perform public.journaliser(
      'role_accorde', 'user_roles', demandeur::text,
      null, jsonb_build_object('role', 'fournisseur', 'via', 'devenir_fournisseur'));
  end if;
end;
$$;

comment on function public.devenir_fournisseur() is
  'Ajoute le role fournisseur au compte connecte et verifie. Idempotente ; n''accorde jamais autre chose que fournisseur.';

revoke all on function public.devenir_fournisseur() from public;
revoke all on function public.devenir_fournisseur() from anon;
grant execute on function public.devenir_fournisseur() to authenticated, service_role;
