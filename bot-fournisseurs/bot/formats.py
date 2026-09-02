"""L'atelier des formats — trancher en série ce qu'aucune machine ne doit deviner.

Le catalogue Akora est une liste fermée : un produit sans référence ne peut pas
être publié. Or la ligne qui porte le PRIX est presque toujours celle qui ne
porte pas le format :

    ALU ZINC              <- le matériau, sans prix
    -014 : 8 500 Ar       <- le prix, sans matériau

`extraction._type_seul()` retire volontairement le format à ces lignes-là,
parce que l'hériter de l'en-tête avait produit le 24/08/2026 une tôle 0,45 mm
étiquetée au prix d'une 0,14 — un produit publié et une ligne faussée dans
l'observatoire des prix. La règle est juste et elle reste.

Sa conséquence, elle, n'avait jamais été regardée. Mesuré le 01/09/2026 :

  * 233 offres portent un prix hérité d'un en-tête, **aucune** n'a de format ;
  * sur les 97 offres gardées des 32 prospects « validés », 35 ont un prix,
    2 ont une référence, **zéro** ont les deux ;
  * donc le bouton « Inscrire les fournisseurs validés » refusait les 32, et
    son message parlait d'un « produit référencé AVEC un prix » sans dire
    lequel des deux manquait.

Le `<select>` qui répare tout cela existait déjà — mais un par offre, au fond
du panneau d'un prospect : 190 offres à trancher chez 33 dépôts, soit 33
panneaux à ouvrir. Ce module renverse la présentation : on ne trie plus par
dépôt, on trie **par type**, et à l'intérieur d'un type on regroupe les
libellés identiques. Les 92 tôles se tranchent ensemble.

🔒 Ce qui n'est pas négociable : **le choix reste humain**. Ce module ne
propose aucun format, n'en devine aucun, n'en classe aucun par vraisemblance.
Il rassemble, il compte, il applique. C'est exactement la frontière entre
extraire — déterministe — et juger.
"""
from __future__ import annotations

import re

from . import akora, base, referentiel

# Un montant suivi de sa monnaie : « 8 500 Ar », « 12.000ar », « 350 000 Ariary ».
# On le retire pour regrouper les libellés, JAMAIS de l'offre elle-même : deux
# tôles 0,14 à deux prix différents sont le même format, et c'est tout
# l'intérêt du regroupement.
MONTANT = re.compile(r"\d[\d\s.,  ]*\s*(?:ar|ariary|fmg)\b", re.IGNORECASE)
ESPACES = re.compile(r"\s+")


class ErreurFormats(Exception):
    pass


def _empreinte(libelle: str) -> str:
    """Le libellé débarrassé de son montant, pour regrouper ce qui est pareil.

    Volontairement prudent : si la monnaie n'est pas écrite (« -014 : 8 500 »),
    les chiffres restent et le libellé forme son propre groupe. Sous-regrouper
    coûte un clic de plus ; sur-regrouper collerait un format à des offres qui
    n'en relèvent pas.
    """
    sans_montant = MONTANT.sub(" ", libelle or "")
    return ESPACES.sub(" ", sans_montant).strip().lower()


def _formats_proposes(type_slug: str) -> list[dict]:
    """Les formats du catalogue pour ce type — la liste fermée, rien d'autre."""
    return [
        {"slug": f["slug"], "libelle": f.get("libelle_court") or f["nom"],
         "nom": f["nom"], "unite": f.get("unite")}
        for f in referentiel.formats_du_type(type_slug)
    ]


def atelier() -> dict:
    """Les offres chiffrées sans format, groupées par type puis par libellé.

    Renvoie {groupes, offres, depots} — `offres` et `depots` sont les totaux,
    affichés tels quels : personne ne doit avoir à recompter pour savoir si
    l'atelier avance.
    """
    if not referentiel.est_charge():
        raise ErreurFormats(
            "Catalogue Akora non chargé : sans lui, aucun format à proposer. "
            "Synchronisez le référentiel dans les réglages."
        )

    lignes = base.offres_sans_format()
    par_type: dict[str, dict] = {}
    depots: set[str] = set()

    for offre in lignes:
        depots.add(offre["prospect_id"])
        groupe = par_type.setdefault(offre["type_slug"], {
            "type_slug": offre["type_slug"],
            # Le nom vient du CATALOGUE, pas de la ligne : celui de l'offre a
            # ete fige a la collecte, et il vieillit sur place. Le type
            # « planche » s'appelait « Planche et volige » quand ces offres
            # ont ete lues ; il s'appelle « Planche de coffrage » depuis que
            # la volige a son propre type, et l'atelier doit le dire.
            "type_nom": (referentiel.charger()["types"].get(offre["type_slug"], {})
                         .get("nom") or offre.get("type_nom") or offre["type_slug"]),
            "famille_slug": offre.get("famille_slug"),
            "formats": _formats_proposes(offre["type_slug"]),
            "libelles": {},
        })
        cle = _empreinte(offre["libelle_brut"])
        paquet = groupe["libelles"].setdefault(cle, {
            "empreinte": cle,
            "exemple": offre["libelle_brut"],
            "offres": [],
        })
        paquet["offres"].append({
            "id": offre["id"],
            "libelle_brut": offre["libelle_brut"],
            "prix": offre["prix"],
            "unite": offre.get("unite"),
            "prospect_id": offre["prospect_id"],
            "prospect_nom": offre.get("prospect_nom") or "",
            "prospect_statut": offre.get("prospect_statut") or "",
        })

    groupes = []
    for groupe in par_type.values():
        paquets = []
        for paquet in groupe["libelles"].values():
            prix = [o["prix"] for o in paquet["offres"] if o["prix"] is not None]
            # Ce que les cotes ecrites dans la ligne designent, quand elles
            # ne designent qu'une seule reference. Une PROPOSITION : elle
            # arrive pre-selectionnee et signalee, un humain confirme.
            propose = referentiel.propose_par_dimensions(
                groupe["type_slug"], paquet["exemple"])
            paquets.append({
                **paquet,
                "propose": propose,
                "nb": len(paquet["offres"]),
                "nb_depots": len({o["prospect_id"] for o in paquet["offres"]}),
                "prix_min": min(prix) if prix else None,
                "prix_max": max(prix) if prix else None,
            })
        paquets.sort(key=lambda p: -p["nb"])
        total = sum(p["nb"] for p in paquets)
        # Ce que les dépôts écrivent, face à ce que le catalogue attend. Quand
        # les deux listes ne se recouvrent pas, il n'y a pas un format à
        # choisir : il y a une conversion à ne pas inventer.
        unites_lues = sorted({
            o["unite"] for p in paquets for o in p["offres"] if o.get("unite")
        })
        unites_ref = sorted({f["unite"] for f in groupe["formats"] if f.get("unite")})
        groupes.append({
            "type_slug": groupe["type_slug"],
            "type_nom": groupe["type_nom"],
            "famille_slug": groupe["famille_slug"],
            "formats": groupe["formats"],
            "paquets": paquets,
            "nb_offres": total,
            "nb_depots": len({
                o["prospect_id"] for p in paquets for o in p["offres"]
            }),
            # Un type que le catalogue ne décline en aucun format ne se tranche
            # pas : il se signale. Le dire ici évite de chercher pourquoi la
            # liste déroulante est vide.
            "sans_reference": not groupe["formats"],
            "unites_lues": unites_lues,
            "unites_reference": unites_ref,
            "unites_incompatibles": bool(
                unites_lues and unites_ref and not (set(unites_lues) & set(unites_ref))
            ),
        })
    groupes.sort(key=lambda g: -g["nb_offres"])

    return {
        "groupes": groupes,
        "offres": len(lignes),
        "depots": len(depots),
        "types": len(groupes),
    }


def appliquer(decisions: list[dict]) -> dict:
    """Pose le format choisi sur les offres.

    `decisions` = [{ids, materiau_slug, confirme_unite}].

    Le matériau est relu dans le catalogue : le nom, l'unité et la famille en
    viennent, jamais de l'interface. Un slug inconnu est refusé — c'est ce qui
    empêche une liste déroulante périmée d'écrire une référence morte.

    🔴 LE GARDE-FOU D'UNITÉ. Une offre dont l'unité lue diffère de celle de la
    référence est REFUSÉE, sauf confirmation explicite. Mesuré le 01/09/2026 :
    6 briques de terre comprimée relevées **au m²** pour une référence **à la
    pièce** (une douzaine de briques au m² : le prix serait multiplié par
    douze), 50 tôles lues « à la pièce » dont les libellés disent « 13 000
    ar/M », une faîtière au mètre pour une référence à la pièce. Choisir un
    format sans regarder l'unité, c'est publier une conversion inventée — et
    la règle est de ne jamais en deviner une.
    """
    catalogue = referentiel.charger()
    touchees, refusees, unites = 0, [], []

    for decision in decisions:
        slug = (decision.get("materiau_slug") or "").strip()
        ids = [int(i) for i in decision.get("ids", [])]
        if not slug or not ids:
            continue
        materiau = catalogue["materiaux"].get(slug)
        if materiau is None:
            refusees.append(slug)
            continue
        type_fiche = catalogue["types"].get(materiau.get("type_slug")) or {}
        unite_ref = materiau.get("unite")
        confirme = bool(decision.get("confirme_unite"))

        for oid in ids:
            lue = (base.offre(oid) or {}).get("unite")
            if lue and unite_ref and lue != unite_ref and not confirme:
                unites.append({"id": oid, "lue": lue, "reference": unite_ref,
                               "materiau": materiau["nom"]})
                continue
            base.modifier_offre(
                oid,
                materiau_slug=materiau["slug"],
                materiau_nom=materiau["nom"],
                type_slug=materiau.get("type_slug"),
                type_nom=type_fiche.get("nom"),
                famille_slug=materiau.get("famille"),
                # Le produit sera créé dans l'unité de la référence : l'offre
                # doit dire la même chose, sinon le prix ne veut plus rien dire.
                unite=unite_ref or lue,
                # Le format vient d'être tranché par un humain : l'offre n'est
                # plus ambiguë, et sa certitude n'est plus celle d'une machine.
                ambigu=0,
                certitude=100,
                hors_catalogue=0,
            )
            touchees += 1

    if refusees:
        base.logguer(
            "Formats refusés (absents du catalogue) : " + ", ".join(sorted(set(refusees))),
            "avert",
        )
    if unites:
        base.logguer(
            f"{len(unites)} offre(s) écartée(s) : l'unité lue ne correspond pas "
            "à celle de la référence, le prix serait faussé par la conversion.",
            "avert",
        )
    if touchees:
        base.logguer(f"{touchees} offre(s) ont reçu leur format.", "succes")
    return {
        "appliquees": touchees,
        "refusees": sorted(set(refusees)),
        "unites_en_conflit": unites,
    }


def _ecrire_reference(type_slug: str, projet: dict, origine: str = "") -> str:
    """Écrit la référence au catalogue du site et recharge le catalogue local.

    La `note` garde la trace : créée par le bot, quand, depuis quelle ligne,
    avec un poids calculé à quelle masse volumique. Rien n'est anonyme.
    """
    from datetime import date

    note = (f"Créée par le bot fournisseurs le {date.today():%d/%m/%Y}"
            + (f" depuis « {origine[:90]} »" if origine else "")
            + (f" — poids à {projet.get('densite')} kg/m³ (médiane du type)."
               if projet.get("densite") else "."))
    lignes = akora.executer(
        "INSERT INTO public.materiaux_ref "
        "(categorie_id, type_id, nom, slug, libelle_court, dimensions, "
        " unite_defaut, poids_kg_unite_defaut, volume_m3_unite_defaut, "
        " attributs, ordre_format, note) "
        "SELECT c.id, t.id, "
        f"{akora.txt(projet['nom'])}, {akora.txt(projet['slug'])}, "
        f"{akora.txt(projet['libelle_court'])}, {akora.txt(projet['dimensions'])}, "
        f"{akora.txt(projet['unite'])}::public.unite, "
        f"{akora.reel(projet['poids'])}, {akora.reel(projet['volume'])}, "
        f"{akora.jsonb(projet['attributs'])}, {akora.reel(projet['ordre_format'])}, "
        f"{akora.txt(note)} "
        "  FROM public.types_materiaux t "
        "  JOIN public.categories c ON c.id = t.categorie_id "
        f" WHERE t.slug = {akora.txt(type_slug)} "
        "ON CONFLICT (slug) DO NOTHING "
        "RETURNING slug;")
    if not lignes:
        raise ErreurFormats(
            "La reference n'a pas ete creee — type absent du site, ou nom "
            "deja pris dans cette famille.")

    # Le catalogue local doit connaitre la nouveaute AVANT qu'on l'applique.
    referentiel.synchroniser()
    base.logguer(
        f"Référence « {projet['nom']} » créée au catalogue "
        f"({projet['volume']} m³, {projet['poids']} kg"
        + (f" à {projet['densite']} kg/m³" if projet.get("densite") else "") + ").",
        "succes")
    return projet["slug"]


def creer_reference_auto(type_slug: str, cote: dict, origine: str = "") -> dict | None:
    """Crée (ou retrouve) la référence qu'une cote lue réclame, pendant la collecte.

    Rend la fiche d'appariement à poser sur l'offre, ou None si la cote ne
    fait pas une référence (bornes, type sans grammaire, poids incalculable).
    Le motif du refus est journalisé UNE fois par libellé.
    """
    projet = referentiel.reference_depuis_cote(type_slug, cote)
    if not projet.get("possible"):
        if projet.get("slug"):                       # existe déjà : on l'applique
            materiau = referentiel.charger()["materiaux"].get(projet["slug"])
            return referentiel.fiche_du_format(materiau, 95) if materiau else None
        base.logguer(
            f"Référence non créée pour « {origine[:70]} » : {projet.get('motif')}.",
            "info")
        return None
    _ecrire_reference(type_slug, projet, origine=origine)
    materiau = referentiel.charger()["materiaux"].get(projet["slug"])
    return referentiel.fiche_du_format(materiau, 95) if materiau else None


def creer_reference(type_slug: str, ligne: str, ids: list[int] | None = None,
                    longueur_m: float | None = None) -> dict:
    """Ecrit au catalogue la reference que cette ligne reclame, puis l'applique.

    C'est le geste qui fait converger les deux bases : ce que la collecte
    trouve et que le site ignorait, le site l'apprend. La cote vient du tarif
    du depot, le volume se calcule, le poids suit la masse volumique deja en
    place pour ce type — rien n'est choisi a la main.

    Le catalogue reste FERME au sens ou il compte : un fournisseur n'y ajoute
    rien, et deux depots qui ecrivent la meme section tombent sur la MEME
    reference, parce que la cote passe par sa forme canonique avant de devenir
    un identifiant.
    """
    projet = referentiel.reference_a_creer(type_slug, ligne, longueur_m)
    if not projet.get("possible"):
        raise ErreurFormats(projet.get("motif") or "reference impossible a composer")
    _ecrire_reference(type_slug, projet, origine=ligne)

    applique = appliquer([{"ids": ids or [], "materiau_slug": projet["slug"]}]) \
        if ids else {"appliquees": 0}
    return {"slug": projet["slug"], "nom": projet["nom"], **applique}


def signaler_hors_catalogue(ids: list[int], libelle: str = "") -> dict:
    """Ce que le terrain vend et qu'Akora ne référence pas.

    L'offre est écartée de l'atelier — elle ne peut pas devenir un produit —
    mais elle n'est PAS supprimée : le libellé remonte dans « matériaux
    absents », qui est la file d'attente d'ajout au catalogue du site. Une
    tôle 0,25 mm que dix dépôts affichent est une référence qui manque, pas
    une offre à jeter.
    """
    signale = 0
    exemples: dict[str, str] = {}
    for oid in [int(i) for i in ids]:
        # La référence PART avec le signalement. Sans ça, une offre écartée
        # gardait son `materiau_slug` et redevenait un produit à l'inscription
        # suivante — le drapeau était posé et personne ne le lisait.
        base.modifier_offre(
            oid, hors_catalogue=1, ambigu=0,
            materiau_slug=None, materiau_nom=None,
        )
        signale += 1
    if libelle:
        exemples[libelle] = libelle
    for texte in exemples:
        base.signaler_materiau_absent(texte[:80], texte)
    if signale:
        base.logguer(
            f"{signale} offre(s) signalée(s) hors catalogue"
            + (f" — « {libelle[:60]} »" if libelle else "") + ".",
            "avert",
        )
    return {"signalees": signale}
