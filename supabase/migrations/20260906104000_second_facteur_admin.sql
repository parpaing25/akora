-- X-11 (audit du 05/09/2026) : l'administrateur qui confirme les paiements et
-- libère le séquestre n'avait qu'un mot de passe.
--
-- Côté base, la ceinture : quand le paramètre `mfa_admin_obligatoire` est actif,
-- toute action d'administration exige un jeton qui a passé le second facteur
-- (claim `aal` du JWT = 'aal2'). La règle vit dans UNE fonction,
-- exiger_second_facteur_admin(), appelée :
--   · par exiger_admin() (tableau de bord, listes) ;
--   · en première instruction des cinq fonctions qui touchent l'argent et les
--     rôles : confirmer_paiement_manuel, arbitrer_litige, executer_retrait,
--     refuser_retrait, definir_role_admin — injectée par réécriture de leur
--     corps (regexp sur le premier « begin »), sans recopier leur logique.
--   liberer_sequestre n'est PAS touchée : l'acheteur la déclenche via
--   confirmer_livraison.
--
-- Le paramètre naît à FALSE : Andry inscrit d'abord son facteur dans
-- /compte/securite, puis bascule :
--   update public.parametres set valeur = '{"actif": true}' where cle = 'mfa_admin_obligatoire';
-- Retour arrière : remettre actif à false (comportement d'avant, sans redéploiement).
begin;

insert into public.parametres (cle, valeur)
values ('mfa_admin_obligatoire', '{"actif": false}'::jsonb)
on conflict (cle) do nothing;

create or replace function public.exiger_second_facteur_admin()
returns void
language plpgsql
stable
set search_path to 'public'
as $$
declare
  exige boolean;
begin
  select coalesce((valeur ->> 'actif')::boolean, false) into exige
    from public.parametres where cle = 'mfa_admin_obligatoire';
  if coalesce(exige, false) and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Second facteur requis pour cette action' using errcode = '42501';
  end if;
end;
$$;
comment on function public.exiger_second_facteur_admin() is
  'Refuse une session sans second facteur (aal2) quand parametres.mfa_admin_obligatoire est actif. Posée le 06/09/2026 sur les fonctions d''administration sensibles.';

create or replace function public.exiger_admin()
returns void
language plpgsql
stable
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not has_role(auth.uid(), 'admin') then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  perform public.exiger_second_facteur_admin();
end;
$$;

-- Injection dans les cinq fonctions sensibles : « begin » → « begin perform … ; »
do $$
declare
  f record;
  def text;
begin
  for f in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('confirmer_paiement_manuel', 'arbitrer_litige', 'executer_retrait', 'refuser_retrait', 'definir_role_admin')
  loop
    def := pg_get_functiondef(f.oid);
    if def not like '%exiger_second_facteur_admin()%' then
      -- premier mot « begin » du corps ; le prototype n'en contient pas
      def := regexp_replace(def, '\mbegin\M', E'begin\n  perform public.exiger_second_facteur_admin();', 'i');
      execute def;
      raise notice 'second facteur posé sur %', f.proname;
    end if;
  end loop;
end $$;

commit;

-- Contrôle :
-- select p.proname, pg_get_functiondef(p.oid) like '%exiger_second_facteur_admin()%' garde
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname in ('confirmer_paiement_manuel','arbitrer_litige','executer_retrait','refuser_retrait','definir_role_admin','exiger_admin');
-- attendu : true partout.
