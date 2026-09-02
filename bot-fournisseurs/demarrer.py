#!/usr/bin/env python
"""Lance le bot de prospection Akora et ouvre son interface.

    python demarrer.py
    python demarrer.py --port 9000 --sans-navigateur
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from bot.serveur import demarrer   # noqa: E402

TAILLE_MAX_JOURNAL = 2 * 1024 * 1024      # au-delà, le précédent passe en .1


def journaliser_les_plantages() -> Path:
    """Envoie stderr et les plantages dans `data/bot-erreurs.log`.

    🔴 POURQUOI. Le gardien (`gardien.ps1`) lance le bot SANS fenêtre. Tout
    ce que Python écrit sur stderr — une exception dans un fil, un
    avertissement uvicorn, un plantage du pilote Playwright — partait dans
    le vide. Le 01/09/2026, le bot est reparti douze fois et
    `bot-erreurs.log` est resté VIDE : impossible de distinguer un
    redémarrage voulu d'un plantage. Un bot qui meurt doit laisser une trace
    là où on la cherchera.

    `faulthandler` couvre ce que Python ne peut pas attraper lui-même : un
    segfault dans une bibliothèque native, un arrêt sur manque de mémoire.
    """
    from bot.config import DOSSIER_DONNEES

    DOSSIER_DONNEES.mkdir(parents=True, exist_ok=True)
    chemin = DOSSIER_DONNEES / "bot-erreurs.log"
    try:
        if chemin.exists() and chemin.stat().st_size > TAILLE_MAX_JOURNAL:
            chemin.replace(chemin.with_suffix(".log.1"))
    except OSError:
        pass
    fichier = open(chemin, "a", encoding="utf-8", buffering=1)      # noqa: SIM115
    fichier.write(
        f"\n=== démarrage {datetime.now():%Y-%m-%d %H:%M:%S} (pid {os.getpid()}) ===\n"
    )
    sys.stderr = fichier
    import faulthandler
    faulthandler.enable(file=fichier, all_threads=True)
    return chemin


def main() -> None:
    analyseur = argparse.ArgumentParser(description="Bot de prospection Akora")
    analyseur.add_argument("--port", type=int, default=8758)
    analyseur.add_argument("--sans-navigateur", action="store_true")
    options = analyseur.parse_args()

    print(f"\n  Bot fournisseurs Akora — http://127.0.0.1:{options.port}")
    print("  Laissez cette fenetre ouverte tant que vous travaillez.\n")
    if options.sans_navigateur:
        # Lancé par le gardien ou une tâche planifiée : personne ne lit la
        # console. Avec une fenêtre, stderr reste à l'écran, là où on le voit.
        journaliser_les_plantages()
    demarrer(port=options.port, ouvrir=not options.sans_navigateur)


if __name__ == "__main__":
    main()
