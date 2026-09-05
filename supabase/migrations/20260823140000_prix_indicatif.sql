-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 40. Un prix indicatif, tant qu'aucun depot ne publie le sien
-- ═══════════════════════════════════════════════════════════════════════════
-- Un catalogue ou tout affiche « aucune offre » ne renseigne personne. Mais
-- inventer un prix serait pire : Akora vend la promesse du prix REEL, et un
-- chiffre invente la detruit d'un coup.
--
-- D'ou ce compromis, qui n'en est pas un : une FOURCHETTE, avec sa SOURCE et
-- sa DATE, obligatoires toutes les deux. Elle ne se commande pas, elle
-- n'entre dans aucun calcul de prix rendu, elle ne devient jamais une offre.
-- Elle dit seulement : « voila l'ordre de grandeur constate, allez verifier ».
--
-- Et elle s'efface des qu'un depot publie : une vraie offre chasse toujours
-- une estimation.

alter table public.materiaux_ref
  add column if not exists prix_indicatif_min    integer,
  add column if not exists prix_indicatif_max    integer,
  add column if not exists prix_indicatif_source text,
  add column if not exists prix_indicatif_le     date;

-- La source et la date ne sont pas facultatives : un chiffre sans origine ne
-- vaut pas mieux qu'un chiffre invente, et il vieillit sans qu'on le sache.
alter table public.materiaux_ref drop constraint if exists prix_indicatif_trace;
alter table public.materiaux_ref add constraint prix_indicatif_trace check (
  (prix_indicatif_min is null and prix_indicatif_max is null)
  or (prix_indicatif_min is not null and prix_indicatif_max is not null
      and prix_indicatif_min > 0 and prix_indicatif_max >= prix_indicatif_min
      and prix_indicatif_source is not null and length(prix_indicatif_source) > 10
      and prix_indicatif_le is not null)
);

comment on column public.materiaux_ref.prix_indicatif_min is
  'Ordre de grandeur constate publiquement. JAMAIS une offre : ne se commande pas, n''entre dans aucun calcul de prix rendu, et disparait des qu''un depot publie le sien.';

-- ── Ce que la presse malgache documente reellement ────────────────────────
-- Le ciment, et lui seul. Pour le sable, les parpaings ou les hourdis, aucune
-- source publique chiffree ne se trouve : ces lignes restent donc vides, et
-- c'est plus honnete qu'une estimation au doigt mouille.
update public.materiaux_ref set
  prix_indicatif_min = 23500,
  prix_indicatif_max = 29900,
  prix_indicatif_source =
    'Relevé Antananarivo : Jumbo 42,5 à 23 500 Ar, Lafarge 42,5 à 28 000 Ar, Orimbato 42,5 à 29 900 Ar. Plafond d''État sur le ciment importé : 29 000 Ar. Source : laverite.mg, presse malgache.',
  prix_indicatif_le = date '2026-08-23'
where slug in ('ciment-cem1-425-50kg', 'ciment-cem2-425-50kg');

-- ── La vue des formats porte la fourchette ────────────────────────────────
create or replace view public.formats_vitrine as
select
  m.id, m.nom, m.slug, m.libelle_court, m.dimensions, m.photo,
  m.unite_defaut as unite,
  m.poids_kg_unite_defaut  as poids_kg_unite,
  m.volume_m3_unite_defaut as volume_m3_unite,
  m.ordre_format, m.note,
  t.slug as type_slug, t.nom as type_nom,
  c.slug as famille_slug, c.nom as famille_nom,
  count(p.id) as nb_offres,
  count(p.id) filter (where f.niveau_verification in ('verifie', 'partenaire')) as nb_offres_verifiees,
  min(coalesce(p.prix_promo, p.prix_unitaire)) as prix_des,
  (array_agg(f.lat order by coalesce(p.prix_promo, p.prix_unitaire)))[1] as offre_lat,
  (array_agg(f.lng order by coalesce(p.prix_promo, p.prix_unitaire)))[1] as offre_lng,
  (array_agg(f.rayon_max_km order by coalesce(p.prix_promo, p.prix_unitaire)))[1] as offre_rayon_max_km,
  (array_agg(f.coef_sinuosite order by coalesce(p.prix_promo, p.prix_unitaire)))[1] as offre_coef_sinuosite,
  (array_agg(f.id order by coalesce(p.prix_promo, p.prix_unitaire)))[1] as offre_fournisseur_id,
  -- Ajoutees EN FIN de liste : « create or replace view » refuse d'inserer
  -- une colonne au milieu, il renommerait les suivantes.
  m.prix_indicatif_min, m.prix_indicatif_max, m.prix_indicatif_source, m.prix_indicatif_le
from public.materiaux_ref m
join public.types_materiaux t on t.id = m.type_id
join public.categories c on c.id = t.categorie_id
left join public.produits p on p.materiau_ref_id = m.id and p.statut = 'actif'
left join public.fournisseurs f on f.id = p.fournisseur_id and f.statut = 'actif'
where m.actif and t.actif
group by m.id, m.nom, m.slug, m.libelle_court, m.dimensions, m.photo, m.unite_defaut,
         m.poids_kg_unite_defaut, m.volume_m3_unite_defaut, m.ordre_format, m.note,
         m.prix_indicatif_min, m.prix_indicatif_max, m.prix_indicatif_source, m.prix_indicatif_le,
         t.slug, t.nom, c.slug, c.nom;

grant select on public.formats_vitrine to anon, authenticated;
