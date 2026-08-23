# Connexion Google — de A à Z

Projet Cloud : **Akora** · numéro `422903455967` · ID `akora-506405`
Objectif : que Google affiche **« Akora »** au lieu de
`lvhnqrnmkajhlohympcs.supabase.co`, et tout rattacher à
`onjaniaina27@gmail.com`.

## Ce qui est déjà fait

La connexion Google **fonctionne**. Le bouton est en ligne, `/authorize`
renvoie bien vers Google avec les bons scopes. Ce qui suit ne corrige que
l'**affichage** — le nom et le logo sur l'écran de consentement.

C'est aussi la preuve que rien ne peut casser : la vérification de domaine
gouverne l'apparence, jamais le fonctionnement.

---

## Phase 0 · Savoir sur quel compte on est

Ouvre <https://console.cloud.google.com/welcome?project=akora-506405> et clique
l'**avatar en haut à droite**.

- C'est déjà `onjaniaina27@gmail.com` → **saute la phase 1**.
- C'est un autre compte → phase 1.

## Phase 1 · Rattacher le projet à onjaniaina27

Aucune modification DNS. Rien de partagé n'est touché.

1. <https://console.cloud.google.com/iam-admin/iam?project=akora-506405>
2. **Accorder l'accès**
   - Compte principal : `onjaniaina27@gmail.com`
   - Rôle : **Propriétaire** (catégorie « De base »)
   - Enregistrer
3. Ouvre la boîte `onjaniaina27@gmail.com` et **clique le lien d'acceptation**.
   Sans ça le rôle reste en attente et l'invitation expire au bout de 7 jours.
4. Recommence pour Diako si tu veux tout regrouper :
   <https://console.cloud.google.com/iam-admin/iam?project=diako-504117>

⚠️ **Ne retire l'ancien propriétaire qu'après** avoir vérifié que le nouveau
accède bien aux projets. Un projet sans propriétaire se récupère très mal.

## Phase 2 · Regarder si le domaine est déjà vérifié

Connecte-toi à <https://search.google.com/search-console> **en
`onjaniaina27@gmail.com`**.

- **`fonenako.mg` apparaît dans la liste** → rien à faire, va en phase 4.
- **Il n'apparaît pas** → phase 3.

## Phase 3 · Vérifier le domaine

1. *Ajouter une propriété* → colonne de **gauche, « Domaine »**
2. Saisir `fonenako.mg` — sans `https://`, sans `www`
3. Google donne un `TXT` du type `google-site-verification=…`
4. cPanel → **Éditeur de zone DNS** → domaine `fonenako.mg` →
   **Ajouter un enregistrement** :

   | Champ | Valeur |
   |---|---|
   | Nom | `fonenako.mg.` (avec le point final) |
   | Type | `TXT` |
   | TTL | `3600` |
   | Enregistrement | `google-site-verification=…` |

5. Attendre 2 à 3 minutes, puis **Valider**

### Les deux règles de sécurité

**On AJOUTE, on ne modifie jamais une ligne existante.** Certains éditeurs
cPanel fusionnent les TXT quand on édite.

**On ne touche pas aux lignes `v=spf1`.** Elles autorisent l'envoi de mail :
les écraser coupe les codes de confirmation d'Akora.

### L'état à retrouver après

```
fonenako.mg   TXT  google-site-verification=iBzRIr76_9nq4n2h6Pxd56eJKYWuPh0Bg-dZ-EO5Jk8
fonenako.mg   TXT  v=spf1 ip4:109.234.166.169 +a +mx +include:spf.jabatus.fr ~all
fonenako.mg   A    109.234.166.169
```

Ces trois lignes doivent être **toujours présentes**, plus la nouvelle. Une
propriété « Domaine » couvre `fonenako.mg`, `akora.fonenako.mg`,
`diako.fonenako.mg` et tout sous-domaine à venir — Akora et Diako réglés
ensemble.

## Phase 4 · La marque

Google Auth Platform → **Personnalisation** :

| Champ | Valeur |
|---|---|
| Nom de l'application | `Akora` |
| Logo | `public/logo-google.png` du dépôt |
| Page d'accueil | `https://akora.fonenako.mg` |
| Politique de confidentialité | `https://akora.fonenako.mg/politique-confidentialite` |
| Conditions d'utilisation | `https://akora.fonenako.mg/conditions-utilisation` |
| Domaines autorisés | `fonenako.mg` |

Enregistrer. Onglet **Audience** : le statut doit être **En production**, pas
« Test » — en test, seuls les utilisateurs listés peuvent se connecter.

Puis : *Problèmes de validation du branding* → **« J'ai corrigé les
problèmes »** → Continuer.

## Phase 5 · Vérifier

Navigation privée, <https://akora.fonenako.mg/connexion>, bouton Google.
L'écran doit annoncer **« Akora »**.

La propagation prend de quelques minutes à quelques heures. Si le domaine
technique s'affiche encore le lendemain, c'est que la vérification n'est pas
rattachée au compte propriétaire du projet : reprendre en phase 2.

## Si tu ne veux pas toucher au DNS

Une propriété « préfixe d'URL » se vérifie par fichier, sans DNS — mais elle ne
vaut que pour une adresse, à refaire pour Diako :

```bash
npm run verif:domaine -- googleXXXXXXXX.html
npm run deploy
```

La règle de réécriture laisse passer les fichiers réels : il est servi tel
quel, pas remplacé par l'application.
