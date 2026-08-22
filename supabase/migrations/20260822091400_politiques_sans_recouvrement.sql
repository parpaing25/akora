-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 15. Politiques : plus de recouvrement, plus de re-evaluation
-- ═══════════════════════════════════════════════════════════════════════════
-- Deux corrections, portant sur les memes politiques.
--
-- 1. RECOUVREMENT. Une politique `for all` ajoute aussi une politique SELECT.
--    Sur les referentiels, chaque lecture d'un compte connecte evaluait donc
--    DEUX politiques : « lisible par tous » et « ecrit par un admin ». On
--    remplace le `for all` par un triplet insert / update / delete.
--
-- 2. RE-EVALUATION. `auth.uid()` ecrit tel quel dans une politique est
--    reevalue POUR CHAQUE LIGNE. Enveloppe dans un sous-select, Postgres le
--    calcule une fois par requete. Sur une liste de 20 produits ce n'est rien,
--    sur un export de commandes cela se voit.

do $$
declare
  cible record;
begin
  for cible in
    select * from (values
      ('categories',    'familles ecrites par un admin'),
      ('materiaux_ref', 'materiaux ecrits par un admin'),
      ('localites',     'localites ecrites par un admin'),
      ('ratios_metre',  'ratios ecrits par un admin'),
      ('commissions',   'commissions ecrites par un admin'),
      ('parametres',    'parametres ecrits par un admin'),
      ('user_roles',    'roles ecrits par un admin seulement')
    ) as t(table_nom, ancienne_politique)
  loop
    execute format('drop policy if exists %I on public.%I', cible.ancienne_politique, cible.table_nom);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_role((select auth.uid()), ''admin''))',
      cible.table_nom || ' : ajout par un admin', cible.table_nom);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_role((select auth.uid()), ''admin'')) with check (public.has_role((select auth.uid()), ''admin''))',
      cible.table_nom || ' : modification par un admin', cible.table_nom);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_role((select auth.uid()), ''admin''))',
      cible.table_nom || ' : suppression par un admin', cible.table_nom);
  end loop;
end $$;
