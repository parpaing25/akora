"""Note de 0 à 100 par prospect, pour savoir qui appeler en premier.

Le score du bot Fonenako répondait à « cette annonce est-elle bonne à publier ? ».
Celui-ci répond à une autre question, et c'est ce qui change ses poids :
**« ce dépôt-là, vaut-il un appel aujourd'hui ? »**

Ce qui fait un bon prospect Akora, dans l'ordre :
  1. il vend des matériaux **du catalogue** — sans référence appariée, on ne
     peut rien mettre en ligne pour lui ;
  2. il **affiche ses prix** — un dépôt qui publie ses tarifs a déjà accepté la
     transparence que le site lui demandera ;
  3. on peut le **joindre** ;
  4. on sait **où** il est — le prix rendu chantier se calcule au kilomètre ;
  5. il a une **enseigne** plutôt qu'un compte personnel ;
  6. il **publie souvent** — un dépôt actif répond, un compte dormant non.

Chaque point est justifié dans `details` : un score opaque ne sert à trier
qu'une seule fois.
"""
from __future__ import annotations

from datetime import datetime, timezone

PLAFONDS = {
    "catalogue": 30,
    "prix": 20,
    "contact": 15,
    "lieu": 15,
    "identite": 10,
    "activite": 10,
}


def _points_catalogue(offres: list[dict]) -> tuple[int, str]:
    appariees = [o for o in offres if o.get("materiau_slug")]
    ambigues = [o for o in offres if not o.get("materiau_slug") and o.get("type_slug")]
    nombre = len(appariees)
    if nombre == 0:
        if ambigues:
            return 6, f"{len(ambigues)} matériau(x) reconnu(s), format à préciser"
        return 0, "aucun matériau du catalogue"
    if nombre == 1:
        acquis = 12
    elif nombre <= 3:
        acquis = 20
    elif nombre <= 6:
        acquis = 26
    else:
        acquis = 30
    detail = f"{nombre} référence(s) appariée(s)"
    if ambigues:
        detail += f", {len(ambigues)} à préciser"
    return acquis, detail


def _points_prix(offres: list[dict]) -> tuple[int, str]:
    if not offres:
        return 0, "aucune offre"
    avec = [o for o in offres if o.get("prix")]
    if not avec:
        return 0, "aucun prix affiché"
    part = len(avec) / len(offres)
    if part >= 0.8:
        return 20, f"{len(avec)} prix sur {len(offres)}"
    if part >= 0.5:
        return 14, f"{len(avec)} prix sur {len(offres)}"
    return 8, f"{len(avec)} prix sur {len(offres)} seulement"


def _points_contact(fiche: dict) -> tuple[int, str]:
    if not fiche.get("telephone_cle"):
        return 0, "pas de téléphone"
    if fiche.get("whatsapp"):
        return 15, "téléphone + WhatsApp"
    return 12, "téléphone"


def _points_lieu(fiche: dict) -> tuple[int, str]:
    if fiche.get("quartier"):
        return 15, f"quartier ({fiche['quartier']})"
    if fiche.get("ville"):
        return 8, "ville seule, pas de quartier"
    return 0, "pas de lieu"


def _points_identite(fiche: dict) -> tuple[int, str]:
    if fiche.get("nom_valide"):
        return 10, "enseigne commerciale"
    if fiche.get("page_url"):
        return 7, "page Facebook"
    if (fiche.get("nom") or "").strip():
        return 4, "nom de compte personnel"
    return 0, "vendeur non identifié"


def _jours_depuis(horodatage: str | None) -> int | None:
    if not horodatage:
        return None
    try:
        quand = datetime.fromisoformat(horodatage)
    except ValueError:
        return None
    if quand.tzinfo is None:
        quand = quand.replace(tzinfo=timezone.utc)
    return max(0, int((datetime.now(timezone.utc) - quand).total_seconds() // 86400))


def _points_activite(fiche: dict) -> tuple[int, str]:
    publications = int(fiche.get("nb_publications") or 0)
    acquis = 0 if publications <= 1 else 3 if publications == 2 else 6
    detail = f"{publications} publication(s)"
    age = _jours_depuis(fiche.get("derniere_vue"))
    if age is not None and age <= 7:
        acquis += 4
        detail += ", vu cette semaine"
    elif age is not None and age <= 30:
        acquis += 2
        detail += f", vu il y a {age} j"
    return min(PLAFONDS["activite"], acquis), detail


def calculer(fiche: dict, offres: list[dict], nb_photos: int = 0) -> dict:
    """{score, niveau, details} — `details` dit POURQUOI, pas seulement combien."""
    postes = [
        ("catalogue", *_points_catalogue(offres)),
        ("prix", *_points_prix(offres)),
        ("contact", *_points_contact(fiche)),
        ("lieu", *_points_lieu(fiche)),
        ("identite", *_points_identite(fiche)),
        ("activite", *_points_activite(fiche)),
    ]
    total = sum(points for _, points, _ in postes)
    details = [
        {"poste": nom, "points": points, "sur": PLAFONDS[nom], "raison": raison}
        for nom, points, raison in postes
    ]

    malus = []
    if nb_photos == 0:
        malus.append(("aucune photo du dépôt", 5))
    confiance = fiche.get("llm_confiance")
    if confiance is not None and confiance < 50:
        malus.append(("lecture peu sûre", 5))
    if not fiche.get("livre") and not fiche.get("retrait_sur_place"):
        malus.append(("ni livraison ni retrait annoncés", 3))
    for raison, points in malus:
        total -= points
        details.append({"poste": "malus", "points": -points, "sur": 0, "raison": raison})

    total = max(0, min(100, total))
    niveau = "chaud" if total >= 70 else "tiede" if total >= 45 else "froid"
    return {"score": total, "niveau": niveau, "details": details}
