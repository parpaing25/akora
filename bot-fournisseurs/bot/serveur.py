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

from . import analyse_llm, akora, base, fil, formats, inscription, marche, prospection
from . import tri
from . import referentiel, reservation
from . import sources_prospection
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


# Ce que chaque tâche MOBILISE. Deux tâches ne s'excluent que si elles se
# disputent la même ressource : il n'y a qu'un profil Chromium, donc les tâches
# qui passent par Facebook se suivent. Les autres n'ont aucune raison
# d'attendre — mesuré sur Diako : une moisson de huit minutes bloquait la
# prospection Facebook tout ce temps, et le bouton répondait « une tâche est
# déjà en cours » sans dire laquelle.
RESSOURCE = {
    "collecte": "navigateur",
    "prospection_sources": "navigateur",
    "connexion": "navigateur",
    "reservation": "site",
    "reservation_lot": "site",
    "synchro": "reseau",
}

_ressources_prises: dict[str, str] = {}   # ressource -> type de tâche en cours
_verrou_taches = threading.Lock()         # deux requêtes peuvent arriver ensemble


def _lancer(type_tache: str, fonction) -> bool:
    ressource = RESSOURCE.get(type_tache, type_tache)
    with _verrou_taches:
        if ressource in _ressources_prises:
            return False
        _ressources_prises[ressource] = type_tache
    tache.update({"type": type_tache, "actif": True, "message": "", "detail": ""})

    def enveloppe():
        try:
            fonction()
        except Exception as e:
            base.logguer(f"{type_tache} : {e}", "erreur")
            tache["message"] = str(e)
        finally:
            with _verrou_taches:
                _ressources_prises.pop(ressource, None)
                # `tache` ne montre qu'une chose à la fois : tant qu'il en
                # reste une en cours, l'interface doit continuer à l'annoncer.
                tache["actif"] = bool(_ressources_prises)
                if _ressources_prises:
                    tache["type"] = next(iter(_ressources_prises.values()))

    threading.Thread(target=enveloppe, daemon=True).start()
    return True


def _refuser_si_poussee_eteinte() -> None:
    """Coupe court quand `pousser_les_fiches` est éteint.

    Le refus tombe AVANT `_lancer()`, donc avant qu'un fil de fond ne parte :
    l'utilisateur voit la raison dans le bandeau d'erreur, tout de suite, au
    lieu de la lire dans le journal une minute plus tard — et surtout au lieu
    de la lire APRÈS que les photos soient parties sur o2switch.
    """
    if not reservation.poussee_autorisee(charger()):
        raise HTTPException(409, reservation.POUSSEE_ETEINTE)


def _occupe() -> bool:
    return tache["actif"] or collecteur.etat.get("actif", False)


# -- Modèles d'entrée --------------------------------------------------------
class RequetesEntree(BaseModel):
    requetes: list[str] | None = None


class ChoixEntree(BaseModel):
    ids: list[str]


class SeuilEntree(BaseModel):
    seuil: int = 20


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


class DecisionFormat(BaseModel):
    """Un format tranché par un humain, appliqué à une ou plusieurs offres.

    `confirme_unite` n'est pas un detail d'interface : sans lui, une offre
    relevee au m2 prendrait le prix d'une reference vendue a la piece.
    """
    ids: list[int]
    materiau_slug: str
    confirme_unite: bool = False


class FormatsEntree(BaseModel):
    decisions: list[DecisionFormat]


class ImportEntree(BaseModel):
    """Le lien d'UNE publication Facebook a faire entrer dans la base."""
    url: str


class ReferenceEntree(BaseModel):
    """Une reference a creer au catalogue, d'apres les cotes d'une ligne."""
    type_slug: str
    ligne: str
    ids: list[int] = []
    longueur_m: float | None = None


class HorsCatalogueEntree(BaseModel):
    ids: list[int]
    libelle: str = ""


class FusionEntree(BaseModel):
    """Une fusion de doublons, DÉCIDÉE PAR UN HUMAIN.

    `garder` est la fiche qui survit ; `absorbes` celles qui s'y versent. Le
    bot ne remplit jamais ce corps tout seul : il ne fait que proposer des
    rapprochements (`GET /api/doublons`).
    """
    garder: str
    absorbes: list[str] = []


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
        "candidats": base.compter_candidats().get("nouveau", 0),
        "planning": plan.bilan_du_jour(config),
        "referentiel": referentiel.est_charge(),
        "bilan": prospection.bilan(),
        "marche": marche.resume(),
        "demandes": base.compter_demandes(),
    }


# -- API : sources -----------------------------------------------------------
# -- Prospection de sources -------------------------------------------------
@app.get("/api/candidats")
def lister_candidats(statut: str = "nouveau", origine: str = ""):
    """Les groupes et pages repérés, avec leur note et leurs chiffres."""
    cfg = charger()
    seuil = int(cfg.get("prospection_note_min", 60))
    tous = base.candidats(statut)

    # Une source repérée sur le fil se note sur ce qu'elle a donné, et ses
    # compteurs bougent à chaque collecte : sa note doit suivre, sinon elle
    # reste figée sur la première publication croisée.
    for c in tous:
        if c.get("origine") == "fil":
            n = sources_prospection.noter(c, [])
            c.update(note=n["note"], niveau=n["niveau"],
                     alertes=n["alertes"], details=n["details"])

    # Les sources encore en observation passent en tête : ce sont celles dont
    # la prochaine collecte dira quelque chose.
    tous.sort(key=lambda c: (c.get("note") is not None,
                             -(c.get("note") or 0), -(c.get("effectif") or 0)))

    if origine:
        tous = [c for c in tous if c.get("origine") == origine]
    return {
        # `note is None` = encore en observation : elle n'est pas « sous le
        # seuil », on ne sait simplement pas encore. La masquer la ferait
        # disparaître avant d'avoir pu faire ses preuves.
        "candidats": [c for c in tous
                      if statut != "nouveau"
                      or c["note"] is None or c["note"] >= seuil],
        "sous_le_seuil": sum(1 for c in tous
                             if c["note"] is not None and c["note"] < seuil)
                         if statut == "nouveau" else 0,
        "seuil": seuil,
        "compteurs": base.compter_candidats(),
        "requetes": cfg.get("prospection_requetes")
                    or sources_prospection.REQUETES_DEFAUT,
    }


@app.post("/api/candidats/prospecter")
def lancer_prospection_sources(entree: RequetesEntree | None = None):
    """Va chercher de nouveaux groupes et pages sur Facebook."""
    requetes = (entree.requetes if entree and entree.requetes else None)

    def travail():
        def progression(fait, total, requete):
            tache["detail"] = f"{fait}/{total} · {requete}"
        r = collecteur.prospecter_sources(requetes, rappel=progression)
        tache["message"] = (
            f"{r['examines']} candidat(s) examiné(s), {r['nouveaux']} nouveau(x) "
            "à trancher." if r["nouveaux"] else
            f"{r['examines']} candidat(s) examiné(s), rien de nouveau."
        )

    if not _lancer("prospection_sources", travail):
        raise HTTPException(409, "Une tâche est déjà en cours.")
    return {"ok": True}


@app.post("/api/candidats/lot/{decision}")
def trancher_candidats_en_lot(decision: str, entree: ChoixEntree):
    """Adopte ou écarte plusieurs candidats cochés d'un coup."""
    if decision not in ("adopte", "ecarte"):
        raise HTTPException(400, "Décision inconnue.")
    faits = [c for cle in entree.ids if (c := base.decider_candidat(cle, decision))]
    base.logguer(
        f"{len(faits)} source(s) "
        + ("adoptée(s)." if decision == "adopte" else "écartée(s)."), "info"
    )
    return {"ok": True, "nombre": len(faits)}


@app.post("/api/candidats/{cle}/{decision}")
def trancher_candidat(cle: str, decision: str):
    """« adopte » ajoute la source, « ecarte » la retire pour de bon."""
    if decision not in ("adopte", "ecarte"):
        raise HTTPException(400, "Décision inconnue.")
    c = base.decider_candidat(cle, decision)
    if not c:
        raise HTTPException(404, "Candidat inconnu.")
    base.logguer(
        f"Source « {c['nom'][:44]} » "
        + ("adoptée — elle sera parcourue à la prochaine collecte."
           if decision == "adopte" else "écartée : elle ne sera plus proposée."),
        "succes" if decision == "adopte" else "info",
    )
    return {"ok": True, "candidat": c}


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


@app.get("/api/sources/rendement")
def rendement_sources():
    """Ce que chaque source a vraiment rapporté, et une note sur 100.

    Recalculé depuis les données à chaque appel — jamais depuis un compteur.
    Un compteur dit combien de publications une source a mises en file ; il ne
    dit pas si l'une d'elles portait un prix.
    """
    return base.rendement_des_sources()


@app.post("/api/sources/couper-les-muettes")
def couper_les_muettes(entree: SeuilEntree | None = None):
    """Désactive les sources qui n'ont rien donné, sans les supprimer.

    Désactiver plutôt que supprimer : un groupe peut se réveiller, et une
    source supprimée emporte l'historique qui explique pourquoi on l'avait
    ajoutée.
    """
    seuil = (entree.seuil if entree else 20)
    coupees = []
    for source in base.rendement_des_sources():
        if not source["actif"] or source["note"] is None:
            continue
        if source["note"] < seuil:
            base.modifier_source(source["id"], actif=0)
            coupees.append(source["nom"])
    if coupees:
        base.logguer(
            f"{len(coupees)} source(s) muette(s) désactivée(s) : "
            + ", ".join(coupees[:6]) + ("…" if len(coupees) > 6 else ""),
            "avert",
        )
    return {"coupees": len(coupees), "noms": coupees}


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
    "nature", "rayon_km", "seuil_franco", "site_web",
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


# ⚠ ORDRE CRITIQUE. Ces routes en lot doivent rester avant TOUTE route
# `/api/prospects/{pid}/...` : sans quoi `/api/prospects/lot/inscrire`
# est lu comme le prospect d'identifiant « lot », et repond « Prospect
# introuvable ». FastAPI teste dans l'ordre de declaration, pas du plus
# specifique au plus general.
@app.post("/api/prospects/lot/inscrire")
def inscrire_selection(entree: ChoixEntree):
    """Inscrit les fiches cochées sur le site, l'une après l'autre.

    Séquentiel : chaque inscription écrit un fournisseur, ses produits et sa
    flotte. Les enchaîner en parallèle ne gagnerait rien et rendrait un échec
    illisible.
    """
    def travail():
        cfg = charger()
        # Quatre comptes, pas deux : un depot qui tient DEJA sa fiche n'est ni
        # une reussite ni un echec, et le confondre avec l'un des deux ferait
        # chercher une panne la ou le bot a bien fait son travail.
        creees, adoptees, ignorees, echecs = 0, 0, 0, 0
        for rang, pid in enumerate(entree.ids[:200], start=1):
            fiche = base.prospect(pid)
            tache["detail"] = f"{rang}/{len(entree.ids)} — {(fiche or {}).get('nom', '')}"
            try:
                resultat = inscription.inscrire(pid, cfg.get("inscrire_en_actif", False))
                action = resultat.get("action")
                if action == "deja_au_depot":
                    ignorees += 1
                elif action == "adopte":
                    adoptees += 1
                else:
                    creees += 1
            except Exception as e:
                echecs += 1
                base.logguer(f"« {(fiche or {}).get('nom')} » non inscrit : {e}", "erreur")
        parties = [f"{creees} creee(s)"]
        if adoptees:
            parties.append(f"{adoptees} fiche(s) existante(s) completee(s)")
        if ignorees:
            parties.append(f"{ignorees} laissee(s) a leur depot")
        if echecs:
            parties.append(f"{echecs} echec(s)")
        base.logguer(
            f"Inscription en lot sur {len(entree.ids)} fiche(s) : "
            + ", ".join(parties) + ".",
            "succes" if (creees or adoptees) else "avert",
        )

    if not _lancer("inscription_lot", travail):
        raise HTTPException(409, "Une autre tâche est déjà en cours.")
    return {"lancee": True, "nombre": len(entree.ids)}


@app.post("/api/prospects/lot/reserver")
def reserver_selection(entree: ChoixEntree):
    """Réserve la fiche des prospects cochés, l'un après l'autre."""
    _refuser_si_poussee_eteinte()

    def travail():
        reussies = 0
        for rang, pid in enumerate(entree.ids[:200], start=1):
            fiche = base.prospect(pid)
            tache["detail"] = f"{rang}/{len(entree.ids)} — {(fiche or {}).get('nom', '')}"
            try:
                reservation.reserver(pid)
                reussies += 1
            except Exception as e:
                base.logguer(f"« {(fiche or {}).get('nom')} » non réservé : {e}", "erreur")
        base.logguer(
            f"Réservation de la sélection : {reussies}/{len(entree.ids)} fiche(s).",
            "succes" if reussies else "avert",
        )

    if not _lancer("reservation_lot", travail):
        raise HTTPException(409, "Une autre tâche est déjà en cours.")
    return {"lancee": True, "nombre": len(entree.ids)}



@app.get("/api/prospects/{pid}/inscription")
def apercu_inscription(pid: str):
    """Ce qui partirait sur le site, sans rien écrire."""
    try:
        return inscription.apercu(pid)
    except inscription.ErreurInscription as e:
        raise HTTPException(400, str(e))


@app.post("/api/prospects/{pid}/inscrire")
def inscrire_prospect(pid: str, actualiser_prix: bool = False):
    """Crée le fournisseur ET ses produits sur akora.fonenako.mg.

    En BROUILLON par défaut : la fiche existe, elle n'apparaît nulle part.
    C'est « Publier » qui la rend visible, et c'est un geste à part.
    """
    try:
        return inscription.inscrire(
            pid, charger().get("inscrire_en_actif", False), actualiser_prix)
    except inscription.ErreurInscription as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, str(e))


@app.post("/api/prospects/{pid}/produits")
def transferer_les_produits(pid: str, actualiser_prix: bool = False):
    """Envoie les produits COMPLETS de ce depot (reference + prix + photo).

    Le second geste, celui qui se repete : la fiche du depot se remplit une
    fois, ses produits arrivent au fil des appels et des photos designees.
    """
    try:
        return inscription.transferer_produits(pid, actualiser_prix)
    except inscription.ErreurInscription as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, str(e))


@app.get("/api/tri/bilan")
def bilan_du_tri():
    """Ou en est le corpus : depots prets, offres qui attendent quoi."""
    return tri.bilan()


@app.get("/api/tri/miroir")
def miroir_collecte_site():
    """Les trois egalites : types, fournisseurs, prix — collecte face au site."""
    return tri.miroir()


@app.get("/api/tri/appels")
def liste_d_appels(limite: int = 400):
    """Les depots a appeler, et ce qu'on leur demandera nommement.

    84 % des publications ne portent aucun prix (mesure du 01/09/2026) : le
    tarif se donne au telephone, pas dans le post. Cette liste remplace
    l'attente d'un prix qui ne tombera jamais tout seul.
    """
    return {"depots": tri.a_appeler(limite)}


@app.post("/api/prospects/{pid}/publier")
def publier_fournisseur(pid: str):
    """Rend la fiche visible dans l'annuaire public d'Akora."""
    try:
        return inscription.publier(pid)
    except inscription.ErreurInscription as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, str(e))


@app.post("/api/prospects/{pid}/depublier")
def depublier_fournisseur(pid: str):
    try:
        return inscription.depublier(pid)
    except inscription.ErreurInscription as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, str(e))


@app.post("/api/prospects/lot/{action}")
def trancher_prospects_en_lot(action: str, entree: ChoixEntree):
    """Valide, écarte ou réserve plusieurs fiches cochées d'un coup.

    Valider trente dépôts un par un, c'est trente allers-retours dans le
    panneau. La sélection multiple existait déjà pour les candidats de
    sources ; elle manquait là où il y a le plus de volume.

    Le refus n'est PAS proposé en lot, et c'est délibéré : il met un numéro en
    liste rouge pour toujours et retire la fiche du site. Une case cochée par
    mégarde ne doit pas pouvoir faire ça à trente dépôts.
    """
    if action not in ("valide", "rejete", "a_trier"):
        raise HTTPException(
            400,
            "Action en lot inconnue. Le refus définitif se fait fiche par fiche.",
        )
    faits, echecs = 0, []
    for pid in entree.ids[:500]:
        try:
            prospection.changer_statut(pid, action)
            faits += 1
        except Exception as e:
            echecs.append(f"{pid[:8]} : {e}")
    base.logguer(
        f"{faits} fiche(s) passée(s) en « {action} » en une fois."
        + (f" {len(echecs)} échec(s)." if echecs else ""),
        "succes" if faits else "avert",
    )
    return {"faits": faits, "echecs": echecs[:5]}


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


# -- API : doublons probables ------------------------------------------------
@app.get("/api/doublons")
def lister_doublons():
    """Les fiches qui sont PEUT-ÊTRE la même. Rien n'est fusionné ici.

    Deux niveaux de certitude, jamais mélangés dans l'interface : « même
    compte Facebook » (solide) et « même nom » (à regarder). Le second existe
    parce que le premier ne couvre pas tout ; il ne doit surtout pas déclencher
    de fusion automatique — « Fournisseur en Matériaux de construction » est
    une enseigne générique portée par des pages réellement différentes.
    """
    from . import fusion
    return fusion.doublons_probables()


@app.post("/api/doublons/fusionner")
def fusionner_doublons(entree: FusionEntree):
    """Verse des fiches dans une autre. Geste HUMAIN, irréversible.

    Irréversible : `absorber` déplace publications, offres, photos, véhicules
    et événements, puis supprime la fiche vidée. C'est pourquoi le bot ne le
    fait jamais de lui-même, même quand l'identifiant de compte est identique.
    """
    from . import fusion
    try:
        return fusion.fusionner_a_la_main(entree.garder, entree.absorbes, charger())
    except ValueError as e:
        raise HTTPException(400, str(e))


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
# ⚠ Ne PAS renommer cette fonction en `formats` : le module `bot/formats.py`
# porte ce nom, et une fonction de module l'eclipse silencieusement. Les
# routes de l'atelier tombaient alors sur
# « 'function' object has no attribute 'ErreurFormats' » — a l'appel, pas a
# l'import, donc invisible tant que personne n'ouvre l'onglet.
def formats_d_un_type(type_slug: str):
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


# -- API : atelier des formats -----------------------------------------------
# Le goulot mesure le 01/09/2026 : 210 offres CHIFFREES sans format, chez 34
# depots, et pas une seule offre publiable chez les 32 prospects valides. Le
# choix du format ne peut pas etre automatise -- l'heriter d'un en-tete avait
# etiquete une tole 0,45 mm au prix d'une 0,14 -- mais rien n'aidait a le
# faire en serie. Ces trois routes sont cet outil-la.
@app.get("/api/formats/atelier")
def atelier_formats():
    """Les offres chiffrees sans format, groupees par type. N'ecrit rien."""
    try:
        return formats.atelier()
    except formats.ErreurFormats as e:
        raise HTTPException(409, str(e))


@app.post("/api/formats/appliquer")
def appliquer_formats(entree: FormatsEntree):
    """Pose les formats choisis. Refuse une unite qui ne correspond pas."""
    try:
        return formats.appliquer([d.model_dump() for d in entree.decisions])
    except formats.ErreurFormats as e:
        raise HTTPException(400, str(e))


@app.post("/api/formats/creer-reference")
def creer_une_reference(entree: ReferenceEntree):
    """Ecrit au catalogue la reference que cette ligne reclame, puis l'applique.

    Le geste qui fait converger les deux bases : ce que la collecte trouve et
    que le site ignorait, le site l'apprend. La cote vient du tarif du depot,
    le volume se calcule, le poids suit la masse volumique deja en place pour
    ce type.
    """
    try:
        return formats.creer_reference(
            entree.type_slug, entree.ligne, entree.ids, entree.longueur_m)
    except formats.ErreurFormats as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, str(e))


@app.get("/api/formats/reference-possible")
def reference_possible(type_slug: str, ligne: str, longueur_m: float | None = None):
    """Ce qui serait cree — sans rien ecrire. Sert au bouton de l'atelier."""
    return referentiel.reference_a_creer(type_slug, ligne, longueur_m)


@app.post("/api/formats/hors-catalogue")
def formats_hors_catalogue(entree: HorsCatalogueEntree):
    """Ce que le terrain vend et qu'Akora ne reference pas encore."""
    return formats.signaler_hors_catalogue(entree.ids, entree.libelle)


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


# -- API : annuaire ----------------------------------------------------------
# Le recensement demandé par la mission : qui vend des matériaux à Madagascar,
# qu'il soit déjà chez nous ou repéré hier sur Facebook.
@app.get("/api/annuaire")
def annuaire():
    """La liste croisée. Ne lève JAMAIS parce que le site est injoignable.

    `annuaire_croise()` avale l'erreur réseau et la renvoie dans le champ
    `avertissement` : l'interface affiche les prospects locaux avec un bandeau,
    au lieu d'un tableau vide qui laisserait croire qu'il n'y a personne.
    """
    return prospection.annuaire_croise()


@app.get("/api/annuaire.csv")
def annuaire_csv():
    return PlainTextResponse(
        prospection.exporter_annuaire_csv(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="annuaire-akora.csv"'},
    )


# -- API : réservation -------------------------------------------------------
@app.post("/api/prospects/{pid}/reserver")
def reserver(pid: str):
    _refuser_si_poussee_eteinte()
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
    _refuser_si_poussee_eteinte()

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


@app.post("/api/importer")
def importer_publication(entree: ImportEntree):
    """Avale UNE publication Facebook designee par son lien.

    Le collecteur ne sait parcourir que des sources entieres. Ceci sert quand
    on tombe soi-meme sur la bonne publication — un depot qu'aucune source ne
    couvre, ou qu'on veut faire entrer sans attendre la tournee. La suite est
    identique a une collecte : meme lecture, meme appariement, memes photos.
    Rien n'est ecrit sur Akora ici.
    """
    if not session_enregistree():
        raise HTTPException(400, "Connectez d'abord un compte Facebook.")
    # Refuser TOUT DE SUITE ce qui n'est pas une adresse : lancer une tache de
    # fond pour repondre « lancee » a un lien vide, puis se plaindre dans le
    # journal, fait chercher le probleme au mauvais endroit.
    if not (entree.url or "").strip().startswith("http"):
        raise HTTPException(400, "Collez le lien complet de la publication.")
    resultat: dict = {}

    def travail():
        resultat.update(collecteur.importer(entree.url))
        if resultat.get("erreur"):
            base.logguer(f"Import refuse : {resultat['erreur']}", "erreur")

    if not _lancer("import", travail):
        raise HTTPException(409, "Une tache est deja en cours.")
    return {"lancee": True}


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
    def collecte_planifiee(reglages, apres=None) -> bool:
        """La collecte du planificateur, puis `apres()` — dans le MÊME fil.

        `_lancer` rend la main dès que le fil est parti : c'est ce qui laissait
        les tâches du jour démarrer pendant la collecte. Ici elles attendent
        sa fin, réussie ou non. Renvoie False si la collecte n'a pas pu
        partir — le planificateur sait alors quoi faire de `apres`.
        """
        def travail():
            try:
                collecteur.collecter(reglages=reglages)
            finally:
                if apres:
                    try:
                        apres()
                    except Exception as e:                   # noqa: BLE001
                        base.logguer(f"Tâches du jour : {e}", "erreur")

        return _lancer("collecte", travail)

    _planificateur = plan.Planificateur(
        lancer_collecte=collecte_planifiee,
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
