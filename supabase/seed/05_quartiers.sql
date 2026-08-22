-- ═══════════════════════════════════════════════════════════════════════════
-- Quartiers et communes de l'agglomeration : coordonnees VERIFIEES
-- ═══════════════════════════════════════════════════════════════════════════
-- Provenance : src/data/madagascar-coords.ts de FONENAKO, en production.
-- Ce jeu n'a pas ete estime : il vient d'un rapprochement de trois releves
-- geographiques independants par ville, ou un quartier n'est retenu QUE si au
-- moins deux d'entre eux concordent a moins de 3,5 km ET tombent dans le rayon
-- de la ville. C'est la meme donnee qui place les annonces sur la carte de
-- Fonenako depuis des mois.
--
-- C'est donc bien une source verifiee, et non une coordonnee inventee : la
-- regle A2.8 est respectee. Precision assumee : « bon quartier », pas « bonne
-- parcelle ». Pour la livraison, l'acheteur garde deux moyens EXACTS — « Ma
-- position » et le clic sur la carte — et le quartier sert de repli lisible.
--
-- 106 quartiers, 13 villes.

with commune as (select id, slug from public.localites where type = 'commune')
insert into public.localites (nom, type, parent_id, lat, lng, slug)
select d.nom, 'quartier'::public.type_localite, c.id,
       d.lat::double precision, d.lng::double precision, d.slug
from (values
  ('Analakely','antananarivo',-18.9082,47.52543,'antananarivo-analakely'),
  ('Andravoahangy','antananarivo',-18.89907,47.53283,'antananarivo-andravoahangy'),
  ('Ankorondrano','antananarivo',-18.87997,47.52157,'antananarivo-ankorondrano'),
  ('Tsaralalana','antananarivo',-18.90593,47.5218,'antananarivo-tsaralalana'),
  ('Ambohijatovo','antananarivo',-18.9131,47.52673,'antananarivo-ambohijatovo'),
  ('Behoririka','antananarivo',-18.90173,47.52717,'antananarivo-behoririka'),
  ('Ambohimanarina','antananarivo',-18.86437,47.5061,'antananarivo-ambohimanarina'),
  ('Andohalo','antananarivo',-18.92077,47.5299,'antananarivo-andohalo'),
  ('Mahamasina','antananarivo',-18.91807,47.52393,'antananarivo-mahamasina'),
  ('Ambanidia','antananarivo',-18.92287,47.53473,'antananarivo-ambanidia'),
  ('67 ha','antananarivo',-18.90147,47.5095,'antananarivo-67-ha'),
  ('Ankadifotsy','antananarivo',-18.89767,47.52743,'antananarivo-ankadifotsy'),
  ('Ivandry','antananarivo',-18.86877,47.52797,'antananarivo-ivandry'),
  ('Ambatobe','antananarivo',-18.8762,47.55057,'antananarivo-ambatobe'),
  ('Ambohitrarahaba','antananarivo',-18.84623,47.53947,'antananarivo-ambohitrarahaba'),
  ('Ambohimangakely','antananarivo',-18.90927,47.59727,'antananarivo-ambohimangakely'),
  ('Ambohidratrimo','antananarivo',-18.80933,47.43697,'antananarivo-ambohidratrimo'),
  ('Ambohijanaka','antananarivo',-19.00323,47.5397,'antananarivo-ambohijanaka'),
  ('Ambohitrimanjaka','antananarivo',-18.85513,47.43897,'antananarivo-ambohitrimanjaka'),
  ('Anosy','antananarivo',-18.9163,47.52103,'antananarivo-anosy'),
  ('Anosivavaka','antananarivo',-18.87043,47.5101,'antananarivo-anosivavaka'),
  ('Antehiroka','antananarivo',-18.8301,47.48073,'antananarivo-antehiroka'),
  ('Tanjombato','antananarivo',-18.95387,47.523,'antananarivo-tanjombato'),
  ('Talatamaty','antananarivo',-18.8373,47.47237,'antananarivo-talatamaty'),
  ('Ambohimanambola','antananarivo',-18.93603,47.58877,'antananarivo-ambohimanambola'),
  ('Ampefiloha','antananarivo',-18.90957,47.51497,'antananarivo-ampefiloha'),
  ('Ambohipo','antananarivo',-18.92597,47.5451,'antananarivo-ambohipo'),
  ('Ambatonakanga','antananarivo',-18.91097,47.52663,'antananarivo-ambatonakanga'),
  ('Isotry','antananarivo',-18.90717,47.5163,'antananarivo-isotry'),
  ('Andavamamba','antananarivo',-18.91493,47.51103,'antananarivo-andavamamba'),
  ('Soavimasoandro','antananarivo',-18.87473,47.53853,'antananarivo-soavimasoandro'),
  ('Ankasina','antananarivo',-18.89437,47.52163,'antananarivo-ankasina'),
  ('Antanimena','antananarivo',-18.8973,47.52087,'antananarivo-antanimena'),
  ('Antsahavola','antananarivo',-18.9106,47.52197,'antananarivo-antsahavola'),
  ('Faravohitra','antananarivo',-18.90647,47.53007,'antananarivo-faravohitra'),
  ('Isoraka','antananarivo',-18.91267,47.52187,'antananarivo-isoraka'),
  ('Avaradoha','antananarivo',-18.90273,47.54243,'antananarivo-avaradoha'),
  ('Ambohimiandra','antananarivo',-18.9286,47.5372,'antananarivo-ambohimiandra'),
  ('Andoharanofotsy','antananarivo',-18.9769,47.5307,'antananarivo-andoharanofotsy'),
  ('Anosibe','antananarivo',-18.92387,47.51207,'antananarivo-anosibe'),
  ('Itaosy','antananarivo',-18.92113,47.47783,'antananarivo-itaosy'),
  ('Bemasoandro','antananarivo',-18.91297,47.48213,'antananarivo-bemasoandro'),
  ('Sabotsy Namehana','antananarivo',-18.82977,47.54303,'antananarivo-sabotsy-namehana'),
  ('Andranonahoatra','antananarivo',-18.91703,47.47757,'antananarivo-andranonahoatra'),
  ('Tanambao','toamasina',-18.15183,49.39683,'toamasina-tanambao'),
  ('Morafeno','toamasina',-18.1475,49.3865,'toamasina-morafeno'),
  ('Bazaribe','toamasina',-18.14727,49.4105,'toamasina-bazaribe'),
  ('Anjoma','toamasina',-18.1509,49.40727,'toamasina-anjoma'),
  ('Morarano','toamasina',-18.14925,49.38575,'toamasina-morarano'),
  ('Tanamakoa','toamasina',-18.14107,49.403,'toamasina-tanamakoa'),
  ('Mangarivotra','toamasina',-18.15673,49.40617,'toamasina-mangarivotra'),
  ('Antsenakely','antsirabe',-19.868,47.03233,'antsirabe-antsenakely'),
  ('Sabotsy','antsirabe',-19.86333,47.04033,'antsirabe-sabotsy'),
  ('Manandona','antsirabe',-19.99833,47.03667,'antsirabe-manandona'),
  ('Ambohimena','antsirabe',-19.84667,47.03133,'antsirabe-ambohimena'),
  ('Andranomanelatra','antsirabe',-19.7832,47.1,'antsirabe-andranomanelatra'),
  ('Tsianolondroa','fianarantsoa',-21.44593,47.08527,'fianarantsoa-tsianolondroa'),
  ('Andrainjato','fianarantsoa',-21.46307,47.09917,'fianarantsoa-andrainjato'),
  ('Ambalakely','fianarantsoa',-21.4333,46.95557,'fianarantsoa-ambalakely'),
  ('Abattoir','mahajanga',-15.727,46.3205,'mahajanga-abattoir'),
  ('Amborovy','mahajanga',-15.66233,46.349,'mahajanga-amborovy'),
  ('Aranta','mahajanga',-15.71567,46.31433,'mahajanga-aranta'),
  ('Mangarivotra','mahajanga',-15.717,46.31667,'mahajanga-mangarivotra'),
  ('Tsararano','mahajanga',-15.71767,46.33967,'mahajanga-tsararano'),
  ('Mahabibo','mahajanga',-15.71667,46.32533,'mahajanga-mahabibo'),
  ('Antanimasaja','mahajanga',-15.70967,46.33733,'mahajanga-antanimasaja'),
  ('Ambondrona','mahajanga',-15.703,46.34033,'mahajanga-ambondrona'),
  ('Mahavoky','mahajanga',-15.72,46.32833,'mahajanga-mahavoky'),
  ('Tanambao','toliara',-23.345,43.671,'toliara-tanambao'),
  ('Mahavatse','toliara',-23.361,43.66233,'toliara-mahavatse'),
  ('Anketa','toliara',-23.361,43.67033,'toliara-anketa'),
  ('Tsimenatse','toliara',-23.352,43.66133,'toliara-tsimenatse'),
  ('Betania','toliara',-23.36667,43.662,'toliara-betania'),
  ('Andaboly','toliara',-23.344,43.673,'toliara-andaboly'),
  ('Sanfily','toliara',-23.34367,43.67233,'toliara-sanfily'),
  ('Andranomena','toliara',-23.344,43.682,'toliara-andranomena'),
  ('Besakoa','toliara',-23.34067,43.66533,'toliara-besakoa'),
  ('Miary','toliara',-23.30667,43.71733,'toliara-miary'),
  ('Tanambao V','antsiranana',-12.283,49.28567,'antsiranana-tanambao-v'),
  ('Lazaret','antsiranana',-12.29633,49.28433,'antsiranana-lazaret'),
  ('Antsiranana I','antsiranana',-12.2765,49.2916,'antsiranana-antsiranana-i'),
  ('Morafeno','antsiranana',-12.2905,49.285,'antsiranana-morafeno'),
  ('Tanambao','antsiranana',-12.283,49.28767,'antsiranana-tanambao'),
  ('Scama','antsiranana',-12.30433,49.28467,'antsiranana-scama'),
  ('Arrachart','antsiranana',-12.34933,49.2917,'antsiranana-arrachart'),
  ('Andrakaka','antsiranana',-12.255,49.25,'antsiranana-andrakaka'),
  ('Ampitatsimo','ambatondrazaka',-17.88057,48.3989,'ambatondrazaka-ampitatsimo'),
  ('Ambohitsilaozana','ambatondrazaka',-17.7333,48.45,'ambatondrazaka-ambohitsilaozana'),
  ('Tanambao','morondava',-20.287,44.287,'morondava-tanambao'),
  ('Betania','morondava',-20.30623,44.281,'morondava-betania'),
  ('Nosy Kely','morondava',-20.29517,44.27667,'morondava-nosy-kely'),
  ('Bemanonga','morondava',-20.2667,44.35557,'morondava-bemanonga'),
  ('Hell-Ville (Andoany)','hell-ville',-13.4054,48.27187,'hell-ville-hell-ville-andoany'),
  ('Ambatoloaka','hell-ville',-13.40977,48.2218,'hell-ville-ambatoloaka'),
  ('Madirokely','hell-ville',-13.4046,48.22033,'hell-ville-madirokely'),
  ('Dzamandzar','hell-ville',-13.35007,48.1924,'hell-ville-dzamandzar'),
  ('Ambondrona','hell-ville',-13.32017,48.19333,'hell-ville-ambondrona'),
  ('Ambatozavavy','hell-ville',-13.37917,48.31757,'hell-ville-ambatozavavy'),
  ('Marodoka','hell-ville',-13.39667,48.298,'hell-ville-marodoka'),
  ('Ankify','hell-ville',-13.4855,48.34,'hell-ville-ankify'),
  ('Tanambao','manakara',-22.147,48.00733,'manakara-tanambao'),
  ('Tanambao','taolagnaro',-25.02767,46.9935,'taolagnaro-tanambao'),
  ('Libanona','taolagnaro',-25.03883,46.99583,'taolagnaro-libanona'),
  ('Bazaribe','taolagnaro',-25.03133,46.99033,'taolagnaro-bazaribe'),
  ('Ambinanibe','taolagnaro',-25.056,46.94267,'taolagnaro-ambinanibe'),
  ('Antsirabato','antalaha',-14.99667,50.31767,'antalaha-antsirabato')
) as d(nom, commune_slug, lat, lng, slug)
join commune c on c.slug = d.commune_slug
on conflict (slug) do update
  set lat = excluded.lat, lng = excluded.lng, parent_id = excluded.parent_id;
