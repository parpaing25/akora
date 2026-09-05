-- Ambadimbahoaka (quartier d'Antananarivo, vu par la collecte — fournisseur
-- « El Ÿãn »). Nominatim/OSM ne le connaît sous aucune graphie essayée le
-- 01/09/2026 (Ambadimbahoaka, Ambodimbahoaka). Règle A2.3 : AUCUNE
-- coordonnée inventée — la ligne est posée SANS lat/lng. Le rattachement par
-- nom fonctionne (observatoire, fiches) ; le site demandera de pointer sur
-- la carte, et la coordonnée se posera à la revendication ou à la main.
insert into public.localites (nom, type, parent_id, lat, lng, slug)
select 'Ambadimbahoaka', 'quartier', l.id, null, null, 'ambadimbahoaka'
from public.localites l
where l.slug = 'antananarivo' and l.type = 'commune'
  and not exists (select 1 from public.localites x where x.slug = 'ambadimbahoaka');
