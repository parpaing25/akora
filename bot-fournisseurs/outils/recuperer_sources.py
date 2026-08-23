#!/usr/bin/env python
"""Récupère des sources effacées, en relisant les pages libérées de la base.

SQLite ne réécrit pas une page quand on supprime une ligne : il la marque
libre. Tant qu'aucun `VACUUM` n'est passé et qu'assez peu de lignes ont été
écrites depuis, l'enregistrement est encore là, octet pour octet.

Ce script cherche donc les adresses Facebook dans le fichier brut, remonte le
nom qui les précède dans l'enregistrement, et propose de tout réinsérer.

    python outils/recuperer_sources.py              # montre ce qui est trouvé
    python outils/recuperer_sources.py --restaurer  # réinsère

Il n'écrase jamais une source existante : `ajouter_source` rend la ligne déjà
en place quand l'adresse est connue.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

from bot import base                     # noqa: E402
from bot.collecteur import analyser_source   # noqa: E402
from bot.config import BASE              # noqa: E402

# Les adresses telles qu'elles sont stockées. Le `genre` suit immédiatement
# l'adresse dans l'enregistrement, sans séparateur : on le retire.
MOTIF_URL = re.compile(
    r"https://www\.facebook\.com/[A-Za-z0-9._/?=%&+-]{2,90}"
)
GENRES = ("recherche", "groupe", "page", "fil")


def _nettoyer(url: str) -> str:
    """Retire ce qui est collé derrière l'adresse dans l'enregistrement.

    L'ordre compte, et il m'a coûté un passage : un enregistrement peut porter
    « …623964 » + « groupe » + un horodatage d'un seul tenant. Retirer le genre
    d'abord ne marche pas — il n'est plus en fin de chaîne. On coupe donc
    l'horodatage, puis on retire le genre, et on répète jusqu'à ce que plus
    rien ne bouge.
    """
    for _ in range(4):
        avant = url
        url = re.split(r"\d{4}-\d{2}-\d{2}T", url)[0]
        for genre in GENRES:
            if url.endswith(genre):
                url = url[: -len(genre)]
        url = url.rstrip("-_.")
        if url == avant:
            break

    # Pour une recherche, le genre n'est pas en fin de chaîne mais AU MILIEU :
    # l'enregistrement enchaîne l'adresse, « recherche », puis la requête —
    # « …?q=Hourdis%20Antananarivo » + « recherche » + « Hourdis Antananarivo ».
    # On coupe donc au premier genre rencontré dans le paramètre de recherche.
    if "/search/posts/" in url:
        coupe = re.search(r"(?:" + "|".join(GENRES) + r")", url[30:])
        if coupe:
            url = url[: 30 + coupe.start()]
    return url


def _nom_avant(brut: bytes, position: int) -> str:
    """Le nom de la source précède son adresse dans l'enregistrement.

    On remonte de 200 octets et on garde la dernière suite lisible : c'est
    approximatif, et c'est assumé — un nom raté se corrige en deux secondes
    dans le tableau, une adresse ratée ne se devine pas.
    """
    debut = max(0, position - 200)
    avant = brut[debut:position].decode("utf-8", errors="replace")
    morceaux = re.findall(r"[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 '’,.\-!()&/]{4,80}", avant)
    if not morceaux:
        return ""
    nom = morceaux[-1].strip()
    # Les fragments d'en-tête SQLite et les restes d'URL ne sont pas des noms.
    if "facebook" in nom.lower() or nom.lower().startswith(("http", "www")):
        return ""
    return nom[:80]


def trouver() -> list[dict]:
    brut = BASE.read_bytes()
    texte = brut.decode("utf-8", errors="replace")

    vues: dict[str, dict] = {}
    for trouve in MOTIF_URL.finditer(texte):
        url = _nettoyer(trouve.group(0))
        try:
            propre, genre, requete = analyser_source(url)
        except ValueError:
            continue
        if propre in vues:
            continue
        vues[propre] = {
            "url": propre,
            "genre": genre,
            "requete": requete,
            "nom": _nom_avant(brut, trouve.start()) or requete
            or propre.rstrip("/").split("/")[-1].split("=")[-1],
        }
    return sorted(vues.values(), key=lambda s: (s["genre"], s["nom"].lower()))


def main() -> None:
    if not BASE.exists():
        print(f"Base introuvable : {BASE}")
        return

    trouvees = trouver()
    deja = {s["url"] for s in base.sources()}
    nouvelles = [s for s in trouvees if s["url"] not in deja]

    print(f"\n  {len(trouvees)} source(s) retrouvée(s) dans le fichier, "
          f"dont {len(nouvelles)} absente(s) de la base.\n")
    for source in trouvees:
        marque = " " if source["url"] in deja else "+"
        print(f"   {marque} [{source['genre']:<9}] {source['nom'][:44]:<46} {source['url']}")

    if "--restaurer" not in sys.argv:
        print("\n  Rien n'a été écrit. Relancez avec --restaurer pour réinsérer.\n")
        return

    for source in nouvelles:
        base.ajouter_source(
            source["nom"], source["url"], source["genre"], source["requete"]
        )
    print(f"\n  {len(nouvelles)} source(s) réinsérée(s). "
          "Vérifiez les noms dans l'onglet Sources.\n")


if __name__ == "__main__":
    main()
