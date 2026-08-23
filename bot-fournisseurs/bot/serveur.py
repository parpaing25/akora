"""Serveur local du bot : API JSON + interface web.

Tout tourne sur la machine d'Andry, sur 127.0.0.1 : rien n'est exposé au
réseau. Les tâches longues (collecte, réservation en lot) partent dans un fil
séparé et rendent la main tout de suite ; l'interface suit l'avancement via
/api/etat, interrogé toutes les deux secondes.
"""
from __future__ import annotations

import threading
import webbrowser
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse
from pydantic import BaseModel

from . import analyse_llm, akora, base, fil, marche, prospection, referentiel, reservation
from . import demandes as mod_demandes
from . import planificateur as plan
from .collecteur import (
    analyser_source,
    collecteur,
    oublier_session,
    session_enregistree,
)
from .config import DOSSIER_PROSPECTS, RACINE, charger, enregistrer

WEB = RACINE / "web"

app = FastAPI(title="Bot fournisseurs Akora", docs_url=None, redoc_url=None)

# État des tâches de fond, lu par l'interface toutes les 2 secondes.
tache = {"type": None, "actif": False, "message": "", "detail": ""}


def _lancer(type_tache: str, fonction) -> bool:
    if tache["actif"]:
        return False
    tache.update({"type": type_tache, "actif": True, "message": "", "detail": ""})

    def enveloppe():
        try:
            fonction()
        except Exception as e:
            base.logguer(f"{type_tache} : {e}", "erreur")
            tache["message"] = str(e)
        finally:
            tache["actif"] = False

    threading.Thread(target=enveloppe, daemon=True).start()
    return True


def _occupe() -> bool:
    return tache["actif"] or collecteur.etat.get("actif", False)


# -- Modèles d'entrée --------------------------------------------------------
class SourceEntree(BaseModel):
    nom: str = ""
    url: str


class ChampsEntree(BaseModel):
    champs: dict


class ConfigEntree(BaseModel):
    config: dict


class StatutEntree(BaseModel):
    statut: str
    note: str = ""


class ContactEntree(BaseModel):
    canal: str = "whatsapp"


class MotifEntree(BaseModel):
    motif: str = ""


class BulletinEntree(BaseModel):
    ville: str = ""
    forcer: bool = False


class PublicationEntree(BaseModel):
    id: str


# -- Interface ---------------------------------------------------------------
@app.get("/")
def accueil():
    """Sert l'interface, avec une empreinte sur les fichiers statiques.

    Sans ça le navigateur garde son ancien CSS : une correction d'affichage
    peut rester invisible des heures.
    """
    page = (WEB / "index.html").read_text(encoding="utf-8")
    for fichier in ("style.css", "app.js", "modules.js"):
        empreinte = int((WEB / fichier).stat().st_mtime)
        page = page.replace(f"/static/{fichier}", f"/static/{fichier}?v={empreinte}")
    return HTMLResponse(page)


@app.get("/static/{fichier}")
def statique(fichier: str):
    chemin = (WEB / Path(fichier).name).resolve()
    if not chemin.is_file() or WEB.resolve() not in chemin.parents:
        raise HTTPException(404, "Fichier inconnu")
    return FileResponse(chemin)


@app.get("/photo/{publication_id}/{fichier}")
def photo(publication_id: str, fichier: str):
    """Sert une photo collectée. Le nom de fichier est contraint, pas de remontée."""
    with base._verrou, base.connexion() as cx:
        ligne = cx.execute(
            "SELECT dossier FROM publications WHERE id = ?", (publication_id,)
        ).fetchone()
    if not ligne or not ligne["dossier"]:
        raise HTTPException(404, "Publication inconnue")
    chemin = (DOSSIER_PROSPECTS.parent / ligne["dossier"] / Path(fichier).name).resolve()
    if not chemin.is_file() or DOSSIER_PROSPECTS.resolve() not in chemin.parents:
        raise HTTPException(404, "Photo introuvable")
    return FileResponse(chemin)


# -- API : état et journal ---------------------------------------------------
@app.get("/api/etat")
def etat():
    config = charger()
    return {
        "compteurs": base.compteurs(),
        "collecte": collecteur.etat,
        "tache": tache,
        "journal": base.lire_journal(60),
        "session_fb": session_enregistree(),
        "sources_actives": len(base.sources(actives_seulement=True)),
        "planning": plan.bilan_du_jour(config),
        "referentiel": referentiel.est_charge(),
        "bilan": prospection.bilan(),
        "marche": marche.resume(),
        "demandes": base.compter_demandes(),
    }


# -- API : sources -----------------------------------------------------------
@app.get("/api/sources")
def liste_sources():
    return base.sources()


@app.post("/api/sources")
def creer_source(entree: SourceEntree):
    try:
        url, genre, requete = analyser_source(entree.url)
    except ValueError as e:
        raise HTTPException(400, str(e))
    nom = entree.nom.strip()
    if not nom:
        nom = requete or url.rstrip("/").split("/")[-1].split("=")[-1]
    return base.ajouter_source(nom, url, genre, requete)


@app.patch("/api/sources/{sid}")
def maj_source(sid: int, entree: ChampsEntree):
    base.modifier_source(sid, **entree.champs)
    return {"ok": True}


@app.delete("/api/sources/{sid}")
def effacer_source(sid: int):
    base.supprimer_source(sid)
    return {"ok": True}


# -- API : prospects ---------------------------------------------------------
@app.get("/api/prospects")
def liste_prospects(statut: str = "", source_id: int = 0, recherche: str = "",
                    famille: str = "", tri: str = "score"):
    return base.lister_prospects(
        statut=statut, source_id=source_id, recherche=recherche,
        famille=famille, tri=tri,
    )


@app.get("/api/prospects/{pid}")
def voir_prospect(pid: str):
    fiche = base.prospect(pid)
    if not fiche:
        raise HTTPException(404, "Prospect inconnu")
    return fiche


CHAMPS_MODIFIABLES = {
    "nom", "metier", "telephone", "whatsapp", "ville", "quartier", "adresse",
    "langue", "livre", "retrait_sur_place", "note", "lat", "lng",
    # `nature` se corrige à la main : un dépôt qui liste ses matériaux sans
    # prix tout en parlant de livraison peut être lu comme un transporteur.
    "nature", "rayon_km", "seuil_franco",
}


@app.patch("/api/prospects/{pid}")
def corriger_prospect(pid: str, entree: ChampsEntree):
    """Corrige une fiche à la main. Une valeur saisie ici fait autorité.

    `nom_valide` passe à 1 dès qu'un nom est saisi : la collecte suivante ne
    le remplacera plus par le pseudo du compte Facebook.
    """
    champs = {c: v for c, v in entree.champs.items() if c in CHAMPS_MODIFIABLES}
    if not champs:
        raise HTTPException(400, "Aucun champ modifiable dans la requête.")
    if "telephone" in champs:
        from .extraction import normaliser_telephone
        affichage, cle = normaliser_telephone(str(champs["telephone"]))
        if not cle:
            raise HTTPException(400, "Numéro malgache non reconnu (03X XX XXX XX).")
        champs["telephone"], champs["telephone_cle"] = affichage, cle
    if champs.get("nom"):
        champs["nom_valide"] = 1
    base.modifier_prospect(pid, champs)
    from . import fusion
    return fusion.evaluer(pid, charger())


@app.post("/api/prospects/{pid}/statut")
def changer_statut(pid: str, entree: StatutEntree):
    try:
        return prospection.changer_statut(pid, entree.statut, entree.note)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/api/prospects/{pid}")
def effacer_prospect(pid: str):
    base.supprimer_prospect(pid)
    return {"ok": True}


# -- API : offres ------------------------------------------------------------
@app.patch("/api/offres/{oid}")
def corriger_offre(oid: int, entree: ChampsEntree):
    """Corrige une offre. Choisir un format lève l'ambiguïté et remet le score.

    C'est le geste le plus fréquent de l'interface : « biriky 1 300 Ar » devient
    « parpaing creux 15 », et le prospect passe de non publiable à publiable.
    """
    champs = dict(entree.champs)
    if champs.get("materiau_slug"):
        catalogue = referentiel.charger()
        materiau = catalogue["materiaux"].get(champs["materiau_slug"])
        if not materiau:
            raise HTTPException(400, "Cette référence n'existe pas dans le catalogue.")
        type_fiche = catalogue["types"].get(materiau.get("type_slug"), {})
        champs.update({
            "materiau_nom": materiau["nom"],
            "type_slug": materiau.get("type_slug"),
            "type_nom": type_fiche.get("nom"),
            "famille_slug": materiau.get("famille"),
            "unite": champs.get("unite") or materiau.get("unite"),
            "ambigu": 0,
            "hors_catalogue": 0,
            "certitude": 100,      # choisi à la main : plus fiable que tout
        })
    base.modifier_offre(oid, **champs)

    with base._verrou, base.connexion() as cx:
        ligne = cx.execute(
            "SELECT prospect_id FROM offres WHERE id = ?", (oid,)
        ).fetchone()
    if not ligne:
        raise HTTPException(404, "Offre inconnue")
    from . import fusion
    return fusion.evaluer(ligne["prospect_id"], charger())


@app.delete("/api/offres/{oid}")
def effacer_offre(oid: int):
    base.supprimer_offre(oid)
    return {"ok": True}


# -- API : photos ------------------------------------------------------------
@app.patch("/api/photos/{photo_id}")
def corriger_photo(photo_id: int, entree: ChampsEntree):
    base.modifier_photo(photo_id, **entree.champs)
    return {"ok": True}


@app.post("/api/prospects/{pid}/couverture/{photo_id}")
def couverture(pid: str, photo_id: int):
    base.definir_couverture(pid, photo_id)
    return {"ok": True}


# -- API : référentiel -------------------------------------------------------
@app.get("/api/referentiel")
def arbre_referentiel():
    try:
        return referentiel.arbre()
    except Exception as e:
        raise HTTPException(503, str(e))


@app.get("/api/referentiel/formats/{type_slug}")
def formats(type_slug: str):
    return referentiel.formats_du_type(type_slug)


@app.post("/api/referentiel/synchroniser")
def synchroniser_referentiel():
    try:
        referentiel.synchroniser()
    except Exception as e:
        raise HTTPException(502, str(e))
    catalogue = referentiel.charger()
    return {
        "familles": len(catalogue["familles"]),
        "types": len(catalogue["types"]),
        "materiaux": len(catalogue["materiaux"]),
    }


@app.get("/api/materiaux-absents")
def materiaux_absents():
    """Ce que le terrain vend et que le catalogue fermé d'Akora ignore encore."""
    return base.materiaux_absents()


# -- API : véhicules ---------------------------------------------------------
@app.patch("/api/vehicules/{vid}")
def corriger_vehicule(vid: int, entree: ChampsEntree):
    """Corrige un camion. C'est ici qu'on saisit la capacité que le texte ne dit pas.

    « 10 roues » ne se convertit pas en mètres cubes tout seul (règle A2.8) :
    le bot garde le libellé et laisse le chiffre vide. C'est ce champ qui le
    remplit, et sans lui aucun prix rendu chantier n'est calculable.
    """
    base.modifier_vehicule(vid, **entree.champs)
    with base._verrou, base.connexion() as cx:
        ligne = cx.execute(
            "SELECT prospect_id FROM vehicules WHERE id = ?", (vid,)
        ).fetchone()
    if not ligne:
        raise HTTPException(404, "Véhicule inconnu")
    from . import fusion
    return fusion.evaluer(ligne["prospect_id"], charger())


@app.delete("/api/vehicules/{vid}")
def effacer_vehicule(vid: int):
    base.supprimer_vehicule(vid)
    return {"ok": True}


# -- API : demandes d'acheteurs ----------------------------------------------
@app.get("/api/demandes")
def liste_demandes(statut: str = "", famille: str = "", ville: str = ""):
    return base.lister_demandes(statut=statut, famille=famille, ville=ville)


@app.get("/api/demandes/pression")
def pression(jours: int = 7):
    """Ce que les acheteurs réclament, du plus demandé au moins."""
    return mod_demandes.pression_du_marche(jours)


@app.get("/api/demandes/{did}")
def voir_demande(did: str):
    fiche = base.demande(did)
    if not fiche:
        raise HTTPException(404, "Demande inconnue")
    return fiche


@app.get("/api/demandes/{did}/fournisseurs")
def qui_peut_servir(did: str):
    """Qui, parmi les prospects, peut servir cette demande."""
    return mod_demandes.fournisseurs_capables(did)


@app.post("/api/demandes/{did}/statut")
def statut_demande(did: str, entree: StatutEntree):
    try:
        return mod_demandes.changer_statut(did, entree.statut, entree.note)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/prospects/{pid}/argumentaire")
def argumentaire(pid: str):
    """Les demandes que CE prospect pourrait servir — l'argument qui fait signer."""
    return mod_demandes.argumentaire(pid)


# -- API : fil d'Akora -------------------------------------------------------
@app.get("/api/fil/apercu")
def apercu_bulletin(ville: str = ""):
    """Le brouillon du bulletin de prix. Ne publie RIEN."""
    try:
        return fil.apercu(ville)
    except fil.ErreurFil as e:
        raise HTTPException(409, str(e))
    except Exception as e:
        raise HTTPException(502, str(e))


@app.post("/api/fil/publier")
def publier_bulletin(entree: BulletinEntree):
    """Écrit le bulletin dans le fil public d'Akora. Sur clic humain uniquement."""
    try:
        return fil.publier(entree.ville, entree.forcer)
    except fil.ErreurFil as e:
        raise HTTPException(409, str(e))
    except Exception as e:
        raise HTTPException(502, str(e))


@app.post("/api/fil/retirer")
def retirer_bulletin(entree: PublicationEntree):
    try:
        fil.retirer(entree.id)
    except Exception as e:
        raise HTTPException(502, str(e))
    return {"ok": True}


# -- API : marché ------------------------------------------------------------
@app.get("/api/marche")
def observatoire(famille: str = "", ville: str = ""):
    return marche.observatoire(famille, ville)


@app.get("/api/marche/{materiau_slug}")
def historique(materiau_slug: str):
    return marche.historique(materiau_slug)


@app.get("/api/couverture")
def couverture_geo():
    return marche.couverture()


# -- API : prospection -------------------------------------------------------
@app.get("/api/file")
def file_du_jour():
    return prospection.file_du_jour(charger())


@app.get("/api/prospects/{pid}/message")
def message(pid: str, modele: str = ""):
    try:
        return prospection.preparer_message(pid, modele)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.post("/api/prospects/{pid}/contacte")
def contacte(pid: str, entree: ContactEntree):
    try:
        return prospection.marquer_contacte(pid, entree.canal)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.post("/api/prospects/{pid}/refus")
def refus(pid: str, entree: MotifEntree):
    try:
        return prospection.marquer_refus(pid, entree.motif)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.get("/api/liste-rouge")
def liste_rouge():
    return base.liste_rouge()


@app.get("/api/export.csv")
def export(statut: str = ""):
    return PlainTextResponse(
        prospection.exporter_csv(statut),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="prospects-akora.csv"'},
    )


# -- API : réservation -------------------------------------------------------
@app.post("/api/prospects/{pid}/reserver")
def reserver(pid: str):
    fiche = base.prospect(pid)
    if not fiche:
        raise HTTPException(404, "Prospect inconnu")

    resultat: dict = {}

    def travail():
        resultat.update(reservation.reserver(
            pid, rappel=lambda rang, total: tache.update(
                {"detail": f"photo {rang}/{total}"}
            ),
        ))

    if not _lancer("reservation", travail):
        raise HTTPException(409, "Une autre tâche est déjà en cours.")
    return {"lancee": True}


@app.post("/api/reserver-lot")
def reserver_lot():
    """Réserve toutes les fiches validées, l'une après l'autre.

    Séquentiel exprès : l'envoi de photos vers o2switch part en 500 dès qu'on
    enchaîne sans pause, et une réservation à moitié faite est pire qu'aucune.
    """
    def travail():
        prospects = base.lister_prospects(statut="valide", tri="score", limite=200)
        if not prospects:
            base.logguer("Aucun prospect validé à réserver.", "avert")
            return
        reussies = 0
        for rang, prospect in enumerate(prospects, start=1):
            tache["detail"] = f"{rang}/{len(prospects)} — {prospect.get('nom')}"
            try:
                reservation.reserver(prospect["id"])
                reussies += 1
            except Exception as e:
                base.logguer(f"« {prospect.get('nom')} » non réservé : {e}", "erreur")
        base.logguer(
            f"Réservation en lot terminée : {reussies}/{len(prospects)} fiche(s).",
            "succes",
        )

    if not _lancer("reservation_lot", travail):
        raise HTTPException(409, "Une autre tâche est déjà en cours.")
    return {"lancee": True}


@app.post("/api/synchroniser-statuts")
def synchroniser_statuts():
    def travail():
        reservation.synchroniser_statuts()

    if not _lancer("synchro", travail):
        raise HTTPException(409, "Une autre tâche est déjà en cours.")
    return {"lancee": True}


# -- API : collecte ----------------------------------------------------------
@app.post("/api/collecte")
def lancer_collecte():
    if not session_enregistree():
        raise HTTPException(400, "Connectez d'abord un compte Facebook.")

    def travail():
        collecteur.collecter()

    if not _lancer("collecte", travail):
        raise HTTPException(409, "Une tâche est déjà en cours.")
    return {"lancee": True}


@app.post("/api/collecte/arret")
def arreter_collecte():
    collecteur.stop.set()
    return {"ok": True}


@app.post("/api/facebook/connexion")
def connexion_facebook():
    def travail():
        collecteur.ouvrir_connexion()

    if not _lancer("connexion", travail):
        raise HTTPException(409, "Une tâche est déjà en cours.")
    return {"lancee": True}


@app.post("/api/facebook/oublier")
def oublier_facebook():
    oublier_session()
    return {"ok": True}


# -- API : réglages ----------------------------------------------------------
@app.get("/api/config")
def lire_config():
    return charger()


@app.post("/api/config")
def ecrire_config(entree: ConfigEntree):
    config = charger()
    config.update(entree.config)
    enregistrer(config)
    base.logguer("Réglages enregistrés.", "info")
    return config


@app.post("/api/llm/test")
def tester_llm():
    try:
        return analyse_llm.tester(charger())
    except analyse_llm.LLMIndisponible as e:
        raise HTTPException(502, str(e))


@app.post("/api/akora/test")
def tester_akora():
    try:
        return akora.tester()
    except Exception as e:
        raise HTTPException(502, str(e))


# -- Démarrage ---------------------------------------------------------------
_planificateur: plan.Planificateur | None = None


@app.on_event("startup")
def au_demarrage():
    global _planificateur
    base.logguer("Bot de prospection Akora démarré.", "info")
    # Le référentiel se charge depuis le cache disque, sans réseau : le bot
    # doit pouvoir servir son interface même si Supabase est injoignable.
    try:
        referentiel.charger()
    except Exception:
        base.logguer(
            "Référentiel non chargé — onglet Réglages, « Synchroniser le "
            "référentiel Akora ».", "avert",
        )
    _planificateur = plan.Planificateur(
        lancer_collecte=lambda reglages: _lancer(
            "collecte", lambda: collecteur.collecter(reglages=reglages)
        ),
        est_occupe=_occupe,
        synchroniser=reservation.synchroniser_statuts,
    )


@app.on_event("shutdown")
def a_l_arret():
    if _planificateur:
        _planificateur.fermer()


def demarrer(port: int = 8758, ouvrir: bool = True) -> None:
    if ouvrir:
        threading.Timer(1.2, lambda: webbrowser.open(f"http://127.0.0.1:{port}")).start()
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
