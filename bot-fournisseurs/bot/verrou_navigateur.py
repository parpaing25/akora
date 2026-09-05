# -*- coding: utf-8 -*-
"""LE VERROU DU NAVIGATEUR — un seul bot ouvre Chromium à la fois.

🔴 POURQUOI CE FICHIER EXISTE. Le 24/08/2026, trois bots ont lancé leur
collecte en même temps (11:00 pour Fonenako et Diako, 10:00 pour AKORA, plus
une moisson déclenchée à la main). Chacun avait pourtant SON garde-fou mémoire
— « je n'ouvre pas Chromium sous 900 Mo » — et chacun l'a passé de bon droit :
au moment de décider, il restait 1,2 Go. Le problème est qu'ils ont décidé
**en même temps, chacun dans son coin**. Trois Chromium plus tard, la machine
était à 187 Mo de RAM libre : exactement le niveau auquel les trois bots sont
morts la veille.

Un garde-fou par bot ne suffit pas quand la ressource est partagée. Il faut un
tour de rôle, et il doit vivre HORS des trois dépôts — d'où ce dossier.

CE QUE CE N'EST PAS : une file d'attente. Un bot qui ne peut pas prendre le
verrou **renonce** à sa partie navigateur et le dit dans son journal ; il
repassera à son prochain créneau. Faire patienter un bot immobiliserait son
serveur web, et l'utilisateur croirait à une panne.

Usage, côté bot :

    from verrou_navigateur import verrou_navigateur

    with verrou_navigateur("diako") as pris:
        if not pris:
            journal("Un autre bot occupe le navigateur, partie Facebook sautée.")
        else:
            ...ouvrir Chromium...

Le verrou est un simple fichier JSON. Un bot tué net ne le rend pas : on le
considère donc **périmé** au-delà de `PEREMPTION_S`, sinon une mort brutale
bloquerait tous les autres jusqu'au prochain redémarrage.
"""
from __future__ import annotations

import contextlib
import json
import os
import time

# ⚠ CHEMIN ABSOLU, PAS `__file__`. Ce module est COPIÉ dans chaque bot (ils
# vivent dans trois dépôts distincts, aucun ne peut importer chez le voisin).
# Si le verrou se posait à côté de la copie, chaque bot verrouillerait son
# propre fichier et personne ne verrait personne — un verrou qui ne verrouille
# rien est pire que pas de verrou, parce qu'on croit être protégé.
FICHIER = os.path.join(os.path.expanduser("~"), "bots-hub",
                       "verrou-navigateur.json")

# Une collecte Facebook complète tient en une petite heure. Au-delà, le
# porteur est réputé mort — le verrou ne doit jamais devenir un blocage
# définitif.
PEREMPTION_S = 3600


def _lire() -> dict | None:
    try:
        with open(FICHIER, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _vivant(porteur: dict | None) -> bool:
    """Le verrou est-il tenu par quelqu'un qui existe encore ?"""
    if not porteur:
        return False
    if time.time() - float(porteur.get("depuis", 0)) > PEREMPTION_S:
        return False
    pid = int(porteur.get("pid", 0))
    if not pid:
        return False
    # Sous Windows, `os.kill(pid, 0)` lève si le processus n'existe plus.
    try:
        os.kill(pid, 0)
        return True
    except (OSError, PermissionError):
        # PermissionError = le processus existe mais appartient à un autre
        # utilisateur. Il existe : le verrou tient.
        return isinstance(os.sys.exc_info()[1], PermissionError)


def prendre(bot: str) -> bool:
    """Tente de prendre le verrou. True s'il est à nous."""
    porteur = _lire()
    if _vivant(porteur) and porteur.get("bot") != bot:
        return False
    try:
        # `x` échoue si le fichier existe : c'est notre garde anti-collision
        # entre deux bots qui décident à la même seconde. Si le porteur était
        # mort, on l'a retiré juste avant.
        if porteur is not None:
            with contextlib.suppress(OSError):
                os.remove(FICHIER)
        with open(FICHIER, "x", encoding="utf-8") as f:
            json.dump({"bot": bot, "pid": os.getpid(), "depuis": time.time()}, f)
        return True
    except FileExistsError:
        return False
    except OSError:
        # Disque plein, dossier absent… On ne bloque pas la collecte pour ça :
        # sans verrou, on retombe simplement sur le comportement d'avant.
        return True


def rendre(bot: str) -> None:
    porteur = _lire()
    if porteur and porteur.get("bot") == bot:
        with contextlib.suppress(OSError):
            os.remove(FICHIER)


def qui() -> str | None:
    """Le nom du bot qui tient le navigateur, pour l'afficher."""
    porteur = _lire()
    return porteur.get("bot") if _vivant(porteur) else None


@contextlib.contextmanager
def verrou_navigateur(bot: str):
    pris = prendre(bot)
    try:
        yield pris
    finally:
        if pris:
            rendre(bot)
