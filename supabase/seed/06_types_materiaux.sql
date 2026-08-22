-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — seed 06. Les types de materiaux, et le rangement des 92 references
-- ═══════════════════════════════════════════════════════════════════════════
-- Rejouable : « on conflict do update » partout. Aucun prix ici — ce fichier
-- ne decrit que le REFERENTIEL, c'est-a-dire le vocabulaire commun dans lequel
-- les fournisseurs viennent poser leurs offres.
--
-- `nom_mg` et `synonymes` ne sont pas decoratifs : sur un chantier on demande
-- des « biriky », pas des « parpaings creux ». La recherche cherche dans les
-- trois.

insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Ciment', 'Simenitra', 'ciment', array['simenitra', 'cement', 'ciman']::text[], 1
  from public.categories c where c.slug = 'liants'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Chaux', 'Sokay', 'chaux', array['sokay']::text[], 2
  from public.categories c where c.slug = 'liants'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Plâtre', 'Platra', 'platre', array['platra', 'gypse']::text[], 3
  from public.categories c where c.slug = 'liants'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Sable', 'Fasika', 'sable', array['fasika']::text[], 1
  from public.categories c where c.slug = 'granulats'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Gravillon et cailloux', 'Vato madinika', 'gravillon', array['vato', 'gravier', 'concasse', 'caillou']::text[], 2
  from public.categories c where c.slug = 'granulats'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Moellon', 'Vato lehibe', 'moellon', array['vato', 'pierre']::text[], 3
  from public.categories c where c.slug = 'granulats'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Remblai et latérite', 'Tany fanotofana', 'remblai', array['tany', 'laterite', 'tout-venant']::text[], 4
  from public.categories c where c.slug = 'granulats'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Parpaing creux', 'Biriky simenitra poakaty', 'parpaing-creux', array['biriky', 'bloc', 'agglo', 'parpin']::text[], 1
  from public.categories c where c.slug = 'agglomeres'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Parpaing plein', 'Biriky simenitra feno', 'parpaing-plein', array['biriky', 'bloc', 'agglo']::text[], 2
  from public.categories c where c.slug = 'agglomeres'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Hourdis', 'Entrevous', 'hourdis', array['entrevous', 'hourdi', 'plancher', 'dalle']::text[], 3
  from public.categories c where c.slug = 'agglomeres'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Poutrelle', 'Poutrelle', 'poutrelle', array['precontraint', 'plancher']::text[], 4
  from public.categories c where c.slug = 'agglomeres'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Bordure de trottoir', 'Sisin-dalana', 'bordure', array['trottoir', 'caniveau']::text[], 5
  from public.categories c where c.slug = 'agglomeres'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Buse béton', 'Fantsona simenitra', 'buse', array['fantsona', 'canalisation', 'tuyau']::text[], 6
  from public.categories c where c.slug = 'agglomeres'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Regard béton', 'Regard', 'regard', array['chambre', 'boite']::text[], 7
  from public.categories c where c.slug = 'agglomeres'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Pavé autobloquant', 'Pavé de cour', 'pave', array['autobloquant', 'pave']::text[], 8
  from public.categories c where c.slug = 'agglomeres'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Claustra', 'Claustra', 'claustra', array['aeration', 'brise-vue']::text[], 9
  from public.categories c where c.slug = 'agglomeres'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Brique creuse', 'Biriky poakaty', 'brique-creuse', array['biriky', 'creuse', 'tanimanga']::text[], 1
  from public.categories c where c.slug = 'briques'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Brique pleine', 'Biriky feno', 'brique-pleine', array['biriky', 'pleine', 'repressee', 'tanimanga']::text[], 2
  from public.categories c where c.slug = 'briques'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Brique de terre comprimée', 'Biriky tany voatery', 'btc', array['btc', 'terre comprimee', 'tany']::text[], 3
  from public.categories c where c.slug = 'briques'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Adobe', 'Biriky tany', 'adobe', array['tany', 'brique crue']::text[], 4
  from public.categories c where c.slug = 'briques'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Habillage en terre cuite', 'Plaquette tanimanga', 'habillage-terre-cuite', array['plaquette', 'briquette', 'tonette', 'parement']::text[], 5
  from public.categories c where c.slug = 'briques'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Tôle', 'Fanitso', 'tole', array['fanitso', 'bac', 'galva', 'aluzinc', 'tole']::text[], 1
  from public.categories c where c.slug = 'couverture'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Tuile', 'Tafo tanimanga', 'tuile', array['tafo', 'ecaille', 'mecanique']::text[], 2
  from public.categories c where c.slug = 'couverture'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Faîtière', 'Faîtière', 'faitiere', array['arete', 'faitage']::text[], 3
  from public.categories c where c.slug = 'couverture'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Fibrociment', 'Fibrociment', 'fibrociment', array['fibro', 'plaque ondulee']::text[], 4
  from public.categories c where c.slug = 'couverture'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Fer à béton', 'Vy', 'fer-a-beton', array['vy', 'fer', 'acier', 'rond', 'armature']::text[], 1
  from public.categories c where c.slug = 'acier'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Treillis soudé', 'Treillis', 'treillis', array['panneau', 'grillage']::text[], 2
  from public.categories c where c.slug = 'acier'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Fil recuit', 'Fil de fer', 'fil-recuit', array['ligature', 'fil']::text[], 3
  from public.categories c where c.slug = 'acier'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Bois rond et bambou', 'Hazo boribory', 'bois-rond', array['hazo', 'bambou', 'eucalyptus', 'rondin', 'etai']::text[], 1
  from public.categories c where c.slug = 'bois'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Chevron', 'Chevron', 'chevron', array['hazo', 'charpente']::text[], 2
  from public.categories c where c.slug = 'bois'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Planche et volige', 'Hazo fisaka', 'planche', array['volige', 'hazo', 'coffrage']::text[], 3
  from public.categories c where c.slug = 'bois'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Madrier', 'Madrier', 'madrier', array['hazo', 'coffrage']::text[], 4
  from public.categories c where c.slug = 'bois'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Latte', 'Latte', 'latte', array['hazo', 'liteau']::text[], 5
  from public.categories c where c.slug = 'bois'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Contreplaqué', 'Contreplaqué', 'contreplaque', array['ctp', 'panneau', 'coffrage']::text[], 6
  from public.categories c where c.slug = 'bois'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Béton prêt à l''emploi', 'Beton vonona', 'beton-pret-emploi', array['toupie', 'dose', 'centrale']::text[], 1
  from public.categories c where c.slug = 'beton-pret'
on conflict (slug) do update
   set nom = excluded.nom, nom_mg = excluded.nom_mg, synonymes = excluded.synonymes,
       ordre = excluded.ordre, categorie_id = excluded.categorie_id;

-- ── Rangement des references ──────────────────────────────────────────────
-- `epaisseur_cm` / `diametre_mm` / `longueur_cm` alimentent `ordre_format`
-- par trigger : c'est ce qui met 12 avant 15 avant 16 avant 20, la ou l'ordre
-- alphabetique donnerait 12, 120, 15, 16, 20.

update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'ciment'),
  libelle_court = 'CEM I 42,5', dimensions = 'Sac de 50 kg', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'ciment-cem1-425-50kg';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'ciment'),
  libelle_court = 'CEM II 32,5', dimensions = 'Sac de 50 kg', note = 'le plus courant',
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'ciment-cem2-325-50kg';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'ciment'),
  libelle_court = 'CEM II 42,5', dimensions = 'Sac de 50 kg', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'ciment-cem2-425-50kg';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'ciment'),
  libelle_court = 'Vrac', dimensions = 'À la tonne', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'ciment-vrac';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'chaux'),
  libelle_court = 'Aérienne', dimensions = 'Sac de 25 kg', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'chaux-aerienne-25kg';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'chaux'),
  libelle_court = 'Hydraulique', dimensions = 'Sac de 50 kg', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'chaux-hydraulique-50kg';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'platre'),
  libelle_court = '40 kg', dimensions = 'Sac de 40 kg', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'platre-40kg';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'sable'),
  libelle_court = 'Fin', dimensions = 'Au m³', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'sable-fin';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'sable'),
  libelle_court = 'Carrière', dimensions = 'Au m³', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'sable-de-carriere';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'sable'),
  libelle_court = 'Rivière', dimensions = 'Au m³', note = 'le plus courant',
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'sable-de-riviere';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'sable'),
  libelle_court = 'Rivière · tonne', dimensions = 'À la tonne', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'sable-de-riviere-tonne';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'gravillon'),
  libelle_court = '5/15', dimensions = 'Au m³', note = null,
  epaisseur_cm = 5, diametre_mm = null, longueur_cm = null
where slug = 'gravillon-5-15';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'gravillon'),
  libelle_court = '15/25', dimensions = 'Au m³', note = null,
  epaisseur_cm = 15, diametre_mm = null, longueur_cm = null
where slug = 'gravillon-15-25';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'gravillon'),
  libelle_court = '25/40', dimensions = 'Au m³', note = null,
  epaisseur_cm = 25, diametre_mm = null, longueur_cm = null
where slug = 'cailloux-25-40';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'moellon'),
  libelle_court = 'Moellon', dimensions = 'Au m³', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'moellon';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'remblai'),
  libelle_court = 'Latérite', dimensions = 'Au m³', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'laterite';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'remblai'),
  libelle_court = 'Remblai', dimensions = 'Au m³', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'remblai';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'remblai'),
  libelle_court = 'Tout-venant 0/31,5', dimensions = 'Au m³', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'tout-venant-0-315';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'parpaing-creux'),
  libelle_court = '10', dimensions = '40 × 20 × 10 cm', note = null,
  epaisseur_cm = 10, diametre_mm = null, longueur_cm = null
where slug = 'parpaing-creux-10';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'parpaing-creux'),
  libelle_court = '15', dimensions = '40 × 20 × 15 cm', note = 'le plus courant',
  epaisseur_cm = 15, diametre_mm = null, longueur_cm = null
where slug = 'parpaing-creux-15';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'parpaing-creux'),
  libelle_court = '20', dimensions = '40 × 20 × 20 cm', note = null,
  epaisseur_cm = 20, diametre_mm = null, longueur_cm = null
where slug = 'parpaing-creux-20';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'parpaing-plein'),
  libelle_court = '10', dimensions = '40 × 20 × 10 cm', note = null,
  epaisseur_cm = 10, diametre_mm = null, longueur_cm = null
where slug = 'parpaing-plein-10';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'parpaing-plein'),
  libelle_court = '15', dimensions = '40 × 20 × 15 cm', note = null,
  epaisseur_cm = 15, diametre_mm = null, longueur_cm = null
where slug = 'parpaing-plein-15';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'parpaing-plein'),
  libelle_court = '20', dimensions = '40 × 20 × 20 cm', note = null,
  epaisseur_cm = 20, diametre_mm = null, longueur_cm = null
where slug = 'parpaing-plein-20';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'hourdis'),
  libelle_court = '12', dimensions = '60 × 20 × 12 cm', note = 'béton, le plus courant',
  epaisseur_cm = 12, diametre_mm = null, longueur_cm = null
where slug = 'hourdis-12';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'hourdis'),
  libelle_court = '12×33×33', dimensions = '33 × 33 × 12 cm', note = 'terre cuite',
  epaisseur_cm = 12.1, diametre_mm = null, longueur_cm = null
where slug = 'hourdis-tc-12';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'hourdis'),
  libelle_court = '15×33×33', dimensions = '33 × 33 × 15 cm', note = 'terre cuite',
  epaisseur_cm = 15.1, diametre_mm = null, longueur_cm = null
where slug = 'hourdis-tc-15';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'hourdis'),
  libelle_court = '16', dimensions = '60 × 20 × 16 cm', note = null,
  epaisseur_cm = 16, diametre_mm = null, longueur_cm = null
where slug = 'hourdis-16';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'hourdis'),
  libelle_court = '20', dimensions = '60 × 20 × 20 cm', note = null,
  epaisseur_cm = 20, diametre_mm = null, longueur_cm = null
where slug = 'hourdis-20';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'hourdis'),
  libelle_court = '20×33×33', dimensions = '33 × 33 × 20 cm', note = 'terre cuite',
  epaisseur_cm = 20.1, diametre_mm = null, longueur_cm = null
where slug = 'hourdis-tc-20';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'poutrelle'),
  libelle_court = 'Précontrainte', dimensions = 'Au mètre linéaire', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'poutrelle-beton';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'bordure'),
  libelle_court = 'P1', dimensions = 'Bordure basse', note = null,
  epaisseur_cm = 1, diametre_mm = null, longueur_cm = null
where slug = 'bordure-p1';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'bordure'),
  libelle_court = 'T2', dimensions = 'Bordure haute', note = null,
  epaisseur_cm = 2, diametre_mm = null, longueur_cm = null
where slug = 'bordure-t2';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'buse'),
  libelle_court = 'Ø300', dimensions = 'Diamètre 300 mm', note = null,
  epaisseur_cm = null, diametre_mm = 300, longueur_cm = null
where slug = 'buse-beton-300';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'buse'),
  libelle_court = 'Ø400', dimensions = 'Diamètre 400 mm', note = null,
  epaisseur_cm = null, diametre_mm = 400, longueur_cm = null
where slug = 'buse-beton-400';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'buse'),
  libelle_court = 'Ø600', dimensions = 'Diamètre 600 mm', note = null,
  epaisseur_cm = null, diametre_mm = 600, longueur_cm = null
where slug = 'buse-beton-600';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'regard'),
  libelle_court = '40×40', dimensions = '40 × 40 cm', note = null,
  epaisseur_cm = 40, diametre_mm = null, longueur_cm = null
where slug = 'regard-beton-40';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'regard'),
  libelle_court = '60×60', dimensions = '60 × 60 cm', note = null,
  epaisseur_cm = 60, diametre_mm = null, longueur_cm = null
where slug = 'regard-beton-60';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'pave'),
  libelle_court = '6 cm', dimensions = 'Épaisseur 6 cm', note = null,
  epaisseur_cm = 6, diametre_mm = null, longueur_cm = null
where slug = 'pave-autobloquant-6';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'pave'),
  libelle_court = '8 cm', dimensions = 'Épaisseur 8 cm', note = null,
  epaisseur_cm = 8, diametre_mm = null, longueur_cm = null
where slug = 'pave-autobloquant-8';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'claustra'),
  libelle_court = '30×30', dimensions = '30 × 30 cm', note = null,
  epaisseur_cm = 30, diametre_mm = null, longueur_cm = null
where slug = 'claustra-beton-30';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'brique-creuse'),
  libelle_court = '8 trous', dimensions = '30 × 20 × 10 cm', note = null,
  epaisseur_cm = 10, diametre_mm = null, longueur_cm = null
where slug = 'brique-creuse-8-trous';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'brique-creuse'),
  libelle_court = '10×20×40', dimensions = '40 × 20 × 10 cm', note = null,
  epaisseur_cm = 10.1, diametre_mm = null, longueur_cm = null
where slug = 'brique-creuse-10x20x40';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'brique-creuse'),
  libelle_court = '12 trous', dimensions = '30 × 20 × 15 cm', note = null,
  epaisseur_cm = 15, diametre_mm = null, longueur_cm = null
where slug = 'brique-creuse-12-trous';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'brique-creuse'),
  libelle_court = '15×20×40', dimensions = '40 × 20 × 15 cm', note = null,
  epaisseur_cm = 15.1, diametre_mm = null, longueur_cm = null
where slug = 'brique-creuse-15x20x40';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'brique-creuse'),
  libelle_court = '20×20×40', dimensions = '40 × 20 × 20 cm', note = null,
  epaisseur_cm = 20, diametre_mm = null, longueur_cm = null
where slug = 'brique-creuse-20x20x40';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'brique-pleine'),
  libelle_court = '6×11×22', dimensions = '22 × 11 × 6 cm', note = 'mur apparent',
  epaisseur_cm = 6, diametre_mm = null, longueur_cm = null
where slug = 'brique-repressee-6x11x22';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'brique-pleine'),
  libelle_court = '22×11×6', dimensions = '22 × 11 × 6 cm', note = null,
  epaisseur_cm = 6.1, diametre_mm = null, longueur_cm = null
where slug = 'brique-cuite-pleine-22';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'brique-pleine'),
  libelle_court = '28×14×9', dimensions = '28 × 14 × 9 cm', note = null,
  epaisseur_cm = 9, diametre_mm = null, longueur_cm = null
where slug = 'brique-cuite-pleine-28';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'btc'),
  libelle_court = '22×11×6', dimensions = '22 × 11 × 6 cm', note = null,
  epaisseur_cm = 6, diametre_mm = null, longueur_cm = null
where slug = 'btc-22';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'btc'),
  libelle_court = '29,5×14×9', dimensions = '29,5 × 14 × 9 cm', note = null,
  epaisseur_cm = 9, diametre_mm = null, longueur_cm = null
where slug = 'btc-295';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'adobe'),
  libelle_court = '30×15×10', dimensions = '30 × 15 × 10 cm', note = null,
  epaisseur_cm = 10, diametre_mm = null, longueur_cm = null
where slug = 'adobe-30';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'habillage-terre-cuite'),
  libelle_court = 'Briquette', dimensions = '22 × 5 × 2 cm', note = null,
  epaisseur_cm = 2, diametre_mm = null, longueur_cm = null
where slug = 'briquette-2x5x22';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'habillage-terre-cuite'),
  libelle_court = 'Plaquette', dimensions = '22 × 7 × 2 cm', note = null,
  epaisseur_cm = 2.1, diametre_mm = null, longueur_cm = null
where slug = 'plaquette-2x7x22';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'habillage-terre-cuite'),
  libelle_court = 'Plaquette chinois', dimensions = '20 × 10 × 2 cm', note = null,
  epaisseur_cm = 2.2, diametre_mm = null, longueur_cm = null
where slug = 'plaquette-chinois-2x10x20';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'habillage-terre-cuite'),
  libelle_court = 'Tonette', dimensions = '40 × 20 × 4 cm', note = null,
  epaisseur_cm = 4, diametre_mm = null, longueur_cm = null
where slug = 'tonette-4x20x40';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'tole'),
  libelle_court = '0,25 mm · 2 m', dimensions = 'Ondulée galvanisée, 2 m', note = null,
  epaisseur_cm = 0.025, diametre_mm = null, longueur_cm = null
where slug = 'tole-ondulee-025-2m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'tole'),
  libelle_court = '0,30 mm · 3 m', dimensions = 'Ondulée galvanisée, 3 m', note = null,
  epaisseur_cm = 0.03, diametre_mm = null, longueur_cm = null
where slug = 'tole-ondulee-030-3m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'tole'),
  libelle_court = 'Bac 0,40 · 4 m', dimensions = 'Bac galvanisé, 4 m', note = null,
  epaisseur_cm = 0.04, diametre_mm = null, longueur_cm = null
where slug = 'bac-galva-040-4m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'tole'),
  libelle_court = 'Bac alu-zinc 0,45 · 6 m', dimensions = 'Bac alu-zinc, 6 m', note = null,
  epaisseur_cm = 0.045, diametre_mm = null, longueur_cm = null
where slug = 'bac-aluzinc-045-6m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'tuile'),
  libelle_court = 'Écaille', dimensions = '75 pièces au m²', note = null,
  epaisseur_cm = 1, diametre_mm = null, longueur_cm = null
where slug = 'tuile-ecaille';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'tuile'),
  libelle_court = 'Terre cuite', dimensions = 'Tuile courante', note = null,
  epaisseur_cm = 2, diametre_mm = null, longueur_cm = null
where slug = 'tuile-terre-cuite';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'tuile'),
  libelle_court = 'Mécanique', dimensions = '33,5 × 22 × 2 cm · 15 au m²', note = null,
  epaisseur_cm = 3, diametre_mm = null, longueur_cm = null
where slug = 'tuile-mecanique-22x335';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'faitiere'),
  libelle_court = 'Terre cuite', dimensions = 'Faîtière courante', note = null,
  epaisseur_cm = 1, diametre_mm = null, longueur_cm = null
where slug = 'faitiere-terre-cuite';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'faitiere'),
  libelle_court = 'Galvanisée 2 m', dimensions = 'Longueur 2 m', note = null,
  epaisseur_cm = 2, diametre_mm = null, longueur_cm = null
where slug = 'faitiere-galva-2m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'fibrociment'),
  libelle_court = '1,80 m', dimensions = 'Plaque ondulée 1,80 m', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = 180
where slug = 'fibrociment-180';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'fer-a-beton'),
  libelle_court = 'Ø6', dimensions = 'Barre de 12 m', note = null,
  epaisseur_cm = null, diametre_mm = 6, longueur_cm = null
where slug = 'fer-beton-6';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'fer-a-beton'),
  libelle_court = 'Ø8', dimensions = 'Barre de 12 m', note = 'le plus courant',
  epaisseur_cm = null, diametre_mm = 8, longueur_cm = null
where slug = 'fer-beton-8';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'fer-a-beton'),
  libelle_court = 'Ø10', dimensions = 'Barre de 12 m', note = null,
  epaisseur_cm = null, diametre_mm = 10, longueur_cm = null
where slug = 'fer-beton-10';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'fer-a-beton'),
  libelle_court = 'Ø12', dimensions = 'Barre de 12 m', note = null,
  epaisseur_cm = null, diametre_mm = 12, longueur_cm = null
where slug = 'fer-beton-12';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'fer-a-beton'),
  libelle_court = 'Ø14', dimensions = 'Barre de 12 m', note = null,
  epaisseur_cm = null, diametre_mm = 14, longueur_cm = null
where slug = 'fer-beton-14';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'fer-a-beton'),
  libelle_court = 'Ø16', dimensions = 'Barre de 12 m', note = null,
  epaisseur_cm = null, diametre_mm = 16, longueur_cm = null
where slug = 'fer-beton-16';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'treillis'),
  libelle_court = 'Ø6 · maille 150', dimensions = 'Panneau 2,4 × 6 m', note = null,
  epaisseur_cm = null, diametre_mm = 6, longueur_cm = null
where slug = 'treillis-soude-6-150';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'fil-recuit'),
  libelle_court = 'Rouleau 25 kg', dimensions = '25 kg', note = null,
  epaisseur_cm = null, diametre_mm = null, longueur_cm = null
where slug = 'fil-recuit-25kg';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'bois-rond'),
  libelle_court = 'Ø8-10 · 4 m', dimensions = 'Eucalyptus, 4 m', note = null,
  epaisseur_cm = null, diametre_mm = 90, longueur_cm = null
where slug = 'bois-rond-8-10-4m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'bois-rond'),
  libelle_court = 'Ø10-12 · 5 m', dimensions = 'Eucalyptus, 5 m', note = null,
  epaisseur_cm = null, diametre_mm = 110, longueur_cm = null
where slug = 'bois-rond-10-12-5m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'bois-rond'),
  libelle_court = 'Bambou Ø8-10 · 5 m', dimensions = 'Bambou, 5 m', note = null,
  epaisseur_cm = null, diametre_mm = 91, longueur_cm = null
where slug = 'bambou-8-10-5m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'chevron'),
  libelle_court = '6 × 8 · 4 m', dimensions = 'Section 6 × 8 cm, 4 m', note = null,
  epaisseur_cm = 6, diametre_mm = null, longueur_cm = null
where slug = 'chevron-60x80-4m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'chevron'),
  libelle_court = '8 × 8 · 4 m', dimensions = 'Section 8 × 8 cm, 4 m', note = null,
  epaisseur_cm = 8, diametre_mm = null, longueur_cm = null
where slug = 'chevron-80x80-4m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'planche'),
  libelle_court = 'Volige 1,5 × 10 · 3 m', dimensions = '1,5 × 10 cm, 3 m', note = null,
  epaisseur_cm = 1.5, diametre_mm = null, longueur_cm = null
where slug = 'volige-15x100-3m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'planche'),
  libelle_court = '2,5 × 20 · 4 m', dimensions = '2,5 × 20 cm, 4 m', note = null,
  epaisseur_cm = 2.5, diametre_mm = null, longueur_cm = null
where slug = 'planche-25x200-4m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'planche'),
  libelle_court = '3 × 20 · 4 m', dimensions = '3 × 20 cm, 4 m', note = null,
  epaisseur_cm = 3, diametre_mm = null, longueur_cm = null
where slug = 'planche-30x200-4m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'madrier'),
  libelle_court = '7,5 × 22,5 · 4 m', dimensions = '7,5 × 22,5 cm, 4 m', note = null,
  epaisseur_cm = 7.5, diametre_mm = null, longueur_cm = null
where slug = 'madrier-75x225-4m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'latte'),
  libelle_court = '2 × 4 · 3 m', dimensions = '2 × 4 cm, 3 m', note = null,
  epaisseur_cm = 2, diametre_mm = null, longueur_cm = null
where slug = 'latte-20x40-3m';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'contreplaque'),
  libelle_court = '5 mm', dimensions = '122 × 244 cm', note = null,
  epaisseur_cm = 0.5, diametre_mm = null, longueur_cm = null
where slug = 'contreplaque-5mm';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'contreplaque'),
  libelle_court = '10 mm', dimensions = '122 × 244 cm', note = null,
  epaisseur_cm = 1, diametre_mm = null, longueur_cm = null
where slug = 'contreplaque-10mm';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'contreplaque'),
  libelle_court = '18 mm', dimensions = '122 × 244 cm', note = null,
  epaisseur_cm = 1.8, diametre_mm = null, longueur_cm = null
where slug = 'contreplaque-18mm';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'beton-pret-emploi'),
  libelle_court = '250 kg/m³', dimensions = 'Dosage 250', note = null,
  epaisseur_cm = 250, diametre_mm = null, longueur_cm = null
where slug = 'beton-250';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'beton-pret-emploi'),
  libelle_court = '300 kg/m³', dimensions = 'Dosage 300', note = null,
  epaisseur_cm = 300, diametre_mm = null, longueur_cm = null
where slug = 'beton-300';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'beton-pret-emploi'),
  libelle_court = '350 kg/m³', dimensions = 'Dosage 350', note = 'le plus courant',
  epaisseur_cm = 350, diametre_mm = null, longueur_cm = null
where slug = 'beton-350';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'beton-pret-emploi'),
  libelle_court = '350 pompé', dimensions = 'Dosage 350, pompé', note = null,
  epaisseur_cm = 351, diametre_mm = null, longueur_cm = null
where slug = 'beton-350-pompe';
update public.materiaux_ref set
  type_id = (select id from public.types_materiaux where slug = 'beton-pret-emploi'),
  libelle_court = '400 kg/m³', dimensions = 'Dosage 400', note = null,
  epaisseur_cm = 400, diametre_mm = null, longueur_cm = null
where slug = 'beton-400';

-- Garde-fou : une reference sans type ne s'affiche nulle part dans la
-- navigation a trois niveaux. Mieux vaut que la migration hurle maintenant
-- qu'un materiau disparaisse silencieusement du catalogue.
do $$
declare v_orphelines integer;
begin
  select count(*) into v_orphelines from public.materiaux_ref where type_id is null and actif;
  if v_orphelines > 0 then
    raise exception 'Il reste % reference(s) active(s) sans type.', v_orphelines;
  end if;
end $$;
