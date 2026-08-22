-- Les 8 familles de gros œuvre. Ni plus, ni moins (spec B3).
-- Le perimetre n'est pas garde par un controle de formulaire : il est garde
-- par cette liste, puisque le catalogue est ferme.
insert into public.categories (slug, nom, nom_mg, icone, ordre) values
  ('agglomeres',  'Agglomérés et préfabriqués béton', 'Biriky simenitra',  'blocks',   1),
  ('briques',     'Briques',                          'Biriky',            'brick',    2),
  ('granulats',   'Granulats',                        'Fasika sy vato',    'mountain', 3),
  ('liants',      'Liants',                           'Simenitra sy sokay','package',  4),
  ('bois',        'Bois',                             'Hazo',              'tree',     5),
  ('couverture',  'Couverture',                       'Tafo',              'home',     6),
  ('acier',       'Acier de construction',            'Vy fanamboarana',   'grid',     7),
  ('beton-pret',  'Béton prêt à l''emploi',           'Simenitra vonona',  'truck',    8)
on conflict (slug) do update
  set nom = excluded.nom,
      nom_mg = excluded.nom_mg,
      icone = excluded.icone,
      ordre = excluded.ordre;
