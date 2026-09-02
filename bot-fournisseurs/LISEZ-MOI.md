# Bot de prospection des fournisseurs — Akora

Automatise ce qui prend le plus de temps au lancement d'une marketplace :
**trouver les dépôts**. Le bot parcourt les groupes, pages et recherches
Facebook, repère qui vend des matériaux du catalogue Akora, en fait une
**fiche de fournisseur déjà remplie** sur akora.fonenako.mg, et prépare le
message qui invite le dépôt à la revendiquer.

Le tri et la décision restent à vous. Le bot n'envoie **aucun message** et ne
publie **rien** de public tout seul.

---

## Ce qui change par rapport au bot d'annonces de Fonenako

Il en reprend l'ossature — session Facebook, atelier parallèle, planificateur,
interface locale — mais l'objet n'est pas le même, et c'est ce qui commande
tout le reste.

| | Bot Fonenako | Bot Akora |
|---|---|---|
| L'unité collectée | une **annonce** | un **fournisseur** |
| Un même auteur qui poste 6 fois | 6 annonces | **1 fiche**, 6 publications, N offres |
| Le produit | texte libre | **référence du catalogue fermé**, obligatoire |
| Ce qu'on écrit en base | `listings`, public | `prospects_fournisseurs`, **privé** |
| Le but | publier | **faire revendiquer** |
| Sous-produit | — | **observatoire des prix** |

---

## Démarrer

Double-cliquez **`DEMARRER.bat`**. L'interface s'ouvre sur
<http://127.0.0.1:8758> ; laissez la fenêtre noire ouverte tant que vous
travaillez.

```bash
cd bot-fournisseurs
python demarrer.py                        # port 8758
python demarrer.py --port 9000 --sans-navigateur
```

### Première installation

```bash
pip install -r requirements.txt
python -m playwright install chromium
```

### Secrets

Lus à l'exécution dans `~/.akora-secrets/`, jamais dans le dépôt — les mêmes
fichiers que `scripts/secrets.mjs` côté site :

| Fichier | Clé | Sert à |
|---|---|---|
| `supabase.txt` | `SUPABASE_URL` | trouver le projet |
| `supabase.txt` | `SUPABASE_ACCESS_TOKEN` | lire le catalogue, écrire les fiches réservées |
| `o2switch.txt` | `O2SWITCH_UPLOAD_API_KEY` | envoyer les photos |
| `anthropic_key.txt` | — | facultatif, relecture par l'API Claude |

Le bot **refuse** un jeton qui ressemble à une clé `service_role` : la règle du
dépôt est qu'il n'en existe aucune sur cette machine.

---

## Les cinq étapes

### 1. Connecter le compte Facebook (une seule fois)

Tant qu'aucun compte n'est branché, un bandeau occupe le haut du tableau de
bord et *Lancer la collecte* reste gris. Cliquez **Connecter mon compte
Facebook** : une fenêtre Chromium s'ouvre, vous vous connectez normalement, et
**la fenêtre se referme d'elle-même** dès que la session est enregistrée.

Aucun mot de passe ne transite par l'interface du bot : la connexion se fait
sur le vrai site Facebook, et seule la session Chromium est gardée dans
`data/profil-fb/`.

> ⚠️ Utilisez un **compte dédié à la veille**, pas votre compte principal.
> Un compte qui déroule des groupes toute la journée finit limité.

### 2. Synchroniser le catalogue Akora

Onglet **Réglages** → *Synchroniser le catalogue*. Le bot récupère les
8 familles, 35 types et 92 formats depuis la base et en garde une copie dans
`data/referentiel.json`.

**Sans lui, le bot ne collecte rien** — et il le dit avant d'ouvrir un
navigateur pour vingt minutes. C'est voulu : sur Akora, un produit sans
`materiau_ref_id` ne peut *jamais* passer en `actif` (contrainte
`produits_publiable_avec_reference`). Une offre non appariée n'est pas une
offre, c'est une note à trier.

### 3. Déclarer les sources

Onglet **Sources**. Quatre genres, reconnus tout seuls :

| Ce que vous collez | Reconnu comme |
|---|---|
| `facebook.com` | **Fil d'actualité** du compte connecte |
| `facebook.com/groups/materiaux.mada` | **Groupe** (il faut en être membre) |
| `facebook.com/DepotAmbohibao` | **Page** |
| `parpaing Antananarivo` | **Recherche** de publications |
| `facebook.com/share/g/AbCdEf/` | refusé : ouvrez-le, puis copiez la vraie adresse |

Le **fil d'actualité** merite une mention a part. C'est la seule source ou on
garde le tri PAR DEFAUT, alors que les groupes sont forces en chronologique :
l'algorithme de Facebook connait les habitudes du compte de veille et lui
pousse les depots qu'il regarde. Un tri chronologique ferait perdre exactement
ce qu'on vient y chercher. Sur un compte dedie aux materiaux, c'est la source
la plus riche du lot — et la seule qui s'ameliore toute seule a mesure qu'on
s'en sert.

La **recherche par mot-clé** n'existe pas dans le bot Fonenako, et c'est elle
qui fait grossir la liste toute seule : elle va chercher les dépôts *hors* des
groupes que vous connaissez déjà. La carte des trous de couverture (onglet
Marché) propose les recherches manquantes en un clic.

Le pistage collé par le bouton « Partager » (`?ref=`, `?mibextid=`) est retiré :
il renvoie parfois sur l'onglet « À propos » au lieu du fil. Les groupes sont
ouverts en tri **chronologique** ; sans ça Facebook sert « les plus
pertinents », c'est-à-dire souvent des publications vues il y a trois semaines.

### 4. Lancer la collecte

Le bot parcourt chaque source active, déplie les « Voir plus » sur place, et
pour chaque publication qui **vend** un matériau du catalogue :

- lit le texte entier (le tarif complet d'un dépôt est presque toujours dans
  la partie coupée) ;
- en tire le vendeur (nom, métier, téléphone, quartier) et **ses offres**
  ligne par ligne ;
- **apparie chaque offre au catalogue** — famille › type › format ;
- range le tout dans le **bon fournisseur**, en fusionnant avec ce qu'on sait
  déjà de lui ;
- télécharge les photos et capture la publication.

#### Le regroupement, qui fait tout le travail

Un dépôt poste son tarif dans six groupes le même matin. Ce n'est pas six
prospects : c'est un seul, avec six publications et une dizaine d'offres. La
clé de regroupement, par ordre de fiabilité :

1. le **téléphone** normalisé — deux publications au même numéro sont le même
   vendeur, quels que soient le groupe et le nom du compte ;
2. l'**adresse du profil ou de la page** de l'auteur ;
3. faute de mieux, `nom du compte + source`, qui reste local à un groupe : deux
   « Rakoto Jean » dans deux groupes restent séparés, et c'est voulu — mieux
   vaut deux fiches à fusionner qu'une fiche fausse.

Quand une publication tardive apporte enfin le numéro d'un prospect créé sur un
profil, les deux fiches sont **absorbées** l'une dans l'autre.

#### Ce que l'appariement sait faire, et ce qu'il refuse de deviner

```
« Parpaing 15 : 1 400 Ar »      -> parpaing-creux-15     certitude 55  (creux ou plein ?)
« Parpaing creux 40x20x15 »     -> parpaing-creux-15     certitude 92
« Hourdis 12 : 1 900 Ar »       -> hourdis-12            certitude 75
« Fer 12 : 48 000 Ar »          -> fer-a-beton-12        certitude 90
« Biriky 1 300 ar »             -> parpaing-creux, FORMAT À PRÉCISER
« Fasika 1 camion : 320 000 »   -> sable, FORMAT À PRÉCISER (fin ? rivière ?)
« Ciment CEM II 50 kg »         -> ciment, FORMAT À PRÉCISER (32,5 ? 42,5 ?)
```

Une offre ambiguë **n'est pas jetée** : elle est gardée avec son type, et
l'interface demande le format dans une liste déroulante. Jeter aurait fait
perdre la moitié des publications malgaches, où « biriky » tout court est la
norme. Trois règles valent d'être connues :

- les **synonymes malgaches** viennent du catalogue lui-même (`biriky`,
  `fasika`, `vato`, `fanitso`, `hazo`, `vy`), pas d'une liste écrite ici ;
- une appellation que **plusieurs types se partagent** (« parpaing » = creux ou
  plein) donne le type le plus courant de la famille, avec une certitude
  plafonnée à 55 pour que l'interface demande confirmation. La liste des
  appellations partagées se **déduit du catalogue** : ajoutez une famille côté
  site, elle se recalcule ;
- quand plusieurs formats portent le même chiffre, **le moins qualifié gagne** :
  « hourdis 12 » désigne le 60×20×12, pas le 33×33×12 — celui-là s'annonce
  toujours « TC ».

Ce que le catalogue ignore est **signalé, pas perdu** : onglet Marché,
« Matériaux vus, absents du catalogue ».

### 5. Trier, réserver, contacter

Onglet **Fournisseurs** : chaque carte montre le score, le nombre de produits,
le lieu et ce qui manque. Le panneau de détail permet de tout corriger — une
valeur saisie à la main **fait autorité**, la collecte suivante ne la
remplacera pas.

Puis, dans l'ordre :

1. **Valider** la fiche ;
2. **Réserver** — le bot compresse les photos en 1280 px q75, les envoie sur
   o2switch avec 3 s d'écart, et écrit la fiche dans
   `prospects_fournisseurs` + `prospects_produits` ;
3. **Contacter** — onglet Prospection : le message est prêt, en français ou en
   malgache selon la langue de ses publications, avec la liste de ses produits
   et le lien de sa fiche. WhatsApp part pré-rempli ; Messenger ouvre la
   conversation et le texte se colle.

---

## Le score, pour savoir qui appeler en premier

Il répond à **une seule question** : *ce dépôt-là vaut-il un appel
aujourd'hui ?* Il ne dit rien de la qualité du dépôt.

| Poste | Points | Ce qui compte |
|---|---|---|
| Catalogue | 30 | 1 réf. = 12 · 2-3 = 20 · 4-6 = 26 · 7+ = 30 |
| Prix affichés | 20 | ≥80 % des offres = 20 · ≥50 % = 14 · sinon 8 |
| Contact | 15 | téléphone + WhatsApp = 15 · téléphone = 12 |
| Lieu | 15 | quartier 15 · ville seule 8 |
| Identité | 10 | enseigne 10 · page Facebook 7 · compte perso 4 |
| Activité | 10 | publications multiples + vu récemment |

Malus : aucune photo (−5), lecture peu sûre (−5), ni livraison ni retrait
annoncés (−3). Le détail est affiché dans le panneau : il dit **pourquoi** la
note est basse, pas seulement qu'elle l'est.

---

## La fiche réservée — comment ça marche vraiment

C'est l'argument de vente rendu concret : quand vous appelez, la fiche existe
déjà, elle porte son nom, son quartier, ses produits et ses prix. Il n'a rien à
saisir — il a à **confirmer**.

```
  Photos  ─► compression 1280 px q75 (Pillow)
          ─► POST akora.fonenako.mg/api/o2upload.php  (en-tête X-API-Key)
             pacing 3 s · 2 essais · reprise après coupure

  Fiche   ─► prospects_fournisseurs + prospects_produits
          ─► API Management Supabase (Authorization: Bearer sbp_…)
          ─► renvoie https://akora.fonenako.mg/depot-reserve/<jeton>
```

### 🔒 Ce qui n'est pas négociable

Ces fiches portent des données relevées dans des publications publiques,
**sans que la personne l'ait demandé**. Donc :

- **jamais publiques** — `anon` n'a aucun droit sur la table, la fiche ne
  s'ouvre qu'avec son jeton (24 octets tirés au hasard, un par dépôt) ;
- **jamais dans l'annuaire** — `annuaire_fournisseurs` lit `fournisseurs`, et
  rien de tout ceci n'y entre avant une revendication ;
- **jamais indexées** ;
- **rien ne part en ligne sous son nom sans qu'il l'ait relu** : la
  revendication crée un fournisseur en `brouillon` et des produits en
  `brouillon`. Un prix faux publié à sa place serait pire que pas de fiche.

Le **refus** est définitif et sans compte à créer : la fiche est retirée, ses
produits supprimés, et le numéro entre en **liste rouge** locale — une collecte
de demain ne le fera pas réapparaître.

### La migration à appliquer

Le fichier `migration/20260823120000_fiches_reservees.sql` crée les deux tables
et les trois fonctions (`fiche_reservee`, `revendiquer_fiche`, `refuser_fiche`).
**Il n'est pas appliqué** : c'est du DDL sur la base de production.

```bash
cp bot-fournisseurs/migration/20260823120000_fiches_reservees.sql supabase/migrations/
npm run db:push
```

Tant qu'elle n'est pas passée, tout le reste du bot fonctionne — collecte,
appariement, score, messages, observatoire des prix.

Le bouton *Réserver*, lui, **refuse avant d'agir**. C'est le rôle de
l'interrupteur *Autoriser l'envoi des fiches vers le site*, onglet
**Automatisations** (réglage `pousser_les_fiches`, éteint par défaut) : tant
qu'il est éteint, aucune photo n'est compressée ni publiée sur o2switch, et
l'onglet *Fournisseurs* affiche un bandeau qui le dit AVANT le clic. Allumez-le
une fois la migration passée — l'allumer avant ne fait que déplacer l'échec
après l'envoi des photos.

Il manque encore, côté site, la page `/depot-reserve/:jeton` qui appelle
`fiche_reservee()` puis `revendiquer_fiche()`. Le bot fabrique déjà l'adresse
et l'écrit dans les messages : la page est la dernière pièce.

---

## L'observatoire des prix

Chaque tarif relevé a de la valeur **même si le dépôt ne s'inscrit jamais**.
C'est l'avantage propre à Akora, celui que le bot de Fonenako ne pouvait pas
avoir : le prix *est* le produit.

- **un prix de marché par matériau** — minimum, médiane, maximum, nombre de
  dépôts. La **médiane**, jamais la moyenne : un seul prix de gros fausse une
  moyenne, pas une médiane ;
- une ligne appuyée sur **moins de trois dépôts** est marquée *peu sûre* et ne
  sert pas d'argument. Un chiffre présenté comme une référence alors qu'il
  vient d'une seule publication est pire que pas de chiffre ;
- l'**écart min-max** dit s'il y a un marché à faire : 10 % d'écart, personne
  ne change de dépôt ; 35 %, c'est tout l'argument d'Akora ;
- le message de prospection s'en sert : *« votre parpaing 15 est 12 % sous la
  médiane relevée à Antananarivo »* — mais seulement quand la médiane est
  fiable.

**Les trous de couverture** croisent trois sources : ce que le bot a collecté,
ce que l'annuaire Akora porte déjà, et les huit familles. Une case rouge =
aucun fournisseur en ligne et aucun prospect à appeler ; le clic ajoute la
recherche Facebook correspondante aux sources.

### L'observatoire se publie tout seul — derrière trois gardes (02/09)

Une fois par jour (réglage `pousser_observatoire`), les prix collectés
partent dans `public.releves_prix`, la table qui nourrit la page `/prix` du
site — **anonymisés par construction** : une empreinte, jamais un nom ni un
numéro. Trois gardes, chacune née d'un incident réel :

1. **prix orphelin** — le montant doit figurer dans le libellé de SON offre
   (une planche à 28 000 Ar au lieu de 4 700, pairage cassé) ;
2. **unité** — une unité contraire à la référence ne se compare pas ;
3. **vraisemblance** — quand l'observatoire connaît déjà la médiane d'un
   matériau sur au moins deux dépôts, un prix qui s'en écarte d'un facteur
   > 2,5 part « **à confirmer** », jamais en ligne. C'est la garde qui
   aurait arrêté la planche appariée en *bordure de trottoir à
   120 000 Ar/ml* (01/09) — un mauvais appariement passe les deux
   premières gardes sans broncher.

### Ce qui n'entre plus, et ce qui entre enfin (02/09)

- **Les annonces en francs CFA** et celles situées à Yaoundé, Douala,
  Abidjan… sont rejetées **à la porte** (`bot/devise_zone.py`, compteur
  `rejet_devise` au bilan). Avant : une annonce FCFA était la moitié de la
  table des véhicules, et un appartement camerounais s'était fait apparier
  en bordure de trottoir. Le franc malgache (fmg) reste accepté.
- **Les transporteurs** : la porte existait (`semble_vendeur` accepte une
  annonce de camion) mais AUCUNE des 133 sources ne cherchait de transport.
  Sept recherches dédiées sont en base (« location camion benne
  Antananarivo », « kamiao manofa », « fiara manofa entana »…).
- **Les photos se pré-trient par FAMILLE** (`bot/photos_familles.py`,
  réglage `classer_photos`, clé API facultative) : la bande de vignettes du
  panneau montre d'abord celles de la famille du produit. Jamais plus fin
  que la famille — un madrier 7×15 et un 7×17 sont indistinguables sur
  photo, le rattachement reste un clic humain.

---

## Collectes automatiques

Par défaut **10 h** et **17 h**, avec un objectif de **15 nouveaux
fournisseurs par jour** (des prospects *créés*, pas des publications : un dépôt
qui poste dix fois ne fait pas dix résultats).

Si l'objectif n'est pas atteint à l'heure du dernier passage, celui-ci
**déroule plus loin dans les mêmes fils** — deux fois plus de défilements. Les
pauses ne changent pas : c'est la profondeur qui augmente, pas le rythme. Le
bot ne devient pas plus agressif un jour creux.

Au premier passage de la journée, le bot **relit le site** : qui a ouvert sa
fiche, qui l'a revendiquée, qui a refusé. Sans ce retour, on relancerait un
dépôt qui vient de créer son compte.

> ⚠️ **Les collectes n'ont lieu que si le bot tourne.** L'horloge est dans le
> bot, pas dans Windows.
>
> ```powershell
> powershell -ExecutionPolicy Bypass -File outils\installer-tache-planifiee.ps1
> ```
> (retour arrière : `Unregister-ScheduledTask -TaskName "Bot fournisseurs Akora" -Confirm:$false`)

---

## La relecture par un modèle (facultative)

Les expressions régulières sont fiables sur le mécanique : un numéro malgache,
un montant avec sa devise, un tarif ligne par ligne. Elles butent sur le
jugement, et trois cas reviennent sans cesse :

- **le vendeur ou l'acheteur ?** « Mila fasika 3 camion » (je *cherche* du
  sable) a exactement la forme d'une offre ;
- **un tarif en prose** : « le 15 est à 1400 et le 20 à 1800 » ;
- **le hors-périmètre** : quincaillerie, plomberie, électricité — à écarter,
  pas à rattacher de force au matériau le plus proche.

⚠️ Le modèle ne choisit **jamais** de référence. Il propose un *libellé*
(« parpaing 15 »), et c'est l'appariement déterministe qui décide du slug.
Sinon il inventerait des références absentes du catalogue fermé, et l'écriture
partirait avec une clé étrangère morte.

Deux chemins, réglables dans l'interface : la passerelle LiteLLM locale
(gratuite, tombe parfois) ou l'API Claude officielle (payante, stable). Une
panne du modèle ne casse jamais la collecte : on retombe sur la lecture par
expressions régulières.

---

## Ce que le bot ne fera pas

- **Envoyer les messages.** Facebook coupe les comptes qui écrivent en série,
  et un dépôt démarché par un robot ne rappelle pas. Le bot prépare, ouvre la
  bonne conversation, et vous appuyez.
- **Rendre une fiche publique.** Aucune fiche réservée n'entre dans l'annuaire
  ni dans le fil avant que son propriétaire l'ait revendiquée.
- **Publier un prix sous le nom d'un dépôt.** Tout arrive en `brouillon`.
- **Recontacter quelqu'un qui a dit non.** La liste rouge survit à la
  suppression de la fiche.

---

## Audit du 02/09/2026 — ce qui a changé, et pourquoi

Chaque point porte l'incident qui l'a motivé : sans lui, la règle ne tient pas.

- **Un créneau manqué se rattrape.** Le bot est resté mort de 21 h 48 la
  veille à 14 h 20 (gardien désactivé) : avec la fenêtre de 30 minutes
  d'alors, la collecte de 10 h était perdue. Un créneau reste dû jusqu'à
  l'arrivée du suivant (`planificateur.creneau_du`). Et les « tâches du
  jour » (inscriptions, réservations, bulletin) tournent maintenant vraiment
  **après** la collecte — elles démarraient pendant, sur les données de la
  veille. Vérifié en direct : « Collecte automatique de 10:00 » partie à
  14 h 28, dès le redémarrage.
- **Les tests n'écrivent plus dans la vraie base.** Chaque `pytest` laissait
  cinq lignes dans le journal de production, lues comme de l'activité
  réelle. `tests/conftest.py` détourne `AKORA_BOT_DATA` vers un dossier
  jetable ; `tests/test_isolation.py` le vérifie.
- **Le regroupement se fait par COMPTE Facebook**, plus par adresse entière :
  `groups/<g>/user/<id>` et `profile.php?id=<id>` sont le même compte, et une
  publication sans numéro rejoint la fiche du même compte (26 comptes
  tenaient 62 fiches). Deux numéros différents sous un compte restent deux
  fiches, signalées dans « Doublons probables ». Pour le passé :
  `outils/regrouper_comptes.py` (à blanc par défaut, sauvegarde auto).
- **Une légende d'image n'est pas une date.** « Peut être une image de texte
  qui dit … Garantie 10ans » se lisait « il y a dix ans » : publication de
  2026 écartée comme 2016. Longueur ≤ 60 signes et légendes refusées, côté
  JS et côté Python.
- **Les recherches donnent enfin.** Treize recherches avaient rendu deux
  publications en dix jours : la page de résultats montre d'abord conseils et
  questions, deux défilements « sans vendeur neuf » et le bot partait en onze
  secondes ; et le premier lien `/posts/` était la recherche elle-même. Sur
  une recherche, un défilement n'est stérile que s'il ne montre plus rien
  d'inédit (`defilement_sterile`), et `/search/` n'est jamais un permalien.
  Après correctif, « Hourdis Antananarivo » : 7 nouveaux dépôts et 6 demandes.
- **Un plantage laisse une trace.** Lancé par le gardien (sans fenêtre),
  stderr partait dans le vide. `demarrer.py --sans-navigateur` l'envoie
  dans `data/bot-erreurs.log`, avec `faulthandler`.
- **Deux outils de plus** : `outils/collecter_une_source.py <id>` parcourt une
  seule source (le « premier passage sur UN seul » recommandé plus haut), et
  `outils/diagnostic_recherche.py "mot-clé"` dit ce que le bot voit sur une
  page de résultats.
- **L'interface** : les douze onglets débordaient déjà à 1 366 px ; ils
  deviennent un menu latéral groupé (travail du jour, marché, le bot),
  l'en-tête montre l'état du bot en permanence, et le menu se replie en
  tiroir sous 960 px.
- **Un dépôt n'est actif sur le site qu'avec un produit actif** (réglage
  `actif_exige_un_produit`, vrai par défaut). Le 02/09 au soir, 24 fiches
  actives portaient le nom du bot et 22 n'avaient rien à vendre : l'annuaire
  montrait un nom, un numéro, et rien à acheter. La fiche est créée en
  brouillon et passe active d'elle-même avec son premier produit complet
  (référence + prix + photo), à l'inscription comme au transfert de produits ;
  une fiche revendiquée par son dépôt n'est jamais touchée. Appliqué sur le
  site le 02/09 : 22 fiches repassées en brouillon, 2 restent actives. Retour
  arrière : `data/fournisseurs-vides-avant-brouillon-20260902.json` porte
  leurs identifiants, et `inscrire_en_actif` + `actif_exige_un_produit` à
  faux rendent l'ancien comportement.
- **Un compte à plusieurs numéros est un dépôt** (une SIM par opérateur) :
  `outils/regrouper_comptes.py --ecrire --tout` verse ces fiches aussi, et
  `fusion.absorber` reporte désormais les autres numéros, la page, le quartier
  et la fiche réservée sur la fiche gardée — rien ne se perd plus avec la
  ligne supprimée. Appliqué le 02/09 : 10 fiches versées dans 7, plus aucun
  compte partagé.

## Le 02/09 au soir — le bot apprend les matériaux, et on repart de zéro

Demande d'Andry, avec la capture d'une publication du « Guide Construction
Madagascar » : « Hourdis 20×20×53 à 4 800 Ar/pièce » écrit noir sur blanc,
et le bot qui rendait sept « produits » sans prix tirés de phrases — donc les
fiches à remplir à la main. Ce qui a changé :

- **`bot/grammaires.py` — comment chaque type écrit son format.** Une cote
  de bloc se lit ENTIÈRE et dans n'importe quel ordre (« 20×20×40 »,
  « (12*33*33) », « 40 × 20 × 20 cm » sont la même chose), puis se compare
  entière au catalogue. Un chiffre commun ne fait plus une référence :
  « 20×20×53 » n'est pas le hourdis 60 × 20 × 20. Grammaires écrites pour
  les blocs (parpaing, hourdis, briques, BTC, adobe, habillage, claustra),
  le fer (Ø), le gravillon (calibre), la buse (Ø), le contreplaqué (mm), le
  pavé (cm), le béton (dosage) et la tôle (épaisseur × longueur × forme) —
  chacune avec ses bornes de vraisemblance.
- **Le catalogue s'enrichit de ce que le terrain vend** (`creer_references`).
  Une cote complète, chiffrée, que le site ignore devient une référence au
  moment de la collecte : nom, slug, libellé, volume calculé, poids à la
  masse volumique médiane du type, `note` qui dit d'où elle vient. Jamais
  sans prix, jamais hors bornes, jamais pour un type sans grammaire (sable,
  ciment, tuile… restent à l'atelier des formats).
- **Une fiche produit sur trois lignes fait une offre** : le matériau
  au-dessus, « Dimensions : 20 × 20 × 53 cm », « Prix : 4 800 Ar / pièce ».
  Une phrase sans prix n'est plus un produit, mais elle ouvre l'en-tête. La
  cote d'une ligne de prix héritée d'un en-tête donne le format quand elle est
  exacte (« Disponible parpaing » puis « 15x20x40 : 2700 Ar » = parpaing
  creux 15). L'unité écrite juste après le montant prime (« 17.500 Ar/m »).
- **Sans prix, un dépôt n'entre pas** (`prix_obligatoire`, vrai). Une
  publication sans tarif est refusée à la porte — sauf d'un dépôt déjà connu,
  ou si elle est SÉRIEUSE : au moins `produits_min_sans_prix` (3) types du
  catalogue ; le dépôt entre alors en « incomplet », dans **À appeler**,
  jamais sur le site. Mesuré sur les 704 publications d'avant : 496 auraient
  été refusées, 160 entrées par le prix, 13 comme sérieuses, 35 comme
  transporteurs.
- **Le bot suit la page de chaque dépôt qui affiche ses prix**
  (`suivre_pages_fournisseurs`) : sa page ou son profil devient une source
  marquée `suivi:<prospect>`, relue à chaque passage avec un petit budget
  (`scrolls_pages_fournisseurs`, 4) — ses dernières actualités suffisent.
- **Remise à zéro** (`outils/remise_a_zero.py`, sauvegarde dans
  `data/archives/`) : 433 fiches, 704 publications, 1 249 offres, 1 779 photos
  effacées ; les 141 sources et la liste rouge gardées. Côté site : les
  24 fournisseurs du bot, leurs produits, les 40 fiches réservées et les
  24 relevés de l'observatoire effacés, sauvegardés en JSON à côté.
  Vérifié avant : aucune commande, aucune ligne de compte, aucun retrait.

---

## Architecture

```
bot/
  config.py         réglages, chemins, lecture des secrets ~/.akora-secrets
  base.py           SQLite : sources, prospects, publications, offres, suivi
  akora.py          pont Supabase : catalogue, annuaire, écriture des fiches
  referentiel.py    APPARIEMENT au catalogue fermé — la pièce centrale
  extraction.py     téléphone, prix, unité, enseigne, offres ligne par ligne
  lieux.py          villes et quartiers malgaches (aucune coordonnée inventée)
  analyse_llm.py    relecture facultative, orientée vendeur + produits
  collecteur.py     Playwright : groupes, pages, recherches, atelier parallèle
  fusion.py         range une publication dans le BON fournisseur
  score.py          note /100 : qui appeler en premier
  marche.py         observatoire des prix, trous de couverture
  messages.py       messages FR/MG, liens WhatsApp / SMS / Messenger
  prospection.py    suivi : statuts, relances, export CSV
  reservation.py    photos o2switch + écriture de la fiche réservée
  planificateur.py  collectes automatiques + retour du site
  serveur.py        FastAPI : API JSON + interface
web/                interface (charte AKORA-DESIGN.md)
migration/          le SQL à appliquer côté site
data/               hors dépôt : session FB, photos, base, cache catalogue
```

`data/` n'est jamais versionné : session Facebook, photos, base locale.

---

## État au 23/08/2026 — ce qui est éprouvé et ce qui ne l'est pas

**Éprouvé, pour de vrai :**
- le pont Supabase — catalogue lu en direct (8 familles, 35 types, 92 formats) ;
- l'appariement, sur huit publications malgaches représentatives ;
- le regroupement — le même dépôt posté dans deux groupes sous deux noms
  différents donne bien **une** fiche, 2 publications, 5 offres ;
- l'observatoire — médiane sur 3 dépôts, écart 35 %, seuil de fiabilité ;
- les messages FR/MG et leurs liens ;
- les 13 routes de l'API et les trois genres de source.

**Pas encore éprouvé — à faire avec prudence :**
- ⚠️ **jamais exécuté contre le vrai Facebook.** Les sélecteurs
  `JS_EXTRAIRE_FIL` / `JS_DEPLIER` de `collecteur.py` sont le premier endroit à
  corriger si la collecte revient vide alors que le point vert de session est
  allumé ;
- ⚠️ **aucune fiche n'a été écrite en base** : la migration n'est pas appliquée,
  et `pousser_les_fiches` est éteint tant qu'elle ne l'est pas. Faites le tout
  premier passage sur **un seul** prospect et vérifiez le rendu avant d'utiliser
  « Réserver les fiches validées » ;
- ⚠️ **la page `/depot-reserve/:jeton` n'existe pas encore** côté site.
