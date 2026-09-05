"""Un dépôt n'est ACTIF sur le site qu'avec au moins un produit actif.

Mesuré le 02/09/2026 : 24 fournisseurs actifs créés par le bot sur
akora.fonenako.mg, 22 sans aucun produit actif, 15 créés ce jour-là par
l'inscription automatique. L'annuaire montrait des fiches vides. La règle est
réglable (`actif_exige_un_produit`), posée à l'inscription ET après chaque
transfert de produits, et ne touche jamais une fiche revendiquée par son
dépôt (autre `owner_id`).

    python -m pytest tests/test_actif_exige_un_produit.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import inscription  # noqa: E402
from bot.config import DEFAUTS  # noqa: E402

COMPTE = "abe73060-3131-4509-b37e-cd8f58805401"


def test_le_reglage_existe_et_est_allume_par_defaut():
    assert DEFAUTS["actif_exige_un_produit"] is True


def test_sans_produit_la_fiche_reste_en_brouillon():
    etat = {"produits": [], "prix_en_ligne": {}, "sans_photo_en_ligne": set()}
    assert inscription.a_de_quoi_etre_actif([], etat, {"actif_exige_un_produit": True}) is False


def test_un_produit_complet_qui_part_suffit():
    etat = {"produits": [], "prix_en_ligne": {}, "sans_photo_en_ligne": set()}
    publiable = {"id": 1, "materiau_slug": "planche-25x200-4m", "prix": 4000}
    assert inscription.a_de_quoi_etre_actif([publiable], etat, {}) is True


def test_un_produit_deja_en_ligne_avec_prix_et_photo_suffit():
    etat = {"produits": ["madrier-75x225-4m"], "prix_en_ligne": {"madrier-75x225-4m": 35000},
            "sans_photo_en_ligne": set()}
    assert inscription.a_de_quoi_etre_actif([], etat, {}) is True


def test_un_produit_en_ligne_sans_photo_ou_sans_prix_ne_compte_pas():
    muet = {"produits": ["moellon"], "prix_en_ligne": {"moellon": 700},
            "sans_photo_en_ligne": {"moellon"}}
    assert inscription.a_de_quoi_etre_actif([], muet, {}) is False
    gratuit = {"produits": ["moellon"], "prix_en_ligne": {"moellon": 0},
               "sans_photo_en_ligne": set()}
    assert inscription.a_de_quoi_etre_actif([], gratuit, {}) is False


def test_la_regle_se_desactive_d_un_reglage():
    etat = {"produits": [], "prix_en_ligne": {}, "sans_photo_en_ligne": set()}
    assert inscription.a_de_quoi_etre_actif([], etat, {"actif_exige_un_produit": False}) is True


def test_le_sql_ne_touche_que_nos_fiches_et_seulement_ce_qui_change():
    sql = inscription._sql_aligner_statut(None, COMPTE)
    assert f"f.owner_id = '{COMPTE}'::uuid" in sql
    assert "IS DISTINCT FROM" in sql
    assert "'actif'::public.statut_fournisseur" in sql
    assert "'brouillon'::public.statut_fournisseur" in sql
    assert "p.statut = 'actif'::public.statut_produit" in sql
    # Une seule fiche : la clause est là ; toutes : elle n'y est pas.
    assert "f.id = 'abcd'::uuid" in inscription._sql_aligner_statut("abcd", COMPTE)
    assert "f.id =" not in sql


def test_muette_quand_la_publication_est_manuelle(monkeypatch):
    """`inscrire_en_actif` éteint : tout est en brouillon, rien à aligner —
    et surtout aucune requête vers le site."""
    monkeypatch.setattr(inscription, "charger", lambda: {"inscrire_en_actif": False})

    def interdit(*_a, **_k):
        raise AssertionError("aucune requête ne doit partir")

    monkeypatch.setattr(inscription.akora, "executer_systeme", interdit)
    assert inscription.aligner_statut_sur_les_produits("x") is False


def test_tourne_quand_les_deux_reglages_sont_allumes(monkeypatch):
    monkeypatch.setattr(inscription, "charger",
                        lambda: {"inscrire_en_actif": True, "actif_exige_un_produit": True})
    monkeypatch.setattr(inscription, "compte_akora", lambda: COMPTE)
    envoyees = []
    monkeypatch.setattr(inscription.akora, "executer_systeme", lambda sql: envoyees.append(sql))
    monkeypatch.setattr(inscription.akora, "oublier_cache", lambda: None)
    assert inscription.aligner_statut_sur_les_produits("abcd") is True
    assert len(envoyees) == 1 and "f.id = 'abcd'::uuid" in envoyees[0]
