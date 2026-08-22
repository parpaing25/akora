-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 32. Le type remonte dans la vue des produits
-- ═══════════════════════════════════════════════════════════════════════════
-- Depuis la navigation a trois niveaux, l'adresse d'un comparateur s'ecrit
-- /materiaux/:famille/:type/:format. Trois pages construisaient encore une
-- adresse a deux segments — la fiche produit, la page prix du marche et le
-- plan du site — et menaient donc a la page d'un TYPE nomme comme un format,
-- c'est-a-dire nulle part.
--
-- Plutot que de faire deviner le type au navigateur, la vue le porte.

create or replace view public.produits_publics as
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
  c.nom  as categorie_nom,
  t.slug as materiau_type_slug,
  t.nom  as materiau_type_nom
from public.produits p
join public.fournisseurs f on f.id = p.fournisseur_id
join public.categories c on c.id = p.categorie_id
left join public.materiaux_ref m on m.id = p.materiau_ref_id
left join public.types_materiaux t on t.id = m.type_id
where p.statut = 'actif' and f.statut = 'actif';
