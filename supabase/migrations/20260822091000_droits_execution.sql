-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 11. Droits d'execution des fonctions
-- ═══════════════════════════════════════════════════════════════════════════
-- Postgres accorde EXECUTE a `public` par defaut. Sur des fonctions
-- SECURITY DEFINER, cela revient a publier une porte derobee : n'importe quel
-- porteur de la cle anon pourrait appeler `ecrire_ledger` et se crediter.
-- On ferme donc tout, puis on rouvre au cas par cas.

-- ── Fonctions internes : personne ne les appelle depuis le navigateur ─────
revoke all on function public.ecrire_ledger(uuid, public.type_ecriture, bigint, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.liberer_sequestre(uuid) from public, anon, authenticated;
revoke all on function public.journaliser(text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.notifier(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.consommer_quota(text, text, integer) from public, anon, authenticated;
revoke all on function public.prochain_numero_commande() from public, anon, authenticated;
revoke all on function public.recalculer_niveau_verification(uuid) from public, anon, authenticated;
revoke all on function public.attribuer_badges_partenaire() from public, anon, authenticated;
revoke all on function public.gerer_nouvel_utilisateur() from public, anon, authenticated;

-- ── Fonctions ouvertes aux comptes connectes ──────────────────────────────
-- Chacune verifie elle-meme les droits qu'elle exige.
grant execute on function public.reveler_contact_fournisseur(uuid) to authenticated;
grant execute on function public.confirmer_livraison(uuid) to authenticated;
grant execute on function public.statuer_document(uuid, public.statut_document, text) to authenticated;
grant execute on function public.accepter_demande_materiau(uuid, text, text, uuid, public.unite, numeric, numeric) to authenticated;
grant execute on function public.refuser_demande_materiau(uuid, text) to authenticated;

-- ── Lectures sans risque ──────────────────────────────────────────────────
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;
grant execute on function public.est_membre_fournisseur(uuid) to authenticated;
grant execute on function public.taux_commission(uuid) to anon, authenticated;
grant execute on function public.compter_vue_produit(uuid) to anon, authenticated;
grant execute on function public.transition_commande_valide(public.statut_commande, public.statut_commande) to anon, authenticated;
grant execute on function public.transition_paiement_valide(public.statut_paiement, public.statut_paiement) to anon, authenticated;

-- ── Verification du ledger : reservee aux administrateurs ─────────────────
-- La fonction ne filtre pas elle-meme : on l'enveloppe pour qu'un fournisseur
-- ne puisse pas lire les ecarts de tous les autres.
revoke all on function public.verifier_solde_ledger() from public, anon, authenticated;

create or replace function public.controle_ledger()
returns table (fournisseur_id uuid, solde_portefeuille bigint, solde_ledger bigint, ecart bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Reserve aux administrateurs.';
  end if;
  return query select * from public.verifier_solde_ledger();
end;
$$;

revoke all on function public.controle_ledger() from public, anon;
grant execute on function public.controle_ledger() to authenticated;

-- ── Rappel : aucune ecriture directe sur les tables d'argent ──────────────
-- Ces revocations sont deja posees table par table ; on les repete ici pour
-- qu'un futur `grant all on all tables` ne les efface pas en silence.
revoke insert, update, delete on public.paiements, public.ledger, public.portefeuilles,
  public.audit_log, public.prix_historique, public.webhooks_recus, public.rate_limits,
  public.compteurs_commande
  from anon, authenticated;
