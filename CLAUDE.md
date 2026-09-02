# AKORA — règles de travail

Complète `~\.claude\CLAUDE.md` (méthode générale). AKORA est la marketplace de matériaux de
construction : `akora.fonenako.mg`, accueil = fil, écrite **à la main** (Lovable abandonné).
Un bot de prospection (`bot-fournisseurs`, port **8758**) remplit les fiches fournisseurs.

⚠️ **Ne pas confondre son bot avec les deux autres bots de collecte** : Fonenako 8756 (annonces
immobilières) et Diako 8757 (établissements de voyage). Trois bots qui se ressemblent, trois
bases différentes.

⚠️ **Deux sessions Claude sur le même dépôt = commits mélangés.** `git add` par chemins
explicites, jamais `git add -A`.

## Le détail

**11 règles** de plus, remontées des fiches mémoire, dans `REGLES-DETAIL.md` (même dossier). Elles ne sont pas chargées automatiquement : les ouvrir quand le sujet les concerne — le routeur les signale.

## Ajouts en cours de route — à ranger

*Écrites au fil des sessions. À replier dans les sections thématiques lors de la prochaine consolidation.*

- 🔴 **Un MAUVAIS APPARIEMENT est une troisieme classe de defaut, invisible aux deux controles existants : le prix figure bien dans son libelle (prix_orphelins ne voit rien) et aucun motif hors-perimetre ne matche (hors_perimetre non plus). Ne jamais alimenter l observatoire PUBLIC sans un controle de vraisemblance par materiau, ou en se limitant aux appariements confirmes a la main dans l atelier** *(01/09/2026)*
  *01/09/2026 : « Epaisseur bois 1, 4 cm misy bordure eo aloha prix 120.000 ar » — une planche de bois — est entree dans releves_prix comme « Bordure de trottoir P1, 120 000 Ar/ml », publie sous le nom d Akora. Deux autres offres accrochees au meme mot : une table carree et un appartement a louer a Yaounde. C est l incident du televiseur en bordure T2 du 24/08, toujours vivant : le mot du catalogue attrape du mobilier et de l immobilier*
