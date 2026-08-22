-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 06. Adresses de chantier, commandes, lignes
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.adresses_chantier (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  libelle       text not null,
  localite_id   uuid references public.localites(id) on delete set null,
  lat           double precision,
  lng           double precision,
  adresse_libre text,
  par_defaut    boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint adresses_coordonnees_completes check ((lat is null) = (lng is null)),
  constraint adresses_lat_plausible check (lat is null or (lat between -26.0 and -11.0)),
  constraint adresses_lng_plausible check (lng is null or (lng between 42.0 and 51.5))
);
create index if not exists idx_adresses_user on public.adresses_chantier(user_id);
create unique index if not exists idx_adresse_defaut_unique
  on public.adresses_chantier(user_id) where par_defaut;

alter table public.adresses_chantier enable row level security;
revoke all on public.adresses_chantier from anon;

drop policy if exists "adresses privees" on public.adresses_chantier;
create policy "adresses privees" on public.adresses_chantier
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Numerotation AK-AAMM-XXXX, remise a zero chaque mois ──────────────────
create table if not exists public.compteurs_commande (
  periode text primary key,
  dernier integer not null default 0
);
alter table public.compteurs_commande enable row level security;
revoke all on public.compteurs_commande from anon, authenticated;

create or replace function public.prochain_numero_commande()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  periode text := to_char(now() at time zone 'Indian/Antananarivo', 'YYMM');
  rang integer;
begin
  insert into public.compteurs_commande (periode, dernier)
  values (periode, 1)
  on conflict (periode) do update set dernier = public.compteurs_commande.dernier + 1
  returning dernier into rang;
  return 'AK-' || periode || '-' || lpad(rang::text, 4, '0');
end;
$$;

-- ── commandes ─────────────────────────────────────────────────────────────
-- Une commande = UN fournisseur. Un panier multi-fournisseurs se scinde en
-- autant de commandes, chacune avec sa livraison et son paiement (spec B8).
create table if not exists public.commandes (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,
  acheteur_id         uuid references auth.users(id) on delete set null,
  nom_contact         text not null,
  telephone_contact   text not null,
  email_contact       text,
  fournisseur_id      uuid not null references public.fournisseurs(id) on delete restrict,
  localite_id         uuid references public.localites(id) on delete set null,
  lat                 double precision,
  lng                 double precision,
  adresse_libre       text,
  distance_km         numeric(7,2),
  vehicule_id         uuid references public.vehicules_livraison(id) on delete set null,
  nb_rotations        integer not null default 1,
  montant_produits    bigint not null default 0,
  montant_livraison   bigint not null default 0,
  montant_total       bigint not null default 0,
  montant_commission  bigint not null default 0,
  livraison_estimable boolean not null default false,
  mode_paiement       public.mode_paiement not null default 'a_la_livraison',
  statut              public.statut_commande not null default 'brouillon',
  message             text,
  vue_le              timestamptz,
  livree_le           timestamptz,
  confirmee_le        timestamptz,
  cloturee_le         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint commandes_montants_positifs
    check (montant_produits >= 0 and montant_livraison >= 0
           and montant_total >= 0 and montant_commission >= 0),
  constraint commandes_total_coherent
    check (montant_total = montant_produits + montant_livraison),
  constraint commandes_rotations_positives check (nb_rotations >= 1),
  constraint commandes_telephone_valide check (telephone_contact ~ '^\+2613[2-9][0-9]{7}$'),
  constraint commandes_coordonnees_completes check ((lat is null) = (lng is null)),
  -- Pas de paiement en ligne quand la livraison n'est pas estimable (B6 etape 5).
  constraint commandes_paiement_en_ligne_estimable
    check (mode_paiement = 'a_la_livraison' or livraison_estimable)
);
create index if not exists idx_commandes_acheteur on public.commandes(acheteur_id, created_at desc);
create index if not exists idx_commandes_fournisseur on public.commandes(fournisseur_id, statut, created_at desc);
create index if not exists idx_commandes_statut on public.commandes(statut) where statut in ('livree','litige');

drop trigger if exists trg_commandes_updated on public.commandes;
create trigger trg_commandes_updated before update on public.commandes
  for each row execute function public.toucher_updated_at();

alter table public.commandes enable row level security;
revoke all on public.commandes from anon;

drop policy if exists "commande lisible par son acheteur son fournisseur ou un admin" on public.commandes;
create policy "commande lisible par son acheteur son fournisseur ou un admin" on public.commandes
  for select to authenticated
  using (acheteur_id = auth.uid()
         or public.est_membre_fournisseur(fournisseur_id)
         or public.has_role(auth.uid(), 'admin'));

-- Une commande n'est jamais creee directement depuis le navigateur : elle
-- passe par la fonction `creer_commande`, qui recalcule tous les montants.
revoke insert on public.commandes from authenticated;

drop policy if exists "commande mise a jour par son fournisseur ou un admin" on public.commandes;
create policy "commande mise a jour par son fournisseur ou un admin" on public.commandes
  for update to authenticated
  using (acheteur_id = auth.uid()
         or public.est_membre_fournisseur(fournisseur_id)
         or public.has_role(auth.uid(), 'admin'))
  with check (acheteur_id = auth.uid()
              or public.est_membre_fournisseur(fournisseur_id)
              or public.has_role(auth.uid(), 'admin'));

-- ── lignes_commande : l'instantane de ce qui a ete vu au moment d'acheter ─
-- Les prix bougent. Une commande fige la designation, l'unite et le prix :
-- c'est ce qui rend le recu opposable trois mois plus tard.
create table if not exists public.lignes_commande (
  id                      uuid primary key default gen_random_uuid(),
  commande_id             uuid not null references public.commandes(id) on delete cascade,
  produit_id              uuid references public.produits(id) on delete set null,
  designation_snapshot    text not null,
  unite_snapshot          public.unite not null,
  prix_unitaire_snapshot  bigint not null,
  quantite                integer not null,
  total_ligne             bigint not null,
  constraint lignes_quantite_positive check (quantite > 0),
  constraint lignes_prix_positif check (prix_unitaire_snapshot > 0),
  constraint lignes_total_coherent check (total_ligne = prix_unitaire_snapshot * quantite)
);
create index if not exists idx_lignes_commande on public.lignes_commande(commande_id);

alter table public.lignes_commande enable row level security;
revoke all on public.lignes_commande from anon;
revoke insert, update, delete on public.lignes_commande from authenticated;

drop policy if exists "lignes lisibles avec leur commande" on public.lignes_commande;
create policy "lignes lisibles avec leur commande" on public.lignes_commande
  for select to authenticated
  using (exists (select 1 from public.commandes c
                  where c.id = commande_id
                    and (c.acheteur_id = auth.uid()
                         or public.est_membre_fournisseur(c.fournisseur_id)
                         or public.has_role(auth.uid(), 'admin'))));

-- ── Machine a etats des commandes ─────────────────────────────────────────
-- Verifiee EN BASE, pas seulement dans le code : un appel direct a l'API REST
-- ne doit pas pouvoir faire passer une commande de « envoyee » a « cloturee ».
create or replace function public.transition_commande_valide(
  _depuis public.statut_commande, _vers public.statut_commande)
returns boolean
language sql
immutable
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

create or replace function public.controler_transition_commande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut is not distinct from old.statut then
    return new;
  end if;
  if not public.transition_commande_valide(old.statut, new.statut) then
    raise exception 'Transition de commande interdite : % vers %.', old.statut, new.statut;
  end if;

  if new.statut = 'vue' and new.vue_le is null then
    new.vue_le := now();
  elsif new.statut = 'livree' and new.livree_le is null then
    new.livree_le := now();
  elsif new.statut = 'cloturee' and new.cloturee_le is null then
    new.cloturee_le := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_commandes_transition on public.commandes;
create trigger trg_commandes_transition
  before update of statut on public.commandes
  for each row execute function public.controler_transition_commande();

-- Les montants d'une commande ne se retouchent pas apres l'envoi : seule la
-- fonction serveur qui la cree les ecrit (recette F7).
create or replace function public.figer_montants_commande()
returns trigger
language plpgsql
-- SECURITY INVOKER volontaire (cf. est_appel_systeme).
set search_path = public
as $$
begin
  if public.est_appel_systeme() or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  new.numero             := old.numero;
  new.acheteur_id        := old.acheteur_id;
  new.fournisseur_id     := old.fournisseur_id;
  new.montant_produits   := old.montant_produits;
  new.montant_livraison  := old.montant_livraison;
  new.montant_total      := old.montant_total;
  new.montant_commission := old.montant_commission;
  return new;
end;
$$;

drop trigger if exists trg_commandes_figer_montants on public.commandes;
create trigger trg_commandes_figer_montants
  before update on public.commandes
  for each row execute function public.figer_montants_commande();
