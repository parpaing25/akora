-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 16. Meme traitement pour les tables gerees par un fournisseur
-- ═══════════════════════════════════════════════════════════════════════════
-- Ces tables ont deja une politique SELECT (publique ou reservee a l'equipe).
-- La politique `for all` qui les accompagnait en ajoutait une seconde. On la
-- remplace par un triplet, avec la meme condition, enveloppee dans un
-- sous-select pour n'etre evaluee qu'une fois par requete.

do $$
declare
  cible record;
  condition text;
begin
  for cible in
    select * from (values
      ('produits',            'produits geres par leur fournisseur',
       'public.est_membre_fournisseur(fournisseur_id) or public.has_role((select auth.uid()), ''admin'')'),
      ('vehicules_livraison', 'vehicules geres par leur fournisseur',
       'public.est_membre_fournisseur(fournisseur_id) or public.has_role((select auth.uid()), ''admin'')'),
      ('zones_livraison',     'zones gerees par leur fournisseur',
       'public.est_membre_fournisseur(fournisseur_id) or public.has_role((select auth.uid()), ''admin'')'),
      ('fournisseur_membres', 'membres geres par le proprietaire',
       'exists (select 1 from public.fournisseurs f where f.id = fournisseur_id and f.owner_id = (select auth.uid())) or public.has_role((select auth.uid()), ''admin'')'),
      ('produits_paliers',    'paliers geres par le fournisseur du produit',
       'exists (select 1 from public.produits p where p.id = produit_id and (public.est_membre_fournisseur(p.fournisseur_id) or public.has_role((select auth.uid()), ''admin'')))')
    ) as t(table_nom, ancienne_politique, condition_sql)
  loop
    condition := cible.condition_sql;
    execute format('drop policy if exists %I on public.%I', cible.ancienne_politique, cible.table_nom);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
                   cible.table_nom || ' : ajout par son equipe', cible.table_nom, condition);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
                   cible.table_nom || ' : modification par son equipe', cible.table_nom, condition, condition);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)',
                   cible.table_nom || ' : suppression par son equipe', cible.table_nom, condition);
  end loop;
end $$;

-- ── Avis : une seule politique de lecture au lieu de deux ────────────────
drop policy if exists "avis publies lisibles par tous" on public.avis;
drop policy if exists "avis lisible par son auteur son fournisseur ou un admin" on public.avis;

create policy "avis lisibles : publies, ou par les parties" on public.avis
  for select to anon, authenticated
  using (
    statut = 'publie'
    or auteur_id = (select auth.uid())
    or public.est_membre_fournisseur(fournisseur_id)
    or public.has_role((select auth.uid()), 'admin')
  );
