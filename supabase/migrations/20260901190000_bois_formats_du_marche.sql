-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — les sections de bois que les depots vendent VRAIMENT
-- ═══════════════════════════════════════════════════════════════════════════
-- Mesure du 01/09/2026, sur le tarif d'un seul depot (Fivarotan-kazo Mirary,
-- Ankadindramamy) : il annonce 13 formats, le catalogue pouvait en
-- representer UN.
--
--   madriers annonces : 10x6 / 15x7 / 17x7 en 4 m, 14x6 / 16x7 en 5 m
--   catalogue         : 7,5 x 22,5 . 4 m  — et rien d'autre
--
--   planches annoncees : 10x1,5 / 12x1,5 / 13-14x2 en 4 m
--   catalogue          : volige 1,5x10.3m, 2,5x20.4m, 3x20.4m
--
-- Resultat visible sur le site : « 1 produit » pour un depot qui en vend
-- treize. Ce n'etait ni un defaut de transfert ni un probleme d'appariement —
-- il n'existait aucune reference ou poser ces prix. Le catalogue est une
-- liste FERMEE (regle F11 : un fournisseur n'en cree aucune), donc c'est ici,
-- et seulement ici, que le manque se repare.
--
-- 🔒 RIEN N'EST INVENTE.
--   · les sections viennent des tarifs publies par les depots eux-memes ;
--   · le volume est calcule (epaisseur x largeur x longueur), pas estime ;
--   · le poids suit la densite deja EN PLACE dans la table pour le bois scie
--     — 650 kg/m3 (madrier 652, planches 650, chevron 651, latte 667) ;
--   · `ordre_format` reste ce qu'il est ailleurs : l'epaisseur en cm.
--
-- ⚠ CE QUI N'EST PAS AJOUTE ICI, ET POURQUOI.
--   · « bois carre 5*5, 6*6, 8*8 » : le meme depot facture son bois carre 8x8
--     a 12 000 Ar et son chevron 4 m a 8 000-10 000 Ar. Ce sont donc DEUX
--     produits distincts, et le catalogue n'a pas de type « bois carre ».
--     Creer un type touche la navigation du site : c'est une decision de
--     produit, pas une correction de donnee.
--   · « planche de rive = 30 000 ar » : aucune dimension annoncee. Une
--     reference sans section ne se compare a rien.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.materiaux_ref
  (categorie_id, type_id, nom, slug, libelle_court, dimensions,
   unite_defaut, poids_kg_unite_defaut, volume_m3_unite_defaut,
   attributs, ordre_format)
select c.id, t.id, v.nom, v.slug, v.libelle_court, v.dimensions,
       'piece'::public.unite, v.poids, v.volume,
       jsonb_build_object('longueur_m', v.longueur_m,
                          'epaisseur_cm', v.epaisseur_cm,
                          'largeur_cm', v.largeur_cm),
       v.ordre
  from (values
    -- ── Madriers ────────────────────────────────────────────────────────
    -- volume = e x l x L ; poids = volume x 650
    ('madrier', 'Madrier 6 x 10 cm, 4 m',  'madrier-60x100-4m',
     '6 × 10 · 4 m',  '6 × 10 cm, 4 m',  15.600, 0.02400, 4, 6.0, 10.0, 6.00),
    ('madrier', 'Madrier 7 x 15 cm, 4 m',  'madrier-70x150-4m',
     '7 × 15 · 4 m',  '7 × 15 cm, 4 m',  27.300, 0.04200, 4, 7.0, 15.0, 7.00),
    ('madrier', 'Madrier 7 x 17 cm, 4 m',  'madrier-70x170-4m',
     '7 × 17 · 4 m',  '7 × 17 cm, 4 m',  30.940, 0.04760, 4, 7.0, 17.0, 7.00),
    ('madrier', 'Madrier 6 x 14 cm, 5 m',  'madrier-60x140-5m',
     '6 × 14 · 5 m',  '6 × 14 cm, 5 m',  27.300, 0.04200, 5, 6.0, 14.0, 6.00),
    ('madrier', 'Madrier 7 x 15 cm, 5 m',  'madrier-70x150-5m',
     '7 × 15 · 5 m',  '7 × 15 cm, 5 m',  34.125, 0.05250, 5, 7.0, 15.0, 7.00),
    ('madrier', 'Madrier 7 x 16 cm, 5 m',  'madrier-70x160-5m',
     '7 × 16 · 5 m',  '7 × 16 cm, 5 m',  36.400, 0.05600, 5, 7.0, 16.0, 7.00),
    -- ── Planches de coffrage ────────────────────────────────────────────
    ('planche', 'Planche 1,5 x 10 cm, 4 m', 'planche-15x100-4m',
     '1,5 × 10 · 4 m', '1,5 × 10 cm, 4 m',  3.900, 0.00600, 4, 1.5, 10.0, 1.50),
    ('planche', 'Planche 1,5 x 12 cm, 4 m', 'planche-15x120-4m',
     '1,5 × 12 · 4 m', '1,5 × 12 cm, 4 m',  4.680, 0.00720, 4, 1.5, 12.0, 1.50),
    ('planche', 'Planche 2 x 14 cm, 4 m',   'planche-20x140-4m',
     '2 × 14 · 4 m',   '2 × 14 cm, 4 m',    7.280, 0.01120, 4, 2.0, 14.0, 2.00),
    -- ── Chevron 5 m ─────────────────────────────────────────────────────
    -- Le catalogue ne connaissait le chevron qu'en 4 m ; les depots le
    -- vendent aussi en 5 m, et a un autre prix (12 000 contre 9 000).
    ('chevron', 'Chevron 8 x 8 cm, 5 m',  'chevron-80x80-5m',
     '8 × 8 · 5 m',   'Section 8 × 8 cm, 5 m', 21.250, 0.03200, 5, 8.0, 8.0, 8.00)
  ) as v(type_slug, nom, slug, libelle_court, dimensions,
         poids, volume, longueur_m, epaisseur_cm, largeur_cm, ordre)
  join public.types_materiaux t on t.slug = v.type_slug
  join public.categories c on c.id = t.categorie_id
on conflict (slug) do nothing;

comment on table public.materiaux_ref is
  'Catalogue FERME des materiaux. Un depot y choisit, il n''y ajoute jamais. Toute reference manquante remonte par le bot (materiaux_absents) et s''ajoute ici, avec ses dimensions reelles et son volume calcule.';
