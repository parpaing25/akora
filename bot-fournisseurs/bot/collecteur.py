"""Parcours de Facebook et récolte des vendeurs de matériaux.

Deux fils de travail, séparés à dessein :

  1. **Le navigateur** ne fait que ce qui exige Facebook : défiler le fil,
     déplier les « Voir plus » sur place, lire le texte et l'adresse des photos,
     capturer la publication. Il avance à allure humaine.
  2. **L'atelier** (quelques fils parallèles) fait tout le reste : télécharger
     les photos depuis le CDN, faire relire par le modèle, apparier au
     référentiel, ranger dans le bon prospect. Rien de tout ça ne touche
     facebook.com.

Pourquoi cette séparation : une relecture par le modèle prend ~40 secondes.
L'enchaîner dans le fil du navigateur multipliait la durée d'une collecte par
dix — sans pour autant ménager Facebook, puisque ces attentes ne le concernent
pas.

Trois genres de source, là où le bot Fonenako n'en avait que deux :
`groupe`, `page`, et **`recherche`** — la recherche de publications par
mot-clé, qui va chercher les dépôts hors des groupes déjà connus. C'est elle
qui fait grossir la liste toute seule.
"""
from __future__ import annotations

import hashlib
import json
import queue
import random
import re
import shutil
import sqlite3
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

import requests
from playwright.sync_api import sync_playwright

from . import (analyse_llm, base, demandes, devise_zone, extraction, fraicheur,
               fusion, referentiel, transport, verrou_navigateur)
from .config import DOSSIER_PROSPECTS, PROFIL_NAVIGATEUR, charger

# Mots qui font d'une publication un candidat. Large exprès : le tri fin se
# fait à l'appariement, sur le texte entier.
MOTS_MATERIAUX = (
    "parpaing", "parpin", "biriky", "brique", "hourdis", "entrevous", "agglo",
    "bloc", "sable", "fasika", "gravillon", "gravier", "vato", "moellon",
    "concasse", "remblai", "laterite", "tany", "ciment", "simenitra", "chaux",
    "sokay", "platre", "tole", "fanitso", "tuile", "tafo", "fibrociment",
    "fer a beton", "fer 8", "fer 10", "fer 12", "treillis", "fil recuit", "vy",
    "planche", "chevron", "madrier", "latte", "contreplaque", "hazo", "rondin",
    "bambou", "eucalyptus", "poutrelle", "bordure", "buse", "pave", "claustra",
    "btc", "adobe", "beton",
)

# Mots qui signalent un VENDEUR sans nommer un matériau. Ils comptent pour
# repérer une offre dans le fil, mais PAS pour trancher le périmètre : une
# publication de carrelage qui parle de « dépôt » et de « livraison » gagnait
# sinon 2 points de « matériaux » qu'elle ne vendait pas, et échappait au
# filtre.
MOTS_CONTEXTE = (
    "materiaux", "depot", "briqueterie", "carriere", "scierie",
    "livraison", "amidy", "mivarotra", "vidiny",
)

# Mots qui trahissent une DEMANDE et non une offre. Un acheteur publié comme
# fournisseur est la faute la plus visible du lot : on l'écarte dès le fil.
MOTS_DEMANDE = ("mila ", "mila fasika", "je cherche", "recherche ", "qui vend",
                "iza no", "besoin de", "mba mila", "cherche fournisseur",
                "avez-vous", "urgent besoin")

# ── Anti-bruit ─────────────────────────────────────────────────────────────
# Mesuré sur la première vraie collecte : 34 publications ramassées, dont
# 9 questions, du carrelage (hors périmètre) et un bloc d'interface Facebook
# pris pour une publication. Trier ça à la main use plus vite qu'un mauvais
# prix — d'où ces trois filtres, appliqués AVANT tout le reste.

# Akora ne prend que le gros œuvre. Le carrelage, la plomberie et
# l'électricité sont explicitement refusés au formulaire du site : les laisser
# entrer ici ne ferait que remplir la liste d'appels de choses invendables.
MOTS_HORS_PERIMETRE = (
    "carreau", "carrelage", "faience", "faïence", "sanitaire", "robinet",
    "plomberie", "tuyau pvc", "pvc ", "electricite", "électricité", "cable",
    "câble", "disjoncteur", "peinture", "vernis", "meuble", "canape",
    "matelas", "climatis", "panneau solaire", "groupe electrogene",
    "carrelage sol", "wc ", "douche", "lavabo", "evier", "évier",
)

# Une publication qui POSE une question n'est pas une offre. « Malany biriky
# firy ? » (combien de briques faut-il ?) demande un métré, pas un dépôt.
MOTS_QUESTION = (
    "firy", "ohatrinona", "ahoana no", "mety ve", "misy mahay",
    "conseil", "des conseils", "votre avis", "quelqu'un sait",
    "qui peut me", "aidez-moi", "mba manampy",
)

# Le malgache intercale volontiers des mots dans une tournure interrogative :
# « iza RY ZAREO no mety mahatafavoaka… ». Une liste de sous-chaînes ne les
# attrape pas ; un motif souple, si.
MOTIFS_QUESTION = (
    re.compile(r"\biza\b.{0,20}\b(no|afaka|mahay|mety)\b"),
    re.compile(r"\bmisy\b.{0,20}\b(mahay|afaka|mahavita)\b"),
    re.compile(r"\bmanao ahoana\b|\bahoana no atao\b"),
)

# Ce que Facebook glisse DANS le fil : suggestions de groupes, publicités,
# blocs « personnes que vous connaissez ». Le texte n'a pas d'auteur et parle
# de membres et d'abonnements — jamais de matériaux.
MOTS_CHROME_FB = (
    "suggestions de groupes", "suggested for you", "rejoindre le groupe",
    "publications par jour", "membres •", "personnes que vous connaissez",
    "sponsorisé", "sponsorise", "en savoir plus sur cette page",
    "voir les résultats", "voir tous les commentaires",
)


_MOTIFS: dict[str, re.Pattern] = {}


def _motif_mot(mot: str) -> re.Pattern:
    """Un mot-clé, avec ses frontières de mot et son pluriel."""
    corps = re.escape(mot.strip()).replace(r"\ ", r"[\s\-']+")
    return re.compile(rf"(?<![a-z0-9]){corps}(?:s|x|es)?(?![a-z0-9])")


def compter_mots(mots, texte: str) -> int:
    """Compte les mots-clés présents, frontières de mot et pluriels compris.

    Deux erreurs successives ici, et les deux comptaient :

    1. `"vy" in texte` mentait **par excès** — « vy », « tole », « hazo »,
       « bloc », « pave » sont assez courts pour tomber au milieu d'un autre
       mot. Une publication de carrelage remontait trois « matériaux » qu'elle
       ne citait pas, et passait le filtre de périmètre ;
    2. les frontières seules mentaient **par défaut** — « carreau » ne
       reconnaissait plus « carreaux », ni « brique » ses « briques ». Un vrai
       dépôt pouvait alors tomber sous le seuil de `semble_vendeur` et finir à
       la poubelle.

    D'où le pluriel toléré (`s`, `x`, `es`). Les motifs sont mis en cache : la
    fonction tourne sur chaque publication du fil.
    """
    reduit = referentiel.sans_accents(texte or "")
    total = 0
    for mot in mots:
        motif = _MOTIFS.get(mot)
        if motif is None:
            motif = _MOTIFS[mot] = _motif_mot(referentiel.sans_accents(mot))
        if motif.search(reduit):
            total += 1
    return total


def est_chrome_facebook(texte: str, auteur: str) -> bool:
    """Est-ce un bloc d'interface Facebook plutôt qu'une publication ?

    Vu en vrai : « Suggestions de groupes pour vous · 238 K membres · Plus de
    10 publications par jour · Rejoindre le groupe » enregistré comme une
    publication, sans auteur. Deux indices ensemble suffisent, et l'absence
    d'auteur pèse : une vraie publication en a toujours un.
    """
    reduit = referentiel.sans_accents(texte or "")
    marques = sum(1 for mot in MOTS_CHROME_FB if mot in reduit)
    return marques >= 2 or (marques >= 1 and not (auteur or "").strip())


def est_hors_perimetre(texte: str) -> bool:
    """Carrelage, plomberie, électricité… — le hors-périmètre d'Akora.

    On ne compte que si AUCUN matériau de gros œuvre n'est cité à côté : un
    dépôt qui vend du ciment ET du carrelage reste un bon prospect, c'est son
    ciment qui nous intéresse.
    """
    hors = compter_mots(MOTS_HORS_PERIMETRE, texte)
    if not hors:
        return False
    return hors > compter_mots(MOTS_MATERIAUX, texte)


def est_une_question(texte: str) -> bool:
    """Une question de chantier, pas une offre.

    Le point d'interrogation ne suffit pas : « Besoin de parpaing ? Antsoy
    034… » est une accroche de vendeur. Il faut un mot interrogatif ET aucun
    prix — un vendeur qui pose une question donne quand même son tarif.
    """
    reduit = referentiel.sans_accents(texte or "")
    interrogatif = (any(mot in reduit for mot in MOTS_QUESTION)
                    or any(m.search(reduit) for m in MOTIFS_QUESTION))
    if not interrogatif:
        return False
    return not a_un_prix(texte)

# Repérage d'une publication dans le fil.
#
# ⚠ Vérifié sur le vrai Facebook le 22/08/2026 : `div[role="article"]` ne
# désigne PLUS une publication, seulement les COMMENTAIRES. Le marqueur qui
# tient aujourd'hui est `aria-posinset` (rang dans le fil), doublé de
# `div[role="feed"] > div`. On garde les anciens sélecteurs en repli : le jour
# où Facebook rechange, l'un des trois répondra.
JS_EXTRAIRE_FIL = """
(largeurMin) => {
  const estRacine = (el, sel) => !el.parentElement?.closest(sel);

  let blocs = [...document.querySelectorAll('div[aria-posinset]')]
    .filter(el => estRacine(el, 'div[aria-posinset]'));
  if (!blocs.length) {
    blocs = [...document.querySelectorAll('div[role="feed"] > div')];
  }
  if (!blocs.length) {
    blocs = [...document.querySelectorAll('div[role="article"]')]
      .filter(el => estRacine(el, 'div[role="article"]'));
  }

  const BRUIT = /^(facebook|j'aime|jaime|commenter|partager|répondre|repondre|voir plus|… en voir plus|en voir plus|tout voir|auteur|top fan|membre|admin|modérateur|moderateur)$/i;
  const nettoyer = (t) => (t || '')
    .split('\\n')
    .map(l => l.trim())
    .filter(l => l && !BRUIT.test(l))
    .join('\\n');

  // ── LIRE LA DATE D'UNE PUBLICATION ──────────────────────────────────────
  // Post-mortem du 24/08/2026. L'ancien sélecteur était, en tout et pour tout :
  //     'a[href*="/posts/"] span, a[href*="permalink"] span, abbr'
  // Il n'a rendu quelque chose que 7 % du temps. Sans date, le filtre d'âge
  // ne filtre RIEN : une publication de 2019 entre exactement comme une
  // publication d'hier, et se retrouve datée d'aujourd'hui.
  //
  // ⚠ Le DOM réel de Facebook n'a PAS pu être vérifié le jour de cette
  // correction. Ce code essaie donc PLUSIEURS pistes, de la plus sûre à la
  // plus approximative, et retient le premier candidat qui RESSEMBLE à une
  // date. Chaque piste vit dans son propre try : une piste morte n'empêche
  // pas la suivante, et l'échec complet rend '' — jamais une exception, qui
  // viderait tout le lot de publications.
  //
  //   1. `[data-utime]` — l'epoch en secondes. C'est le vieux Facebook
  //      (mbasic, m.facebook, quelques gabarits Comet) : quand il répond, il
  //      n'y a rien à interpréter, on rend une date ISO exacte.
  //   2. `aria-label` / `title` / `data-tooltip-content` du lien vers la
  //      publication. Facebook y met la date de l'infobulle de survol, qui
  //      est souvent ABSOLUE (« 12 août 2019 à 14:05 ») là où le texte
  //      visible n'est qu'un « 1 sem. » relatif. C'est la piste qui vaut le
  //      plus pour une règle d'ANNÉE : elle seule distingue 2019 de 2026.
  //   3. le texte du lien, puis celui de chacun de ses `span`. Comet imbrique
  //      l'horodatage plusieurs niveaux plus bas ; `querySelector('a span')`
  //      ne prenait que le PREMIER span du PREMIER lien — souvent le nom de
  //      l'auteur, jamais la date.
  //   4. les `[role="link"]` courts : Comet rend fréquemment l'horodatage
  //      dans un `span[role="link"]` SANS href, invisible pour l'ancien
  //      sélecteur qui n'interrogeait que des `a[href]`.
  //   5. dernier recours, une forme de date cherchée dans les 400 premiers
  //      caractères du bloc (l'en-tête). Approximatif, et assumé : Python
  //      revérifie derrière, et une date fausse vaut mieux qu'aucune date
  //      seulement parce qu'elle sera relue.
  //
  // Ce qui est rendu : `heure` (le texte tel quel), `heure_iso` (rempli par
  // la seule piste exacte) et `heure_source` (quelle piste a répondu). La
  // troisième n'est pas décorative : c'est elle qui dira, au premier vrai
  // passage, laquelle de ces cinq pistes tient encore chez Facebook.
  const RE_RELATIF = /(\\d+\\s*(?:minutes?|mins?|mn|heures?|hrs?|h|jours?|j|days?|d|semaines?|sem|weeks?|wks?|w|mois|months?|mos?|mo|ann[ée]es?|ans?|years?|yrs?|y)\\b\\.?)|(\\bhier\\b|\\byesterday\\b|\\bomaly\\b)/i;
  const RE_ABSOLU = /(\\d{1,2}\\s*(?:er)?\\s+(?:janv|f[ée]vr|mars|avr|mai|juin|juil|ao[uû]t?|sept|octo|oct|nov|d[ée]c)[a-zé]*\\.?(?:\\s*,?\\s*\\d{4})?)|((?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?\\s+\\d{1,2}(?:\\s*,?\\s*\\d{4})?)|(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4})|(\\d{4}-\\d{2}-\\d{2})/i;

  // Les formes réelles relevées en base portent TOUTES une espace insécable
  // (U+00A0) : `'1\\u00a0sem.'`, `'6\\u00a0j'`. On les ramène à l'espace
  // ordinaire ici plutôt que de les traîner jusqu'en base.
  const nettoyerDate = (t) => (t || '')
    .replace(/[\\u00a0\\u202f\\u2009\\u2007]/g, ' ')
    .split('\\n')[0].trim().slice(0, 80);
  const ressembleADate = (t) => !!t && (RE_RELATIF.test(t) || RE_ABSOLU.test(t));

  const dateDuBloc = (el) => {
    try {
      const n = el.querySelector('[data-utime]');
      if (n) {
        const secondes = parseInt(n.getAttribute('data-utime'), 10);
        if (secondes > 0) {
          const iso = new Date(secondes * 1000).toISOString();
          return {
            heure: nettoyerDate(n.getAttribute('title') || n.innerText) || iso,
            iso, source: 'data-utime',
          };
        }
      }
    } catch (e) { /* piste morte : on passe à la suivante */ }

    const candidats = [];
    const pousser = (v, src) => { if (v) candidats.push([String(v), src]); };

    try {
      const liens = [...el.querySelectorAll(
        'a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid="], ' +
        'a[href*="multi_permalinks="], a[href*="/videos/"], a[href*="__cft__"], abbr')];
      // Les ATTRIBUTS d'abord : c'est là que se trouve la date absolue.
      for (const a of liens) {
        pousser(a.getAttribute('aria-label'), 'aria-label');
        pousser(a.getAttribute('title'), 'title');
        pousser(a.getAttribute('data-tooltip-content'), 'tooltip');
      }
      for (const a of liens) {
        pousser(a.innerText, 'texte-lien');
        for (const s of a.querySelectorAll('span')) pousser(s.innerText, 'span-lien');
      }
    } catch (e) { /* piste morte */ }

    try {
      for (const n of el.querySelectorAll('[data-tooltip-content]')) {
        pousser(n.getAttribute('data-tooltip-content'), 'tooltip');
      }
      for (const n of el.querySelectorAll('[aria-label]')) {
        pousser(n.getAttribute('aria-label'), 'aria-label');
      }
      for (const n of el.querySelectorAll('[role="link"]')) {
        const t = (n.innerText || '').trim();
        if (t && t.length <= 40) pousser(t, 'role-link');
      }
    } catch (e) { /* piste morte */ }

    try {
      const entete = (el.innerText || '').slice(0, 400);
      const trouve = entete.match(RE_ABSOLU) || entete.match(RE_RELATIF);
      if (trouve) pousser(trouve[0], 'entete');
    } catch (e) { /* piste morte */ }

    for (const [valeur, src] of candidats) {
      const propre = nettoyerDate(valeur);
      if (ressembleADate(propre)) return { heure: propre, iso: '', source: src };
    }
    return { heure: '', iso: '', source: '' };
  };

  return blocs.map(el => {
    const liens = [...el.querySelectorAll('a[href]')].map(a => a.href);
    const permalien = liens.find(h =>
      /\\/posts\\/|\\/permalink\\/|story_fbid=|multi_permalinks=|\\/videos\\//.test(h)) || '';

    const images = [...el.querySelectorAll('img')]
      .map(i => ({
        url: i.currentSrc || i.src,
        largeur: i.naturalWidth || i.width || 0,
        hauteur: i.naturalHeight || i.height || 0,
      }))
      .filter(o => o.url && o.url.includes('scontent') && o.largeur >= largeurMin);

    const message = el.querySelector(
      '[data-ad-preview="message"], [data-ad-comet-preview="message"]');
    const texte = nettoyer(message ? message.innerText : el.innerText);

    // Cinq pistes, dans l'ordre ; '' si aucune ne répond (voir dateDuBloc).
    let quand = { heure: '', iso: '', source: '' };
    try { quand = dateDuBloc(el); } catch (e) { /* jamais bloquant */ }

    // L'auteur ET son adresse : c'est elle qui regroupe les publications d'un
    // même dépôt quand le numéro de téléphone manque encore.
    const enTete = el.querySelector('h2 a, h3 a, h4 a, strong a');
    const auteur = ((enTete?.innerText) ||
      el.querySelector('h2 span, h3 span')?.innerText || '').split('\\n')[0].trim();
    let auteurUrl = enTete?.href || '';
    if (!auteurUrl) {
      auteurUrl = liens.find(h =>
        /facebook\\.com\\/(profile\\.php\\?id=|[A-Za-z0-9.]+\\/?$)/.test(h)) || '';
    }

    // D'OÙ vient cette publication. Dans le fil, une publication de groupe
    // porte un lien vers son groupe : c'est ce qui permet de DÉCOUVRIR des
    // sources sans aller les chercher — et pas n'importe lesquelles, celles
    // qui donnent déjà ce qu'on veut.
    const lienGroupe = liens.find(h => /facebook\\.com\\/groups\\/[^/?]+/.test(h)) || '';
    let origineNom = '';
    if (lienGroupe) {
      const ancre = [...el.querySelectorAll('a[href]')]
        .find(a => a.href.includes('/groups/') && (a.innerText || '').trim().length > 2);
      origineNom = (ancre?.innerText || '').split('\\n')[0].trim();
    }

    // Les sites cités dans le texte. Un dépôt qui a son site est une
    // entreprise établie, et c'est un canal de contact de plus.
    const sites = (texte.match(/https?:\\/\\/[^\\s)]+/g) || [])
      .filter(u => !/facebook\\.com|fb\\.me|fb\\.watch|messenger\\.com/.test(u));

    return {
      texte,
      permalien: permalien.split('?')[0],
      images,
      nb_images: images.length,
      heure: quand.heure,
      heure_iso: quand.iso,
      heure_source: quand.source,
      auteur,
      auteur_url: auteurUrl.split('?ref=')[0],
      origine_url: lienGroupe.split('?')[0],
      origine_nom: origineNom,
      sites,
      posinset: el.getAttribute('aria-posinset') || '',
    };
  }).filter(p => p.texte.length > 10 || p.nb_images > 0);
}
"""

# Déplie les textes coupés à « Voir plus », SANS changer de page. C'est ce qui
# permet de ne plus ouvrir chaque publication dans un onglet — une page chargée
# en moins par publication, pour Facebook comme pour nous. Ici c'est vital : le
# tarif complet d'un dépôt est presque toujours dans la partie coupée.
JS_DEPLIER = """
() => {
  const libelles = ['Voir plus', 'See more', 'En voir plus', 'Afficher plus',
                    'Hijery bebe kokoa'];
  const boutons = [...document.querySelectorAll('div[role="button"], span[role="button"]')]
    .filter(b => libelles.some(l => (b.innerText || '').trim() === l));
  boutons.forEach(b => { try { b.click(); } catch (e) {} });
  return boutons.length;
}
"""


# Lit les commentaires d'une publication ouverte.
#
# ⚠ `div[role="article"]` ne désigne PLUS une publication dans le fil — il
# désigne les COMMENTAIRES. Ce qui était un piège à la collecte devient ici
# exactement le bon sélecteur.
#
# On garde le nom de l'auteur de chaque commentaire : le prix qui compte est
# celui que donne le VENDEUR sous sa propre publication, pas celui qu'un
# passant a cru se rappeler.
JS_COMMENTAIRES = """
() => {
  const blocs = [...document.querySelectorAll('div[role="article"]')];
  return blocs.slice(0, 25).map(el => {
    const auteur = (el.querySelector('a[role="link"] span, strong span, span a')
      ?.innerText || '').split('\\n')[0].trim();
    // Le corps du commentaire porte dir="auto" ; le reste est de l'interface
    // (« J'aime · Répondre · 2 h »).
    const morceaux = [...el.querySelectorAll('div[dir="auto"]')]
      .map(d => (d.innerText || '').trim())
      .filter(t => t && !/^(j'aime|jaime|répondre|repondre|modifié|modifie|\\d+\\s*(min|h|j|sem))$/i.test(t));
    return { auteur, texte: [...new Set(morceaux)].join(' ') };
  }).filter(c => c.texte.length > 1);
}
"""

# Ouvre le panneau des commentaires et demande « Tout » plutôt que « Les plus
# pertinents » : le tarif du vendeur est souvent son premier commentaire, donc
# le plus ancien, et « pertinent » le range derrière les « Combien ? ».
JS_OUVRIR_COMMENTAIRES = """
() => {
  const libelles = ['Voir plus de commentaires', 'Afficher plus de commentaires',
                    'View more comments', 'Voir les commentaires précédents',
                    'Tout afficher', 'Voir 1 réponse'];
  let cliques = 0;
  for (const bouton of document.querySelectorAll('div[role="button"], span[role="button"]')) {
    const texte = (bouton.innerText || '').trim();
    if (libelles.some(l => texte.startsWith(l))) {
      try { bouton.click(); cliques++; } catch (e) {}
    }
  }
  return cliques;
}
"""


def a_un_prix(texte: str) -> bool:
    """Le texte porte-t-il déjà un tarif lisible ?

    ⚠ MÊME DÉFINITION QUE `extraction.prix_dans` : un montant SUIVI DE SA
      DEVISE. Il y avait ici un motif à part — « n'importe quel nombre d'au
      moins quatre chiffres » — et les deux ne pouvaient pas diverger sans
      conséquence. Cette fonction décide si le bot ouvre la publication pour
      lire les commentaires, et « vidiny ao amin'ny commentaire » (le tarif en
      premier commentaire) est la NORME chez les dépôts malgaches. Avec
      l'ancien motif, une publication qui n'affichait qu'un « 0,25mm », un
      « 60x20x15 » ou un numéro de téléphone était réputée porter son prix : le
      bot n'allait pas le chercher, et l'offre restait sans tarif.
    """
    return extraction.porte_un_prix(texte)


def _pause(bornes) -> None:
    time.sleep(random.uniform(float(bornes[0]), float(bornes[1])))


def _bloc_vise(candidats: list[dict], adresse: str, titre: str) -> dict:
    """Parmi les blocs lus, celui que le lien colle designe vraiment.

    🔴 POURQUOI CE N'EST PAS « LE PLUS LONG ». Ouvrir
    `facebook.com/share/p/1DEn6ibetm/` ne donne pas une page a une
    publication : Facebook resout vers `permalink.php?story_fbid=...` et
    affiche la publication AU MILIEU DU FIL de sa page — 22 blocs
    `role="article"` le 01/09/2026. Prendre le plus fourni rendait, d'un appel
    a l'autre, un tarif de madriers puis un article sur l'elevage de tilapia.

    Deux reperes, dans cet ordre :

      1. **l'identifiant de la publication** (`story_fbid`, `/posts/<id>`)
         present dans les liens du bloc — c'est l'exact, quand il est la ;
      2. **le titre de la page**, qui reprend le debut du texte vise :
         « (20+) #ARRIVAGE #ARRIVAGE… - Fivarotan-kazo Mirary | Facebook ».

    A defaut, le plus fourni — mais on sait alors qu'on devine.
    """
    if len(candidats) == 1:
        return candidats[0]

    identifiants = [i for i in re.findall(r"(?:story_fbid=|/posts/)([A-Za-z0-9]{8,})",
                                          adresse or "") if i]
    for identifiant in identifiants:
        for bloc in candidats:
            liens = (bloc.get("permalien") or "") + " " + (bloc.get("auteur_url") or "")
            if identifiant in liens:
                return bloc

    # Le titre : « (20+) DEBUT DU TEXTE... - Auteur | Facebook ». On retire le
    # compteur de notifications, la queue, et on compare sur les lettres et
    # les chiffres seuls — les emojis et la ponctuation ne survivent pas au
    # passage par le titre.
    debut = re.sub(r"^\(\d+\+?\)\s*", "", titre or "")
    debut = re.split(r"\s+[-|]\s+", debut)[0]
    debut = re.sub(r"[^a-z0-9]", "", debut.lower())[:40]
    if len(debut) >= 12:
        for bloc in candidats:
            texte = re.sub(r"[^a-z0-9]", "", (bloc.get("texte") or "").lower())
            if texte.startswith(debut[:len(debut)]) or debut in texte[:200]:
                return bloc

    return max(candidats, key=lambda b: len(b.get("texte") or ""))


def empreinte(texte: str, permalien: str) -> str:
    """Identifie une publication. Le permalien prime ; sinon le texte normalisé."""
    if permalien:
        return hashlib.sha1(permalien.encode()).hexdigest()
    reduit = re.sub(r"[^a-z0-9]", "", texte.lower())[:300]
    return hashlib.sha1(reduit.encode()).hexdigest()


def _age_en_jours(heure: str) -> int | None:
    """Âge d'une publication en jours, `None` si la date ne se lit pas.

    Le corps est parti dans `bot/fraicheur.py` le 24/08/2026 : la lecture de
    date est devenue trop grosse pour tenir dans le collecteur, et les DEUX
    bots de collecte Facebook en ont besoin mot pour mot. Le détail est
    là-bas ; le résumé tient en une ligne : l'ancienne version ne fermait pas
    ses unités par un `\\b` et lisait « 12 juin 2019 » comme « 12 jours »,
    ce qui faisait passer une date de 2019 pour une publication fraîche.

    La signature ne bouge pas : ce qui l'appelait continue de marcher.
    """
    return fraicheur.age_en_jours(heure)


def semble_demande(texte: str) -> bool:
    """Est-ce un ACHETEUR qui cherche, plutôt qu'un vendeur qui propose ?

    Ces publications étaient jetées. Elles valent pourtant plus cher que
    beaucoup d'offres : un besoin daté, chiffré, localisé, et l'argument qui
    fait signer un dépôt qui hésite. On les capture (voir `demandes.py`), mais
    on ne les republie jamais.

    La photo ne compte pas ici : personne ne photographie le sable qu'il n'a
    pas encore acheté.
    """
    reduit = referentiel.sans_accents(texte or "")
    if not any(mot in reduit for mot in MOTS_DEMANDE):
        return False
    return compter_mots(MOTS_MATERIAUX, texte) >= 1


def semble_vendeur(texte: str, nb_photos: int = 0) -> bool:
    """Pré-filtre du fil, volontairement large.

    Le fil coupe les textes à « En voir plus » : sur 60 caractères, exiger deux
    mots-clés écarterait de bons dépôts. Un seul suffit dès qu'il y a une photo.

    Une annonce de camion compte autant qu'une annonce de matériau : sans
    véhicule, aucun « prix rendu chantier » n'est calculable, et le
    transporteur est un fournisseur à part entière.
    """
    reduit = referentiel.sans_accents(texte)
    if any(mot in reduit for mot in MOTS_DEMANDE):
        return False
    # Le contexte compte ici — « dépôt », « livraison », « mivarotra » disent
    # bien qu'on a affaire à un vendeur — mais il ne comptera pas pour trancher
    # le périmètre.
    trouves = compter_mots(MOTS_MATERIAUX, texte) + compter_mots(MOTS_CONTEXTE, texte)
    if trouves >= 2 or (trouves >= 1 and nb_photos >= 1):
        return True
    return transport.semble_transport(texte)


def _url_fil_de_page(url: str) -> str:
    """Nettoie l'adresse d'une page pour tomber sur son fil de publications.

    Les adresses copiées depuis Facebook traînent du pistage (`?ref=`,
    `?mibextid=`…) qui peut renvoyer sur un onglet « À propos » ou « Avis ».
    Seul `profile.php` garde son paramètre : son `id` EST l'adresse.
    """
    decoupe = urlsplit(url)
    parametres = ""
    if decoupe.path.rstrip("/").endswith("profile.php"):
        parametres = urlencode([(c, v) for c, v in parse_qsl(decoupe.query) if c == "id"])
    return urlunsplit(
        (decoupe.scheme or "https", decoupe.netloc, decoupe.path, parametres, "")
    )


def memoire_libre_mo() -> int | None:
    """Mémoire virtuelle disponible, en mégaoctets. None si on ne sait pas.

    🔴 CE CONTRÔLE EXISTE PARCE QUE LA MACHINE A TUÉ LES TROIS BOTS. Le
       23/08/2026, il ne restait que **189 Mo de mémoire virtuelle libre** sur
       29,3 Go : Windows tue les processus dans cet état, et c'est ce qui a
       éteint Fonenako, Diako et AKORA le même jour. Chromium en réclame près
       d'un gigaoctet à lui seul. (Même motif que bot-diako.)

    ⚠ On mesure la mémoire ENGAGEABLE (`ullAvailPageFile`), pas la RAM libre.
      C'est elle qui plafonne : les fichiers d'échange de cette machine sont à
      taille fixe, donc la limite d'engagement est atteinte bien avant que la
      RAM ne se remplisse.
    """
    try:
        import ctypes

        class _Etat(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        etat = _Etat()
        etat.dwLength = ctypes.sizeof(_Etat)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(etat)):
            return None
        return int(etat.ullAvailPageFile // (1024 * 1024))
    except Exception:                                    # pas sous Windows
        return None


def _memoire_suffisante(cfg: dict) -> bool:
    """Dit (et logue) si on peut lancer Chromium sans se faire tuer.

    ⚠ ON NE LANCE PAS CHROMIUM SUR UNE MACHINE PLEINE. Mieux vaut sauter la
      tournée en le disant que mourir au milieu — et emporter le bot avec.
    """
    libre = memoire_libre_mo()
    seuil = int(cfg.get("memoire_mini_mo", 900))
    if libre is not None and libre < seuil:
        base.logguer(
            f"Navigateur non lancé : il ne reste que {libre} Mo de mémoire "
            f"disponible (il en faut {seuil} pour Chromium). Fermez des "
            "applications ou agrandissez le fichier d'échange, puis relancez.",
            "erreur",
        )
        return False
    return True


@contextmanager
def _playwright_ouvert():
    """`sync_playwright()`, mais avec un vrai message quand le pilote meurt.

    Vu le 23/08 (07:25 et 10:46) : quand la machine n'a plus de mémoire, le
    sous-processus du pilote Playwright meurt avant de s'annoncer. `__enter__`
    lit alors `self._playwright`, jamais assigné, et tout ce qui remonte au
    journal est l'illisible « 'PlaywrightContextManager' object has no
    attribute '_playwright' ». On traduit ici, une fois pour toutes.
    """
    gestionnaire = sync_playwright()
    try:
        pw = gestionnaire.__enter__()
    except AttributeError as e:
        if "_playwright" not in str(e):
            raise
        raise RuntimeError(
            "Le pilote Playwright n'a pas réussi à démarrer — presque toujours "
            "un manque de mémoire sur la machine. Fermez des applications et "
            "relancez."
        ) from e
    try:
        yield pw
    finally:
        gestionnaire.__exit__(None, None, None)


def navigateur_perdu(e: Exception) -> bool:
    """Le navigateur ou son contexte n'existe plus : plus rien à tenter.

    Playwright 1.62 ne réexporte pas `TargetClosedError` dans `sync_api` : on
    reconnaît donc l'erreur à son nom et à son message. C'est moins élégant
    qu'un `isinstance`, mais ça survit aux versions.
    """
    texte = str(e).lower()
    return (type(e).__name__ == "TargetClosedError"
            or "browser has been closed" in texte
            or "browser closed" in texte
            or "connection closed" in texte)


CLE_SESSION = "session_facebook"

CHEMINS_REFUSES = {
    "posts", "photo", "photos", "watch", "reel", "reels", "video", "videos",
    "marketplace", "events", "story.php", "permalink.php", "media", "login",
    "help", "settings", "messages", "notifications", "bookmarks",
    "sharer.php", "hashtag", "stories",
}


def analyser_source(url: str) -> tuple[str, str, str]:
    """Valide une entrée et dit ce que c'est. Renvoie (url, genre, requête).

    Accepte aussi un simple **mot-clé** (« parpaing Antananarivo ») : c'est une
    source de genre `recherche`, qui interroge la recherche de publications de
    Facebook. C'est elle qui trouve les dépôts hors des groupes connus.
    """
    saisie = (url or "").strip()
    if not saisie:
        raise ValueError("Adresse ou mot-clé vide.")

    ressemble_a_une_url = saisie.startswith(("http://", "https://")) or (
        "facebook.com" in saisie.lower() or "fb.com" in saisie.lower()
    )
    if not ressemble_a_une_url:
        if len(saisie) < 3:
            raise ValueError("Mot-clé trop court pour une recherche.")
        return (
            f"https://www.facebook.com/search/posts/?q={quote(saisie)}",
            "recherche",
            saisie,
        )

    if not saisie.startswith(("http://", "https://")):
        saisie = "https://" + saisie

    decoupe = urlsplit(saisie)
    if "facebook.com" not in decoupe.netloc.lower() and "fb.com" not in decoupe.netloc.lower():
        raise ValueError("Ce n'est pas une adresse Facebook.")

    segments = [s for s in decoupe.path.split("/") if s]
    if not segments:
        # L'accueil de Facebook n'est pas une impasse : c'est le FIL, et
        # l'algorithme y pousse justement ce que le compte a l'habitude de
        # regarder. Sur un compte dédié à la veille matériaux, c'est la source
        # la plus riche du lot — et la seule qui s'améliore toute seule.
        tri = dict(parse_qsl(decoupe.query)).get("sk", "")
        adresse = f"https://www.facebook.com/?sk={tri}" if tri \
            else "https://www.facebook.com/"
        return adresse, "fil", ""
    premier = segments[0].lower()

    if premier == "search":
        requete = dict(parse_qsl(decoupe.query)).get("q", "")
        if not requete:
            raise ValueError("Adresse de recherche sans mot-clé.")
        return (
            f"https://www.facebook.com/search/posts/?q={quote(requete)}",
            "recherche",
            requete,
        )

    if premier == "groups":
        if len(segments) < 2:
            raise ValueError("Adresse de groupe incomplète (il manque son identifiant).")
        return f"https://www.facebook.com/groups/{segments[1]}", "groupe", ""

    if premier == "share":
        raise ValueError(
            "Lien de partage abrégé : ouvrez-le dans Facebook, puis copiez "
            "l'adresse affichée dans la barre du navigateur."
        )

    if premier == "profile.php":
        identifiant = dict(parse_qsl(decoupe.query)).get("id")
        if not identifiant:
            raise ValueError("Adresse de profil sans identifiant.")
        return f"https://www.facebook.com/profile.php?id={identifiant}", "page", ""

    if premier in CHEMINS_REFUSES:
        raise ValueError(
            "Cette adresse désigne une publication, pas une source. Collez "
            "l'adresse du groupe ou de la page elle-même."
        )

    if premier in ("pages", "p") and len(segments) >= 2:
        return f"https://www.facebook.com/{'/'.join(segments[:3])}", "page", ""
    return f"https://www.facebook.com/{segments[0]}", "page", ""


def session_enregistree() -> bool:
    """Y a-t-il une session Facebook en place ?

    On lit directement le fichier de cookies du profil Chromium : ouvrir un
    navigateur pour le savoir coûterait trop cher, l'interface pose la question
    toutes les 2 secondes. Le cookie `c_user` n'existe que si quelqu'un s'est
    réellement connecté — la présence du dossier, elle, ne prouve rien.
    """
    fichier = PROFIL_NAVIGATEUR / "Default" / "Network" / "Cookies"
    if not fichier.exists():
        base.ecrire_etat(CLE_SESSION, "0")
        return False

    # On travaille sur une COPIE : le fichier est verrouillé tant que le
    # navigateur tourne, et l'ouverture en mode URI casse dès que le chemin
    # contient une espace.
    with tempfile.TemporaryDirectory() as dossier:
        copie = Path(dossier) / "cookies.db"
        try:
            shutil.copy2(fichier, copie)
            cx = sqlite3.connect(copie, timeout=2)
            try:
                nombre = cx.execute(
                    "SELECT COUNT(*) FROM cookies "
                    "WHERE host_key LIKE '%facebook.com' AND name = 'c_user'"
                ).fetchone()[0]
            finally:
                cx.close()
            base.ecrire_etat(CLE_SESSION, "1" if nombre else "0")
            return nombre > 0
        except (OSError, sqlite3.Error):
            # Fichier illisible parce qu'un navigateur l'occupe (une collecte
            # est en cours) : on se rabat sur le dernier état vérifié plutôt
            # que d'inventer une réponse dans un sens ou dans l'autre.
            return base.lire_etat(CLE_SESSION) == "1"


def oublier_session() -> None:
    """Efface le profil Chromium — sert à changer de compte Facebook."""
    if PROFIL_NAVIGATEUR.exists():
        shutil.rmtree(PROFIL_NAVIGATEUR, ignore_errors=True)
    base.ecrire_etat(CLE_SESSION, "0")
    base.logguer("Session Facebook effacée.", "avert")


NAVIGATEUR_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _telecharger_photos(images: list[dict], dossier: Path, prospect_id: str,
                        publication_id: str, cfg: dict) -> int:
    """Récupère les photos depuis le CDN, en parallèle et hors navigateur.

    Les adresses `scontent` sont signées et publiques : un simple GET suffit.
    Elles ne passent pas par facebook.com — les charger de front, c'est ce que
    fait déjà un navigateur qui affiche le fil.
    """
    maxi = int(cfg.get("photos_max_par_publication", 12))
    lot = list(enumerate(images[:maxi], start=1))
    if not lot:
        return 0

    session = requests.Session()
    session.headers["User-Agent"] = NAVIGATEUR_UA

    def une(rang_img):
        rang, img = rang_img
        nom = f"photo{rang:02d}.jpg"
        try:
            reponse = session.get(img["url"], timeout=30)
            if not reponse.ok or "image" not in reponse.headers.get("Content-Type", ""):
                return None
            if len(reponse.content) < 8_000:     # une vignette, pas une photo de stock
                return None
            (dossier / nom).write_bytes(reponse.content)
        except requests.RequestException:
            return None
        return rang, nom, img

    de_front = max(2, 12 // max(1, int(cfg.get("travailleurs", 3))))
    gardees = 0
    with ThreadPoolExecutor(max_workers=de_front) as pool:
        for resultat in pool.map(une, lot):
            if not resultat:
                continue
            rang, nom, img = resultat
            base.ajouter_photo(
                prospect_id, publication_id, nom, img["url"],
                img.get("largeur", 0), img.get("hauteur", 0), ordre=rang,
            )
            gardees += 1

    if gardees and not any(p["couverture"] for p in base.photos_a_publier(prospect_id)):
        premieres = base.photos_a_publier(prospect_id)
        if premieres:
            base.definir_couverture(prospect_id, premieres[0]["id"])
    return gardees


class Atelier:
    """File de travail hors navigateur : photos, relecture, appariement, score."""

    def __init__(self, travail, nb_fils: int = 3) -> None:
        self.travail = travail
        self.file: queue.Queue = queue.Queue()
        self.fils: list[threading.Thread] = []
        self.arret = threading.Event()
        self.en_attente = 0
        self._verrou = threading.Lock()
        for _ in range(max(1, nb_fils)):
            fil = threading.Thread(target=self._boucle, daemon=True)
            fil.start()
            self.fils.append(fil)

    def soumettre(self, tache: dict) -> None:
        with self._verrou:
            self.en_attente += 1
        self.file.put(tache)

    def _boucle(self) -> None:
        while not self.arret.is_set():
            try:
                tache = self.file.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                self.travail(tache)
            except Exception as e:
                base.logguer(f"Traitement d'une publication abandonné : {e}", "erreur")
            finally:
                with self._verrou:
                    self.en_attente -= 1
                self.file.task_done()

    def attendre(self) -> None:
        self.file.join()

    def fermer(self) -> None:
        self.arret.set()


class Collecteur:
    """Pilote le navigateur. Une seule instance à la fois (verrou de classe)."""

    _en_cours = threading.Lock()

    def __init__(self) -> None:
        self.config = charger()
        self.stop = threading.Event()
        self.etat = {"actif": False, "source": None, "nouveaux": 0, "revus": 0,
                     "examines": 0, "parcourues": 0, "en_file": 0, "demandes": 0,
                     # Tout ce qui a été ÉCARTÉ, et pourquoi. Ces compteurs
                     # sont remis à zéro à chaque collecte (voir `collecter`) :
                     # jusqu'au 24/08/2026 ils cumulaient depuis le démarrage
                     # du bot, et `_ecartes` annonçait donc, à la deuxième
                     # collecte, les rejets de la première en prime.
                     "rejet_question": 0, "rejet_perimetre": 0,
                     "rejet_chrome": 0, "rejet_annee": 0, "rejet_age": 0,
                     "rejet_devise": 0}
        # Un verrou pour l'écriture des prospects : plusieurs fils d'atelier
        # peuvent tomber sur le MÊME dépôt (il poste dans plusieurs groupes),
        # et deux créations simultanées feraient deux fiches au lieu d'une.
        self._verrou_fusion = threading.Lock()
        # Combien de publications retenues viennent de chaque groupe repéré
        # dans le fil : c'est la preuve qui fait monter la note d'un candidat.
        self._origines: dict[str, int] = {}

    # -- Session Facebook ---------------------------------------------------
    def _contexte(self, pw, visible: bool):
        PROFIL_NAVIGATEUR.mkdir(parents=True, exist_ok=True)
        return pw.chromium.launch_persistent_context(
            user_data_dir=str(PROFIL_NAVIGATEUR),
            headless=not visible,
            viewport={"width": 1280, "height": 900},
            locale="fr-FR",
            timezone_id="Indian/Antananarivo",
            args=["--disable-blink-features=AutomationControlled"],
        )

    def ouvrir_connexion(self) -> bool:
        """Ouvre Facebook en grand pour se connecter une bonne fois.

        La fenêtre se referme d'elle-même dès que la connexion est détectée.
        Au bout de 5 minutes sans connexion, on abandonne pour ne pas laisser
        un navigateur ouvert.
        """
        if not _memoire_suffisante(charger()):
            return False
        connecte = False
        with _playwright_ouvert() as pw:
            ctx = self._contexte(pw, visible=True)
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            try:
                page.goto("https://www.facebook.com/", wait_until="domcontentloaded")
            except Exception:
                pass
            base.logguer(
                "Fenêtre Facebook ouverte — connectez-vous. "
                "Elle se fermera toute seule une fois la session enregistrée.",
                "info",
            )
            limite = time.time() + 300
            while time.time() < limite:
                if self.stop.is_set():
                    break
                try:
                    if self._verifier_session(ctx):
                        connecte = True
                        break
                    if not ctx.pages:
                        break
                    page.wait_for_timeout(1000)
                except Exception:
                    break
            try:
                ctx.close()
            except Exception:
                pass

        base.ecrire_etat(CLE_SESSION, "1" if connecte else "0")
        base.logguer(
            "Compte Facebook connecté — le bot peut collecter." if connecte
            else "Connexion non aboutie : la session n'a pas été enregistrée.",
            "succes" if connecte else "erreur",
        )
        return connecte

    def _verifier_session(self, ctx) -> bool:
        return "c_user" in {c["name"] for c in ctx.cookies("https://www.facebook.com")}

    def session_active(self) -> bool:
        return session_enregistree()

    # -- Collecte -----------------------------------------------------------
    def collecter(self, sources: list[dict] | None = None,
                  reglages: dict | None = None) -> dict:
        if not Collecteur._en_cours.acquire(blocking=False):
            return {"erreur": "Une collecte est déjà en cours."}
        try:
            return self._collecter(sources, reglages)
        finally:
            self.etat["actif"] = False
            Collecteur._en_cours.release()

    def _collecter(self, sources: list[dict] | None,
                   reglages: dict | None = None) -> dict:
        self.config = charger()
        if reglages:
            self.config.update(reglages)
        cfg = self.config

        # Sans référentiel, aucune offre ne peut être appariée : autant le dire
        # avant d'ouvrir un navigateur pendant vingt minutes pour rien.
        try:
            referentiel.charger()
        except Exception as e:
            base.logguer(
                f"Référentiel Akora indisponible ({e}). "
                "Onglet Réglages → « Synchroniser le référentiel ».",
                "erreur",
            )
            return {"erreur": "referentiel_absent"}

        sources = sources or base.sources(actives_seulement=True, pour_collecte=True)
        if not sources:
            base.logguer(
                "Aucune source active — ajoutez un groupe, une page ou un "
                "mot-clé dans l'onglet Sources.",
                "avert",
            )
            return {"nouveaux": 0, "examines": 0}

        self.stop.clear()
        self.etat.update({"actif": True, "nouveaux": 0, "revus": 0, "examines": 0,
                          "parcourues": 0, "en_file": 0, "demandes": 0,
                          "rejet_question": 0, "rejet_perimetre": 0,
                          "rejet_chrome": 0, "rejet_annee": 0, "rejet_age": 0,
                          "rejet_devise": 0, "prix_commentaires": 0})
        depart = base.maintenant()
        self.atelier = Atelier(self._finir_publication, int(cfg.get("travailleurs", 3)))
        par_genre = {}
        for source in sources:
            par_genre[source.get("genre") or "groupe"] = \
                par_genre.get(source.get("genre") or "groupe", 0) + 1
        base.logguer(
            "Collecte lancée sur " + ", ".join(
                f"{n} {g}(s)" for g, n in sorted(par_genre.items())
            ) + ".",
            "info",
        )

        if not _memoire_suffisante(cfg):
            self.atelier.fermer()
            return {"erreur": "memoire_insuffisante"}

        # ⚠ UN SEUL BOT OUVRE CHROMIUM À LA FOIS SUR CETTE MACHINE.
        #   `_memoire_suffisante` regarde la machine à un instant t ; il ne
        #   voit pas que les bots frères (Fonenako 8756, Diako 8757) sont sur
        #   le point de faire la même chose. Le 24/08/2026 les trois ont passé
        #   ce contrôle en même temps — 1,2 Go libres pour chacun — et la
        #   machine est tombée à 187 Mo, le niveau où ils sont morts la veille.
        #   Le verrou vit hors des dépôts (~/bots-hub) : voir son en-tête.
        occupant = verrou_navigateur.qui()
        if occupant and occupant != "akora":
            base.logguer(
                f"Collecte reportée : le bot « {occupant} » occupe le navigateur. "
                "Une seule collecte à la fois — celle-ci repassera au prochain "
                "créneau.",
                "avert",
            )
            self.atelier.fermer()
            return {"erreur": "navigateur_occupe"}

        with verrou_navigateur.verrou_navigateur("akora"), _playwright_ouvert() as pw:
            ctx = self._contexte(pw, visible=cfg["navigateur_visible"])
            if not self._verifier_session(ctx):
                ctx.close()
                base.logguer(
                    "Pas de session Facebook. Cliquez « Connecter mon compte Facebook ».",
                    "erreur",
                )
                return {"erreur": "session_absente"}

            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            for rang, source in enumerate(sources):
                if self.stop.is_set():
                    base.logguer("Collecte arrêtée à la demande.", "avert")
                    break
                self.etat["source"] = f"{source['nom']} ({rang + 1}/{len(sources)})"
                try:
                    trouves = self._parcourir_source(ctx, page, source)
                except Exception as e:      # une source qui casse ne tue pas la tournée
                    base.logguer(f"« {source['nom']} » : {e}", "erreur")
                    trouves = 0
                    # Navigateur ou contexte MORT (TargetClosedError, vu le
                    # 23/08 à 11:03) : inutile d'essayer la source suivante,
                    # chacune échouerait pareil. On abandonne tout de suite —
                    # ce qui a déjà été ramassé part quand même à l'atelier.
                    if navigateur_perdu(e):
                        base.logguer("Navigateur perdu, collecte interrompue.", "erreur")
                        break
                    # « Page crashed » : l'onglet est mort (souvent faute de
                    # mémoire). Sans nouvel onglet, TOUTES les sources suivantes
                    # échoueraient en cascade.
                    if "crash" in str(e).lower() or page.is_closed():
                        try:
                            if not page.is_closed():
                                page.close()
                            page = ctx.new_page()
                            base.logguer(
                                "Onglet relancé après un plantage — la tournée continue.",
                                "avert",
                            )
                        except Exception:
                            base.logguer("Navigateur perdu, collecte interrompue.", "erreur")
                            break
                base.modifier_source(
                    source["id"],
                    derniere_collecte=base.maintenant(),
                    nb_trouves=(source.get("nb_trouves") or 0) + trouves,
                )
                if rang < len(sources) - 1 and not self.stop.is_set():
                    _pause(cfg["pause_entre_sources"])
            # Après un « Navigateur perdu », ce close() relèverait la même
            # TargetClosedError — et elle sauterait par-dessus l'atelier : les
            # publications déjà ramassées ne seraient jamais lues. On ferme
            # donc sans insister : le `with` arrête Playwright de toute façon.
            try:
                ctx.close()
            except Exception:
                pass

        restant = self.atelier.en_attente
        if restant:
            base.logguer(
                f"Navigation terminée. Reste {restant} publication(s) à lire — "
                "photos et relecture continuent en arrière-plan.",
                "info",
            )
            self.etat["source"] = "traitement en cours"
            self.atelier.attendre()
        self.atelier.fermer()

        self.etat["source"] = None
        base.logguer(
            f"Collecte terminée : {self.etat['nouveaux']} nouveau(x) fournisseur(s), "
            f"{self.etat['revus']} déjà connu(s) enrichi(s), "
            f"{self.etat.get('demandes', 0)} demande(s) d'acheteur, sur "
            f"{self.etat['parcourues']} publication(s) parcourue(s). "
            + _ecartes(self.etat) + _repartition(depart),
            "succes",
        )
        return dict(self.etat)

    # -- Import d'une publication precise -----------------------------------
    def importer(self, url: str) -> dict:
        """Avale UNE publication Facebook, designee par son lien.

        Le collecteur ne sait parcourir qu'une source entiere : un groupe, une
        page, un fil. Or il arrive qu'on tombe soi-meme sur la bonne
        publication — celle d'un depot qu'aucune source ne couvre, ou qu'on
        veut faire entrer tout de suite sans attendre la tournee de nuit.

        Le chemin est ensuite EXACTEMENT le meme que pour une publication
        ramassee dans un fil : meme lecture, meme appariement au catalogue,
        memes photos, meme fiche de prospect. Rien n'est ecrit sur Akora ici —
        l'inscription reste un geste a part, et le tri d'avant publication
        garde tout son sens.

        Les liens de partage (`facebook.com/share/p/...`) sont acceptes tels
        quels : c'est ce que donne le bouton « Copier le lien » du telephone,
        et Facebook les redirige lui-meme vers l'adresse longue.
        """
        url = (url or "").strip()
        if not url.startswith("http"):
            return {"erreur": "Ce n'est pas une adresse : collez le lien complet."}
        if not session_enregistree():
            return {"erreur": "Aucune session Facebook — connectez le compte d'abord."}
        try:
            referentiel.charger()
        except Exception as e:
            return {"erreur": f"Referentiel Akora indisponible ({e})."}
        if not _memoire_suffisante(charger()):
            return {"erreur": "Memoire insuffisante pour ouvrir le navigateur."}

        # Le verrou vaut ici comme pour une collecte : un seul bot ouvre
        # Chromium a la fois sur cette machine.
        occupant = verrou_navigateur.qui()
        if occupant and occupant != "akora":
            return {"erreur": f"Le bot « {occupant} » occupe le navigateur."}

        self.config = charger()
        cfg = self.config
        source = base.ajouter_source(
            "Imports manuels", "akora://imports-manuels", "page")
        base.modifier_source(source["id"], actif=0)

        self.stop.clear()
        self.atelier = Atelier(self._finir_publication,
                               int(cfg.get("travailleurs", 3)))
        resultat = {"lu": False, "texte": "", "auteur": "", "photos": 0}
        try:
            with verrou_navigateur.verrou_navigateur("akora"):
                with _playwright_ouvert() as pw:
                    ctx = self._contexte(pw, visible=bool(cfg.get("navigateur_visible")))
                    page = ctx.pages[0] if ctx.pages else ctx.new_page()
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
                        page.wait_for_timeout(4000)
                        try:
                            page.evaluate(JS_DEPLIER)
                            page.wait_for_timeout(1200)
                        except Exception:
                            pass
                        lot = page.evaluate(
                            JS_EXTRAIRE_FIL, int(cfg["largeur_photo_min"]))
                        # 🔴 L'ADRESSE DE LA PAGE FAIT FOI, PAS CELLE DU DOM.
                        #   Dans un fil, chaque bloc porte son propre lien.
                        #   Sur la page d'UNE publication, le lien `/posts/`
                        #   attrape parfois celui d'un post VOISIN — et comme
                        #   l'empreinte est le SHA1 du permalien, l'import
                        #   annoncait « deja dans la base » en designant la
                        #   fiche d'un autre depot. Vu le 01/09/2026 sur un
                        #   post de Fivarotan-kazo Mirary renvoye vers
                        #   « Fournisseur en Materiaux de construction ».
                        #   Facebook resout lui-meme /share/p/... vers
                        #   l'adresse canonique : c'est elle qu'on garde.
                        # ⚠ NE PAS couper la query : l'identite d'une
                        #   publication de groupe vit dans
                        #   `permalink.php?story_fbid=...&id=...`. Coupee, toute
                        #   adresse se ramenait a « permalink.php », donc a UNE
                        #   seule empreinte : le deuxieme import annoncait
                        #   « deja dans la base » quel que soit le lien colle.
                        adresse_resolue = page.url or url
                        titre_page = ""
                        try:
                            titre_page = page.title() or ""
                        except Exception:
                            pass
                    finally:
                        try:
                            ctx.close()
                        except Exception:
                            pass

                # La page d'une publication seule en rend parfois plusieurs
                # (la publication, puis des suggestions) : on garde la plus
                # fournie en texte, c'est toujours celle qu'on est venu
                # chercher.
                candidats = [b for b in (lot or []) if (b.get("texte") or "").strip()]
                if not candidats:
                    return {"erreur": (
                        "Rien de lisible a cette adresse. Une publication de "
                        "groupe prive n'est visible que si le compte du bot y "
                        "est membre.")}
                post = _bloc_vise(candidats, adresse_resolue, titre_page)
                post["permalien"] = adresse_resolue

                fraich = fraicheur.verdict(
                    post.get("heure_iso") or post.get("heure") or "",
                    0,                      # importe a la main : l'age ne filtre pas
                    10_000,
                )
                post["publie_date"] = fraicheur.en_texte(fraich["date"])

                cle = empreinte(post["texte"], post["permalien"])
                if base.publication_existe(cle):
                    # « Deja dans la base » n'est pas une reponse : ce qu'on
                    # veut savoir, c'est CHEZ QUI elle a atterri et ce qu'elle
                    # a donne. Sans ce renvoi, on relit la meme publication a
                    # la main en croyant qu'elle avait ete perdue.
                    return {"deja": True,
                            "prospect": base.prospect_de_publication(cle),
                            "permalien": post["permalien"],
                            "texte": post["texte"][:400],
                            "auteur": post.get("auteur") or "",
                            "photos": int(post.get("nb_images") or 0)}
                if not self._inscrire_post(page, post, source, cle):
                    return {"erreur": "La publication n'a pas pu etre enregistree."}

                resultat.update({
                    "lu": True,
                    "texte": post["texte"][:400],
                    "auteur": post.get("auteur") or "",
                    "photos": int(post.get("nb_images") or 0),
                    "permalien": post["permalien"],
                })
        except Exception as e:                                   # noqa: BLE001
            base.logguer(f"Import de publication echoue : {e}", "erreur")
            return {"erreur": str(e)[:200]}
        finally:
            self.atelier.attendre()
            self.atelier.fermer()

        base.logguer(
            f"Publication importee a la main — {resultat['photos']} photo(s), "
            f"auteur « {resultat['auteur'] or 'inconnu'} ».", "succes")
        return resultat

    def _parcourir_source(self, ctx, page, source: dict) -> int:
        cfg = self.config
        genre = source.get("genre") or "groupe"
        url = source["url"].rstrip("/")

        if genre == "groupe":
            # Tri chronologique : sans ça Facebook sert « les plus pertinents »,
            # c'est-à-dire souvent des publications vues il y a trois semaines.
            if "sorting_setting" not in url:
                url += "?sorting_setting=CHRONOLOGICAL"
        elif genre == "page":
            url = _url_fil_de_page(url)
        elif genre == "fil":
            # Ici, contrairement aux groupes, on garde le tri PAR DÉFAUT :
            # c'est tout l'intérêt. L'algorithme de Facebook connaît les
            # habitudes du compte de veille et lui pousse les dépôts qu'il
            # regarde — un tri chronologique nous ferait perdre exactement ce
            # qu'on vient chercher.
            url = url or "https://www.facebook.com/"
        # genre == 'recherche' : l'adresse porte déjà la requête, on n'y touche pas.

        libelle = {"groupe": "Groupe", "page": "Page", "recherche": "Recherche",
                   "fil": "Fil d'actualité"}[genre]
        base.logguer(f"{libelle} « {source['nom']} » — ouverture.", "info")
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(4000)

        vus_dans_ce_tour: set[str] = set()
        retenues = 0
        ecartes_annee = 0      # publiées avant `annee_minimum`
        ecartes_age = 0        # plus vieilles que `jours_max`
        commentaires_lus = 0    # ouvertures de publication, bornées par source
        plafond = int(cfg["posts_max_par_source"])
        steriles = 0        # défilements consécutifs sans rien de neuf

        for _ in range(int(cfg["scrolls_max_par_source"])):
            if self.stop.is_set():
                break

            # Déplier AVANT d'extraire : le fil coupe à « Voir plus », et le
            # tarif complet d'un dépôt est presque toujours dans la partie coupée.
            try:
                page.evaluate(JS_DEPLIER)
                page.wait_for_timeout(900)
            except Exception:
                pass

            try:
                lot = page.evaluate(JS_EXTRAIRE_FIL, int(cfg["largeur_photo_min"]))
            except Exception:
                lot = []

            neufs = 0
            for post in lot:
                cle = empreinte(post["texte"], post["permalien"])
                if cle in vus_dans_ce_tour:
                    continue
                vus_dans_ce_tour.add(cle)
                self.etat["parcourues"] += 1
                # La vue se compte ICI, avant tout filtre. Comptée plus bas,
                # après le tri, chaque source afficherait 100 % de rendement et
                # le chiffre ne voudrait plus rien dire.
                try:
                    self._noter_origine(post, source, retenue=False)
                except Exception as e:                       # noqa: BLE001
                    base.logguer(f"Origine non notée : {str(e)[:80]}", "avert")

                # ⚠ RÈGLE : on ne collecte QUE l'année en cours.
                #
                # Le filtre d'âge existait déjà, mais il ne s'appliquait
                # qu'à 11 % des publications (20 sur 181, mesuré le
                # 24/08/2026) — les seules dont la date avait pu être
                # lue. Ce qui a été réparé, c'est la LECTURE
                # (JS_EXTRAIRE_FIL plus haut, et bot/fraicheur.py) ; le
                # filtre, lui, ne fait que s'en servir.
                #
                # Quand l'année reste INDÉTERMINABLE, on GARDE : la
                # refuser supprimerait la collecte au lieu de la
                # nettoyer. Mais la date n'est plus inventée pour
                # autant — `publie_date` reste VIDE, et personne
                # n'affichera « vu aujourd'hui » sur un relevé qui
                # vient peut-être de 2019.
                fraich = fraicheur.verdict(
                    post.get("heure_iso") or post.get("heure") or "",
                    cfg.get("annee_minimum", 0),
                    cfg["jours_max"],
                )
                post["publie_date"] = fraicheur.en_texte(fraich["date"])
                if not fraich["garder"]:
                    if fraich["motif"] == "annee":
                        ecartes_annee += 1
                        self.etat["rejet_annee"] = self.etat.get("rejet_annee", 0) + 1
                        # Journalisé, mais pas quarante fois : le
                        # journal ne garde que 500 lignes, et un groupe
                        # entier d'archives le viderait de tout le reste.
                        if ecartes_annee <= 3:
                            base.logguer(
                                f"Écartée — publiée en {fraich['annee']} "
                                f"(« {post.get('heure', '')} »), on ne garde "
                                f"que {cfg.get('annee_minimum')} et après : "
                                f"{post['texte'][:60].strip()}…",
                                "info",
                            )
                    else:
                        ecartes_age += 1
                        self.etat["rejet_age"] = self.etat.get("rejet_age", 0) + 1
                    continue

                # Anti-bruit, avant tout le reste. Sur la première vraie
                # collecte, un tiers des publications retenues n'étaient ni des
                # offres ni des demandes : des questions, du carrelage, et un
                # bloc d'interface Facebook. Chaque rejet est compté pour que
                # le bilan de fin de collecte dise ce qu'il a écarté.
                if est_chrome_facebook(post["texte"], post.get("auteur", "")):
                    self.etat["rejet_chrome"] = self.etat.get("rejet_chrome", 0) + 1
                    continue
                if est_hors_perimetre(post["texte"]):
                    self.etat["rejet_perimetre"] = self.etat.get("rejet_perimetre", 0) + 1
                    continue

                # Hors zone monétaire : les annonces en francs CFA et les
                # villes d'Afrique continentale. Le 01/09, la moitié de la
                # table `vehicules` était une annonce FCFA, et un appartement
                # de Yaoundé était apparié en bordure de trottoir. À part de
                # `semble_vendeur` EXPRÈS : lui ne demande pas de prix, et
                # c'est voulu (84 % des publications n'en portent aucun).
                motif_zone = devise_zone.hors_zone_monetaire(post["texte"])
                if motif_zone:
                    self.etat["rejet_devise"] = self.etat.get("rejet_devise", 0) + 1
                    if self.etat["rejet_devise"] <= 3:
                        base.logguer(
                            f"Écartée — {motif_zone} : {post['texte'][:60].strip()}…",
                            "info",
                        )
                    continue

                # Un acheteur qui cherche part dans les demandes, pas a la
                # poubelle : c'est ce qui prouve la demande a un depot qui
                # hesite. Rien n'en sera republie.
                if semble_demande(post["texte"]):
                    if not base.demande_existe(cle):
                        self._inscrire_demande(post, source, cle)
                    continue

                # Une question de chantier n'est ni une offre ni une demande
                # exploitable : ni quantité, ni contact, ni prix.
                if est_une_question(post["texte"]):
                    self.etat["rejet_question"] = self.etat.get("rejet_question", 0) + 1
                    continue

                if not semble_vendeur(post["texte"], post["nb_images"]):
                    continue
                if base.publication_existe(cle):
                    continue

                neufs += 1
                self.etat["examines"] += 1

                # Le prix manque dans le texte : il est peut-être en
                # commentaire. On n'ouvre la publication que dans ce cas, et
                # pas plus de N fois par source — chaque ouverture est une page
                # chargée de plus chez Facebook.
                if (cfg.get("lire_commentaires")
                        and not a_un_prix(post["texte"])
                        and commentaires_lus < int(cfg.get("commentaires_max_par_source", 8))):
                    commentaires_lus += 1
                    ajout = self._lire_commentaires(ctx, post)
                    if ajout:
                        post["texte"] += ajout
                    _pause(cfg["pause_entre_scrolls"])

                if self._inscrire_post(page, post, source, cle):
                    retenues += 1
                    # Retenue, donc la source d'origine a fait ses preuves.
                    try:
                        self._noter_origine(post, source, retenue=True,
                                            deja_vue=True)
                    except Exception as e:
                        base.logguer(f"Origine non notée : {str(e)[:80]}", "avert")

            steriles = steriles + 1 if neufs == 0 else 0
            if steriles >= 2 or retenues >= plafond:
                break

            page.mouse.wheel(0, random.randint(700, 1400))
            _pause(cfg["pause_entre_scrolls"])

        bilan = f"« {source['nom']} » : {retenues} publication(s) mise(s) en file."
        if ecartes_annee or ecartes_age:
            bilan += (
                f" Écartée(s) sur la date : {ecartes_annee} d'avant "
                f"{cfg.get('annee_minimum')}, {ecartes_age} de plus de "
                f"{cfg['jours_max']} jours."
            )
        base.logguer(bilan, "info")
        return retenues

    # -- Passe 1 : inscription, dans le fil du navigateur -------------------
    def _inscrire_post(self, page, post: dict, source: dict, cle: str) -> bool:
        """Enregistre une publication repérée et confie la suite à l'atelier.

        Tout ce qui touche Facebook se fait ICI : capture d'écran et rien
        d'autre. Le téléchargement des photos (CDN), la relecture et
        l'appariement partent en parallèle.
        """
        dossier = DOSSIER_PROSPECTS / date.today().isoformat() / hashlib.sha1(
            cle.encode()
        ).hexdigest()[:8]
        dossier.mkdir(parents=True, exist_ok=True)

        if post.get("posinset"):
            try:
                page.locator(
                    f'div[aria-posinset="{post["posinset"]}"]'
                ).first.screenshot(path=str(dossier / "capture.png"), timeout=5000)
            except Exception:
                pass

        (dossier / "publication.txt").write_text(post["texte"], encoding="utf-8")

        publication_id = base.ajouter_publication({
            "empreinte": cle,
            "permalien": post["permalien"],
            "source_id": source["id"],
            "source_nom": source["nom"],
            "auteur": (post.get("auteur") or "").strip(),
            "publie_le": post.get("heure", ""),
            # Le texte brut ci-dessus (« 1 sem. ») ne se compare pas et
            # vieillit sur place ; la date résolue, si. VIDE quand elle
            # est inconnue — c'est une information, pas un oubli.
            "publie_date": post.get("publie_date", ""),
            "date_source": post.get("heure_source", ""),
            "texte": post["texte"],
            "dossier": str(dossier.relative_to(DOSSIER_PROSPECTS.parent)),
        })
        if not publication_id:
            return False

        self.atelier.soumettre({
            "publication_id": publication_id,
            "dossier": dossier,
            "post": post,
            "source": source,
            "config": dict(self.config),
        })
        return True

    def _lire_commentaires(self, ctx, post: dict) -> str:
        """Va chercher le prix dans les commentaires. Renvoie le texte ajouté.

        « Vidiny ao amin'ny commentaire » est la norme ici : le dépôt publie sa
        photo, et met son tarif en premier commentaire — souvent pour éviter que
        la concurrence le voie dans le fil. Sur la première collecte, 6
        publications sur 34 renvoyaient explicitement au privé ou aux
        commentaires.

        Deux règles, et elles comptent :
          - on n'ouvre une publication que si elle **ressemble déjà à une offre
            sans prix**. Ouvrir chaque publication du fil doublerait le nombre
            de pages chargées, pour Facebook comme pour nous ;
          - on ne garde que les commentaires **de l'auteur de la publication**.
            Le prix qui engage est le sien ; celui qu'un passant croit se
            rappeler ne vaut rien, et le publier serait pire que rien.
        """
        permalien = post.get("permalien") or ""
        if not permalien:
            return ""

        auteur = referentiel.sans_accents((post.get("auteur") or "").strip())
        onglet = None
        try:
            onglet = ctx.new_page()
            onglet.goto(permalien, wait_until="domcontentloaded", timeout=45_000)
            onglet.wait_for_timeout(2500)
            try:
                onglet.evaluate(JS_OUVRIR_COMMENTAIRES)
                onglet.wait_for_timeout(1500)
            except Exception:
                pass
            commentaires = onglet.evaluate(JS_COMMENTAIRES) or []
        except Exception as e:
            base.logguer(f"Commentaires illisibles : {str(e)[:90]}", "avert")
            return ""
        finally:
            if onglet is not None:
                try:
                    onglet.close()
                except Exception:
                    pass

        gardes = []
        for commentaire in commentaires:
            texte = (commentaire.get("texte") or "").strip()
            if not texte or not a_un_prix(texte):
                continue
            nom = referentiel.sans_accents((commentaire.get("auteur") or "").strip())
            # Le vendeur, ou personne. La comparaison est lâche : Facebook
            # abrège parfois le nom sous les commentaires.
            if auteur and nom and (nom in auteur or auteur in nom):
                gardes.append(texte)

        if not gardes:
            return ""
        base.logguer(
            f"Prix trouvé dans les commentaires de « {post.get('auteur') or '?'} ».",
            "succes",
        )
        self.etat["prix_commentaires"] = self.etat.get("prix_commentaires", 0) + 1
        return "\n" + "\n".join(gardes[:4])

    def _noter_origine(self, post: dict, source: dict, retenue: bool = False,
                       deja_vue: bool = False) -> None:
        """Propose comme source le groupe d'où vient une publication du fil.

        C'est la découverte à l'endroit : au lieu de deviner quels groupes
        pourraient être bons, on regarde **d'où viennent les publications**, et
        surtout quelle proportion d'entre elles nous sert. Compter seulement
        les retenues donnait une note qui montait avec le temps sans jamais
        dire si le groupe fait perdre neuf lectures sur dix.

        Elle n'est pas adoptée pour autant : elle rejoint les candidats, avec
        pour preuve son rendement. C'est Andry qui tranche — adhérer à un
        groupe est un acte visible depuis son compte.
        """
        url = (post.get("origine_url") or "").split("?")[0].rstrip("/")
        if url and "/groups/" in url:
            cle = url.rsplit("/", 1)[-1]
            if cle:
                base.observer_source(
                    cle, "groupe",
                    (post.get("origine_nom") or f"Groupe {cle}")[:90], url,
                    retenue=retenue, deja_vue=deja_vue,
                )

        # Le site d'un dépôt cité dans une publication est une source à part
        # entière — et souvent la meilleure : aucun algorithme entre lui et nous.
        for domaine in (post.get("sites") or [])[:3]:
            base.observer_source(domaine, "site", domaine, f"https://{domaine}",
                                 retenue=retenue, deja_vue=deja_vue)

    def _noter_sites(self, post: dict, prospect_id: str) -> None:
        """Garde le site web cité par un dépôt, sur SA fiche.

        Le bot ne parcourt pas les sites — ce n'est pas construit. Mais un
        dépôt qui donne son adresse web est une entreprise établie, et c'est un
        canal de contact de plus au moment d'appeler.
        """
        sites = [s for s in (post.get("sites") or []) if len(s) > 12][:1]
        if not sites:
            return
        fiche = base.prospect(prospect_id)
        if fiche and not fiche.get("site_web"):
            base.modifier_prospect(prospect_id, {"site_web": sites[0][:200]})

    def _inscrire_demande(self, post: dict, source: dict, cle: str) -> bool:
        """Range une demande d'acheteur. Pas de photo, pas d'atelier.

        Une demande ne demande aucun travail lourd : ni téléchargement de
        photos (personne ne photographie le sable qu'il n'a pas acheté), ni
        relecture par un modèle. Elle est lue et rangée sur place.
        """
        lecture = extraction.analyser_demande(post["texte"], self.config)
        if not (lecture.get("type_slug") or lecture.get("materiau_slug")):
            return False        # « je cherche un maçon » : hors périmètre

        identifiant = demandes.enregistrer(lecture, post, source, cle, "")
        if not identifiant:
            return False

        self.etat["demandes"] = self.etat.get("demandes", 0) + 1
        base.logguer(
            "Demande d'acheteur — "
            f"{lecture.get('type_nom') or lecture.get('materiau_nom')} "
            f"{('(' + str(lecture['quantite']) + ' ' + (lecture.get('unite') or '') + ')') if lecture.get('quantite') else ''} "
            f"à {lecture.get('quartier') or lecture.get('ville') or 'lieu inconnu'}"
            f"{' — URGENT' if lecture.get('urgence') else ''}.",
            "info",
        )
        return True

    # -- Passe 2 : atelier, hors du navigateur ------------------------------
    def _finir_publication(self, travail: dict) -> None:
        """Lecture, appariement, rangement dans le bon prospect."""
        cfg = travail["config"]
        post, source = travail["post"], travail["source"]
        publication_id, dossier = travail["publication_id"], travail["dossier"]
        texte = post["texte"]

        lecture = extraction.analyser(texte, cfg)

        if cfg.get("llm_actif"):
            try:
                lecture = analyse_llm.fusionner(
                    lecture, analyse_llm.relire(texte, cfg), cfg
                )
            except analyse_llm.LLMIndisponible as e:
                base.logguer(f"Relecture IA indisponible ({e}) — lecture simple.", "avert")

        # Le modèle a tranché : ce n'est pas un vendeur de gros œuvre. On jette
        # la publication plutôt que de polluer la liste d'appels d'Andry.
        if lecture.get("est_fournisseur") is False:
            base.supprimer_publication(publication_id)
            shutil.rmtree(dossier, ignore_errors=True)
            return

        # Rien à vendre ET rien à transporter : la publication n'apprend rien.
        # Le « et » compte : un transporteur pur n'a AUCUNE offre de matériau,
        # et n'exiger que des offres l'aurait fait disparaître en silence.
        if not lecture["offres"] and not lecture.get("vehicules"):
            base.supprimer_publication(publication_id)
            shutil.rmtree(dossier, ignore_errors=True)
            return

        # Liste rouge : ce numéro a demandé à ne plus être contacté.
        if lecture.get("telephone_cle") and base.est_refuse(lecture["telephone_cle"]):
            base.supprimer_publication(publication_id)
            shutil.rmtree(dossier, ignore_errors=True)
            return

        # Un seul fil à la fois ici : deux publications du même dépôt traitées
        # en parallèle créeraient deux fiches au lieu d'une.
        with self._verrou_fusion:
            prospect_id, nouveau = fusion.enregistrer(lecture, post, source, cfg)
            gardees = 0
            # La date de la PUBLICATION suit le prix. Sans elle, l'observatoire
            # daterait d'aujourd'hui un tarif relevé sur un post ancien, et le
            # bulletin public d'Akora annoncerait « prix de mars » un chiffre
            # de 2019. Vide quand la date n'a pas pu être lue : `base` la
            # laissera à NULL plutôt que d'en inventer une.
            publiee_le = post.get("publie_date") or ""
            for offre in lecture["offres"]:
                if base.ajouter_offre(prospect_id, publication_id,
                                      {**offre, "publie_le": publiee_le}):
                    gardees += 1
            # La flotte : sans elle, aucun « prix rendu chantier » n'est
            # calculable, et c'est tout le produit d'Akora.
            for vehicule in lecture.get("vehicules") or []:
                base.ajouter_vehicule(prospect_id, publication_id, vehicule)
            base.rattacher_publication(publication_id, prospect_id, gardees)

        _telecharger_photos(
            post.get("images") or [], dossier, prospect_id, publication_id, cfg
        )
        self._noter_sites(post, prospect_id)

        if nouveau:
            fusion.controler_annuaire(prospect_id)
        fiche = fusion.evaluer(prospect_id, cfg)

        (dossier / "lecture.json").write_text(
            json.dumps(lecture, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        if nouveau:
            self.etat["nouveaux"] += 1
        else:
            self.etat["revus"] += 1

        appariees = sum(1 for o in lecture["offres"] if o.get("materiau_slug"))
        base.logguer(
            f"{'Nouveau' if nouveau else 'Revu'} — {fiche.get('nom') or 'sans nom'} "
            f"({fiche.get('quartier') or fiche.get('ville') or 'lieu inconnu'}) : "
            f"{appariees}/{len(lecture['offres'])} offre(s) appariée(s), "
            f"score {fiche.get('score', 0)}/100.",
            "succes",
        )

    # -- Prospection de sources ---------------------------------------------
    def prospecter_sources(self, requetes: list[str] | None = None,
                           rappel=None) -> dict:
        """Cherche de nouveaux groupes et pages, et range les candidats.

        Passe par le même navigateur et la même session que la collecte : c'est
        le compte d'Andry qui cherche, avec les mêmes pauses. Rien n'est
        rejoint ni suivi — seulement lu.
        """
        from . import sources_prospection as prospection

        cfg = charger()
        if self.etat["actif"]:
            raise RuntimeError("Une collecte est déjà en cours.")
        self.etat.update(actif=True, source="prospection de sources", trouvees=0)
        try:
            if not _memoire_suffisante(cfg):
                return {"erreur": "memoire_insuffisante"}
            with _playwright_ouvert() as pw:
                ctx = self._contexte(pw, visible=cfg["navigateur_visible"])
                page = ctx.pages[0] if ctx.pages else ctx.new_page()
                try:
                    candidats = prospection.prospecter(
                        page, requetes=requetes, rappel=rappel, config=cfg
                    )
                finally:
                    try:
                        ctx.close()
                    except Exception:
                        pass
            neufs = prospection.enregistrer(candidats)
            base.logguer(
                f"Prospection de sources : {len(candidats)} candidat(s) examiné(s), "
                f"{neufs} nouveau(x) à trancher.",
                "succes" if neufs else "info",
            )
            return {"examines": len(candidats), "nouveaux": neufs}
        finally:
            self.etat.update(actif=False, source=None)


def _ecartes(etat: dict) -> str:
    """« 9 question(s), 3 hors périmètre, 1 bloc Facebook écarté(s). »

    Un bilan qui ne montre que ce qui est retenu laisse croire que le fil est
    pauvre. Il est surtout bruyant : le dire change la lecture d'une collecte
    qui ramène cinq fournisseurs sur soixante publications.
    """
    morceaux = [
        (etat.get("rejet_question", 0), "question(s)"),
        (etat.get("rejet_perimetre", 0), "hors périmètre"),
        (etat.get("rejet_chrome", 0), "bloc(s) Facebook"),
        # Règle « année en cours ». Compté à part du rejet d'âge : « 12
        # publications d'avant 2026 » et « 12 publications de plus de 60
        # jours » ne disent pas la même chose du fil qu'on vient de lire.
        (etat.get("rejet_annee", 0), "d'une année révolue"),
        (etat.get("rejet_age", 0), "trop ancienne(s)"),
        (etat.get("rejet_devise", 0), "en francs CFA / hors zone"),
    ]
    ecartes = [f"{n} {mot}" for n, mot in morceaux if n]
    phrase = ("Écarté : " + ", ".join(ecartes) + ". ") if ecartes else ""
    trouves = etat.get("prix_commentaires", 0)
    if trouves:
        phrase += f"{trouves} prix trouvé(s) en commentaire. "
    return phrase


def _repartition(depuis: str) -> str:
    """« Dont 12 à trier, 4 incomplets, 2 déjà clients » — l'utile et le reste."""
    with base._verrou, base.connexion() as cx:
        lignes = cx.execute(
            "SELECT statut, COUNT(*) n FROM prospects WHERE derniere_vue >= ? "
            "GROUP BY statut", (depuis,),
        ).fetchall()
    par_statut = {l["statut"]: l["n"] for l in lignes}
    libelles = [
        (par_statut.get("a_trier", 0), "à trier"),
        (par_statut.get("incomplet", 0), "incomplet(s)"),
        (par_statut.get("deja_client", 0), "déjà client(s)"),
    ]
    morceaux = [f"{n} {mot}" for n, mot in libelles if n]
    return ("Dont " + ", ".join(morceaux) + ".") if morceaux else ""


collecteur = Collecteur()
