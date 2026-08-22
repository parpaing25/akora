-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 17. auth.uid() evalue une fois par requete, pas une fois par ligne
-- ═══════════════════════════════════════════════════════════════════════════
-- Fichier GENERE par scripts/generer-migration-initplan.mjs a partir des
-- politiques reellement en place. Chaque `auth.uid()` nu est enveloppe dans
-- un sous-select : Postgres le sort alors de la boucle sur les lignes.
-- La logique d'autorisation, elle, est rigoureusement inchangee.

drop policy if exists "adresses privees" on public.adresses_chantier;
create policy "adresses privees" on public.adresses_chantier
  for all to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "journal lisible par un admin" on public.audit_log;
create policy "journal lisible par un admin" on public.audit_log
  for select to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists "avis depose par l acheteur d une commande cloturee" on public.avis;
create policy "avis depose par l acheteur d une commande cloturee" on public.avis
  for insert to authenticated
  with check (((auteur_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM commandes c
  WHERE ((c.id = avis.commande_id) AND (c.acheteur_id = (select auth.uid())) AND (c.statut = 'cloturee'::statut_commande) AND (c.fournisseur_id = avis.fournisseur_id))))));

drop policy if exists "avis modere par un admin" on public.avis;
create policy "avis modere par un admin" on public.avis
  for update to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) OR est_membre_fournisseur(fournisseur_id) OR (auteur_id = (select auth.uid()))))
  with check ((has_role((select auth.uid()), 'admin'::app_role) OR est_membre_fournisseur(fournisseur_id) OR (auteur_id = (select auth.uid()))));

drop policy if exists "commande lisible par son acheteur son fournisseur ou un admin" on public.commandes;
create policy "commande lisible par son acheteur son fournisseur ou un admin" on public.commandes
  for select to authenticated
  using (((acheteur_id = (select auth.uid())) OR est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "commande mise a jour par son fournisseur ou un admin" on public.commandes;
create policy "commande mise a jour par son fournisseur ou un admin" on public.commandes
  for update to authenticated
  using (((acheteur_id = (select auth.uid())) OR est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)))
  with check (((acheteur_id = (select auth.uid())) OR est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "compteurs lisibles par un admin" on public.compteurs_commande;
create policy "compteurs lisibles par un admin" on public.compteurs_commande
  for select to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists "demandes arbitrees par un admin" on public.demandes_materiau;
create policy "demandes arbitrees par un admin" on public.demandes_materiau
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists "demandes lisibles par leur auteur ou un admin" on public.demandes_materiau;
create policy "demandes lisibles par leur auteur ou un admin" on public.demandes_materiau
  for select to authenticated
  using ((est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "pieces lisibles par leur fournisseur ou un admin" on public.documents_fournisseur;
create policy "pieces lisibles par leur fournisseur ou un admin" on public.documents_fournisseur
  for select to authenticated
  using ((est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "pieces mises a jour par leur fournisseur ou un admin" on public.documents_fournisseur;
create policy "pieces mises a jour par leur fournisseur ou un admin" on public.documents_fournisseur
  for update to authenticated
  using ((est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)))
  with check ((est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "pieces supprimees par leur fournisseur" on public.documents_fournisseur;
create policy "pieces supprimees par leur fournisseur" on public.documents_fournisseur
  for delete to authenticated
  using ((est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "favoris prives" on public.favoris;
create policy "favoris prives" on public.favoris
  for all to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "membres lisibles par l equipe ou un admin" on public.fournisseur_membres;
create policy "membres lisibles par l equipe ou un admin" on public.fournisseur_membres
  for select to authenticated
  using (((user_id = (select auth.uid())) OR est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "fiche creee par son proprietaire" on public.fournisseurs;
create policy "fiche creee par son proprietaire" on public.fournisseurs
  for insert to authenticated
  with check (((owner_id = (select auth.uid())) AND has_role((select auth.uid()), 'fournisseur'::app_role)));

drop policy if exists "fiche lisible par son equipe ou un admin" on public.fournisseurs;
create policy "fiche lisible par son equipe ou un admin" on public.fournisseurs
  for select to authenticated
  using (((owner_id = (select auth.uid())) OR est_membre_fournisseur(id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "fiche modifiee par son equipe ou un admin" on public.fournisseurs;
create policy "fiche modifiee par son equipe ou un admin" on public.fournisseurs
  for update to authenticated
  using (((owner_id = (select auth.uid())) OR est_membre_fournisseur(id) OR has_role((select auth.uid()), 'admin'::app_role)))
  with check (((owner_id = (select auth.uid())) OR est_membre_fournisseur(id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "fiche supprimee par un admin" on public.fournisseurs;
create policy "fiche supprimee par un admin" on public.fournisseurs
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists "ledger lisible par son fournisseur ou un admin" on public.ledger;
create policy "ledger lisible par son fournisseur ou un admin" on public.ledger
  for select to authenticated
  using ((est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "lignes lisibles avec leur commande" on public.lignes_commande;
create policy "lignes lisibles avec leur commande" on public.lignes_commande
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM commandes c
  WHERE ((c.id = lignes_commande.commande_id) AND ((c.acheteur_id = (select auth.uid())) OR est_membre_fournisseur(c.fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role))))));

drop policy if exists "litige arbitre par un admin" on public.litiges;
create policy "litige arbitre par un admin" on public.litiges
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists "litige lisible par les parties ou un admin" on public.litiges;
create policy "litige lisible par les parties ou un admin" on public.litiges
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM commandes c
  WHERE ((c.id = litiges.commande_id) AND ((c.acheteur_id = (select auth.uid())) OR est_membre_fournisseur(c.fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role))))));

drop policy if exists "litige ouvert par l acheteur" on public.litiges;
create policy "litige ouvert par l acheteur" on public.litiges
  for insert to authenticated
  with check (((ouvert_par = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM commandes c
  WHERE ((c.id = litiges.commande_id) AND (c.acheteur_id = (select auth.uid())))))));

drop policy if exists "notification marquee lue par son destinataire" on public.notifications;
create policy "notification marquee lue par son destinataire" on public.notifications
  for update to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "notifications privees" on public.notifications;
create policy "notifications privees" on public.notifications
  for select to authenticated
  using ((user_id = (select auth.uid())));

drop policy if exists "paiement lisible par les parties ou un admin" on public.paiements;
create policy "paiement lisible par les parties ou un admin" on public.paiements
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM commandes c
  WHERE ((c.id = paiements.commande_id) AND ((c.acheteur_id = (select auth.uid())) OR est_membre_fournisseur(c.fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role))))));

drop policy if exists "portefeuille lisible par son fournisseur ou un admin" on public.portefeuilles;
create policy "portefeuille lisible par son fournisseur ou un admin" on public.portefeuilles
  for select to authenticated
  using ((est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "produits lisibles par leur fournisseur ou un admin" on public.produits;
create policy "produits lisibles par leur fournisseur ou un admin" on public.produits
  for select to authenticated
  using ((est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "profil lisible par son proprietaire" on public.profiles;
create policy "profil lisible par son proprietaire" on public.profiles
  for select to authenticated
  using ((id = (select auth.uid())));

drop policy if exists "profil modifiable par son proprietaire" on public.profiles;
create policy "profil modifiable par son proprietaire" on public.profiles
  for update to authenticated
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

drop policy if exists "profil supprimable par son proprietaire" on public.profiles;
create policy "profil supprimable par son proprietaire" on public.profiles
  for delete to authenticated
  using ((id = (select auth.uid())));

drop policy if exists "quotas lisibles par un admin" on public.rate_limits;
create policy "quotas lisibles par un admin" on public.rate_limits
  for select to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists "retraits executes par un admin" on public.retraits;
create policy "retraits executes par un admin" on public.retraits
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists "retraits lisibles par leur fournisseur ou un admin" on public.retraits;
create policy "retraits lisibles par leur fournisseur ou un admin" on public.retraits
  for select to authenticated
  using ((est_membre_fournisseur(fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "signalement depose par un utilisateur connecte" on public.signalements;
create policy "signalement depose par un utilisateur connecte" on public.signalements
  for insert to authenticated
  with check ((signale_par = (select auth.uid())));

drop policy if exists "signalement traite par un admin" on public.signalements;
create policy "signalement traite par un admin" on public.signalements
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists "signalements lisibles par un admin" on public.signalements;
create policy "signalements lisibles par un admin" on public.signalements
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) OR (signale_par = (select auth.uid()))));

drop policy if exists "roles lisibles par soi ou par un admin" on public.user_roles;
create policy "roles lisibles par soi ou par un admin" on public.user_roles
  for select to authenticated
  using (((user_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "compteur de vues lisible par le fournisseur" on public.vues_produit_jour;
create policy "compteur de vues lisible par le fournisseur" on public.vues_produit_jour
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM produits p
  WHERE ((p.id = vues_produit_jour.produit_id) AND (est_membre_fournisseur(p.fournisseur_id) OR has_role((select auth.uid()), 'admin'::app_role))))));

drop policy if exists "webhooks lisibles par un admin" on public.webhooks_recus;
create policy "webhooks lisibles par un admin" on public.webhooks_recus
  for select to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role));
