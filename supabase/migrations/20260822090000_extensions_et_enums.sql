-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 01. Extensions et vocabulaire
-- ═══════════════════════════════════════════════════════════════════════════
-- Les enumerations sont l'unique source de verite du vocabulaire metier.
-- Leur equivalent TypeScript (src/lib/types-metier.ts) les recopie mot pour mot.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.app_role as enum ('acheteur', 'fournisseur', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.statut_fournisseur as enum ('brouillon', 'en_attente', 'actif', 'suspendu');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.niveau_verification as enum ('non_verifie', 'en_cours', 'verifie', 'partenaire');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.statut_document as enum ('en_attente', 'valide', 'refuse');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.type_document as enum
    ('nif', 'stat', 'rcs', 'cin_gerant', 'photo_depot', 'photo_camion', 'numero_versement');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stock_statut as enum ('en_stock', 'sur_commande', 'rupture');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.statut_produit as enum ('brouillon', 'en_attente_materiau', 'actif', 'inactif');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.statut_commande as enum (
    'brouillon', 'envoyee', 'vue', 'devis_envoye', 'acceptee', 'en_attente_paiement',
    'payee', 'en_preparation', 'en_livraison', 'livree', 'cloturee', 'annulee',
    'refusee', 'litige');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.mode_paiement as enum ('en_ligne_integral', 'en_ligne_acompte', 'a_la_livraison');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.operateur_paiement as enum ('mvola', 'orange_money', 'airtel_money');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.statut_paiement as enum (
    'initie', 'en_attente_client', 'en_verification', 'confirme', 'sequestre',
    'libere', 'rembourse', 'rejete', 'expire', 'echoue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.unite as enum
    ('piece', 'sac', 'm3', 'tonne', 'm2', 'ml', 'botte', 'chargement', 'palette');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.statut_demande_materiau as enum ('en_attente', 'acceptee', 'refusee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.statut_retrait as enum ('demande', 'en_cours', 'paye', 'refuse');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.statut_litige as enum ('ouvert', 'en_examen', 'tranche');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.type_ecriture as enum
    ('credit_sequestre', 'liberation', 'commission', 'retrait', 'remboursement', 'ajustement');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.type_client as enum ('particulier', 'entreprise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.role_interne as enum ('proprietaire', 'gestionnaire', 'commercial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.type_localite as enum ('region', 'district', 'commune', 'quartier');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.statut_moderation as enum ('en_attente', 'publie', 'masque');
exception when duplicate_object then null; end $$;
