# AKORA — règles de détail

*Sorti du `CLAUDE.md` le 30/08/2026 : celui-ci est chargé en entier à chaque session, ce fichier-ci ne s'ouvre que quand le sujet le concerne. Le `CLAUDE.md` garde ce qui bloque, ce fichier porte le détail.*

## Règles remontées des fiches mémoire (30/08/2026)

*Ces 11 règles ne vivaient que dans les fiches mémoire : elles ne s'appliquaient donc que si on pensait à ouvrir la fiche. Reprises telles qu'elles y figurent, **sans avoir été recontrôlées à la source** — chacune porte sa fiche d'origine.*

- **Un garde-fou annonce en commentaire n'est pas un garde-fou : verifier qu'il est reellement lu par le code.**
  *`pousser_les_fiches` dans config.py etait un drapeau JAMAIS LU : le bot poussait des fiches alors que la config annoncait le contraire. On se croit protege, donc on ne verifie pas — c'est le meme mecanisme que le verrou qui ne verrouille rien.*
  `akora-bot-prospection-fournisseurs`
- **Journaliser le CORPS de la reponse HTTP, pas seulement le code.**
  *« HTTP 400 (application/json) » a cache la vraie cause (o2upload.php refusait le dossier `prospects`) : on a d'abord accuse la cle o2switch et cherche du mauvais cote. La cause exacte etait dans le corps, que le bot ne montrait pas.*
  `akora-bot-prospection-fournisseurs`
- **Corriger un algorithme d'appariement ou de classement ne repare PAS les lignes deja ecrites : prevoir et lancer un outil de rejeu (mode a blanc par defaut, sauvegarde auto).**
  *L'appariement est fige dans offres.materiau_slug au moment de la collecte. Le 24/08, 9 des 23 appariements en base etaient faux, dont deux publiables : un televiseur « >32 pouces sans bordure : 410.000ar » range en bordure de trottoir T2 a 410 000 Ar/ml. Ces lignes alimentent l'observatoire des prix, donc le bulletin PUBLIC signe Akora. Corriger le code et se croire quitte, c'est publier l'erreur.*
  `akora-bot-prospection-fournisseurs`
- **Un modele de langue ne choisit jamais un identifiant (slug, id, cle etrangere) : il propose un libelle, l'appariement deterministe tranche.**
  *C'est la meme architecture qui empeche l'agent Diako d'inventer (le modele traduit la question, agent_chercher repond avec des faits en base, le modele reformule — verifie : « restaurant sushi » rend une liste VIDE, pas une reponse fabriquee). Sans la regle, un slug invente donne une cle etrangere morte ou, pire, une fiche credible et fausse.*
  `akora-bot-prospection-fournisseurs + diako-projet-voyage`
- **Un bot ne pose aucun acte visible depuis le compte d'Andry : pas d'adhesion a un groupe, pas d'abonnement a une page, pas de message ni de DM, pas de collage automatique dans les groupes. Il prepare, l'humain appuie.**
  *Sanction reelle : bannissement Meta pour scraping / DM de masse / collage automatise dans les groupes — et le compte concerne est celui d'Andry, pas celui d'un bot. Motif commercial en plus : un depot demarche par un robot ne rappelle pas. Le refus a deja ete oppose explicitement a Andry ; sans trace ecrite, la demande reviendra et sera acceptee.*
  `bots-prospection-sources-facebook + akora-bot-prospection-fournisseurs + hermes-marketing-agent`
- **pg_net vit dans le schema `net` : extensions.net.http_post n'existe pas, meme installe « with schema extensions ». Un nom a trois parties est lu comme une reference inter-bases et la tache passe pour « succeeded » sans rien emettre. Ne jamais avaler l'erreur dans un `exception when others` — tracer par raise warning.**
  *Le meme piege a mordu DEUX projets : notification creee et aucune requete emise cote Diako, tache pg_cron « succeeded » et muette cote AKORA. Une tache qui se declare reussie sans rien faire ne se decouvre que lorsque quelqu'un s'etonne de ne rien recevoir — des semaines plus tard.*
  `diako-projet-voyage + akora-projet-materiaux`
- **PL/pgSQL compile TOUTES les branches d'un `case` : ecrire IF/ELSIF et retourner explicitement selon TG_OP, jamais coalesce(new, old). Et un trigger BEFORE INSERT ne peut pas ecrire une FK vers new.id — dater = BEFORE, historiser = AFTER.**
  *Cote Diako : « record new has no field room_type_id » sur une insertion dans une table qui n'a jamais cette colonne — l'erreur accuse la mauvaise branche. Cote AKORA : AUCUN produit ne pouvait etre cree, sur le produit central du site. Deux pieges Postgres non evidents, tous deux bloquants.*
  `diako-projet-voyage + akora-projet-materiaux`
- **CORS : le client Supabase pose l'en-tete x-application-name sur CHAQUE requete ; si l'Edge Function ne l'autorise pas, le prevol echoue et rien ne part. Invisible en test — un appel depuis Node ne declenche aucun CORS.**
  *Ca concerne les trois sites (Fonenako, Diako, AKORA) : meme client, meme en-tete. Le piege est qu'il passe TOUS les tests serveur et ne casse que dans le navigateur du client — donc on livre en croyant avoir verifie. AKORA a du ajouter un controle qui rejoue le prevol du navigateur.*
  `akora-projet-materiaux`
- **Un module jamais importe est absent du bundle : verifier qu'une cle publique est bien SERVIE, pas seulement generee.**
  *push.ts etait mort : personne ne pouvait s'abonner aux notifications alors que TOUTE la chaine serveur marchait et avait ete testee. Fonenako a exactement la meme chaine push (VAPID + notifications) : le controle « la cle est-elle servie ? » est le seul qui distingue une chaine vivante d'une chaine morte.*
  `akora-projet-materiaux`
- **o2switch : un fichier absent rend HTTP 200 text/html (page SPA de repli), jamais 404 — toujours tester le Content-Type. La liste des dossiers d'upload autorises est codee en dur dans o2upload.php (folder hors liste = 400) et l'endpoint n'accepte que [A-Za-z0-9._/-], donc slugs a translitterer. Et la version EN LIGNE de o2upload.php DIFFERE du depot : la corriger en ligne, jamais l'ecraser avec celle du depot.**
  *Le meme fichier PHP sert Fonenako, Diako et AKORA sur le meme compte anfa7857, et il a mordu les trois : envois en 400 pendant des jours cote Diako et AKORA. Le 200 text/html sur fichier absent fait valider un deploiement rate. Et ecraser la version en ligne avec celle du depot ferait perdre des valeurs de repli Supabase ecrites en dur — panne immediate en production.*
  `akora-bot-prospection-fournisseurs + diako-projet-voyage`
- **Jamais de metre par « surface x ratio » pour une dalle, un mur ou une toiture : ils se posent en RANGEES entieres et le ratio sous-estime de 5 a 30 %. Le beton et la chape sont des volumes — leur ratio, lui, est juste.**
  *Regle BTP apprise sur AKORA (calepinage.ts, teste) mais qui vaut telle quelle pour les metres OTI, ou un metre devient une commande ferme de centaines de millions d'ariary sans retour possible. Les 477 regles couvrent le recoupement BDE, les conditionnements et le +2 %, mais aucune n'interdit le calcul au ratio — c'est pourtant la methode la plus naturelle et elle sous-estime toujours dans le meme sens.*
  `akora-projet-materiaux`
