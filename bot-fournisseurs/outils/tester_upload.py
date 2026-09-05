"""Testeur de l'upload o2switch — envoie une image d'1 pixel et montre TOUT.

Écrit pour percer l'« HTTP 400 (application/json) » du 23/08 : le journal du
bot tronquait la réponse du serveur, donc personne ne savait POURQUOI le refus.
Cet outil rejoue exactement l'envoi de `reservation._envoyer_photo` (JSON
base64, en-tête X-API-Key) et affiche le statut, le Content-Type et le corps
complet de la réponse.

Usage :
    python outils/tester_upload.py                # dossier « prospects », comme le bot
    python outils/tester_upload.py --dossier produits

⚠ Avec un dossier ACCEPTÉ par le PHP, le pixel est réellement écrit sur
  akora.fonenako.mg/uploads/<dossier>/test-bot-1px.jpg — c'est le but (et il
  est inoffensif), mais autant le savoir.
"""
from __future__ import annotations

import base64
import io
import sys
from pathlib import Path

import requests
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot.config import API_UPLOAD, cle_upload  # noqa: E402


def pixel_jpeg() -> bytes:
    """Un vrai JPEG d'1 pixel : le PHP vérifie les magic bytes, pas que l'extension."""
    tampon = io.BytesIO()
    Image.new("RGB", (1, 1), (41, 148, 192)).save(tampon, format="JPEG")
    return tampon.getvalue()


def principal() -> None:
    dossier = "prospects"
    if "--dossier" in sys.argv:
        dossier = sys.argv[sys.argv.index("--dossier") + 1]

    charge = {
        "file": "data:image/jpeg;base64," + base64.b64encode(pixel_jpeg()).decode(),
        "filename": "test-bot-1px.jpg",
        "folder": dossier,
    }
    print(f"POST {API_UPLOAD}")
    print(f"  folder   = {dossier!r}")
    print(f"  filename = {charge['filename']!r}")
    print(f"  X-API-Key = {'présente' if cle_upload() else 'ABSENTE'}")

    reponse = requests.post(
        API_UPLOAD,
        headers={"X-API-Key": cle_upload(), "Content-Type": "application/json"},
        json=charge,
        timeout=60,
    )
    print(f"\n→ HTTP {reponse.status_code}")
    print(f"→ Content-Type : {reponse.headers.get('Content-Type')}")
    print(f"→ Corps complet :\n{reponse.text}")


if __name__ == "__main__":
    principal()
