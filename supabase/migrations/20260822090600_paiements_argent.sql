-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 07. Paiements, sequestre, portefeuilles, ledger, retraits, litiges
-- ═══════════════════════════════════════════════════════════════════════════
-- Regle qui gouverne tout ce fichier : AUCUN montant ne vient du navigateur.
-- Les Edge Functions recalculent depuis la commande ; le client n'a meme pas
-- le droit d'inserer une ligne ici.

create table if not exists public.paiements (
  id                 uuid primary key default gen_random_uuid(),
  commande_id        uuid not null references public.commandes(id) on delete restrict,
  operateur          public.operateur_paiement not null,
  mode               public.mode_paiement not null,
  montant            bigint not null,
  cle_idempotence    text not null unique,
  reference_externe  text,
  reference_saisie   text,
  msisdn             text,
  statut             public.statut_paiement not null default 'initie',
  payload_brut       jsonb,
  initie_le          timestamptz not null default now(),
  confirme_le        timestamptz,
  libere_le          timestamptz,
  updated_at         timestamptz not null default now(),
  constraint paiements_montant_positif check (montant > 0),
  constraint paiements_msisdn_valide check (msisdn is null or msisdn ~ '^\+2613[2-9][0-9]{7}$')
);
create index if not exists idx_paiements_commande on public.paiements(commande_id, initie_le desc);
create index if not exists idx_paiements_statut on public.paiements(statut, initie_le)
  where statut in ('en_attente_client', 'en_verification', 'sequestre');

drop trigger if exists trg_paiements_updated on public.paiements;
create trigger trg_paiements_updated before update on public.paiements
  for each row execute function public.toucher_updated_at();

alter table public.paiements enable row level security;
revoke all on public.paiements from anon;
-- Lecture seule pour l'acheteur et le fournisseur : ni insert, ni update.
revoke insert, update, delete on public.paiements from authenticated;

drop policy if exists "paiement lisible par les parties ou un admin" on public.paiements;
create policy "paiement lisible par les parties ou un admin" on public.paiements
  for select to authenticated
  using (exists (select 1 from public.commandes c
                  where c.id = commande_id
                    and (c.acheteur_id = auth.uid()
                         or public.est_membre_fournisseur(c.fournisseur_id)
                         or public.has_role(auth.uid(), 'admin'))));

-- ── Machine a etats du paiement (spec B9) ─────────────────────────────────
create or replace function public.transition_paiement_valide(
  _depuis public.statut_paiement, _vers public.statut_paiement)
returns boolean
language sql
immutable
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

comment on function public.transition_paiement_valide is
  'Etats terminaux : libere, rembourse, rejete, expire, echoue. Aucun retour en arriere.';

create or replace function public.controler_transition_paiement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut is not distinct from old.statut then
    return new;
  end if;
  if not public.transition_paiement_valide(old.statut, new.statut) then
    raise exception 'Transition de paiement interdite : % vers %.', old.statut, new.statut;
  end if;
  if new.statut = 'confirme' and new.confirme_le is null then
    new.confirme_le := now();
  elsif new.statut = 'libere' and new.libere_le is null then
    new.libere_le := now();
  end if;
  -- Le montant d'un paiement ne bouge jamais apres son initiation.
  new.montant := old.montant;
  new.commande_id := old.commande_id;
  new.cle_idempotence := old.cle_idempotence;
  return new;
end;
$$;

drop trigger if exists trg_paiements_transition on public.paiements;
create trigger trg_paiements_transition
  before update on public.paiements
  for each row execute function public.controler_transition_paiement();

-- ── webhooks_recus : anti-rejeu ───────────────────────────────────────────
-- Un operateur qui reemet dix fois le meme evenement ne doit crediter qu'une
-- fois. L'unicite de `id_evenement` est la seule garantie qui tienne.
create table if not exists public.webhooks_recus (
  id               bigserial primary key,
  operateur        public.operateur_paiement not null,
  id_evenement     text not null,
  signature_valide boolean not null default false,
  payload          jsonb not null,
  traite           boolean not null default false,
  erreur           text,
  recu_le          timestamptz not null default now(),
  unique (operateur, id_evenement)
);
create index if not exists idx_webhooks_a_traiter on public.webhooks_recus(traite, recu_le) where not traite;

alter table public.webhooks_recus enable row level security;
revoke all on public.webhooks_recus from anon, authenticated;

drop policy if exists "webhooks lisibles par un admin" on public.webhooks_recus;
create policy "webhooks lisibles par un admin" on public.webhooks_recus
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ── portefeuilles et ledger ───────────────────────────────────────────────
-- Le solde n'est jamais une valeur autonome : il doit rester exactement egal
-- a la somme du ledger. Un test automatise le verifie (recette F10).
create table if not exists public.portefeuilles (
  fournisseur_id   uuid primary key references public.fournisseurs(id) on delete cascade,
  solde_disponible bigint not null default 0,
  solde_sequestre  bigint not null default 0,
  maj_le           timestamptz not null default now(),
  constraint portefeuilles_soldes_positifs
    check (solde_disponible >= 0 and solde_sequestre >= 0)
);

alter table public.portefeuilles enable row level security;
revoke all on public.portefeuilles from anon;
revoke insert, update, delete on public.portefeuilles from authenticated;

drop policy if exists "portefeuille lisible par son fournisseur ou un admin" on public.portefeuilles;
create policy "portefeuille lisible par son fournisseur ou un admin" on public.portefeuilles
  for select to authenticated
  using (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'));

create table if not exists public.ledger (
  id             bigserial primary key,
  fournisseur_id uuid not null references public.fournisseurs(id) on delete restrict,
  commande_id    uuid references public.commandes(id) on delete set null,
  paiement_id    uuid references public.paiements(id) on delete set null,
  retrait_id     uuid,
  type           public.type_ecriture not null,
  montant        bigint not null,
  solde_apres    bigint not null,
  libelle        text not null,
  created_at     timestamptz not null default now(),
  constraint ledger_montant_non_nul check (montant <> 0)
);
create index if not exists idx_ledger_fournisseur on public.ledger(fournisseur_id, id);

alter table public.ledger enable row level security;
revoke all on public.ledger from anon;
revoke insert, update, delete on public.ledger from authenticated;

drop policy if exists "ledger lisible par son fournisseur ou un admin" on public.ledger;
create policy "ledger lisible par son fournisseur ou un admin" on public.ledger
  for select to authenticated
  using (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'));

-- Ecritures IMMUABLES. On ne corrige pas une ligne de ledger : on en ajoute
-- une de type `ajustement`. C'est ce qui rend le solde reconstituable.
create or replace function public.interdire_modification_ledger()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Le ledger est immuable : ajoutez une ecriture d''ajustement plutot que de modifier ou supprimer.';
end;
$$;

drop trigger if exists trg_ledger_immuable on public.ledger;
create trigger trg_ledger_immuable
  before update or delete on public.ledger
  for each row execute function public.interdire_modification_ledger();

-- ── L'unique porte d'ecriture du portefeuille ─────────────────────────────
create or replace function public.ecrire_ledger(
  _fournisseur_id uuid,
  _type public.type_ecriture,
  _montant bigint,
  _libelle text,
  _commande_id uuid default null,
  _paiement_id uuid default null,
  _retrait_id uuid default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  nouveau_solde bigint;
  id_ecriture bigint;
begin
  insert into public.portefeuilles (fournisseur_id)
  values (_fournisseur_id)
  on conflict (fournisseur_id) do nothing;

  -- Verrou de ligne : deux liberations simultanees ne doivent pas lire le
  -- meme solde de depart.
  select solde_disponible into nouveau_solde
    from public.portefeuilles where fournisseur_id = _fournisseur_id for update;

  nouveau_solde := nouveau_solde + _montant;
  if nouveau_solde < 0 then
    raise exception 'Solde insuffisant : le portefeuille passerait a % Ar.', nouveau_solde;
  end if;

  insert into public.ledger (fournisseur_id, commande_id, paiement_id, retrait_id,
                             type, montant, solde_apres, libelle)
  values (_fournisseur_id, _commande_id, _paiement_id, _retrait_id,
          _type, _montant, nouveau_solde, _libelle)
  returning id into id_ecriture;

  update public.portefeuilles
     set solde_disponible = nouveau_solde, maj_le = now()
   where fournisseur_id = _fournisseur_id;

  return id_ecriture;
end;
$$;

comment on function public.ecrire_ledger is
  'Seule fonction autorisee a bouger un solde. Toute mise a jour de portefeuille sans ecriture correspondante est un bug.';

-- ── retraits : le fournisseur demande, l'admin execute ────────────────────
create table if not exists public.retraits (
  id             uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null references public.fournisseurs(id) on delete restrict,
  montant        bigint not null,
  operateur      public.operateur_paiement not null,
  msisdn         text not null,
  statut         public.statut_retrait not null default 'demande',
  reference      text,
  motif_refus    text,
  demande_le     timestamptz not null default now(),
  traite_par     uuid references auth.users(id) on delete set null,
  traite_le      timestamptz,
  constraint retraits_montant_positif check (montant > 0),
  constraint retraits_msisdn_valide check (msisdn ~ '^\+2613[2-9][0-9]{7}$')
);
create index if not exists idx_retraits_fournisseur on public.retraits(fournisseur_id, demande_le desc);
create index if not exists idx_retraits_a_traiter on public.retraits(statut, demande_le)
  where statut in ('demande', 'en_cours');

alter table public.retraits enable row level security;
revoke all on public.retraits from anon;

drop policy if exists "retraits lisibles par leur fournisseur ou un admin" on public.retraits;
create policy "retraits lisibles par leur fournisseur ou un admin" on public.retraits
  for select to authenticated
  using (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "retraits demandes par leur fournisseur" on public.retraits;
create policy "retraits demandes par leur fournisseur" on public.retraits
  for insert to authenticated
  with check (public.est_membre_fournisseur(fournisseur_id) and statut = 'demande');

drop policy if exists "retraits executes par un admin" on public.retraits;
create policy "retraits executes par un admin" on public.retraits
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Le montant demande doit tenir dans le solde disponible et depasser le
-- minimum parametre. Verifie en base, pas seulement dans le formulaire.
create or replace function public.verifier_demande_retrait()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  disponible bigint;
  minimum bigint;
begin
  select coalesce(solde_disponible, 0) into disponible
    from public.portefeuilles where fournisseur_id = new.fournisseur_id;
  select coalesce((valeur)::text::bigint, 50000) into minimum
    from public.parametres where cle = 'retrait_minimum_ar';

  if new.montant < minimum then
    raise exception 'Le versement minimum est de % Ar.', minimum;
  end if;
  if new.montant > coalesce(disponible, 0) then
    raise exception 'Solde disponible insuffisant (% Ar).', coalesce(disponible, 0);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_retraits_verifier on public.retraits;
create trigger trg_retraits_verifier
  before insert on public.retraits
  for each row execute function public.verifier_demande_retrait();

-- ── litiges ───────────────────────────────────────────────────────────────
create table if not exists public.litiges (
  id                uuid primary key default gen_random_uuid(),
  commande_id       uuid not null references public.commandes(id) on delete cascade,
  ouvert_par        uuid not null references auth.users(id) on delete restrict,
  motif             text not null,
  description       text,
  photos            text[] not null default '{}',
  statut            public.statut_litige not null default 'ouvert',
  decision          text,
  montant_rembourse bigint,
  arbitre_par       uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint litiges_photos_bornees check (cardinality(photos) <= 8),
  constraint litiges_remboursement_positif
    check (montant_rembourse is null or montant_rembourse >= 0),
  constraint litiges_decision_motivee
    check (statut <> 'tranche' or (decision is not null and length(btrim(decision)) > 0))
);
create unique index if not exists idx_litige_ouvert_par_commande
  on public.litiges(commande_id) where statut <> 'tranche';

drop trigger if exists trg_litiges_updated on public.litiges;
create trigger trg_litiges_updated before update on public.litiges
  for each row execute function public.toucher_updated_at();

alter table public.litiges enable row level security;
revoke all on public.litiges from anon;

drop policy if exists "litige lisible par les parties ou un admin" on public.litiges;
create policy "litige lisible par les parties ou un admin" on public.litiges
  for select to authenticated
  using (exists (select 1 from public.commandes c
                  where c.id = commande_id
                    and (c.acheteur_id = auth.uid()
                         or public.est_membre_fournisseur(c.fournisseur_id)
                         or public.has_role(auth.uid(), 'admin'))));

drop policy if exists "litige ouvert par l acheteur" on public.litiges;
create policy "litige ouvert par l acheteur" on public.litiges
  for insert to authenticated
  with check (ouvert_par = auth.uid()
              and exists (select 1 from public.commandes c
                           where c.id = commande_id and c.acheteur_id = auth.uid()));

drop policy if exists "litige arbitre par un admin" on public.litiges;
create policy "litige arbitre par un admin" on public.litiges
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Le retrait cite une ecriture de ledger, et reciproquement : on ferme la
-- boucle maintenant que les deux tables existent.
alter table public.ledger drop constraint if exists ledger_retrait_fk;
alter table public.ledger add constraint ledger_retrait_fk
  foreign key (retrait_id) references public.retraits(id) on delete set null;
