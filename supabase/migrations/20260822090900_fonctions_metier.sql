-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 10. Fonctions metier
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Reveler le telephone d'un fournisseur ─────────────────────────────────
-- Reserve aux utilisateurs connectes, plafonne, et JOURNALISE. C'est la seule
-- porte de sortie des coordonnees : sans elle, l'annuaire entier s'aspire en
-- une requete.
create or replace function public.reveler_contact_fournisseur(_fournisseur_id uuid)
returns table (telephone text, whatsapp text)
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour voir les coordonnees du fournisseur.';
  end if;

  if not public.consommer_quota('reveler_contact', auth.uid()::text, 60) then
    raise exception 'Trop de consultations de coordonnees cette heure-ci. Reessayez plus tard.';
  end if;

  select f2.telephone, f2.whatsapp, f2.statut
    into f
    from public.fournisseurs f2
   where f2.id = _fournisseur_id;

  if not found or f.statut <> 'actif' then
    raise exception 'Fournisseur introuvable.';
  end if;

  perform public.journaliser('reveler_contact', 'fournisseurs', _fournisseur_id::text);

  telephone := f.telephone;
  whatsapp := f.whatsapp;
  return next;
end;
$$;

-- ── Niveau de verification, recalcule a partir des pieces ─────────────────
create or replace function public.recalculer_niveau_verification(_fournisseur_id uuid)
returns public.niveau_verification
language plpgsql
security definer
set search_path = public
as $$
declare
  obligatoires public.type_document[] :=
    array['nif','stat','rcs','cin_gerant','photo_depot','numero_versement']::public.type_document[];
  nb_valides integer;
  nb_deposees integer;
  actuel public.niveau_verification;
  nouveau public.niveau_verification;
begin
  select niveau_verification into actuel from public.fournisseurs where id = _fournisseur_id;
  if actuel is null then
    raise exception 'Fournisseur introuvable.';
  end if;

  select count(*) filter (where statut = 'valide'),
         count(*)
    into nb_valides, nb_deposees
    from public.documents_fournisseur
   where fournisseur_id = _fournisseur_id
     and type = any(obligatoires);

  if nb_valides = array_length(obligatoires, 1) then
    -- On ne retrograde jamais un partenaire par ce chemin : le badge or a ses
    -- propres regles, et seul un admin le revoque.
    nouveau := case when actuel = 'partenaire' then 'partenaire' else 'verifie' end;
  elsif nb_deposees > 0 then
    nouveau := 'en_cours';
  else
    nouveau := 'non_verifie';
  end if;

  perform set_config('akora.systeme', 'on', true);
  update public.fournisseurs
     set niveau_verification = nouveau,
         verifie_le = case
           when nouveau in ('verifie','partenaire') and verifie_le is null then now()
           when nouveau in ('non_verifie','en_cours') then null
           else verifie_le end
   where id = _fournisseur_id;
  perform set_config('akora.systeme', 'off', true);

  return nouveau;
end;
$$;

-- ── Valider ou refuser une piece (admin) ──────────────────────────────────
create or replace function public.statuer_document(
  _document_id uuid, _statut public.statut_document, _motif text default null)
returns public.niveau_verification
language plpgsql
security definer
set search_path = public
as $$
declare
  doc record;
  niveau public.niveau_verification;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Reserve aux administrateurs.';
  end if;
  if _statut = 'refuse' and coalesce(btrim(_motif), '') = '' then
    raise exception 'Un refus doit etre motive, en clair, pour que le fournisseur sache quoi corriger.';
  end if;

  select * into doc from public.documents_fournisseur where id = _document_id;
  if not found then
    raise exception 'Piece introuvable.';
  end if;

  perform set_config('akora.systeme', 'on', true);
  update public.documents_fournisseur
     set statut = _statut,
         motif_refus = case when _statut = 'refuse' then _motif else null end,
         valide_par = auth.uid(),
         valide_le = now()
   where id = _document_id;
  perform set_config('akora.systeme', 'off', true);

  perform public.journaliser(
    'statuer_document', 'documents_fournisseur', _document_id::text,
    jsonb_build_object('statut', doc.statut),
    jsonb_build_object('statut', _statut, 'motif', _motif));

  niveau := public.recalculer_niveau_verification(doc.fournisseur_id);

  perform public.notifier(
    (select owner_id from public.fournisseurs where id = doc.fournisseur_id),
    case when _statut = 'valide' then 'Piece validee' else 'Piece refusee' end,
    case when _statut = 'valide'
         then 'Votre piece a ete acceptee.'
         else 'Motif du refus : ' || coalesce(_motif, '') end,
    '/pro/verification', 'verification');

  return niveau;
end;
$$;

-- ── Badge « Partenaire Akora », attribue automatiquement ──────────────────
-- verifie + 10 commandes cloturees + note >= 4,2 + aucun litige perdu sur
-- 6 mois. Recalcule chaque nuit ; un admin peut toujours revoquer a la main.
create or replace function public.attribuer_badges_partenaire()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  commandes_min integer;
  note_min numeric;
  promus integer := 0;
  retrogrades integer := 0;
begin
  select coalesce((valeur)::text::integer, 10) into commandes_min
    from public.parametres where cle = 'partenaire_commandes_min';
  select coalesce((valeur)::text::numeric, 4.2) into note_min
    from public.parametres where cle = 'partenaire_note_min';

  perform set_config('akora.systeme', 'on', true);

  with eligibles as (
    select f.id
      from public.fournisseurs f
     where f.statut = 'actif'
       and f.niveau_verification in ('verifie', 'partenaire')
       and f.nb_commandes_cloturees >= commandes_min
       and coalesce(f.note_moyenne, 0) >= note_min
       and not exists (
         select 1
           from public.litiges l
           join public.commandes c on c.id = l.commande_id
          where c.fournisseur_id = f.id
            and l.statut = 'tranche'
            and coalesce(l.montant_rembourse, 0) > 0
            and l.updated_at > now() - interval '6 months')
  )
  update public.fournisseurs f
     set niveau_verification = 'partenaire'
    from eligibles e
   where f.id = e.id and f.niveau_verification = 'verifie';
  get diagnostics promus = row_count;

  -- Un partenaire qui ne remplit plus les conditions redevient « verifie ».
  with sortants as (
    select f.id
      from public.fournisseurs f
     where f.niveau_verification = 'partenaire'
       and (f.nb_commandes_cloturees < commandes_min
            or coalesce(f.note_moyenne, 0) < note_min
            or exists (
              select 1
                from public.litiges l
                join public.commandes c on c.id = l.commande_id
               where c.fournisseur_id = f.id
                 and l.statut = 'tranche'
                 and coalesce(l.montant_rembourse, 0) > 0
                 and l.updated_at > now() - interval '6 months'))
  )
  update public.fournisseurs f
     set niveau_verification = 'verifie'
    from sortants s
   where f.id = s.id;
  get diagnostics retrogrades = row_count;

  perform set_config('akora.systeme', 'off', true);
  return promus + retrogrades;
end;
$$;

-- ── Accepter une demande de materiau ──────────────────────────────────────
-- L'admin cree la reference, la lie a la demande, et les produits en attente
-- se rattachent automatiquement puis deviennent publiables (spec B4).
create or replace function public.accepter_demande_materiau(
  _demande_id uuid,
  _nom_normalise text,
  _slug text,
  _categorie_id uuid,
  _unite public.unite,
  _poids_kg numeric,
  _volume_m3 numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  demande record;
  ref_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Reserve aux administrateurs.';
  end if;

  select * into demande from public.demandes_materiau where id = _demande_id;
  if not found then raise exception 'Demande introuvable.'; end if;
  if demande.statut <> 'en_attente' then
    raise exception 'Cette demande a deja ete traitee.';
  end if;

  insert into public.materiaux_ref
    (categorie_id, nom, slug, unite_defaut, poids_kg_unite_defaut, volume_m3_unite_defaut)
  values (_categorie_id, _nom_normalise, _slug, _unite, _poids_kg, _volume_m3)
  returning id into ref_id;

  update public.demandes_materiau
     set statut = 'acceptee', materiau_ref_cree_id = ref_id, motif_refus = null
   where id = _demande_id;

  -- Rattachement des produits qui attendaient cette reference. Ils passent en
  -- « brouillon » : c'est au fournisseur de publier, pas a l'admin.
  update public.produits
     set materiau_ref_id = ref_id, statut = 'brouillon'
   where demande_materiau_id = _demande_id and statut = 'en_attente_materiau';

  perform public.journaliser('accepter_demande_materiau', 'demandes_materiau', _demande_id::text,
                             null, jsonb_build_object('materiau_ref_id', ref_id));

  perform public.notifier(
    (select owner_id from public.fournisseurs where id = demande.fournisseur_id),
    'Materiau ajoute au referentiel',
    demande.nom_propose || ' est desormais disponible sous le nom ' || _nom_normalise || '. Votre produit peut etre publie.',
    '/pro/catalogue', 'catalogue');

  return ref_id;
end;
$$;

create or replace function public.refuser_demande_materiau(_demande_id uuid, _motif text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  demande record;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Reserve aux administrateurs.';
  end if;
  if coalesce(btrim(_motif), '') = '' then
    raise exception 'Un refus doit etre motive.';
  end if;

  select * into demande from public.demandes_materiau where id = _demande_id;
  if not found then raise exception 'Demande introuvable.'; end if;

  update public.demandes_materiau
     set statut = 'refusee', motif_refus = _motif
   where id = _demande_id;

  perform public.journaliser('refuser_demande_materiau', 'demandes_materiau', _demande_id::text,
                             null, jsonb_build_object('motif', _motif));

  perform public.notifier(
    (select owner_id from public.fournisseurs where id = demande.fournisseur_id),
    'Demande de materiau refusee',
    'Motif : ' || _motif,
    '/pro/catalogue', 'catalogue');
end;
$$;

-- ── Sequestre : liberation, commission, portefeuille ──────────────────────
-- Appelee soit par la confirmation de l'acheteur, soit par la tache qui
-- libere apres 72 h sans contestation. Idempotente : un paiement deja libere
-- ne credite pas deux fois.
create or replace function public.liberer_sequestre(_paiement_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  c record;
  taux numeric;
  commission bigint;
  net bigint;
begin
  select * into p from public.paiements where id = _paiement_id for update;
  if not found then raise exception 'Paiement introuvable.'; end if;
  if p.statut <> 'sequestre' then
    raise exception 'Seul un paiement sous sequestre peut etre libere (statut actuel : %).', p.statut;
  end if;

  select * into c from public.commandes where id = p.commande_id;
  if exists (select 1 from public.litiges l
              where l.commande_id = c.id and l.statut <> 'tranche') then
    raise exception 'Un litige est ouvert sur cette commande : la liberation est suspendue.';
  end if;

  -- Commission : un pourcentage du montant PRODUITS. Zero sur la livraison,
  -- qui n'est pas une marge mais un cout reel du fournisseur (spec B10).
  taux := public.taux_commission(
    (select categorie_id from public.produits pr
      join public.lignes_commande lc on lc.produit_id = pr.id
     where lc.commande_id = c.id limit 1));
  commission := floor(c.montant_produits * taux / 100.0)::bigint;
  net := p.montant - commission;
  if net < 0 then
    commission := p.montant;
    net := 0;
  end if;

  perform set_config('akora.systeme', 'on', true);

  update public.paiements set statut = 'libere' where id = p.id;

  -- Deux ecritures, pas une : le brut credite, la commission debite. Le
  -- solde final est identique, mais chaque mouvement existe reellement et le
  -- portefeuille reste reconstituable ligne a ligne (recette F10).
  perform public.ecrire_ledger(
    c.fournisseur_id, 'liberation', p.montant,
    'Liberation du sequestre, commande ' || c.numero, c.id, p.id);

  if commission > 0 then
    perform public.ecrire_ledger(
      c.fournisseur_id, 'commission', -commission,
      'Commission Akora de ' || taux || ' %, commande ' || c.numero,
      c.id, p.id);
  end if;

  update public.portefeuilles
     set solde_sequestre = greatest(0, solde_sequestre - p.montant), maj_le = now()
   where fournisseur_id = c.fournisseur_id;

  update public.commandes
     set montant_commission = commission
   where id = c.id;

  perform set_config('akora.systeme', 'off', true);

  perform public.journaliser('liberer_sequestre', 'paiements', p.id::text,
                             jsonb_build_object('statut', 'sequestre'),
                             jsonb_build_object('statut', 'libere', 'net', net, 'commission', commission));
  return net;
end;
$$;

comment on function public.liberer_sequestre is
  'Idempotente : seul un paiement au statut sequestre est traite. La commission porte sur le montant PRODUITS, jamais sur la livraison.';

-- ── Confirmation de livraison par l'acheteur ──────────────────────────────
create or replace function public.confirmer_livraison(_commande_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  p record;
begin
  select * into c from public.commandes where id = _commande_id;
  if not found then raise exception 'Commande introuvable.'; end if;
  if c.acheteur_id is distinct from auth.uid() then
    raise exception 'Seul l''acheteur confirme la reception de sa commande.';
  end if;
  if c.statut <> 'livree' then
    raise exception 'La commande doit etre marquee livree par le fournisseur avant confirmation.';
  end if;

  perform set_config('akora.systeme', 'on', true);
  update public.commandes
     set statut = 'cloturee', confirmee_le = now()
   where id = _commande_id;
  update public.fournisseurs
     set nb_commandes_cloturees = nb_commandes_cloturees + 1
   where id = c.fournisseur_id;
  perform set_config('akora.systeme', 'off', true);

  for p in select id from public.paiements
            where commande_id = _commande_id and statut = 'sequestre'
  loop
    perform public.liberer_sequestre(p.id);
  end loop;

  perform public.journaliser('confirmer_livraison', 'commandes', _commande_id::text);
  perform public.notifier(
    (select owner_id from public.fournisseurs where id = c.fournisseur_id),
    'Livraison confirmee',
    'La commande ' || c.numero || ' est cloturee. Votre portefeuille a ete credite.',
    '/pro/portefeuille', 'paiement');
end;
$$;

-- ── Verification du ledger : le solde doit etre reconstituable ────────────
-- Utilisee par le test automatise de la recette (F10) et par l'ecran admin.
create or replace function public.verifier_solde_ledger()
returns table (fournisseur_id uuid, solde_portefeuille bigint, solde_ledger bigint, ecart bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    pf.fournisseur_id,
    pf.solde_disponible,
    coalesce(sum(l.montant), 0)::bigint,
    (pf.solde_disponible - coalesce(sum(l.montant), 0))::bigint
  from public.portefeuilles pf
  left join public.ledger l on l.fournisseur_id = pf.fournisseur_id
  group by pf.fournisseur_id, pf.solde_disponible
  having pf.solde_disponible <> coalesce(sum(l.montant), 0);
$$;

comment on function public.verifier_solde_ledger is
  'Renvoie les portefeuilles dont le solde ne correspond PAS a la somme de leur ledger. Un resultat vide est la seule reponse acceptable.';
