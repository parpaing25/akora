# -*- coding: utf-8 -*-
"""Le pré-tri des photos : la liste fermée dispose, le modèle propose."""
from pathlib import Path

from bot.photos_familles import classer, consigne, normaliser_famille

FAMILLES = ["bois", "briques", "granulats", "couverture"]


def test_hors_liste_devient_autre_jamais_une_invention():
    assert normaliser_famille("bois", FAMILLES) == "bois"
    assert normaliser_famille("camion", FAMILLES) == "camion"
    assert normaliser_famille("Madrier 7x15", FAMILLES) == "autre"
    assert normaliser_famille("parquet massif", FAMILLES) == "autre"
    assert normaliser_famille("", FAMILLES) == "autre"


def test_la_consigne_porte_la_liste_fermee_et_le_doute():
    texte = consigne(FAMILLES)
    for famille in FAMILLES + ["camion", "personne", "autre"]:
        assert famille in texte
    assert "doute" in texte and "JSON" in texte


def test_classer_par_lots_avec_normalisation():
    chemins = [Path(f"p{i}.jpg") for i in range(10)]  # 2 lots de 8 et 2
    appels = []

    def faux_appel(lot, familles):
        appels.append(len(lot))
        # Le « modèle » répond une étiquette valide, une invention, un trou.
        reponse = {str(i): "bois" for i in range(1, len(lot) + 1)}
        reponse["2"] = "tas de planches 7x15"      # invention → autre
        if "3" in reponse:
            del reponse["3"]                        # trou → autre
        return reponse

    verdicts = classer(chemins, FAMILLES, appel=faux_appel)
    assert appels == [8, 2]
    assert verdicts[Path("p0.jpg")] == "bois"
    assert verdicts[Path("p1.jpg")] == "autre"      # l'invention
    assert verdicts[Path("p2.jpg")] == "autre"      # le trou
    assert len(verdicts) == 10
