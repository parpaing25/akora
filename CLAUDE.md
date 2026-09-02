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
