-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — la volige n'est pas une planche, et le bois carré existe
-- ═══════════════════════════════════════════════════════════════════════════
-- Deux corrections du catalogue, toutes deux venues du terrain.
--
-- 1. LE TYPE « planche » S'APPELAIT « Planche et volige ».
--    Une volige (1,5 × 10 cm, 3 m) se cloue sous les tuiles ; une planche de
--    coffrage (2 × 14 cm, 4 m) coffre une dalle. Ni le même métier, ni le même
--    prix, ni le même acheteur — mais un seul type, donc un seul comparateur,
--    donc des prix mis en face les uns des autres sans raison.
--
-- 2. LE BOIS CARRÉ N'EXISTAIT PAS.
--    Fivarotan-kazo Mirary annonce « #BOIS CARRE 4m : 5*5 = 5 000ar, 6*6 =
--    8 000ar, 8*8 = 12 000ar » — et facture son chevron 4 m 8 000 à 10 000 Ar.
--    Le bois carré 8×8 à 12 000 Ar et le chevron à 9 000 Ar sont donc DEUX
--    produits chez le même dépôt : les confondre aurait publié un prix pour
--    l'autre. Ces lignes tombaient jusqu'ici dans « Bois rond et bambou »,
--    faute de mieux.
--
-- 🔒 Le poids suit la densité DÉJÀ en place pour le bois scié — 650 kg/m³
--    (madrier 650, planches 653, chevron 660). Le volume est calculé, pas
--    estimé. Les sections viennent du tarif du dépôt.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La volige prend son propre type ───────────────────────────────────
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Volige', 'Volige', 'volige',
       array['volige', 'hazo', 'tafo']::text[],
       coalesce((select max(t.ordre) from public.types_materiaux t
                  where t.categorie_id = c.id), 0) + 1
  from public.categories c where c.slug = 'bois'
on conflict (slug) do nothing;

update public.materiaux_ref m
   set type_id = (select id from public.types_materiaux where slug = 'volige')
 where m.slug like 'volige-%';

-- Le type qui reste ne parle plus que de coffrage, et ne revendique plus
-- « volige » comme synonyme : c'est ce mot qui attirait les voliges ici.
update public.types_materiaux
   set nom = 'Planche de coffrage',
       synonymes = array['planche', 'hazo', 'coffrage']::text[]
 where slug = 'planche';

-- ── 2. Le bois carré ─────────────────────────────────────────────────────
insert into public.types_materiaux (categorie_id, nom, nom_mg, slug, synonymes, ordre)
select c.id, 'Bois carré', 'Hazo efa-joro', 'bois-carre',
       array['bois carre', 'bois carré', 'hazo efajoro', 'carre']::text[],
       coalesce((select max(t.ordre) from public.types_materiaux t
                  where t.categorie_id = c.id), 0) + 1
  from public.categories c where c.slug = 'bois'
on conflict (slug) do nothing;

insert into public.materiaux_ref
  (categorie_id, type_id, nom, slug, libelle_court, dimensions,
   unite_defaut, poids_kg_unite_defaut, volume_m3_unite_defaut,
   attributs, ordre_format)
select c.id, t.id, v.nom, v.slug, v.libelle_court, v.dimensions,
       'piece'::public.unite, v.poids, v.volume,
       jsonb_build_object('longueur_m', 4,
                          'epaisseur_cm', v.cote, 'largeur_cm', v.cote),
       v.cote
  from (values
    ('Bois carré 5 x 5 cm, 4 m', 'bois-carre-50x50-4m',
     '5 × 5 · 4 m', '5 × 5 cm, 4 m',  6.500, 0.01000, 5.0),
    ('Bois carré 6 x 6 cm, 4 m', 'bois-carre-60x60-4m',
     '6 × 6 · 4 m', '6 × 6 cm, 4 m',  9.360, 0.01440, 6.0),
    ('Bois carré 8 x 8 cm, 4 m', 'bois-carre-80x80-4m',
     '8 × 8 · 4 m', '8 × 8 cm, 4 m', 16.640, 0.02560, 8.0)
  ) as v(nom, slug, libelle_court, dimensions, poids, volume, cote)
  join public.types_materiaux t on t.slug = 'bois-carre'
  join public.categories c on c.id = t.categorie_id
on conflict (slug) do nothing;
