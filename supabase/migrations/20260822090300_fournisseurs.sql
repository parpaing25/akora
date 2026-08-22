-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 04. Fournisseurs, dossier de verification, vehicules et zones
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.fournisseurs (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null references auth.users(id) on delete restrict,
  raison_sociale           text not null,
  slug                     text not null unique,
  description              text,
  logo_url                 text,
  couverture_url           text,
  telephone                text,
  whatsapp                 text,
  email                    text,
  nif                      text,
  stat                     text,
  rcs                      text,
  adresse                  text,
  localite_id              uuid references public.localites(id) on delete set null,
  lat                      double precision,
  lng                      double precision,
  horaires                 jsonb not null default '{}'::jsonb,
  rayon_max_km             numeric(6,1) not null default 40,
  coef_sinuosite           numeric(4,2),
  assujetti_tva            boolean not null default false,
  statut                   public.statut_fournisseur not null default 'brouillon',
  niveau_verification      public.niveau_verification not null default 'non_verifie',
  verifie_le               timestamptz,
  note_moyenne             numeric(3,2),
  nb_avis                  integer not null default 0,
  nb_commandes_cloturees   integer not null default 0,
  modes_paiement_acceptes  public.mode_paiement[] not null default '{a_la_livraison}',
  taux_acompte             integer not null default 30,
  operateur_versement      public.operateur_paiement,
  msisdn_versement         text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint fournisseurs_coordonnees_completes check ((lat is null) = (lng is null)),
  constraint fournisseurs_lat_plausible check (lat is null or (lat between -26.0 and -11.0)),
  constraint fournisseurs_lng_plausible check (lng is null or (lng between 42.0 and 51.5)),
  constraint fournisseurs_rayon_plausible check (rayon_max_km > 0 and rayon_max_km <= 1200),
  constraint fournisseurs_sinuosite_plausible
    check (coef_sinuosite is null or (coef_sinuosite >= 1.0 and coef_sinuosite <= 3.0)),
  constraint fournisseurs_acompte_borne check (taux_acompte between 10 and 100),
  constraint fournisseurs_note_bornee check (note_moyenne is null or (note_moyenne between 1 and 5)),
  constraint fournisseurs_telephone_valide
    check (telephone is null or telephone ~ '^\+2613[2-9][0-9]{7}$'),
  constraint fournisseurs_whatsapp_valide
    check (whatsapp is null or whatsapp ~ '^\+2613[2-9][0-9]{7}$'),
  constraint fournisseurs_msisdn_valide
    check (msisdn_versement is null or msisdn_versement ~ '^\+2613[2-9][0-9]{7}$')
);
create index if not exists idx_fournisseurs_owner on public.fournisseurs(owner_id);
create index if not exists idx_fournisseurs_statut on public.fournisseurs(statut, niveau_verification);
create index if not exists idx_fournisseurs_localite on public.fournisseurs(localite_id);
create index if not exists idx_fournisseurs_nom_trgm
  on public.fournisseurs using gin (raison_sociale extensions.gin_trgm_ops);

drop trigger if exists trg_fournisseurs_updated on public.fournisseurs;
create trigger trg_fournisseurs_updated before update on public.fournisseurs
  for each row execute function public.toucher_updated_at();

alter table public.fournisseurs enable row level security;

-- La table porte des donnees personnelles (telephone, e-mail, adresse exacte).
-- Elle n'est donc JAMAIS lisible par anon : le public passe par la vue
-- `fournisseurs_publics`. On retire aussi le droit au niveau des GRANT, pour
-- qu'un select('*') echoue avant meme d'atteindre la RLS.
revoke all on public.fournisseurs from anon;

-- ── Qui agit au nom d'un fournisseur ──────────────────────────────────────
create table if not exists public.fournisseur_membres (
  id             uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  role_interne   public.role_interne not null default 'gestionnaire',
  created_at     timestamptz not null default now(),
  unique (fournisseur_id, user_id)
);
create index if not exists idx_membres_user on public.fournisseur_membres(user_id);

alter table public.fournisseur_membres enable row level security;
revoke all on public.fournisseur_membres from anon;

create or replace function public.est_membre_fournisseur(_fournisseur_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.fournisseurs f
     where f.id = _fournisseur_id and f.owner_id = auth.uid()
  ) or exists (
    select 1 from public.fournisseur_membres m
     where m.fournisseur_id = _fournisseur_id and m.user_id = auth.uid()
  );
$$;

comment on function public.est_membre_fournisseur is
  'Le demandeur agit-il au nom de ce fournisseur ? SECURITY DEFINER pour eviter la recursion RLS entre fournisseurs et fournisseur_membres.';

drop policy if exists "membres lisibles par l equipe ou un admin" on public.fournisseur_membres;
create policy "membres lisibles par l equipe ou un admin" on public.fournisseur_membres
  for select to authenticated
  using (user_id = auth.uid() or public.est_membre_fournisseur(fournisseur_id)
         or public.has_role(auth.uid(), 'admin'));

drop policy if exists "membres geres par le proprietaire" on public.fournisseur_membres;
create policy "membres geres par le proprietaire" on public.fournisseur_membres
  for all to authenticated
  using (exists (select 1 from public.fournisseurs f
                  where f.id = fournisseur_id and f.owner_id = auth.uid())
         or public.has_role(auth.uid(), 'admin'))
  with check (exists (select 1 from public.fournisseurs f
                       where f.id = fournisseur_id and f.owner_id = auth.uid())
              or public.has_role(auth.uid(), 'admin'));

-- ── Politiques sur fournisseurs ───────────────────────────────────────────
drop policy if exists "fiche lisible par son equipe ou un admin" on public.fournisseurs;
create policy "fiche lisible par son equipe ou un admin" on public.fournisseurs
  for select to authenticated
  using (owner_id = auth.uid() or public.est_membre_fournisseur(id)
         or public.has_role(auth.uid(), 'admin'));

drop policy if exists "fiche creee par son proprietaire" on public.fournisseurs;
create policy "fiche creee par son proprietaire" on public.fournisseurs
  for insert to authenticated
  with check (owner_id = auth.uid() and public.has_role(auth.uid(), 'fournisseur'));

drop policy if exists "fiche modifiee par son equipe ou un admin" on public.fournisseurs;
create policy "fiche modifiee par son equipe ou un admin" on public.fournisseurs
  for update to authenticated
  using (owner_id = auth.uid() or public.est_membre_fournisseur(id)
         or public.has_role(auth.uid(), 'admin'))
  with check (owner_id = auth.uid() or public.est_membre_fournisseur(id)
              or public.has_role(auth.uid(), 'admin'));

drop policy if exists "fiche supprimee par un admin" on public.fournisseurs;
create policy "fiche supprimee par un admin" on public.fournisseurs
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ── Colonnes qu'un fournisseur ne peut pas s'attribuer lui-meme ───────────
-- La RLS de Postgres autorise ou refuse une LIGNE, pas une COLONNE. Le
-- verrou colonne par colonne se pose donc ici. Sans ce trigger, un fournisseur
-- se declarerait « verifie » et encaisserait des paiements en ligne (F9).
--
-- Les fonctions internes (badge Partenaire, cloture de commande, arbitrage)
-- posent `akora.systeme = on` le temps de leur transaction pour passer.
create or replace function public.est_appel_systeme()
returns boolean
language sql
stable
as $$
  -- Deux conditions, pas une : le drapeau doit etre pose ET l'appel doit venir
  -- d'un role interne. Les triggers de protection sont volontairement en
  -- SECURITY INVOKER, donc `current_user` vaut 'authenticated' quand la
  -- requete vient du navigateur, et 'postgres' quand elle vient d'une
  -- fonction interne. Un client ne peut donc pas se faire passer pour le
  -- systeme, meme s'il trouvait un moyen de poser le drapeau.
  select coalesce(current_setting('akora.systeme', true), 'off') = 'on'
     and current_user in ('postgres', 'supabase_admin', 'service_role');
$$;

create or replace function public.proteger_colonnes_fournisseur()
returns trigger
language plpgsql
-- SECURITY INVOKER volontaire : c'est ce qui permet a est_appel_systeme() de
-- distinguer une requete du navigateur d'un appel interne.
set search_path = public
as $$
begin
  if public.est_appel_systeme() or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  new.owner_id               := old.owner_id;
  new.statut                 := old.statut;
  new.niveau_verification    := old.niveau_verification;
  new.verifie_le             := old.verifie_le;
  new.note_moyenne           := old.note_moyenne;
  new.nb_avis                := old.nb_avis;
  new.nb_commandes_cloturees := old.nb_commandes_cloturees;
  return new;
end;
$$;

drop trigger if exists trg_fournisseurs_colonnes_protegees on public.fournisseurs;
create trigger trg_fournisseurs_colonnes_protegees
  before update on public.fournisseurs
  for each row execute function public.proteger_colonnes_fournisseur();

-- ── documents_fournisseur : les pieces du dossier de verification ─────────
-- `chemin_bucket` designe un objet du bucket PRIVE `kyc`. Ni le chemin ni le
-- fichier ne sortent d'ici : la consultation passe par une URL signee de 60 s
-- generee cote serveur pour un admin, et chaque ouverture est journalisee.
create table if not exists public.documents_fournisseur (
  id             uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  type           public.type_document not null,
  numero         text,
  chemin_bucket  text,
  statut         public.statut_document not null default 'en_attente',
  motif_refus    text,
  expire_le      date,
  valide_par     uuid references auth.users(id) on delete set null,
  valide_le      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (fournisseur_id, type),
  constraint documents_refus_motive
    check (statut <> 'refuse' or (motif_refus is not null and length(btrim(motif_refus)) > 0))
);
create index if not exists idx_documents_fournisseur on public.documents_fournisseur(fournisseur_id, statut);

drop trigger if exists trg_documents_updated on public.documents_fournisseur;
create trigger trg_documents_updated before update on public.documents_fournisseur
  for each row execute function public.toucher_updated_at();

alter table public.documents_fournisseur enable row level security;
revoke all on public.documents_fournisseur from anon;

drop policy if exists "pieces lisibles par leur fournisseur ou un admin" on public.documents_fournisseur;
create policy "pieces lisibles par leur fournisseur ou un admin" on public.documents_fournisseur
  for select to authenticated
  using (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "pieces deposees par leur fournisseur" on public.documents_fournisseur;
create policy "pieces deposees par leur fournisseur" on public.documents_fournisseur
  for insert to authenticated with check (public.est_membre_fournisseur(fournisseur_id));

drop policy if exists "pieces mises a jour par leur fournisseur ou un admin" on public.documents_fournisseur;
create policy "pieces mises a jour par leur fournisseur ou un admin" on public.documents_fournisseur
  for update to authenticated
  using (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'))
  with check (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "pieces supprimees par leur fournisseur" on public.documents_fournisseur;
create policy "pieces supprimees par leur fournisseur" on public.documents_fournisseur
  for delete to authenticated
  using (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'));

-- Un fournisseur depose et remplace ses pieces, mais ne les valide pas :
-- sans ce verrou, il passerait « verifie » tout seul en une requete.
create or replace function public.proteger_colonnes_document()
returns trigger
language plpgsql
-- SECURITY INVOKER volontaire : c'est ce qui permet a est_appel_systeme() de
-- distinguer une requete du navigateur d'un appel interne.
set search_path = public
as $$
begin
  if public.est_appel_systeme() or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  new.statut      := 'en_attente';
  new.motif_refus := null;
  new.valide_par  := null;
  new.valide_le   := null;
  return new;
end;
$$;

drop trigger if exists trg_documents_colonnes_protegees on public.documents_fournisseur;
create trigger trg_documents_colonnes_protegees
  before insert or update on public.documents_fournisseur
  for each row execute function public.proteger_colonnes_document();

-- ── vehicules_livraison : la flotte declaree, base du calcul de transport ─
create table if not exists public.vehicules_livraison (
  id                      uuid primary key default gen_random_uuid(),
  fournisseur_id          uuid not null references public.fournisseurs(id) on delete cascade,
  nom                     text not null,
  capacite_m3             numeric(8,2) not null,
  capacite_kg             numeric(10,1) not null,
  prix_par_km             bigint not null default 0,
  forfait_base            bigint not null default 0,
  km_inclus               numeric(6,1) not null default 0,
  prix_minimum            bigint not null default 0,
  facturer_aller_retour   boolean not null default false,
  actif                   boolean not null default true,
  ordre                   integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint vehicules_capacite_positive check (capacite_m3 > 0 and capacite_kg > 0),
  constraint vehicules_montants_positifs
    check (prix_par_km >= 0 and forfait_base >= 0 and prix_minimum >= 0 and km_inclus >= 0)
);
create index if not exists idx_vehicules_fournisseur
  on public.vehicules_livraison(fournisseur_id, ordre) where actif;

drop trigger if exists trg_vehicules_updated on public.vehicules_livraison;
create trigger trg_vehicules_updated before update on public.vehicules_livraison
  for each row execute function public.toucher_updated_at();

alter table public.vehicules_livraison enable row level security;

-- Le bareme de transport est PUBLIC : le simulateur doit pouvoir calculer
-- avant toute connexion. Il ne contient aucune donnee personnelle.
drop policy if exists "vehicules lisibles par tous" on public.vehicules_livraison;
create policy "vehicules lisibles par tous" on public.vehicules_livraison
  for select to anon, authenticated using (actif);

drop policy if exists "vehicules geres par leur fournisseur" on public.vehicules_livraison;
create policy "vehicules geres par leur fournisseur" on public.vehicules_livraison
  for all to authenticated
  using (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'))
  with check (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'));

-- ── zones_livraison : franco de port et majorations ───────────────────────
create table if not exists public.zones_livraison (
  id               uuid primary key default gen_random_uuid(),
  fournisseur_id   uuid not null references public.fournisseurs(id) on delete cascade,
  nom              text not null,
  rayon_km         numeric(6,1) not null,
  seuil_franco     bigint,
  rayon_franco_km  numeric(6,1),
  majoration_pct   numeric(5,2) not null default 0,
  actif            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint zones_rayon_positif check (rayon_km > 0),
  constraint zones_franco_coherent
    check ((seuil_franco is null and rayon_franco_km is null)
        or (seuil_franco > 0 and rayon_franco_km > 0)),
  constraint zones_majoration_bornee check (majoration_pct >= -50 and majoration_pct <= 200)
);
create index if not exists idx_zones_fournisseur
  on public.zones_livraison(fournisseur_id, rayon_km) where actif;

drop trigger if exists trg_zones_updated on public.zones_livraison;
create trigger trg_zones_updated before update on public.zones_livraison
  for each row execute function public.toucher_updated_at();

alter table public.zones_livraison enable row level security;

drop policy if exists "zones lisibles par tous" on public.zones_livraison;
create policy "zones lisibles par tous" on public.zones_livraison
  for select to anon, authenticated using (actif);

drop policy if exists "zones gerees par leur fournisseur" on public.zones_livraison;
create policy "zones gerees par leur fournisseur" on public.zones_livraison
  for all to authenticated
  using (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'))
  with check (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'));

-- ── demandes_materiau : la seule porte d'entree du referentiel ────────────
-- Un fournisseur qui ne trouve pas son materiau ne le cree pas : il le demande.
-- L'admin accepte (et cree alors le materiaux_ref) ou refuse avec un motif,
-- typiquement « hors perimetre gros oeuvre ».
create table if not exists public.demandes_materiau (
  id                   uuid primary key default gen_random_uuid(),
  fournisseur_id       uuid not null references public.fournisseurs(id) on delete cascade,
  nom_propose          text not null,
  categorie_id         uuid not null references public.categories(id) on delete restrict,
  unite                public.unite not null,
  poids_kg_unite       numeric(10,3) not null,
  volume_m3_unite      numeric(10,5) not null,
  photo_url            text,
  description          text,
  statut               public.statut_demande_materiau not null default 'en_attente',
  motif_refus          text,
  materiau_ref_cree_id uuid references public.materiaux_ref(id) on delete set null,
  nb_demandeurs        integer not null default 1,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint demandes_poids_positif  check (poids_kg_unite > 0),
  constraint demandes_volume_positif check (volume_m3_unite > 0),
  constraint demandes_refus_motive
    check (statut <> 'refusee' or (motif_refus is not null and length(btrim(motif_refus)) > 0)),
  constraint demandes_acceptation_liee
    check (statut <> 'acceptee' or materiau_ref_cree_id is not null)
);
create index if not exists idx_demandes_statut on public.demandes_materiau(statut, nb_demandeurs desc, created_at);
create index if not exists idx_demandes_fournisseur on public.demandes_materiau(fournisseur_id);

drop trigger if exists trg_demandes_updated on public.demandes_materiau;
create trigger trg_demandes_updated before update on public.demandes_materiau
  for each row execute function public.toucher_updated_at();

alter table public.demandes_materiau enable row level security;
revoke all on public.demandes_materiau from anon;

drop policy if exists "demandes lisibles par leur auteur ou un admin" on public.demandes_materiau;
create policy "demandes lisibles par leur auteur ou un admin" on public.demandes_materiau
  for select to authenticated
  using (public.est_membre_fournisseur(fournisseur_id) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "demandes creees par un fournisseur" on public.demandes_materiau;
create policy "demandes creees par un fournisseur" on public.demandes_materiau
  for insert to authenticated with check (public.est_membre_fournisseur(fournisseur_id));

drop policy if exists "demandes arbitrees par un admin" on public.demandes_materiau;
create policy "demandes arbitrees par un admin" on public.demandes_materiau
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ── Bucket PRIVE `kyc` ────────────────────────────────────────────────────
-- Motif, en clair : sur un projet precedent, des cartes d'identite se sont
-- retrouvees dans un dossier `uploads` public. Ici, aucune politique de
-- lecture n'est accordee a anon ni a authenticated. Les scans ne sortent que
-- par une URL signee de 60 s produite cote serveur pour un administrateur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc', 'kyc', false, 8388608,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Un fournisseur depose ses pieces dans SON dossier, et peut les remplacer.
-- Il ne peut pas les relire en clair : seul un admin y accede, par lien signe.
drop policy if exists "kyc depot par le fournisseur" on storage.objects;
create policy "kyc depot par le fournisseur" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc remplacement par le fournisseur" on storage.objects;
create policy "kyc remplacement par le fournisseur" on storage.objects
  for update to authenticated
  using (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kyc lecture par un admin" on storage.objects;
create policy "kyc lecture par un admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'kyc' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "kyc suppression par un admin" on storage.objects;
create policy "kyc suppression par un admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'kyc' and public.has_role(auth.uid(), 'admin'));
