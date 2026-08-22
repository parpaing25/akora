-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 34. La vitrine d'un depot dit ce qu'il EST
-- ═══════════════════════════════════════════════════════════════════════════
-- « Briqueterie », « Carriere », « Scierie » : un mot sous le nom, et l'on
-- sait a qui l'on a affaire. Le retrait sur place et les camions declares
-- comptent autant — un depot sans camion ne livre pas, autant le dire sur sa
-- fiche plutot que de le laisser decouvrir au moment de commander.
--
-- Toujours aucune donnee personnelle : ni telephone, ni e-mail, ni adresse
-- exacte. Le telephone reste derriere sa fonction dediee, journalisee.

create or replace view public.fournisseurs_publics as
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
  f.created_at,
  f.metier,
  f.photo_depot,
  f.retrait_sur_place,
  coalesce(
    (select array_agg(v.nom order by v.capacite_kg)
       from public.vehicules_livraison v
      where v.fournisseur_id = f.id and v.actif),
    '{}'
  ) as vehicules
from public.fournisseurs f
where f.statut = 'actif';
