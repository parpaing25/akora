"""Ce qui est prêt à partir, ce qui manque, et à qui il faut téléphoner.

Le bot faisait UN geste — « inscrire » — qui exigeait tout à la fois : une
fiche de dépôt ET au moins un produit chiffré. Un dépôt dont la publication ne
donnait pas de prix ne pouvait donc pas exister sur Akora, alors qu'on avait
son nom, son quartier et son numéro.

Or la mesure du 01/09/2026 est sans appel : **440 publications sur 526 (84 %)
ne portent aucun prix**. Le tarif ne se met pas dans le post, il se donne au
téléphone. Attendre qu'il tombe tout seul, c'est attendre pour toujours.

D'où la séparation, qui est la règle du dépôt maintenant :

┌────────────────┬──────────────────────────┬──────────────────────────────┐
│                │ ce qu'il faut            │ quand                        │
├────────────────┼──────────────────────────┼──────────────────────────────┤
│ LE FOURNISSEUR │ un nom, un contact,      │ dès que c'est là — sa fiche  │
│                │ un emplacement           │ se remplit une fois          │
│ UN PRODUIT     │ une référence du         │ jamais avant : un produit    │
│                │ catalogue, un PRIX,      │ sans prix ne se compare pas, │
│                │ et une PHOTO             │ sans photo ne s'achète pas   │
└────────────────┴──────────────────────────┴──────────────────────────────┘

Les deux ne s'attendent plus. Le dépôt entre avec ses coordonnées ; ses
produits le rejoignent au fur et à mesure qu'ils se complètent — par un appel
qui donne le prix, par une photo qu'on désigne.
"""
from __future__ import annotations

from . import base

# Ce qui manque à une offre pour devenir un produit, dans l'ordre où on le
# répare : le format se tranche à l'écran, le prix se demande au téléphone,
# la photo se désigne.
MANQUE_REFERENCE = "reference"
MANQUE_PRIX = "prix"
MANQUE_PHOTO = "photo"


def photos_par_offre(fiche: dict) -> dict[int, list[dict]]:
    """{identifiant d'offre: [photos qui la montrent]}. Gardées seulement."""
    par_offre: dict[int, list[dict]] = {}
    for photo in fiche.get("photos", []):
        if photo.get("garder") and photo.get("offre_id"):
            par_offre.setdefault(int(photo["offre_id"]), []).append(photo)
    return par_offre


def manques_de_l_offre(offre: dict, photos: dict[int, list[dict]]) -> list[str]:
    """Ce qui manque à CETTE offre pour partir sur le site. Vide = prête."""
    manques = []
    if not offre.get("materiau_slug"):
        manques.append(MANQUE_REFERENCE)
    if not offre.get("prix"):
        manques.append(MANQUE_PRIX)
    if not photos.get(int(offre["id"])):
        manques.append(MANQUE_PHOTO)
    return manques


def etat_des_offres(fiche: dict) -> dict:
    """Le tri d'un dépôt : ce qui est prêt, ce qui attend quoi.

    Ne compte que les offres GARDÉES et dans le périmètre — une offre écartée
    à la main ou signalée hors catalogue n'attend plus rien de personne.
    """
    photos = photos_par_offre(fiche)
    pretes, par_manque = [], {MANQUE_REFERENCE: [], MANQUE_PRIX: [], MANQUE_PHOTO: []}

    for offre in fiche.get("offres", []):
        if not offre.get("garder") or offre.get("hors_catalogue"):
            continue
        manques = manques_de_l_offre(offre, photos)
        if not manques:
            pretes.append(offre)
            continue
        for manque in manques:
            par_manque[manque].append(offre)

    return {
        "pretes": pretes,
        "sans_reference": par_manque[MANQUE_REFERENCE],
        "sans_prix": par_manque[MANQUE_PRIX],
        "sans_photo": par_manque[MANQUE_PHOTO],
        "nb_pretes": len(pretes),
    }


def fiche_depot_complete(fiche: dict) -> list[str]:
    """Ce qui manque au DÉPÔT lui-même. Rien à voir avec ses produits.

    Trois choses, et trois seulement : un nom pour l'identifier, un contact
    pour l'appeler, un emplacement pour chiffrer une livraison. C'est tout ce
    qu'il faut pour qu'une fiche existe sur Akora — les produits viendront.
    """
    manques = []
    if not (fiche.get("nom") or "").strip():
        manques.append("un nom d'enseigne")
    if not (fiche.get("telephone") or fiche.get("whatsapp")
            or fiche.get("page_url")):
        manques.append("un contact (téléphone ou page)")
    if not (fiche.get("ville") or fiche.get("quartier") or fiche.get("lat")):
        manques.append("un emplacement (ville ou quartier)")
    return manques


def a_appeler(limite: int = 400) -> list[dict]:
    """Les dépôts qu'il faut appeler, et ce qu'on leur demandera.

    Un dépôt entre ici quand il a de quoi être contacté et au moins une offre
    qui n'attend qu'un prix. C'est la liste d'appels : elle remplace l'attente
    qu'un tarif finisse par tomber dans un post.
    """
    liste = []
    for resume in base.lister_prospects(statut="tous", tri="score", limite=limite):
        if resume.get("statut") in ("rejete", "doublon", "refuse", "revendique"):
            continue
        fiche = base.prospect(resume["id"])
        if not fiche:
            continue
        etat = etat_des_offres(fiche)
        if not etat["sans_prix"]:
            continue
        contact = (fiche.get("telephone") or "").strip()
        liste.append({
            "id": fiche["id"],
            "nom": fiche.get("nom") or "Sans nom",
            "telephone": contact,
            "whatsapp": bool(fiche.get("whatsapp")),
            "page_url": fiche.get("page_url") or "",
            "ville": fiche.get("ville") or "",
            "quartier": fiche.get("quartier") or "",
            "statut": fiche.get("statut"),
            "score": int(fiche.get("score") or 0),
            "sur_le_site": bool(fiche.get("fournisseur_id")),
            "nb_pretes": etat["nb_pretes"],
            # Ce qu'on lui demande, nommément : c'est la feuille d'appel.
            "a_demander": [
                {"id": o["id"],
                 "nom": o.get("materiau_nom") or (o.get("libelle_brut") or "")[:48],
                 "type": o.get("type_nom") or o.get("type_slug") or "",
                 "a_une_photo": False}
                for o in etat["sans_prix"][:12]
            ],
            "nb_sans_prix": len(etat["sans_prix"]),
            "nb_sans_photo": len(etat["sans_photo"]),
            "nb_sans_reference": len(etat["sans_reference"]),
        })
    liste.sort(key=lambda x: (-x["nb_sans_prix"], -x["score"]))
    return liste


def miroir() -> dict:
    """Les trois egalites qui disent si la collecte et le site se repondent.

    C'est la demande, telle qu'elle a ete posee :

        types de materiaux sur la collecte = types sur le site
        fournisseurs valides sur la collecte = fournisseurs sur le site
        prix visible sur la collecte = prix visible sur le site

    Elles ne seront jamais toutes vraies au meme instant — un depot collecte
    ce matin n'est pas encore transfere — mais **l'ecart doit se voir et se
    nommer**. Chaque ligne dit donc combien manquent, et POURQUOI.

    Une seule requete pour le site (l'annuaire, deja en cache) et une lecture
    locale : cette vue s'ouvre a chaque coup d'oeil, elle ne doit rien couter.
    """
    from . import akora, referentiel

    catalogue = referentiel.charger()
    depots_site, produits_site, prix_site = [], 0, 0
    erreur = ""
    try:
        for ligne in akora.annuaire():
            depots_site.append(ligne)
            produits_site += len(ligne.get("produits") or [])
            prix_site += len([v for v in (ligne.get("prix") or {}).values() if v])
    except Exception as e:                                   # noqa: BLE001
        erreur = str(e)[:160]

    types_vus, refs_vues, prix_collecte, offres_gardees = set(), set(), 0, 0
    for offre in base.offres_gardees_vivantes():
        offres_gardees += 1
        if offre.get("type_slug"):
            types_vus.add(offre["type_slug"])
        if offre.get("materiau_slug"):
            refs_vues.add(offre["materiau_slug"])
        if offre.get("prix"):
            prix_collecte += 1

    complets, transferes = 0, 0
    for resume in base.lister_prospects(statut="tous", limite=5000):
        if resume.get("statut") in ("rejete", "doublon", "refuse"):
            continue
        fiche = base.prospect(resume["id"])
        if not fiche or fiche_depot_complete(fiche):
            continue
        complets += 1
        if fiche.get("fournisseur_id"):
            transferes += 1

    return {
        "erreur": erreur,
        "types": {
            "collecte": len(types_vus),
            "site": len(catalogue["types"]),
            "jamais_rencontres": sorted(set(catalogue["types"]) - types_vus),
            "hors_catalogue": sorted(types_vus - set(catalogue["types"])),
        },
        "references": {
            "collecte": len(refs_vues),
            "site": len(catalogue["materiaux"]),
        },
        "fournisseurs": {
            "collecte": complets,
            "site": len(depots_site),
            "transferes": transferes,
            "a_transferer": complets - transferes,
        },
        "prix": {
            "collecte": prix_collecte,
            "site": prix_site,
            "offres_gardees": offres_gardees,
            # Un prix releve qui n'atteint pas le site, et ce qui le retient.
            "bloques": max(0, prix_collecte - prix_site),
        },
    }


def bilan() -> dict:
    """Le tri du corpus entier, en un coup d'œil. N'écrit rien."""
    total = {"depots": 0, "depots_transferables": 0, "depots_incomplets": 0,
             "pretes": 0, "sans_prix": 0, "sans_photo": 0, "sans_reference": 0}
    for resume in base.lister_prospects(statut="tous", limite=5000):
        if resume.get("statut") in ("rejete", "doublon", "refuse"):
            continue
        fiche = base.prospect(resume["id"])
        if not fiche:
            continue
        total["depots"] += 1
        if fiche_depot_complete(fiche):
            total["depots_incomplets"] += 1
        etat = etat_des_offres(fiche)
        if etat["nb_pretes"]:
            total["depots_transferables"] += 1
        total["pretes"] += etat["nb_pretes"]
        total["sans_prix"] += len(etat["sans_prix"])
        total["sans_photo"] += len(etat["sans_photo"])
        total["sans_reference"] += len(etat["sans_reference"])
    return total
