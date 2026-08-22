-- ═══════════════════════════════════════════════════════════════════════════
-- Referentiel des materiaux de gros œuvre
-- ═══════════════════════════════════════════════════════════════════════════
-- POIDS : masse reelle d'une unite.
-- VOLUME : ENCOMBREMENT DE TRANSPORT, pas le volume de matiere. Une tole de
-- 0,25 mm ne represente que 0,0005 m3 d'acier, mais elle occupe environ
-- 0,010 m3 dans une benne. C'est l'encombrement qui decide du vehicule, donc
-- c'est lui qu'on stocke (spec B6 etape 3).
--
-- Ces valeurs sont des references courantes du batiment, servant de valeurs
-- PRE-REMPLIES. Chaque fournisseur les ajuste pour SES produits (spec B4).

with famille as (select id, slug from public.categories)
insert into public.materiaux_ref
  (categorie_id, nom, slug, unite_defaut, poids_kg_unite_defaut, volume_m3_unite_defaut, attributs)
select f.id, d.nom, d.slug, d.unite::public.unite, d.poids::numeric, d.volume::numeric, d.attributs::jsonb
from (values
  -- ── Agglomeres et prefabriques beton ────────────────────────────────────
  ('agglomeres','Parpaing creux 10 (40x20x10)','parpaing-creux-10','piece',11.0,0.0080,'{"epaisseur_cm":10}'),
  ('agglomeres','Parpaing creux 15 (40x20x15)','parpaing-creux-15','piece',17.0,0.0120,'{"epaisseur_cm":15}'),
  ('agglomeres','Parpaing creux 20 (40x20x20)','parpaing-creux-20','piece',22.0,0.0160,'{"epaisseur_cm":20}'),
  ('agglomeres','Parpaing plein 10 (40x20x10)','parpaing-plein-10','piece',18.0,0.0080,'{"epaisseur_cm":10}'),
  ('agglomeres','Parpaing plein 15 (40x20x15)','parpaing-plein-15','piece',26.0,0.0120,'{"epaisseur_cm":15}'),
  ('agglomeres','Parpaing plein 20 (40x20x20)','parpaing-plein-20','piece',34.0,0.0160,'{"epaisseur_cm":20}'),
  ('agglomeres','Hourdis 12 (60x20x12)','hourdis-12','piece',14.0,0.0144,'{"hauteur_cm":12}'),
  ('agglomeres','Hourdis 16 (60x20x16)','hourdis-16','piece',18.0,0.0192,'{"hauteur_cm":16}'),
  ('agglomeres','Hourdis 20 (60x20x20)','hourdis-20','piece',22.0,0.0240,'{"hauteur_cm":20}'),
  ('agglomeres','Poutrelle béton précontraint','poutrelle-beton','ml',17.0,0.0080,'{}'),
  ('agglomeres','Claustra béton 30x30','claustra-beton-30','piece',10.0,0.0090,'{}'),
  ('agglomeres','Pavé autobloquant 6 cm','pave-autobloquant-6','m2',135.0,0.0600,'{"epaisseur_cm":6}'),
  ('agglomeres','Pavé autobloquant 8 cm','pave-autobloquant-8','m2',180.0,0.0800,'{"epaisseur_cm":8}'),
  ('agglomeres','Bordure de trottoir T2','bordure-t2','ml',60.0,0.0300,'{}'),
  ('agglomeres','Bordure de trottoir P1','bordure-p1','ml',40.0,0.0180,'{}'),
  ('agglomeres','Buse béton diamètre 300','buse-beton-300','ml',110.0,0.0900,'{"diametre_mm":300}'),
  ('agglomeres','Buse béton diamètre 400','buse-beton-400','ml',180.0,0.1300,'{"diametre_mm":400}'),
  ('agglomeres','Buse béton diamètre 600','buse-beton-600','ml',330.0,0.2200,'{"diametre_mm":600}'),
  ('agglomeres','Regard béton 40x40','regard-beton-40','piece',90.0,0.0800,'{}'),
  ('agglomeres','Regard béton 60x60','regard-beton-60','piece',180.0,0.1700,'{}'),

  -- ── Briques ─────────────────────────────────────────────────────────────
  ('briques','Brique cuite pleine 22x11x6','brique-cuite-pleine-22','piece',2.6,0.00145,'{}'),
  ('briques','Brique cuite pleine 28x14x9','brique-cuite-pleine-28','piece',6.5,0.00353,'{}'),
  ('briques','Brique cuite creuse 8 trous 30x20x10','brique-creuse-8-trous','piece',5.5,0.00600,'{}'),
  ('briques','Brique cuite creuse 12 trous 30x20x15','brique-creuse-12-trous','piece',8.0,0.00900,'{}'),
  ('briques','Brique de terre comprimée 29,5x14x9','btc-295','piece',7.5,0.00372,'{}'),
  ('briques','Brique de terre comprimée 22x11x6','btc-22','piece',3.0,0.00145,'{}'),
  ('briques','Adobe 30x15x10','adobe-30','piece',8.0,0.00450,'{}'),

  -- ── Granulats ───────────────────────────────────────────────────────────
  ('granulats','Sable fin','sable-fin','m3',1500.0,1.0,'{}'),
  ('granulats','Sable de rivière','sable-de-riviere','m3',1600.0,1.0,'{}'),
  ('granulats','Sable de carrière','sable-de-carriere','m3',1550.0,1.0,'{}'),
  ('granulats','Gravillon 5/15','gravillon-5-15','m3',1450.0,1.0,'{"calibre":"5/15"}'),
  ('granulats','Gravillon 15/25','gravillon-15-25','m3',1450.0,1.0,'{"calibre":"15/25"}'),
  ('granulats','Cailloux concassés 25/40','cailloux-25-40','m3',1500.0,1.0,'{"calibre":"25/40"}'),
  ('granulats','Moellon','moellon','m3',1700.0,1.0,'{}'),
  ('granulats','Tout-venant 0/31,5','tout-venant-0-315','m3',1900.0,1.0,'{}'),
  ('granulats','Remblai','remblai','m3',1700.0,1.0,'{}'),
  ('granulats','Latérite','laterite','m3',1800.0,1.0,'{}'),
  ('granulats','Sable de rivière en vrac','sable-de-riviere-tonne','tonne',1000.0,0.625,'{}'),

  -- ── Liants ──────────────────────────────────────────────────────────────
  ('liants','Ciment CEM II 32,5 sac de 50 kg','ciment-cem2-325-50kg','sac',50.0,0.033,'{"classe":"32.5"}'),
  ('liants','Ciment CEM II 42,5 sac de 50 kg','ciment-cem2-425-50kg','sac',50.0,0.033,'{"classe":"42.5"}'),
  ('liants','Ciment CEM I 42,5 sac de 50 kg','ciment-cem1-425-50kg','sac',50.0,0.033,'{"classe":"42.5"}'),
  ('liants','Ciment en vrac','ciment-vrac','tonne',1000.0,0.660,'{}'),
  ('liants','Chaux hydraulique sac de 50 kg','chaux-hydraulique-50kg','sac',50.0,0.040,'{}'),
  ('liants','Chaux aérienne sac de 25 kg','chaux-aerienne-25kg','sac',25.0,0.022,'{}'),
  ('liants','Plâtre sac de 40 kg','platre-40kg','sac',40.0,0.030,'{}')
) as d(famille_slug, nom, slug, unite, poids, volume, attributs)
join famille f on f.slug = d.famille_slug
on conflict (slug) do update
  set nom = excluded.nom,
      unite_defaut = excluded.unite_defaut,
      poids_kg_unite_defaut = excluded.poids_kg_unite_defaut,
      volume_m3_unite_defaut = excluded.volume_m3_unite_defaut;

with famille as (select id, slug from public.categories)
insert into public.materiaux_ref
  (categorie_id, nom, slug, unite_defaut, poids_kg_unite_defaut, volume_m3_unite_defaut, attributs)
select f.id, d.nom, d.slug, d.unite::public.unite, d.poids::numeric, d.volume::numeric, d.attributs::jsonb
from (values
  -- ── Bois ────────────────────────────────────────────────────────────────
  ('bois','Planche 2,5 x 20 cm, 4 m','planche-25x200-4m','piece',13.0,0.0200,'{"longueur_m":4}'),
  ('bois','Planche 3 x 20 cm, 4 m','planche-30x200-4m','piece',15.6,0.0240,'{"longueur_m":4}'),
  ('bois','Volige 1,5 x 10 cm, 3 m','volige-15x100-3m','piece',3.0,0.0045,'{"longueur_m":3}'),
  ('bois','Latte 2 x 4 cm, 3 m','latte-20x40-3m','piece',1.6,0.0024,'{"longueur_m":3}'),
  ('bois','Chevron 6 x 8 cm, 4 m','chevron-60x80-4m','piece',12.5,0.0192,'{"longueur_m":4}'),
  ('bois','Chevron 8 x 8 cm, 4 m','chevron-80x80-4m','piece',17.0,0.0256,'{"longueur_m":4}'),
  ('bois','Madrier 7,5 x 22,5 cm, 4 m','madrier-75x225-4m','piece',44.0,0.0675,'{"longueur_m":4}'),
  ('bois','Bois rond eucalyptus diamètre 8-10 cm, 4 m','bois-rond-8-10-4m','piece',20.0,0.0280,'{"longueur_m":4}'),
  ('bois','Bois rond eucalyptus diamètre 10-12 cm, 5 m','bois-rond-10-12-5m','piece',38.0,0.0520,'{"longueur_m":5}'),
  ('bois','Bambou diamètre 8-10 cm, 5 m','bambou-8-10-5m','piece',12.0,0.0300,'{"longueur_m":5}'),
  ('bois','Contreplaqué 5 mm, 122 x 244','contreplaque-5mm','piece',9.0,0.0150,'{"epaisseur_mm":5}'),
  ('bois','Contreplaqué 10 mm, 122 x 244','contreplaque-10mm','piece',18.0,0.0300,'{"epaisseur_mm":10}'),
  ('bois','Contreplaqué 18 mm, 122 x 244','contreplaque-18mm','piece',32.0,0.0540,'{"epaisseur_mm":18}'),

  -- ── Couverture ──────────────────────────────────────────────────────────
  ('couverture','Tôle ondulée galvanisée 0,25 mm, 2 m','tole-ondulee-025-2m','piece',4.0,0.0100,'{"epaisseur_mm":0.25,"longueur_m":2}'),
  ('couverture','Tôle ondulée galvanisée 0,30 mm, 3 m','tole-ondulee-030-3m','piece',7.0,0.0150,'{"epaisseur_mm":0.30,"longueur_m":3}'),
  ('couverture','Bac galvanisé 0,40 mm, 4 m','bac-galva-040-4m','piece',14.0,0.0250,'{"epaisseur_mm":0.40,"longueur_m":4}'),
  ('couverture','Bac alu-zinc 0,45 mm, 6 m','bac-aluzinc-045-6m','piece',22.0,0.0400,'{"epaisseur_mm":0.45,"longueur_m":6}'),
  ('couverture','Plaque fibrociment ondulée 1,80 m','fibrociment-180','piece',22.0,0.0200,'{"longueur_m":1.8}'),
  ('couverture','Tuile en terre cuite','tuile-terre-cuite','piece',2.5,0.0012,'{}'),
  ('couverture','Faîtière galvanisée 2 m','faitiere-galva-2m','piece',3.0,0.0080,'{"longueur_m":2}'),
  ('couverture','Faîtière en terre cuite','faitiere-terre-cuite','piece',3.5,0.0020,'{}'),

  -- ── Acier de construction ───────────────────────────────────────────────
  ('acier','Fer à béton diamètre 6, barre de 12 m','fer-beton-6','piece',2.66,0.0040,'{"diametre_mm":6,"longueur_m":12}'),
  ('acier','Fer à béton diamètre 8, barre de 12 m','fer-beton-8','piece',4.74,0.0045,'{"diametre_mm":8,"longueur_m":12}'),
  ('acier','Fer à béton diamètre 10, barre de 12 m','fer-beton-10','piece',7.40,0.0050,'{"diametre_mm":10,"longueur_m":12}'),
  ('acier','Fer à béton diamètre 12, barre de 12 m','fer-beton-12','piece',10.66,0.0060,'{"diametre_mm":12,"longueur_m":12}'),
  ('acier','Fer à béton diamètre 14, barre de 12 m','fer-beton-14','piece',14.50,0.0070,'{"diametre_mm":14,"longueur_m":12}'),
  ('acier','Fer à béton diamètre 16, barre de 12 m','fer-beton-16','piece',18.94,0.0085,'{"diametre_mm":16,"longueur_m":12}'),
  ('acier','Treillis soudé diamètre 6, maille 150, panneau 2,4 x 6 m','treillis-soude-6-150','piece',34.0,0.0500,'{"diametre_mm":6,"maille_mm":150}'),
  ('acier','Fil recuit, rouleau de 25 kg','fil-recuit-25kg','piece',25.0,0.0200,'{}'),

  -- ── Beton pret a l'emploi ───────────────────────────────────────────────
  ('beton-pret','Béton dosé à 250 kg/m3','beton-250','m3',2400.0,1.0,'{"dosage_kg_m3":250}'),
  ('beton-pret','Béton dosé à 300 kg/m3','beton-300','m3',2400.0,1.0,'{"dosage_kg_m3":300}'),
  ('beton-pret','Béton dosé à 350 kg/m3','beton-350','m3',2400.0,1.0,'{"dosage_kg_m3":350}'),
  ('beton-pret','Béton dosé à 400 kg/m3','beton-400','m3',2400.0,1.0,'{"dosage_kg_m3":400}'),
  ('beton-pret','Béton pompé dosé à 350 kg/m3','beton-350-pompe','m3',2400.0,1.0,'{"dosage_kg_m3":350,"pompe":true}')
) as d(famille_slug, nom, slug, unite, poids, volume, attributs)
join famille f on f.slug = d.famille_slug
on conflict (slug) do update
  set nom = excluded.nom,
      unite_defaut = excluded.unite_defaut,
      poids_kg_unite_defaut = excluded.poids_kg_unite_defaut,
      volume_m3_unite_defaut = excluded.volume_m3_unite_defaut;
