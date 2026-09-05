-- ═══════════════════════════════════════════════════════════════════════════
-- QUARTIERS VUS PAR LA COLLECTE, ABSENTS DU RÉFÉRENTIEL — 01/09/2026.
--
-- 4 fournisseurs en ligne sur 10 étaient SANS position : leurs quartiers
-- (Ankadindramamy, Analamahitsy…) n'existaient pas dans `localites`, donc
-- aucun prix rendu chantier n'était calculable pour eux — la promesse
-- centrale du site tombait. Le bot reprend la coordonnée de la localité à la
-- synchronisation suivante : poser ces lignes répare les fiches en aval.
--
-- Coordonnées relevées le 01/09/2026 sur Nominatim (OpenStreetMap), jamais
-- inventées (règle A2.3/A2.8). Chaque ligne porte sa source. Deux choix
-- assumés, notés sur les lignes : Ampangabe (l'homonyme commune existe dans
-- le district d'Ambohidratrimo — on pose le quartier d'Antananarivo, la
-- ville déclarée par les vendeurs) et Ilafy (administrativement dans le
-- district d'Avaradrano ; rattaché ici à la commune d'Antananarivo, comme
-- les vendeurs le déclarent).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  tana uuid;
  analamanga uuid;
begin
  select id into tana from public.localites where slug = 'antananarivo' and type = 'commune';
  select id into analamanga from public.localites where slug = 'analamanga' and type = 'region';
  if tana is null or analamanga is null then
    raise exception 'Référentiel localites inattendu : antananarivo ou analamanga introuvable.';
  end if;

  -- type quartier, parent = commune d'Antananarivo ------------------------
  insert into public.localites (nom, type, parent_id, lat, lng, slug)
  select v.nom, 'quartier', tana, v.lat, v.lng, v.slug
  from (values
    -- OSM suburb « Ambatoroka, Antananarivo »
    ('Ambatoroka',     -18.92388, 47.54186, 'ambatoroka'),
    -- OSM suburb « Ambodihady, Antananarivo »
    ('Ambodihady',     -18.87374, 47.48688, 'ambodihady'),
    -- OSM suburb « Ampahibe, Antananarivo »
    ('Ampahibe',       -18.90924, 47.53841, 'ampahibe'),
    -- OSM suburb « Ampangabe, Antananarivo » (≠ commune d'Ambohidratrimo)
    ('Ampangabe',      -18.92620, 47.49967, 'ampangabe'),
    -- OSM suburb « Analamahitsy Tanàna, Antananarivo »
    ('Analamahitsy',   -18.87647, 47.54689, 'analamahitsy'),
    -- OSM quarter « Ankadindramamy, Ambohidahy, Antananarivo »
    ('Ankadindramamy', -18.89196, 47.55906, 'ankadindramamy'),
    -- OSM suburb « Ilafy, district d'Antananarivo Avaradrano »
    ('Ilafy',          -18.85326, 47.56219, 'ilafy')
  ) as v(nom, lat, lng, slug)
  where not exists (select 1 from public.localites l where l.slug = v.slug);

  -- type commune, parent = région Analamanga ------------------------------
  -- OSM administrative « Mahitsy, District d'Ambohidratrimo » (RN4)
  insert into public.localites (nom, type, parent_id, lat, lng, slug)
  select 'Mahitsy', 'commune', analamanga, -18.74824, 47.34532, 'mahitsy'
  where not exists (select 1 from public.localites l where l.slug = 'mahitsy');
end $$;
