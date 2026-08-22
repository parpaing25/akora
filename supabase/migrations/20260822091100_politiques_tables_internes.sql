-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 12. Politiques explicites sur les deux tables internes
-- ═══════════════════════════════════════════════════════════════════════════
-- `rate_limits` et `compteurs_commande` n'etaient accessibles a personne :
-- RLS activee, aucune politique, et les GRANT revoques. C'est le comportement
-- voulu, mais un refus IMPLICITE se relit mal — la prochaine personne qui
-- ouvre le schema ne sait pas si c'est un choix ou un oubli.
-- On rend donc l'intention explicite : lecture pour l'admin, ecriture pour
-- personne (seules les fonctions SECURITY DEFINER y touchent).

drop policy if exists "quotas lisibles par un admin" on public.rate_limits;
create policy "quotas lisibles par un admin" on public.rate_limits
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "compteurs lisibles par un admin" on public.compteurs_commande;
create policy "compteurs lisibles par un admin" on public.compteurs_commande
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

grant select on public.rate_limits to authenticated;
grant select on public.compteurs_commande to authenticated;
