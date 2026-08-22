"""Réserver la place d'un dépôt sur akora.fonenako.mg.

C'est l'argument de vente rendu concret : quand Andry appelle, la fiche existe
déjà, elle porte le nom du dépôt, son quartier, ses produits et ses prix. Il
n'y a rien à saisir — il y a à confirmer.

Chaîne : compression 1280 px q75 -> envoi o2switch (pacing 3 s) -> écriture
dans `prospects_fournisseurs` + `prospects_produits` via l'API Management. Les
photos ne vont JAMAIS dans Supabase Storage — c'est la règle du dépôt.

Trois garde-fous qui ne se négocient pas :
  - **seules les offres appariées** au référentiel partent : `prospects_produits`
    référence `materiaux_ref`, une offre ambiguë n'a pas de clé ;
  - la fiche n'est **jamais publique** — elle ne s'ouvre qu'avec son jeton ;
  - un refus la **retire** de la base distante, il ne la masque pas.
"""
from __future__ import annotations

import base64
import io
import time
from pathlib import Path

import requests
from PIL import Image

from . import akora, base
from .config import (
    API_UPLOAD,
    DOSSIER_PROSPECTS,
    SITE,
    charger,
    cle_upload,
)

LARGEUR_MAX = 1280
QUALITE = 75
PHOTOS_MAX = 8          # contrainte `prospects_photos_bornees`


class ErreurReservation(Exception):
    pass


# ── Photos ──────────────────────────────────────────────────────────────────
def _compresser(chemin: Path) -> bytes:
    """1280 px sur le plus grand côté, JPEG q75 — le format des imports Akora."""
    with Image.open(chemin) as image:
        image = image.convert("RGB")
        if max(image.size) > LARGEUR_MAX:
            ratio = LARGEUR_MAX / max(image.size)
            image = image.resize(
                (round(image.width * ratio), round(image.height * ratio)),
                Image.LANCZOS,
            )
        tampon = io.BytesIO()
        image.save(tampon, format="JPEG", quality=QUALITE, optimize=True)
    return tampon.getvalue()


def _envoyer_photo(octets: bytes, nom_distant: str, cle: str) -> str:
    """Envoie une photo et renvoie son URL publique. Deux essais, 15 s d'écart."""
    charge = {
        "file": "data:image/jpeg;base64," + base64.b64encode(octets).decode(),
        "filename": nom_distant,
        "folder": "prospects",
    }
    derniere = ""
    for essai in (1, 2):
        try:
            reponse = requests.post(
                API_UPLOAD,
                headers={"X-API-Key": cle, "Content-Type": "application/json"},
                json=charge,
                timeout=120,
            )
            # Un fichier absent renvoie 200 + text/html : vérifier le TYPE, pas
            # le code. C'est le piège qui a coûté le plus cher côté Fonenako.
            if reponse.ok and "application/json" in reponse.headers.get("Content-Type", ""):
                donnees = reponse.json()
                if donnees.get("url"):
                    return donnees["url"]
                derniere = str(donnees)[:200]
            else:
                derniere = f"HTTP {reponse.status_code} ({reponse.headers.get('Content-Type')})"
        except requests.RequestException as e:
            derniere = str(e)[:200]
        if essai == 1:
            time.sleep(15)
    raise ErreurReservation(f"Envoi refusé pour {nom_distant} : {derniere}")


def envoyer_photos(fiche: dict, rappel=None) -> list[str]:
    """Compresse et envoie les photos gardées. Reprend là où ça s'était arrêté."""
    cfg = charger()
    photos = base.photos_a_publier(fiche["id"])[:PHOTOS_MAX]
    if not photos:
        return []

    cle = cle_upload()
    urls: list[str] = []
    court = fiche["id"][:8]
    for rang, photo in enumerate(photos, start=1):
        if photo.get("url_o2"):
            urls.append(photo["url_o2"])
            continue
        # La photo vit dans le dossier de LA publication où elle a été vue —
        # un prospect en a souvent plusieurs, un par groupe où il a posté.
        publication = next(
            (p for p in fiche["publications"] if p["id"] == photo.get("publication_id")),
            None,
        )
        if publication is None or not publication.get("dossier"):
            continue
        source = DOSSIER_PROSPECTS.parent / publication["dossier"] / photo["fichier"]
        if not source.exists():
            base.logguer(f"Photo introuvable sur le disque : {source.name}", "avert")
            continue
        url = _envoyer_photo(_compresser(source), f"{court}_{rang:02d}.jpg", cle)
        urls.append(url)
        # Enregistré après CHAQUE photo : une coupure ne fait pas tout
        # recommencer, et un second passage ne réenvoie rien.
        base.modifier_photo(photo["id"], url_o2=url)
        if rappel:
            rappel(rang, len(photos))
        time.sleep(float(cfg.get("pause_entre_envois_photos", 3.0)))
    return urls


# ── Écriture de la fiche ───────────────────────────────────────────────────
def _sql_upsert_fiche(fiche: dict, urls: list[str], localite_id: str | None) -> str:
    photos = (
        "ARRAY[" + ", ".join(akora.txt(u) for u in urls) + "]::text[]"
        if urls else "'{}'::text[]"
    )
    source_url = ""
    if fiche.get("publications"):
        source_url = fiche["publications"][0].get("permalien") or ""

    colonnes = {
        "jeton": akora.txt(fiche["jeton"]),
        "raison_sociale": akora.txt(fiche.get("nom") or "Dépôt sans nom"),
        "metier": akora.txt(fiche.get("metier")),
        "telephone": akora.txt(fiche.get("telephone")),
        "whatsapp": akora.bool_sql(fiche.get("whatsapp")),
        "page_url": akora.txt(fiche.get("page_url")),
        "ville": akora.txt(fiche.get("ville")),
        "quartier": akora.txt(fiche.get("quartier")),
        "adresse": akora.txt(fiche.get("adresse")),
        "lat": akora.reel(fiche.get("lat")),
        "lng": akora.reel(fiche.get("lng")),
        "localite_id": (f"{akora.txt(localite_id)}::uuid" if localite_id else "NULL"),
        "photos": photos,
        "langue": akora.txt(fiche.get("langue") or "fr"),
        "source": "'facebook'",
        "source_url": akora.txt(source_url),
        "score": akora.num(fiche.get("score")),
    }
    noms = ", ".join(colonnes)
    valeurs = ", ".join(colonnes.values())
    # Le jeton est la clé : une seconde réservation du même prospect met la
    # fiche à jour au lieu d'en créer une deuxième — et l'adresse envoyée au
    # dépôt reste valable.
    maj = ", ".join(
        f"{nom} = excluded.{nom}" for nom in colonnes if nom != "jeton"
    )
    return (
        f"INSERT INTO public.prospects_fournisseurs ({noms}) VALUES ({valeurs}) "
        f"ON CONFLICT (jeton) DO UPDATE SET {maj}, updated_at = now() "
        "RETURNING id::text;"
    )


def _sql_produits(prospect_distant: str, offres: list[dict]) -> str:
    """Remplace les produits relevés. Rien n'est inséré sans référence valide."""
    lignes = []
    for rang, offre in enumerate(offres):
        if not offre.get("materiau_slug"):
            continue
        lignes.append(
            "(" + ", ".join([
                f"{akora.txt(prospect_distant)}::uuid",
                f"(SELECT id FROM public.materiaux_ref WHERE slug = "
                f"{akora.txt(offre['materiau_slug'])})",
                akora.txt(offre.get("materiau_nom") or offre.get("libelle_brut")),
                akora.num(offre.get("prix")),
                (f"{akora.txt(offre['unite'])}::public.unite"
                 if offre.get("unite") else "NULL"),
                akora.num(offre.get("quantite_min")),
                str(rang),
            ]) + ")"
        )
    suppression = (
        "DELETE FROM public.prospects_produits WHERE prospect_id = "
        f"{akora.txt(prospect_distant)}::uuid;"
    )
    if not lignes:
        return suppression
    return suppression + (
        "INSERT INTO public.prospects_produits "
        "(prospect_id, materiau_ref_id, libelle, prix_unitaire, unite, "
        "quantite_min, ordre) VALUES " + ", ".join(lignes) +
        # Une référence disparue du catalogue rendrait le sous-select NULL :
        # la ligne est simplement écartée, elle ne fait pas échouer le lot.
        " ON CONFLICT (prospect_id, materiau_ref_id) DO NOTHING;"
    )


def reserver(prospect_id: str, rappel=None) -> dict:
    """Réserve la place d'un prospect sur le site. Renvoie {url, produits, photos}."""
    fiche = base.prospect(prospect_id)
    if not fiche:
        raise ErreurReservation("Prospect introuvable.")
    if fiche["statut"] in ("refuse", "revendique"):
        raise ErreurReservation(
            "Ce dépôt a refusé ou a déjà revendiqué sa fiche."
        )
    if not (fiche.get("nom") or "").strip():
        raise ErreurReservation(
            "Il faut un nom d'enseigne avant de réserver : c'est ce que le "
            "dépôt lira en haut de sa fiche."
        )

    offres = [
        o for o in fiche["offres"] if o["garder"] and o.get("materiau_slug")
    ]
    if not offres:
        raise ErreurReservation(
            "Aucune offre appariée au catalogue : il n'y aurait rien à montrer. "
            "Précisez au moins un format dans le panneau."
        )

    base.logguer(f"Réservation de « {fiche['nom']} » — envoi des photos…", "info")
    urls = envoyer_photos(fiche, rappel)

    localite = None
    try:
        trouvee = akora.localite_par_nom(fiche.get("quartier") or fiche.get("ville") or "")
        localite = trouvee["id"] if trouvee else None
        # La coordonnée vient de la table `localites`, jamais d'une estimation :
        # règle A2.8, aucune coordonnée inventée.
        if trouvee and trouvee.get("lat") is not None and not fiche.get("lat"):
            fiche["lat"], fiche["lng"] = trouvee["lat"], trouvee["lng"]
            base.modifier_prospect(prospect_id, {"lat": trouvee["lat"], "lng": trouvee["lng"]})
    except akora.ErreurAkora:
        pass

    lignes = akora.executer(_sql_upsert_fiche(fiche, urls, localite))
    if not lignes or not lignes[0].get("id"):
        raise ErreurReservation("La fiche n'a pas été écrite (aucun identifiant rendu).")
    distant = lignes[0]["id"]
    akora.executer(_sql_produits(distant, offres))

    url = f"{SITE}/depot-reserve/{fiche['jeton']}"
    base.modifier_prospect(prospect_id, {
        "statut": "reserve" if fiche["statut"] in ("a_trier", "valide", "incomplet")
        else fiche["statut"],
        "fiche_url": url,
        "reserve_le": base.maintenant(),
        "prospect_distant": distant,
    })
    base.evenement(
        prospect_id, "reservation",
        f"Fiche réservée avec {len(offres)} produit(s) et {len(urls)} photo(s).",
    )
    base.logguer(f"Fiche réservée : {url}", "succes")
    return {"url": url, "produits": len(offres), "photos": len(urls)}


def retirer(prospect_id: str, motif: str = "") -> None:
    """Retire la fiche du site. Utilisé quand le dépôt dit non."""
    fiche = base.prospect(prospect_id)
    if not fiche or not fiche.get("jeton"):
        return
    akora.executer(
        "UPDATE public.prospects_fournisseurs SET statut = 'retire', updated_at = now() "
        f"WHERE jeton = {akora.txt(fiche['jeton'])} AND statut = 'reserve';"
        "DELETE FROM public.prospects_produits WHERE prospect_id IN "
        f"(SELECT id FROM public.prospects_fournisseurs WHERE jeton = {akora.txt(fiche['jeton'])});"
    )
    base.evenement(prospect_id, "statut", f"Fiche retirée du site. {motif}".strip())


def synchroniser_statuts() -> dict:
    """Relit le site : qui a ouvert sa fiche, qui l'a revendiquée, qui a refusé.

    C'est la boucle de retour du bot. Sans elle, on relancerait un dépôt qui
    vient de créer son compte — et une fiche ouverte trois fois sans suite est
    justement celle qui mérite un appel plutôt qu'un message de plus.
    """
    lignes = akora.executer(
        "SELECT jeton, statut, nb_vues, vue_le, revendique_le, "
        "       coalesce(fournisseur_id::text, '') AS fournisseur_id "
        "  FROM public.prospects_fournisseurs;"
    )
    par_jeton = {l["jeton"]: l for l in lignes}
    bilan = {"revendiques": 0, "refuses": 0, "vues": 0}

    for prospect in base.lister_prospects(statut="tous", limite=2000):
        distant = par_jeton.get(prospect.get("jeton") or "")
        if not distant:
            continue
        if distant["statut"] == "revendique" and prospect["statut"] != "revendique":
            base.modifier_prospect(prospect["id"], {
                "statut": "revendique",
                "revendique_le": distant.get("revendique_le") or base.maintenant(),
                "fournisseur_id": distant.get("fournisseur_id") or None,
            })
            base.evenement(prospect["id"], "reponse", "Fiche REVENDIQUÉE sur le site.")
            base.logguer(
                f"🎉 {prospect.get('nom') or 'Un dépôt'} a revendiqué sa fiche.", "succes"
            )
            bilan["revendiques"] += 1
        elif distant["statut"] == "refuse" and prospect["statut"] != "refuse":
            base.modifier_prospect(prospect["id"], {
                "statut": "refuse",
                "note": "A refusé depuis la fiche.",
            })
            base.refuser_definitivement(
                prospect.get("telephone_cle") or prospect.get("cle") or "",
                prospect.get("nom") or "", "refus depuis la fiche",
            )
            base.evenement(prospect["id"], "reponse", "Refus exprimé depuis la fiche.")
            bilan["refuses"] += 1
        elif int(distant.get("nb_vues") or 0) > 0 and prospect["statut"] == "contacte":
            base.evenement(
                prospect["id"], "reponse",
                f"Fiche ouverte {distant['nb_vues']} fois, sans revendication.",
            )
            bilan["vues"] += 1

    base.logguer(
        f"Retour du site : {bilan['revendiques']} revendication(s), "
        f"{bilan['refuses']} refus, {bilan['vues']} fiche(s) consultée(s).",
        "info",
    )
    return bilan
