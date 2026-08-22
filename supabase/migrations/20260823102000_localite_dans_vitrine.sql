-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 35. Le nom de la commune, pas seulement son identifiant
-- ═══════════════════════════════════════════════════════════════════════════
-- La vitrine affichait « Briqueterie · <rien> » : la vue portait
-- `localite_id`, un identifiant, la ou la page a besoin d'un nom. Une jointure
-- de plus vaut mieux qu'une requete de plus depuis le navigateur.

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
  ) as vehicules,
  l.nom as localite_nom
from public.fournisseurs f
left join public.localites l on l.id = f.localite_id
where f.statut = 'actif';
