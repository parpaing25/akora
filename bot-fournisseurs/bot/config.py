"""Configuration du bot de prospection Akora.

Tout ce qui se règle vit dans data/config.json (créé au premier lancement à
partir des valeurs ci-dessous). Les secrets, eux, ne sont JAMAIS ici : ils sont
lus à l'exécution dans ~/.akora-secrets/, exactement comme scripts/secrets.mjs
côté site.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DOSSIER_DONNEES = RACINE / "data"
DOSSIER_PROSPECTS = DOSSIER_DONNEES / "prospects"
PROFIL_NAVIGATEUR = DOSSIER_DONNEES / "profil-fb"
BASE = DOSSIER_DONNEES / "bot.db"
FICHIER_CONFIG = DOSSIER_DONNEES / "config.json"
CACHE_REFERENTIEL = DOSSIER_DONNEES / "referentiel.json"

SECRETS = Path.home() / ".akora-secrets"
FICHIER_SUPABASE = SECRETS / "supabase.txt"
FICHIER_O2SWITCH = SECRETS / "o2switch.txt"
CLE_ANTHROPIC = SECRETS / "anthropic_key.txt"

SITE = "https://akora.fonenako.mg"
API_UPLOAD = f"{SITE}/api/o2upload.php"

DEFAUTS = {
    # ── Cadence. Volontairement lente : on imite une lecture humaine, et un
    # compte Facebook qui déroule trop vite finit limité.
    "posts_max_par_source": 40,
    "scrolls_max_par_source": 25,
    "pause_entre_scrolls": [2.0, 4.0],
    "pause_entre_sources": [15, 35],
    "navigateur_visible": True,
    "travailleurs": 6,
    "photos_max_par_publication": 12,
    "largeur_photo_min": 400,
    "jours_max": 60,          # un dépôt qui a publié il y a 2 mois vend encore

    # ── Ce qui fait un prospect exploitable. Le téléphone n'est pas
    # négociable : sans lui, personne à contacter, donc rien à prospecter.
    "criteres_obligatoires": ["telephone", "materiau"],
    "garder_les_incomplets": True,
    "prix_obligatoire": False,   # un dépôt sans prix affiché reste un prospect

    # ── Devises croisées dans les publications malgaches.
    "taux_fmg_ar": 5,            # 1 Ar = 5 Fmg
    "prix_plancher_ar": 200,     # sous ce montant, ce n'est pas un prix matériau
    "prix_plafond_ar": 50_000_000,

    # ── Relecture par un modèle. Sans elle le bot marche, mais il se trompe
    # sur ce qui demande du jugement : quel montant va avec quel matériau
    # dans une liste de dix lignes, un dépôt ou un simple revendeur.
    "llm_actif": False,
    "llm_transport": "passerelle",   # 'passerelle' (LiteLLM local) | 'anthropic'
    "llm_passerelle": "http://127.0.0.1:4000",
    "llm_modele": "",
    "llm_repli_anthropic": False,
    "llm_delai": 120,
    "llm_confiance_min": 50,

    # ── Collectes automatiques. FAUX par défaut, et c'est délibéré : ce bot
    # n'a encore jamais tourné contre le vrai Facebook. Un bot qui part tout
    # seul avant sa première collecte vérifiée est un bot qu'on ne peut plus
    # déboguer — on ne sait plus qui a déclenché quoi, surtout avec trois bots
    # sur la même machine. À activer depuis le tableau de bord, une fois la
    # première collecte lancée à la main et son résultat regardé.
    "collecte_auto": False,
    "heures_collecte": ["10:00", "17:00"],
    "objectif_par_jour": 15,         # 15 NOUVEAUX fournisseurs par jour

    # ── Prospection.
    "delai_relance_jours": 3,
    "relances_max": 2,
    "langue_message": "fr",          # 'fr' | 'mg'
    "expediteur": "Akora",

    # ── Réservation de la fiche sur le site.
    "pousser_les_fiches": False,     # tant que la migration n'est pas appliquée
    "pause_entre_envois_photos": 3.0,
}


def charger() -> dict:
    """Lit data/config.json, en le créant au besoin, et comble les clés manquantes."""
    DOSSIER_DONNEES.mkdir(parents=True, exist_ok=True)
    config = dict(DEFAUTS)
    if FICHIER_CONFIG.exists():
        config.update(json.loads(FICHIER_CONFIG.read_text(encoding="utf-8")))
    else:
        FICHIER_CONFIG.write_text(
            json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    return config


def enregistrer(config: dict) -> None:
    DOSSIER_DONNEES.mkdir(parents=True, exist_ok=True)
    FICHIER_CONFIG.write_text(
        json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def lire_secrets(chemin: Path = FICHIER_SUPABASE) -> dict:
    """Lit un fichier `clé=valeur` de ~/.akora-secrets. Ne jamais logguer le retour.

    `utf-8-sig` et non `utf-8` : ces fichiers sont souvent créés au Bloc-notes
    ou par PowerShell, qui y collent un BOM. `.strip()` ne retire PAS U+FEFF,
    et le jeton part alors dans un en-tête HTTP qui refuse tout ce qui n'est
    pas latin-1 — la requête échoue avant même de partir.
    """
    if not chemin.exists():
        raise FileNotFoundError(
            f"Secret absent : {chemin}. Voir LISEZ-MOI.md, section « Secrets »."
        )
    valeurs: dict[str, str] = {}
    for ligne in chemin.read_text(encoding="utf-8-sig").splitlines():
        ligne = ligne.strip().strip("﻿")
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        cle, _, valeur = ligne.partition("=")
        valeurs[cle.strip()] = valeur.strip()
    return valeurs


def ref_projet(url: str) -> str:
    """https://<ref>.supabase.co -> <ref>."""
    trouve = re.match(r"^https://([a-z0-9]+)\.supabase\.(co|in)", url.strip(), re.I)
    if not trouve:
        raise ValueError(f"URL de projet Supabase inattendue : {url}")
    return trouve.group(1)


def api_supabase() -> tuple[str, str]:
    """(url de l'API Management, jeton). Le même chemin que scripts/db-push.mjs.

    Le bot écrit dans une base dont les tables sont fermées à la clé anon :
    il lui faut donc l'API Management et son jeton `sbp_...`, pas la clé du
    navigateur. Aucune clé service_role n'entre ici — c'est la règle du dépôt.
    """
    secrets = lire_secrets()
    jeton = secrets.get("SUPABASE_ACCESS_TOKEN", "")
    if not jeton:
        raise FileNotFoundError(
            "SUPABASE_ACCESS_TOKEN absent de ~/.akora-secrets/supabase.txt "
            "(dashboard Supabase -> Account -> Access Tokens)."
        )
    if jeton.startswith("sb_secret_") or "service_role" in jeton:
        raise ValueError("STOP : ce jeton ressemble à une clé service_role.")
    ref = ref_projet(secrets["SUPABASE_URL"])
    return f"https://api.supabase.com/v1/projects/{ref}/database/query", jeton


def cle_upload() -> str:
    return lire_secrets(FICHIER_O2SWITCH)["O2SWITCH_UPLOAD_API_KEY"]
