-- ═══════════════════════════════════════════════════════════════════════════
-- Ratios des calculateurs de metre
-- ═══════════════════════════════════════════════════════════════════════════
-- Aucun de ces nombres n'est code en dur dans l'application (spec B11) :
-- l'admin les modifie ici, et les calculateurs suivent. Ce sont des ratios
-- courants du batiment ; ils s'ajustent selon la mise en œuvre reelle.

insert into public.ratios_metre (calculateur, cle, valeur, unite, libelle, note) values
  -- ── Mur en parpaings, par metre carre de mur ────────────────────────────
  ('mur_parpaing','blocs_par_m2',12.5,'piece/m2','Blocs 40 x 20 par metre carre',
   'Un bloc de 40 x 20 couvre 0,08 m2 hors joints.'),
  ('mur_parpaing','mortier_m3_par_m2',0.020,'m3/m2','Mortier de pose par metre carre',
   'Joints de 1,5 cm sur un mur de 15 cm.'),

  -- ── Mortier et beton : composition au metre cube ────────────────────────
  ('mortier','ciment_kg_par_m3',350,'kg/m3','Ciment par metre cube de mortier','Dosage courant de pose.'),
  ('mortier','sable_m3_par_m3',1.10,'m3/m3','Sable par metre cube de mortier',
   'Le sable foisonne : il en faut plus d''un metre cube pour un metre cube de mortier.'),
  ('beton_350','ciment_kg_par_m3',350,'kg/m3','Ciment par metre cube de beton','Dosage 350, usage courant en elevation.'),
  ('beton_350','sable_m3_par_m3',0.40,'m3/m3','Sable par metre cube de beton',null),
  ('beton_350','gravillon_m3_par_m3',0.80,'m3/m3','Gravillon par metre cube de beton',null),
  ('beton_350','eau_l_par_m3',175,'l/m3','Eau par metre cube de beton','Rapport eau sur ciment de 0,50.'),

  -- ── Dalle en hourdis, par metre carre de plancher ───────────────────────
  ('dalle_hourdis','poutrelles_ml_par_m2',1.67,'ml/m2','Poutrelles par metre carre','Entraxe de 60 cm.'),
  ('dalle_hourdis','hourdis_par_m2',8.33,'piece/m2','Hourdis par metre carre','Hourdis de 60 x 20 entre poutrelles.'),
  ('dalle_hourdis','table_compression_m3_par_m2',0.04,'m3/m2','Beton de la table de compression','Epaisseur de 4 cm.'),
  ('dalle_hourdis','treillis_m2_par_m2',1.05,'m2/m2','Treillis soude par metre carre','Recouvrement de 5 %.'),

  -- ── Chape et enduit, par metre carre ────────────────────────────────────
  ('chape_enduit','enduit_ep_cm',1.5,'cm','Epaisseur d''enduit par defaut',null),
  ('chape_enduit','chape_ep_cm',5.0,'cm','Epaisseur de chape par defaut',null),
  ('chape_enduit','ciment_kg_par_m3',300,'kg/m3','Ciment par metre cube de mortier d''enduit','Dosage 300.'),
  ('chape_enduit','sable_m3_par_m3',1.10,'m3/m3','Sable par metre cube de mortier d''enduit',null),

  -- ── Toiture en toles, par metre carre de couverture ─────────────────────
  ('toiture_tole','tole_2m_par_m2',0.70,'piece/m2','Toles de 2 m par metre carre',
   'Largeur utile de 0,80 m, recouvrements compris.'),
  ('toiture_tole','tole_3m_par_m2',0.47,'piece/m2','Toles de 3 m par metre carre','Largeur utile de 0,80 m.'),
  ('toiture_tole','chevrons_ml_par_m2',1.67,'ml/m2','Chevrons par metre carre','Entraxe de 60 cm.'),
  ('toiture_tole','pannes_ml_par_m2',0.83,'ml/m2','Pannes par metre carre','Entraxe de 1,20 m.'),
  ('toiture_tole','faitiere_ml_par_ml',1.05,'ml/ml','Faitieres par metre lineaire de faitage','Recouvrement de 5 %.'),

  -- ── Marge de securite commune ───────────────────────────────────────────
  ('general','marge_defaut_pct',5,'%','Marge de securite par defaut',
   'Chutes, casse et pertes. Reglable par l''utilisateur sur chaque calcul.')
on conflict (calculateur, cle) do update
  set valeur = excluded.valeur, unite = excluded.unite,
      libelle = excluded.libelle, note = excluded.note;
