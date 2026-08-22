#!/usr/bin/env python
"""Lance le bot de prospection Akora et ouvre son interface.

    python demarrer.py
    python demarrer.py --port 9000 --sans-navigateur
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from bot.serveur import demarrer   # noqa: E402


def main() -> None:
    analyseur = argparse.ArgumentParser(description="Bot de prospection Akora")
    analyseur.add_argument("--port", type=int, default=8758)
    analyseur.add_argument("--sans-navigateur", action="store_true")
    options = analyseur.parse_args()

    print(f"\n  Bot fournisseurs Akora — http://127.0.0.1:{options.port}")
    print("  Laissez cette fenetre ouverte tant que vous travaillez.\n")
    demarrer(port=options.port, ouvrir=not options.sans_navigateur)


if __name__ == "__main__":
    main()
