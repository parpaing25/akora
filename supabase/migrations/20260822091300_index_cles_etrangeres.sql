-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 14. Index de couverture sur les cles etrangeres
-- ═══════════════════════════════════════════════════════════════════════════
-- Une cle etrangere sans index oblige Postgres a balayer la table fille a
-- chaque suppression du parent, et penalise toutes les jointures dans ce sens.

create index if not exists idx_adresses_localite on public.adresses_chantier(localite_id);
create index if not exists idx_avis_auteur on public.avis(auteur_id);
create index if not exists idx_avis_commande on public.avis(commande_id);
create index if not exists idx_commandes_localite on public.commandes(localite_id);
create index if not exists idx_commandes_vehicule on public.commandes(vehicule_id);
create index if not exists idx_demandes_categorie on public.demandes_materiau(categorie_id);
create index if not exists idx_demandes_ref_creee on public.demandes_materiau(materiau_ref_cree_id);
create index if not exists idx_documents_validateur on public.documents_fournisseur(valide_par);
create index if not exists idx_favoris_cible_produit on public.favoris(produit_id);
create index if not exists idx_favoris_cible_fournisseur on public.favoris(fournisseur_id);
create index if not exists idx_ledger_commande on public.ledger(commande_id);
create index if not exists idx_ledger_paiement on public.ledger(paiement_id);
create index if not exists idx_ledger_retrait on public.ledger(retrait_id);
create index if not exists idx_lignes_produit on public.lignes_commande(produit_id);
create index if not exists idx_litiges_commande on public.litiges(commande_id);
create index if not exists idx_litiges_auteur on public.litiges(ouvert_par);
create index if not exists idx_litiges_arbitre on public.litiges(arbitre_par);
create index if not exists idx_produits_demande on public.produits(demande_materiau_id);
create index if not exists idx_retraits_traite_par on public.retraits(traite_par);
create index if not exists idx_commissions_categorie on public.commissions(categorie_id);
create index if not exists idx_signalements_auteur on public.signalements(signale_par);
create index if not exists idx_signalements_traite_par on public.signalements(traite_par);
create index if not exists idx_fournisseurs_owner_fk on public.fournisseurs(owner_id);
create index if not exists idx_audit_acteur_fk on public.audit_log(acteur_id);
