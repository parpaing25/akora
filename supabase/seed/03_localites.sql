-- ═══════════════════════════════════════════════════════════════════════════
-- Localites : 23 regions et les chefs-lieux
-- ═══════════════════════════════════════════════════════════════════════════
-- Les regions n'ont volontairement PAS de coordonnees : une region n'est pas
-- un point, et un centroide de region servirait de fausse adresse de chantier.
--
-- Les villes portent des coordonnees verifiees. Les communes et quartiers de
-- l'agglomeration d'Antananarivo ne sont PAS dans ce fichier : je n'ai pas de
-- coordonnees verifiees pour chacune, et la regle A2.8 interdit d'en inventer.
-- L'acheteur de Tana dispose de deux moyens exacts et immediats — « Ma
-- position » et le clic sur la carte — et l'ecran /admin/referentiels permet
-- d'ajouter une commune en la pointant sur la carte, une fois pour toutes.

insert into public.localites (nom, type, slug) values
  ('Analamanga','region','analamanga'),
  ('Vakinankaratra','region','vakinankaratra'),
  ('Itasy','region','itasy'),
  ('Bongolava','region','bongolava'),
  ('Haute Matsiatra','region','haute-matsiatra'),
  ('Amoron''i Mania','region','amoron-i-mania'),
  ('Vatovavy','region','vatovavy'),
  ('Fitovinany','region','fitovinany'),
  ('Atsimo-Atsinanana','region','atsimo-atsinanana'),
  ('Ihorombe','region','ihorombe'),
  ('Menabe','region','menabe'),
  ('Atsimo-Andrefana','region','atsimo-andrefana'),
  ('Androy','region','androy'),
  ('Anosy','region','anosy'),
  ('Melaky','region','melaky'),
  ('Boeny','region','boeny'),
  ('Betsiboka','region','betsiboka'),
  ('Sofia','region','sofia'),
  ('Alaotra-Mangoro','region','alaotra-mangoro'),
  ('Atsinanana','region','atsinanana'),
  ('Analanjirofo','region','analanjirofo'),
  ('Sava','region','sava'),
  ('Diana','region','diana')
on conflict (slug) do nothing;

with region as (select id, slug from public.localites where type = 'region')
insert into public.localites (nom, type, parent_id, lat, lng, slug)
select d.nom, 'commune'::public.type_localite, r.id,
       d.lat::double precision, d.lng::double precision, d.slug
from (values
  ('Antananarivo','analamanga',-18.8792,47.5079,'antananarivo'),
  ('Ankazobe','analamanga',-18.3167,47.1167,'ankazobe'),
  ('Anjozorobe','analamanga',-18.4000,47.8667,'anjozorobe'),
  ('Manjakandriana','analamanga',-18.9167,47.8000,'manjakandriana'),
  ('Andramasina','analamanga',-19.1667,47.6000,'andramasina'),
  ('Antsirabe','vakinankaratra',-19.8659,47.0333,'antsirabe'),
  ('Ambatolampy','vakinankaratra',-19.3833,47.4167,'ambatolampy'),
  ('Betafo','vakinankaratra',-19.8333,46.8500,'betafo'),
  ('Faratsiho','vakinankaratra',-19.4000,46.9500,'faratsiho'),
  ('Miarinarivo','itasy',-19.0000,46.7333,'miarinarivo'),
  ('Arivonimamo','itasy',-19.0167,47.1833,'arivonimamo'),
  ('Soavinandriana','itasy',-19.1667,46.7333,'soavinandriana'),
  ('Tsiroanomandidy','bongolava',-18.7713,46.0537,'tsiroanomandidy'),
  ('Fianarantsoa','haute-matsiatra',-21.4536,47.0854,'fianarantsoa'),
  ('Ambalavao','haute-matsiatra',-21.8333,46.9333,'ambalavao'),
  ('Ambositra','amoron-i-mania',-20.5300,47.2467,'ambositra'),
  ('Mananjary','vatovavy',-21.2167,48.3333,'mananjary'),
  ('Manakara','fitovinany',-22.1451,48.0115,'manakara'),
  ('Vohipeno','fitovinany',-22.3500,47.8333,'vohipeno'),
  ('Farafangana','atsimo-atsinanana',-22.8167,47.8333,'farafangana'),
  ('Vangaindrano','atsimo-atsinanana',-23.3500,47.6000,'vangaindrano'),
  ('Ihosy','ihorombe',-22.4028,46.1256,'ihosy'),
  ('Morondava','menabe',-20.2833,44.2833,'morondava'),
  ('Mahabo','menabe',-20.3833,44.6667,'mahabo'),
  ('Miandrivazo','menabe',-19.5167,45.4667,'miandrivazo'),
  ('Belo sur Tsiribihina','menabe',-19.7000,44.5500,'belo-sur-tsiribihina'),
  ('Toliara','atsimo-andrefana',-23.3500,43.6667,'toliara'),
  ('Sakaraha','atsimo-andrefana',-22.9000,44.5333,'sakaraha'),
  ('Betioky','atsimo-andrefana',-23.7167,44.3833,'betioky'),
  ('Ampanihy','atsimo-andrefana',-24.7000,44.7500,'ampanihy'),
  ('Morombe','atsimo-andrefana',-21.7500,43.3667,'morombe')
) as d(nom, region_slug, lat, lng, slug)
join region r on r.slug = d.region_slug
on conflict (slug) do update
  set lat = excluded.lat, lng = excluded.lng, parent_id = excluded.parent_id;

with region as (select id, slug from public.localites where type = 'region')
insert into public.localites (nom, type, parent_id, lat, lng, slug)
select d.nom, 'commune'::public.type_localite, r.id,
       d.lat::double precision, d.lng::double precision, d.slug
from (values
  ('Ambovombe','androy',-25.1728,46.0875,'ambovombe'),
  ('Taolagnaro','anosy',-25.0319,46.9855,'taolagnaro'),
  ('Betroka','anosy',-23.2667,46.1000,'betroka'),
  ('Maintirano','melaky',-18.0667,44.0167,'maintirano'),
  ('Mahajanga','boeny',-15.7167,46.3167,'mahajanga'),
  ('Marovoay','boeny',-16.1000,46.6333,'marovoay'),
  ('Maevatanana','betsiboka',-16.9500,46.8333,'maevatanana'),
  ('Antsohihy','sofia',-14.8667,47.9833,'antsohihy'),
  ('Boriziny','sofia',-15.5667,47.6167,'boriziny'),
  ('Mandritsara','sofia',-15.8333,48.8333,'mandritsara'),
  ('Ambatondrazaka','alaotra-mangoro',-17.8324,48.4116,'ambatondrazaka'),
  ('Moramanga','alaotra-mangoro',-18.9333,48.2000,'moramanga'),
  ('Amparafaravola','alaotra-mangoro',-17.5833,48.2167,'amparafaravola'),
  ('Toamasina','atsinanana',-18.1492,49.4023,'toamasina'),
  ('Brickaville','atsinanana',-18.8167,49.0667,'brickaville'),
  ('Vatomandry','atsinanana',-19.3333,48.9833,'vatomandry'),
  ('Mahanoro','atsinanana',-19.9000,48.8000,'mahanoro'),
  ('Fenoarivo Atsinanana','analanjirofo',-17.3833,49.4167,'fenoarivo-atsinanana'),
  ('Soanierana Ivongo','analanjirofo',-16.9167,49.5833,'soanierana-ivongo'),
  ('Mananara Nord','analanjirofo',-16.1667,49.7667,'mananara-nord'),
  ('Maroantsetra','analanjirofo',-15.4333,49.7333,'maroantsetra'),
  ('Sambava','sava',-14.2667,50.1667,'sambava'),
  ('Antalaha','sava',-14.9003,50.2788,'antalaha'),
  ('Iharana','sava',-13.3667,50.0000,'iharana'),
  ('Antsiranana','diana',-12.2787,49.2917,'antsiranana'),
  ('Ambanja','diana',-13.6786,48.4519,'ambanja'),
  ('Hell-Ville','diana',-13.4058,48.2606,'hell-ville')
) as d(nom, region_slug, lat, lng, slug)
join region r on r.slug = d.region_slug
on conflict (slug) do update
  set lat = excluded.lat, lng = excluded.lng, parent_id = excluded.parent_id;
