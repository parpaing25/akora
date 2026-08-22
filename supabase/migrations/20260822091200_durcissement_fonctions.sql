-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 13. Durcissement des fonctions (retours du conseiller Supabase)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── search_path fige sur les quatre fonctions qui l'avaient laisse libre ──
-- Une fonction sans search_path fixe peut etre detournee : il suffit qu'un
-- appelant place un schema devant `public` pour que `has_role` ou un operateur
-- soit remplace par le sien.
create or replace function public.est_appel_systeme()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(current_setting('akora.systeme', true), 'off') = 'on'
     and current_user in ('postgres', 'supabase_admin', 'service_role');
$$;

create or replace function public.transition_commande_valide(
  _depuis public.statut_commande, _vers public.statut_commande)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case _depuis
    when 'brouillon'           then _vers in ('envoyee', 'annulee')
    when 'envoyee'             then _vers in ('vue', 'refusee', 'annulee')
    when 'vue'                 then _vers in ('devis_envoye', 'acceptee', 'refusee', 'annulee')
    when 'devis_envoye'        then _vers in ('acceptee', 'refusee', 'annulee')
    when 'acceptee'            then _vers in ('en_attente_paiement', 'en_preparation', 'annulee')
    when 'en_attente_paiement' then _vers in ('payee', 'acceptee', 'annulee')
    when 'payee'               then _vers in ('en_preparation', 'litige', 'annulee')
    when 'en_preparation'      then _vers in ('en_livraison', 'litige', 'annulee')
    when 'en_livraison'        then _vers in ('livree', 'litige')
    when 'livree'              then _vers in ('cloturee', 'litige')
    when 'litige'              then _vers in ('livree', 'cloturee', 'annulee')
    else false
  end;
$$;

create or replace function public.transition_paiement_valide(
  _depuis public.statut_paiement, _vers public.statut_paiement)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case _depuis
    when 'initie'            then _vers in ('en_attente_client', 'echoue')
    when 'en_attente_client' then _vers in ('en_verification', 'confirme', 'expire', 'echoue')
    when 'en_verification'   then _vers in ('confirme', 'rejete')
    when 'confirme'          then _vers in ('sequestre', 'rembourse')
    when 'sequestre'         then _vers in ('libere', 'rembourse')
    else false
  end;
$$;

create or replace function public.interdire_modification_ledger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Le ledger est immuable : ajoutez une ecriture d''ajustement plutot que de modifier ou supprimer.';
end;
$$;

-- ── Personne n'appelle une fonction de trigger a la main ──────────────────
-- Postgres accorde EXECUTE a `public` par defaut, et mes revocations de la
-- migration 11 ne couvraient pas les fonctions de trigger. Elles echoueraient
-- de toute facon hors contexte, mais on ne laisse pas une porte entrouverte
-- au motif qu'elle donne sur un mur.
revoke all on function public.aligner_produit_sur_reference() from public, anon, authenticated;
revoke all on function public.historiser_prix() from public, anon, authenticated;
revoke all on function public.verifier_palier() from public, anon, authenticated;
revoke all on function public.verifier_demande_retrait() from public, anon, authenticated;
revoke all on function public.recalculer_note_fournisseur() from public, anon, authenticated;
revoke all on function public.controler_transition_commande() from public, anon, authenticated;
revoke all on function public.controler_transition_paiement() from public, anon, authenticated;
revoke all on function public.proteger_colonnes_fournisseur() from public, anon, authenticated;
revoke all on function public.proteger_colonnes_document() from public, anon, authenticated;
revoke all on function public.proteger_colonnes_avis() from public, anon, authenticated;
revoke all on function public.figer_montants_commande() from public, anon, authenticated;
revoke all on function public.toucher_updated_at() from public, anon, authenticated;

-- ── Les actions reservees ne sont plus exposees a anon ────────────────────
-- Elles verifient toutes leur appelant, mais un visiteur non connecte n'a
-- aucune raison de pouvoir seulement les atteindre.
revoke all on function public.accepter_demande_materiau(uuid, text, text, uuid, public.unite, numeric, numeric) from public, anon;
revoke all on function public.refuser_demande_materiau(uuid, text) from public, anon;
revoke all on function public.statuer_document(uuid, public.statut_document, text) from public, anon;
revoke all on function public.confirmer_livraison(uuid) from public, anon;
revoke all on function public.reveler_contact_fournisseur(uuid) from public, anon;
revoke all on function public.controle_ledger() from public, anon;
revoke all on function public.est_membre_fournisseur(uuid) from public, anon;

grant execute on function public.accepter_demande_materiau(uuid, text, text, uuid, public.unite, numeric, numeric) to authenticated;
grant execute on function public.refuser_demande_materiau(uuid, text) to authenticated;
grant execute on function public.statuer_document(uuid, public.statut_document, text) to authenticated;
grant execute on function public.confirmer_livraison(uuid) to authenticated;
grant execute on function public.reveler_contact_fournisseur(uuid) to authenticated;
grant execute on function public.controle_ledger() to authenticated;
grant execute on function public.est_membre_fournisseur(uuid) to authenticated;

-- `has_role`, `taux_commission`, `compter_vue_produit` et les deux fonctions
-- de transition restent accessibles a anon : les politiques RLS evaluees pour
-- un visiteur en ont besoin, et elles ne revelent rien.
