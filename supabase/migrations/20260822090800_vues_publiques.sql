-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 09. Vues publiques
-- ═══════════════════════════════════════════════════════════════════════════
-- Ces vues sont la SEULE lecture publique du site. Les tables sous-jacentes
-- ne sont pas lisibles par anon : un select('*') sur `fournisseurs` echoue au
-- niveau des GRANT, avant meme la RLS.
--
-- Elles sont volontairement en SECURITY DEFINER (le defaut) : c'est ce qui
-- permet d'exposer une PROJECTION sure sans ouvrir la table. La contrepartie
-- est que la liste des colonnes ci-dessous est le perimetre public exact —
-- toute colonne ajoutee ici devient publique, y compris pour un robot.

drop view if exists public.fournisseurs_publics cascade;
create view public.fournisseurs_publics
with (security_invoker = false) as
select
  f.id,
  f.slug,
  f.raison_sociale,
  f.description,
  f.logo_url,
  f.couverture_url,
  -- NIF, STAT et RCS sont des identifiants d'entreprise : ils figurent deja
  -- sur les factures. Les SCANS, eux, ne sortent jamais du bucket prive.
  f.nif,
  f.stat,
  f.rcs,
  f.localite_id,
  -- Coordonnees du depot : indispensables au calcul de distance (B6 etape 2),
  -- et publiques par nature puisqu'il s'agit d'un lieu de vente.
  f.lat,
  f.lng,
  f.horaires,
  f.rayon_max_km,
  f.coef_sinuosite,
  f.assujetti_tva,
  f.niveau_verification,
  f.verifie_le,
  f.note_moyenne,
  f.nb_avis,
  f.nb_commandes_cloturees,
  f.modes_paiement_acceptes,
  f.taux_acompte,
  f.created_at
from public.fournisseurs f
where f.statut = 'actif';

comment on view public.fournisseurs_publics is
  'Projection publique des fournisseurs actifs. Ni telephone, ni e-mail, ni adresse exacte, ni numero de versement.';

drop view if exists public.produits_publics cascade;
create view public.produits_publics
with (security_invoker = false) as
select
  p.id,
  p.slug,
  p.nom_affiche,
  p.description,
  p.unite,
  p.prix_unitaire,
  p.prix_promo,
  p.prix_maj_le,
  p.tva_taux,
  p.quantite_min,
  p.poids_kg_unite,
  p.volume_m3_unite,
  p.stock_statut,
  p.delai_preparation_jours,
  p.photos,
  p.caracteristiques,
  p.materiau_ref_id,
  p.categorie_id,
  p.created_at,
  f.id   as fournisseur_id,
  f.slug as fournisseur_slug,
  f.raison_sociale as fournisseur_nom,
  f.niveau_verification as fournisseur_niveau,
  f.verifie_le as fournisseur_verifie_le,
  f.note_moyenne as fournisseur_note,
  f.nb_avis as fournisseur_nb_avis,
  f.localite_id as fournisseur_localite_id,
  f.lat as fournisseur_lat,
  f.lng as fournisseur_lng,
  f.rayon_max_km as fournisseur_rayon_max_km,
  f.coef_sinuosite as fournisseur_coef_sinuosite,
  f.assujetti_tva as fournisseur_assujetti_tva,
  f.modes_paiement_acceptes as fournisseur_modes_paiement,
  m.slug as materiau_slug,
  m.nom  as materiau_nom,
  c.slug as categorie_slug,
  c.nom  as categorie_nom
from public.produits p
join public.fournisseurs f on f.id = p.fournisseur_id
join public.categories c on c.id = p.categorie_id
left join public.materiaux_ref m on m.id = p.materiau_ref_id
where p.statut = 'actif' and f.statut = 'actif';

comment on view public.produits_publics is
  'Produits publies de fournisseurs actifs. Un produit en attente de reference n''y figure jamais.';

-- ── prix_marche : mediane, min, max et nombre d'offres ────────────────────
-- Publiee UNIQUEMENT a partir de 3 offres actives. En dessous, un « prix du
-- marche » calcule sur une ou deux annonces n'est pas une statistique, c'est
-- la vitrine d'un fournisseur deguisee en reference.
drop view if exists public.prix_marche cascade;
create view public.prix_marche
with (security_invoker = false) as
select
  p.materiau_ref_id,
  f.localite_id,
  count(*)::integer                                                   as nb_offres,
  min(coalesce(p.prix_promo, p.prix_unitaire))::bigint                as prix_min,
  max(coalesce(p.prix_promo, p.prix_unitaire))::bigint                as prix_max,
  (percentile_cont(0.5) within group (
      order by coalesce(p.prix_promo, p.prix_unitaire)))::bigint      as prix_median,
  max(p.prix_maj_le)                                                  as dernier_releve
from public.produits p
join public.fournisseurs f on f.id = p.fournisseur_id
where p.statut = 'actif'
  and f.statut = 'actif'
  and p.materiau_ref_id is not null
  and f.localite_id is not null
group by p.materiau_ref_id, f.localite_id
having count(*) >= 3;

comment on view public.prix_marche is
  'Statistiques de prix par materiau et par localite, publiees a partir de 3 offres actives.';

-- ── Droits de lecture ─────────────────────────────────────────────────────
revoke all on public.fournisseurs_publics from public;
revoke all on public.produits_publics from public;
revoke all on public.prix_marche from public;
grant select on public.fournisseurs_publics to anon, authenticated;
grant select on public.produits_publics to anon, authenticated;
grant select on public.prix_marche to anon, authenticated;
