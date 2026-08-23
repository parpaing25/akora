"""Collectes automatiques aux heures dites, avec un objectif journalier.

Deux passages par jour (10 h et 17 h par défaut) sur toutes les sources
actives. Si le premier a peu donné, le second va chercher plus loin dans les
fils plutôt que de rester sur son quota : le but est un nombre de **nouveaux
fournisseurs** par jour, pas un nombre de défilements.

Le rattrapage ne rend PAS le bot plus agressif — il déroule davantage le même
fil, avec les mêmes pauses. Ce qui change, c'est la profondeur, pas le rythme.

Au premier passage de la journée, le planificateur relit aussi le site : qui a
ouvert sa fiche, qui l'a revendiquée, qui a refusé. Sans ce retour, on
relancerait un dépôt qui vient de créer son compte.
"""
from __future__ import annotations

import threading
from datetime import date, datetime, timedelta, timezone

from . import base
from .config import charger

CLE_DERNIER = "planificateur_dernier_creneau"
CLE_SYNCHRO = "planificateur_derniere_synchro"
CLE_TACHES = "planificateur_dernieres_taches"
VERIFICATION = 30      # secondes entre deux regards à l'horloge


def _heures(config: dict) -> list[str]:
    valides = []
    for brut in config.get("heures_collecte") or []:
        try:
            datetime.strptime(str(brut).strip(), "%H:%M")
            valides.append(str(brut).strip())
        except ValueError:
            base.logguer(f"Heure de collecte illisible, ignorée : {brut!r}", "avert")
    return sorted(valides)


def _minuit_utc() -> str:
    """Minuit d'ici, écrit comme les horodatages de la base (UTC, ISO).

    `cree_le` est stocké en UTC ; l'objectif, lui, se compte sur la journée
    d'Antananarivo. Sans cette conversion, la remise à zéro tomberait à 3 h du
    matin.
    """
    minuit_ici = datetime.now().astimezone().replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return minuit_ici.astimezone(timezone.utc).isoformat(timespec="seconds")


def trouves_aujourdhui() -> int:
    """Nouveaux fournisseurs depuis minuit — c'est la mesure de l'objectif.

    On compte les prospects CRÉÉS, pas les publications : un dépôt qui poste
    dix fois dans la journée ne fait pas dix résultats.
    """
    with base._verrou, base.connexion() as cx:
        return cx.execute(
            "SELECT COUNT(*) AS n FROM prospects WHERE cree_le >= ?", (_minuit_utc(),)
        ).fetchone()["n"]


def prochain_passage(config: dict) -> str:
    """« aujourd'hui 17:00 » ou « demain 10:00 », pour l'afficher."""
    heures = _heures(config)
    if not heures or not config.get("collecte_auto"):
        return ""
    maintenant = datetime.now()
    for heure in heures:
        moment = datetime.combine(
            maintenant.date(), datetime.strptime(heure, "%H:%M").time()
        )
        if moment > maintenant:
            return f"aujourd'hui {heure}"
    return f"demain {heures[0]}"


class Planificateur:
    """Surveille l'horloge et déclenche les collectes. Un seul fil, discret."""

    def __init__(self, lancer_collecte, est_occupe, synchroniser=None) -> None:
        self.lancer_collecte = lancer_collecte
        self.est_occupe = est_occupe
        self.synchroniser = synchroniser
        self.arret = threading.Event()
        self.fil = threading.Thread(target=self._boucle, daemon=True)
        self.fil.start()

    def _boucle(self) -> None:
        while not self.arret.wait(VERIFICATION):
            try:
                self._verifier()
            except Exception as e:
                base.logguer(f"Planificateur : {e}", "erreur")

    def _verifier(self) -> None:
        config = charger()
        if not config.get("collecte_auto"):
            return
        heures = _heures(config)
        if not heures:
            return

        maintenant = datetime.now()
        # Le créneau est « passé » dès son heure, et jusqu'à 30 min après : un
        # PC en veille à 10 h pile ne doit pas faire sauter la collecte.
        for heure in heures:
            moment = datetime.combine(
                maintenant.date(), datetime.strptime(heure, "%H:%M").time()
            )
            if not (moment <= maintenant < moment + timedelta(minutes=30)):
                continue

            marque = f"{date.today().isoformat()} {heure}"
            if base.lire_etat(CLE_DERNIER) == marque:
                return          # déjà fait
            if self.est_occupe():
                return          # on retentera dans 30 s, le créneau dure 30 min

            base.ecrire_etat(CLE_DERNIER, marque)
            self._retour_du_site()
            self._declencher(config, heure, heures)
            # Les automatisations tournent APRÈS la collecte, une fois par
            # jour : elles se nourrissent de ce qui vient d'être ramassé.
            self._taches_du_jour(config)
            return

    def _taches_du_jour(self, config: dict) -> None:
        """Les automatisations réglables, chacune muette si elle est éteinte.

        Aucune n'est irréversible, et aucune ne parle à un fournisseur : le
        bot n'envoie jamais de message, il prépare et signale.
        """
        aujourdhui = date.today().isoformat()
        if base.lire_etat(CLE_TACHES) == aujourdhui:
            return
        base.ecrire_etat(CLE_TACHES, aujourdhui)

        if config.get("auto_relances"):
            self._signaler_relances(config)
        if config.get("auto_recherches"):
            self._combler_les_trous(config)
        if config.get("auto_reservation"):
            self._reserver_les_valides(config)
        if config.get("auto_bulletin"):
            self._preparer_bulletin(config)

    def _signaler_relances(self, config: dict) -> None:
        """Compte les relances dues. N'envoie RIEN — c'est la règle du bot."""
        dus = base.a_relancer(
            int(config.get("delai_relance_jours", 3)),
            int(config.get("relances_max", 2)),
        )
        if dus:
            base.logguer(
                f"{len(dus)} relance(s) à faire aujourd'hui — onglet Prospection. "
                "Le bot prépare les messages, c'est vous qui envoyez.",
                "avert",
            )

    def _combler_les_trous(self, config: dict) -> None:
        """Ajoute des recherches Facebook là où personne ne sert un matériau.

        C'est l'automatisation qui fait grossir la liste des sources toute
        seule : le bot voit qu'aucun dépôt ne vend de tôle à Toamasina, et
        ajoute la recherche qui pourrait en trouver.
        """
        from . import marche
        from .collecteur import analyser_source

        try:
            couverture = marche.couverture()
        except Exception as e:
            base.logguer(f"Trous de couverture illisibles : {e}", "avert")
            return

        existantes = {
            (s.get("requete") or "").lower() for s in base.sources()
        }
        ajoutees = 0
        for trou in couverture["trous"]:
            if ajoutees >= int(config.get("auto_recherches_max", 3)):
                break
            if trou["ville"] == "Lieu inconnu":
                continue
            requete = f"{trou['famille_nom'].split(' ')[0]} {trou['ville']}"
            if requete.lower() in existantes:
                continue
            try:
                url, genre, texte = analyser_source(requete)
            except ValueError:
                continue
            base.ajouter_source(requete, url, genre, texte)
            existantes.add(requete.lower())
            ajoutees += 1
        if ajoutees:
            base.logguer(
                f"{ajoutees} recherche(s) ajoutée(s) pour combler des trous de "
                "couverture. Elles seront parcourues au prochain passage.",
                "info",
            )

    def _reserver_les_valides(self, config: dict) -> None:
        """Réserve les fiches validées. Écrit en base Akora, mais en PRIVÉ.

        Une fiche réservée n'est ni publique, ni indexée, ni dans l'annuaire :
        elle ne s'ouvre qu'avec son jeton. C'est pour ça que cette
        automatisation peut exister, là où la publication, elle, reste
        manuelle.
        """
        from . import reservation

        a_faire = base.lister_prospects(statut="valide", tri="score", limite=25)
        if not a_faire:
            return
        reussies = 0
        for prospect in a_faire:
            try:
                reservation.reserver(prospect["id"])
                reussies += 1
            except Exception as e:
                base.logguer(f"« {prospect.get('nom')} » non réservé : {e}", "erreur")
        base.logguer(
            f"Réservation automatique : {reussies}/{len(a_faire)} fiche(s).",
            "succes" if reussies else "avert",
        )

    def _preparer_bulletin(self, config: dict) -> None:
        """Prépare — et ne publie que si on le lui a EXPLICITEMENT demandé.

        Deux réglages séparés, et ce n'est pas de la coquetterie : préparer un
        brouillon n'engage rien, le publier signe une page publique au nom
        d'Akora. Le second interrupteur doit se choisir à part.
        """
        from . import fil

        ville = config.get("auto_bulletin_ville") or ""
        try:
            brouillon = fil.apercu(ville)
        except fil.ErreurFil as e:
            base.logguer(f"Bulletin non préparé : {e}", "info")
            return
        except Exception as e:
            base.logguer(f"Bulletin indisponible : {e}", "avert")
            return

        if not brouillon["publiable"]:
            return

        if not config.get("auto_bulletin_publier"):
            base.logguer(
                f"Bulletin de prix prêt ({brouillon['lignes']} matériaux) — "
                "onglet Marché pour le relire et le publier.",
                "avert",
            )
            return

        try:
            fil.publier(ville)
        except Exception as e:
            base.logguer(f"Bulletin non publié : {e}", "erreur")

    def _retour_du_site(self) -> None:
        """Une fois par jour : qui a revendiqué, qui a refusé, qui a regardé."""
        if not self.synchroniser or not charger().get("auto_synchro", True):
            return
        aujourdhui = date.today().isoformat()
        if base.lire_etat(CLE_SYNCHRO) == aujourdhui:
            return
        base.ecrire_etat(CLE_SYNCHRO, aujourdhui)
        try:
            self.synchroniser()
        except Exception as e:
            base.logguer(f"Retour du site indisponible : {e}", "avert")

    def _declencher(self, config: dict, creneau: str, heures: list[str]) -> None:
        deja = trouves_aujourdhui()
        objectif = int(config.get("objectif_par_jour") or 0)
        dernier_creneau = creneau == heures[-1]

        reglages = None
        if objectif and dernier_creneau and deja < objectif:
            reglages = {
                "scrolls_max_par_source": min(60, int(config["scrolls_max_par_source"]) * 2),
                "posts_max_par_source": min(80, int(config["posts_max_par_source"]) * 2),
            }
            base.logguer(
                f"Collecte de {creneau} : {deja} fournisseur(s) aujourd'hui, objectif "
                f"{objectif} — il en manque {objectif - deja}. Ce passage cherche plus "
                "loin dans les fils (mêmes pauses, plus de défilements).",
                "info",
            )
        else:
            base.logguer(
                f"Collecte automatique de {creneau} — {deja} fournisseur(s) déjà "
                "aujourd'hui.", "info",
            )
        self.lancer_collecte(reglages)

    def fermer(self) -> None:
        self.arret.set()


def bilan_du_jour(config: dict) -> dict:
    """Ce que l'interface affiche : où en est-on de l'objectif."""
    fait = trouves_aujourdhui()
    objectif = int(config.get("objectif_par_jour") or 0)
    return {
        "actif": bool(config.get("collecte_auto")),
        "heures": _heures(config),
        "prochain": prochain_passage(config),
        "trouves": fait,
        "objectif": objectif,
        "atteint": bool(objectif and fait >= objectif),
    }
