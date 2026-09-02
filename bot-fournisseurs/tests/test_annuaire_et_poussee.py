"""Garde-fous sur l'envoi des fiches et sur l'annuaire.

Deux choses qui ne doivent pas se découvrir en production :

  1. `pousser_les_fiches` était un drapeau que PERSONNE ne lisait. Le
     commentaire de config.py annonçait un garde-fou, `reserver()` partait
     quand même, compressait et publiait les photos sur o2switch, puis se
     cassait sur le premier INSERT. Ces tests vérifient que le refus tombe
     AVANT le moindre effet de bord.

  2. `annuaire()` a besoin du réseau. Quand il tombe, la vue doit rendre les
     prospects locaux avec un avertissement — pas une page vide, qui dirait
     « il n'y a personne » au lieu de « je n'ai pas pu demander ».

    python -m pytest tests/test_annuaire_et_poussee.py -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import akora, prospection, reservation  # noqa: E402


# ── Le drapeau `pousser_les_fiches` ────────────────────────────────────────
def test_le_drapeau_est_bien_lu():
    assert reservation.poussee_autorisee({"pousser_les_fiches": False}) is False
    assert reservation.poussee_autorisee({"pousser_les_fiches": True}) is True
    assert reservation.poussee_autorisee({}) is False       # absent = éteint


def test_reserver_refuse_avant_de_toucher_aux_photos(monkeypatch):
    """Le refus doit précéder TOUT effet de bord.

    On piège `envoyer_photos` et la lecture de la fiche : si l'un des deux est
    appelé, c'est que le garde-fou est arrivé trop tard — et une photo publiée
    sur o2switch ne se dépublie pas d'un clic.
    """
    def interdit(*_a, **_kw):
        raise AssertionError("appelé alors que l'envoi est désactivé")

    monkeypatch.setattr(reservation, "charger", lambda: {"pousser_les_fiches": False})
    monkeypatch.setattr(reservation.base, "prospect", interdit)
    monkeypatch.setattr(reservation, "envoyer_photos", interdit)

    with pytest.raises(reservation.ErreurReservation) as echec:
        reservation.reserver("nimporte-quel-identifiant")
    assert "Automatisations" in str(echec.value)
    assert "migration" in str(echec.value)


def test_le_message_dit_quoi_faire():
    """Un refus qui n'explique pas la suite se lit comme une panne."""
    message = reservation.POUSSEE_ETEINTE
    assert "Automatisations" in message
    assert "prospects_fournisseurs" in message
    assert "akora.fonenako.mg" in message


# ── L'annuaire croisé ──────────────────────────────────────────────────────
def test_le_site_injoignable_ne_vide_pas_la_page(monkeypatch):
    """Réseau coupé : les prospects locaux restent, l'avertissement apparaît."""
    def tombe():
        raise akora.ErreurAkora("Base Akora injoignable : essai de test")

    monkeypatch.setattr(prospection.akora, "annuaire", tombe)
    donnees = prospection.annuaire_croise()

    assert donnees["avertissement"], "un échec réseau doit se dire"
    assert "incomplète" in donnees["avertissement"] or "n'a pas répondu" in donnees["avertissement"]
    # Les lignes locales sont là, et aucune ne prétend venir du site.
    assert all(l["origine"] != "site" for l in donnees["lignes"])
    assert donnees["compte"]["croises"] == 0


def test_un_inscrit_jamais_croise_figure_quand_meme(monkeypatch):
    """C'est ce qui fait de cette page un RECENSEMENT et pas une liste d'appels."""
    monkeypatch.setattr(prospection.akora, "annuaire", lambda: [
        {"id": "aaaa-bbbb", "raison_sociale": "Dépôt Fictif Test",
         "slug": "depot-fictif-test", "tel": "0340000000", "tel2": "0340000000"},
    ])
    monkeypatch.setattr(prospection.akora, "deja_fournisseur", lambda *_a: ("", ""))
    donnees = prospection.annuaire_croise()

    ligne = next(l for l in donnees["lignes"] if l["nom"] == "Dépôt Fictif Test")
    assert ligne["origine"] == "site"
    assert ligne["client"] is True
    # `tel` et `tel2` sont le même abonné : une seule ligne à l'écran.
    assert ligne["telephones"] == ["0340000000"]
    assert donnees["avertissement"] == ""


def test_un_prospect_deja_inscrit_est_signale(monkeypatch):
    """Le seul chiffre qui compte vraiment : qui ne faut-il PAS démarcher."""
    monkeypatch.setattr(prospection.akora, "annuaire", lambda: [
        {"id": "cccc", "raison_sociale": "Déjà Client", "slug": "deja-client",
         "tel": "0341112233", "tel2": ""},
    ])
    monkeypatch.setattr(
        prospection.akora, "deja_fournisseur",
        lambda tel, nom="": ("cccc", "même numéro que « Déjà Client »") if tel else ("", ""),
    )
    donnees = prospection.annuaire_croise()

    croises = [l for l in donnees["lignes"] if l["origine"] == "les deux"]
    assert croises, "aucun prospect n'a de téléphone dans la base de test ?"
    assert all(l["client"] for l in croises)
    assert all(l["raison_client"] for l in croises)
    # Un fournisseur retrouvé ne doit pas apparaître une SECONDE fois en ligne
    # « site » : ce serait deux fiches pour un seul dépôt.
    assert not [l for l in donnees["lignes"] if l["fournisseur_id"] == "cccc"
                and l["origine"] == "site"]


def test_lexport_csv_souvre_dans_excel(monkeypatch):
    """Point-virgule et BOM : sans les deux, le fichier est à retaper.

    L'annuaire distant est neutralisé : aucun test de ce dossier ne doit
    dépendre d'une connexion, ni faire une requête à Supabase pour vérifier un
    séparateur.
    """
    monkeypatch.setattr(prospection.akora, "annuaire", list)
    contenu = prospection.exporter_annuaire_csv()
    assert contenu.startswith("﻿")
    entete = contenu.splitlines()[0]
    assert entete.count(";") == len(prospection.COLONNES_ANNUAIRE) - 1
    assert "telephones" in entete and "familles" in entete
