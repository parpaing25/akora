# AKORA — règles de travail

Complète `~\.claude\CLAUDE.md` (méthode générale). AKORA est la marketplace de matériaux de
construction : `akora.fonenako.mg`, accueil = fil, écrite **à la main** (Lovable abandonné).
Un bot de prospection (`bot-fournisseurs`, port **8758**) remplit les fiches fournisseurs.

⚠️ **Ne pas confondre son bot avec les deux autres bots de collecte** : Fonenako 8756 (annonces
immobilières) et Diako 8757 (établissements de voyage). Trois bots qui se ressemblent, trois
bases différentes.

⚠️ **Deux sessions Claude sur le même dépôt = commits mélangés.** `git add` par chemins
explicites, jamais `git add -A`.

## Observatoire des prix — ce qui ne doit jamais devenir public

🔴 **Un MAUVAIS APPARIEMENT est une troisième classe de défaut**, invisible aux deux contrôles
existants : le prix figure bien dans son libellé (`prix_orphelins` ne voit rien) et aucun motif
hors-périmètre ne matche (`hors_perimetre` non plus). **Ne jamais alimenter l'observatoire PUBLIC
sans un contrôle de vraisemblance par matériau**, ou en se limitant aux appariements confirmés à
la main dans l'atelier.
*01/09/2026 : « Epaisseur bois 1,4 cm misy bordure eo aloha prix 120.000 ar » — une planche — est
entrée dans `releves_prix` comme « Bordure de trottoir P1, 120 000 Ar/ml », publiée sous le nom
d'Akora. Même mot, même piège : une table carrée, un appartement à Yaoundé, et le téléviseur en
bordure T2 du 24/08.* Essai déjà raté, ne pas refaire : alimenter `releves_prix` avec les seuls
garde-fous `prix_orphelins` + `hors_perimetre`.

## Le détail

**11 règles** de plus, remontées des fiches mémoire, dans `REGLES-DETAIL.md` (même dossier). Elles ne sont pas chargées automatiquement : les ouvrir quand le sujet les concerne — le routeur les signale.

## Ajouts en cours de route — à ranger

*Écrites au fil des sessions. À replier dans les sections thématiques lors de la prochaine consolidation.*

- 🟠 **Une reference de catalogue ne nait que pour un type dont la GRAMMAIRE est ecrite (blocs, fer, gravillon par calibre, buse, contreplaque, pave, beton, tole ; section = bois scie seulement) et dans ses bornes. Le garde-fou se pose dans l extraction ET dans reference_a_creer, pas seulement chez l appelant** *(03/09/2026)*
  *03/09/2026 0 h 08, premiere tournee apres la remise a zero : « 2/ Gravillon : 560 000 Ar 8m3 livre » est devenu « Gravillon et cailloux 2 x 3 cm, 8 m » dans materiaux_ref (la lecture de section marchait, la densite du gravillon etait constante, rien ne disait qu un gravillon n a pas de section). Efface du site, collecte relancee*
- 🟠 **Un type reconnu par un MOT PARTAGE (« brique » = creuse, pleine ou BTC ; « biriky », « vato ») ne cree jamais de reference au catalogue : la cote peut etre juste et le type faux. Et les synonymes se lisent au pluriel (« BTCs », « bacs »)** *(03/09/2026)*
  *03/09/2026 0 h 12 : « Prix unitaire brique BTCs 30*15*10cm reste 1400 Ar » a fait naitre « Brique creuse 10 x 15 x 30 cm » dans materiaux_ref — « BTCs » non lu (pluriel), « brique » retombant sur la premiere de sa famille. Efface du site, cache resynchronise, `type_sur` exige dans creer_les_references*
- 🔴 **Un motif de montant glouton traverse l espace et mange le chiffre d avant : compter les milliers par blocs de TROIS chiffres et refuser un montant qui demarre juste apres un x. Et le prix, son libelle, son unite et sa publication se rafraichissent ENSEMBLE — jamais le prix seul** *(03/09/2026)*
  *03/09/2026, premiere vraie tournee : « Parpaing 20x20x40 : 3 400 Ariary » range en parpaing creux 10 (le motif partait du 40 de la cote et emportait « 40 3 400 ariary », la cote disparaissait) ; et 14 offres sur 245 portaient un montant absent de leur propre libelle parce qu un repost ne mettait a jour que la colonne prix — « Hourdis 12x33x33 : 2500ar » portant 2 800*
- 🔴 **Une unite HERITEE du catalogue n est pas une unite : pour entrer dans l observatoire PUBLIC, le vendeur doit l avoir ECRITE dans sa ligne, et elle doit correspondre a la reference. Et le garde de vraisemblance prend sa mediane dans le LOT pousse, pas seulement dans ce qui est deja en ligne** *(03/09/2026)*
  *03/09/2026, constate sur akora.fonenako.mg : le catalogue vend le moellon au m3, les depots a la piece (250-800 Ar) ; six lignes « moellon : 400ar » sans unite ecrite ont herite du m3 et sont parties en public a 400 Ar le m3, facteur 200 sous le prix reel. Et juste apres la purge, table vide, le garde de vraisemblance n avait rien a opposer : trois parpaings a 300, 350 et 400 Ar sont entres alors que le passage a blanc les avait signales une minute plus tot*
