"""Inscrire un prospect comme VRAI fournisseur sur akora.fonenako.mg.

C'est l'autre bout du bot, et il ne fait pas la même chose que
`reservation.py` :

| | Fiche réservée | Inscription |
|---|---|---|
| Où | `prospects_fournisseurs` | `fournisseurs` + `produits` |
| Visible | jamais, sauf par jeton | dans l'annuaire, une fois publiée |
| Propriétaire | personne | le compte Akora, jusqu'à revendication |
| Sert à | convaincre le dépôt | **remplir le site** |

Le verrou qui commande tout : `fournisseurs.owner_id` référence
`auth.users`, et un dépôt trouvé sur Facebook n'a pas de compte. La fiche est
donc créée **au nom du compte Akora**, comme les annonces importées de
Fonenako le sont au nom du compte Fonenako. Quand le dépôt revendique sa
fiche, la propriété lui est **transférée** — on ne crée pas un second
fournisseur à côté du premier.

🔒 CE QUI N'EST PAS NÉGOCIABLE

* **Brouillon par défaut.** Un fournisseur créé ici n'apparaît nulle part tant
  que quelqu'un n'a pas cliqué « Publier ». Mettre en ligne le nom d'un dépôt
  et des prix relevés sur Facebook, sans qu'il l'ait demandé, n'est pas une
  décision qu'un bot prend.
* **Pas de produit sans prix.** Akora compare des prix ; un produit sans
  montant n'y sert à rien, et lui coller un prix de remplissage serait pire —
  c'est le genre de 1 Ar qu'on retrouve en ligne six mois plus tard.
* **`niveau_verification` reste `non_verifie`.** Rien n'a été vérifié : ni NIF,
  ni STAT, ni existence légale. Le badge se gagne, il ne se suppose pas.
"""
from __future__ import annotations

import re
import unicodedata

from . import akora, base, fil, tri
from .config import SITE, charger


class ErreurInscription(Exception):
    pass


def _slug(texte: str) -> str:
    reduit = "".join(
        c for c in unicodedata.normalize("NFD", texte or "")
        if unicodedata.category(c) != "Mn"
    ).lower()
    reduit = re.sub(r"[^a-z0-9]+", "-", reduit).strip("-")
    return reduit[:60] or "depot"


def _slug_libre(souhaite: str) -> str:
    """Un slug qui n'existe pas encore. `fournisseurs.slug` est unique."""
    pris = {
        ligne["slug"] for ligne in akora.executer(
            f"SELECT slug FROM public.fournisseurs WHERE slug LIKE {akora.txt(souhaite + '%')};"
        )
    }
    if souhaite not in pris:
        return souhaite
    for suffixe in range(2, 60):
        candidat = f"{souhaite}-{suffixe}"
        if candidat not in pris:
            return candidat
    raise ErreurInscription(f"Impossible de trouver un slug libre pour « {souhaite} ».")


def telephone_e164(affichage: str) -> str | None:
    """« 034 12 345 67 » -> « +261341234567 », ou None si ce n'est pas un mobile.

    Le site impose `^\\+2613[2-9][0-9]{7}$` sur `fournisseurs.telephone` : format
    international, sans espaces, et **mobile uniquement**. Un numéro fixe
    (020…) est parfaitement valable pour appeler, mais il ne peut pas entrer
    dans cette colonne — on le laisse alors vide plutôt que de faire échouer
    toute l'inscription pour un numéro.

    C'est le genre de contrainte qu'on ne découvre qu'en écrivant vraiment :
    le bot stocke le numéro comme un Malgache l'écrit, la base le veut comme
    l'UIT le veut.
    """
    chiffres = "".join(c for c in (affichage or "") if c.isdigit())
    if chiffres.startswith("261"):
        chiffres = "0" + chiffres[3:]
    if len(chiffres) != 10 or not chiffres.startswith("03"):
        return None
    if chiffres[2] not in "23456789":
        return None
    return "+261" + chiffres[1:]


def compte_akora() -> str:
    """Le compte qui porte les fiches créées par le bot.

    Réglable, mais avec un défaut sûr : l'administrateur du site. Un
    `owner_id` qui ne référence aucun compte ferait échouer l'INSERT — autant
    le dire ici plutôt que de laisser Postgres l'annoncer.
    """
    cfg = charger()
    identifiant = (cfg.get("compte_akora") or "").strip()
    if identifiant:
        return identifiant
    lignes = akora.executer(
        "SELECT ur.user_id::text AS id FROM public.user_roles ur "
        "WHERE ur.role = 'admin' ORDER BY ur.created_at LIMIT 1;"
    )
    if not lignes:
        raise ErreurInscription(
            "Aucun compte administrateur sur Akora : impossible de savoir qui "
            "doit porter les fiches créées. Réglez « compte_akora »."
        )
    return lignes[0]["id"]


def etat_sur_le_site(fiche: dict) -> dict:
    """Ce que akora.fonenako.mg porte DEJA pour ce depot, avant d'ecrire.

    Trois situations, et elles n'appellent pas la meme chose :

    ┌────────────────────────────┬──────────────────────────────────────────┐
    │ le depot n'existe pas      │ on cree la fiche et ses produits         │
    │ il existe, porte par NOUS  │ on adopte la fiche, on ajoute ce qui     │
    │ (compte Akora)             │ manque, on ne recree rien                │
    │ il existe, porte par LUI   │ ON N'ECRIT RIEN. Sa fiche est a lui.     │
    └────────────────────────────┴──────────────────────────────────────────┘

    La troisieme ligne est celle qui compte. Un depot qui a revendique sa
    fiche a relu SES prix ; y reinjecter ceux qu'on a releves sur Facebook des
    mois plus tot, c'est ecraser le travail du client par une lecture de
    robot. Et creer un second depot du meme nom a cote du sien serait pire
    encore.

    Le rapprochement se fait sur le **numero de telephone** d'abord (ses neuf
    derniers chiffres : 034…, +261 34… et 34… sont un seul abonne), puis sur
    la raison sociale. Le lien deja pose sur le prospect, lui, fait toujours
    foi : c'est le seul rapprochement certain.
    """
    connus = {ligne["id"]: ligne for ligne in akora.annuaire()}

    distant, raison = fiche.get("fournisseur_id") or "", ""
    if distant and distant in connus:
        raison = "fiche deja liee a ce prospect"
    else:
        # Le lien local pointe dans le vide (fiche supprimee cote site) : on
        # le dit, sinon on chercherait longtemps pourquoi la mise a jour ne
        # touche aucune ligne.
        if distant:
            base.logguer(
                f"« {fiche.get('nom')} » pointe vers un fournisseur absent du "
                f"site ({distant[:8]}) : on repart d'une recherche.", "avert")
            distant = ""
        distant, raison = akora.deja_fournisseur(
            fiche.get("telephone") or "", fiche.get("nom") or "")

    if not distant:
        return {"fournisseur_id": "", "raison": "", "a_nous": True,
                "statut": "", "produits": set(), "prix_en_ligne": {},
                "sans_photo_en_ligne": set(), "existe": False}

    ligne = connus.get(distant, {})
    try:
        proprietaire = compte_akora()
    except ErreurInscription:
        proprietaire = ""
    return {
        "fournisseur_id": distant,
        "raison": raison,
        "a_nous": bool(proprietaire) and ligne.get("owner_id") == proprietaire,
        "statut": ligne.get("statut") or "",
        "produits": set(ligne.get("produits") or ()),
        # Le tarif EN LIGNE, produit par produit. Sans lui on ne sait dire que
        # « on l'a deja » ; avec lui on voit qu'un depot a change son prix, et
        # c'est la seule chose qui merite une reecriture.
        "prix_en_ligne": dict(ligne.get("prix") or {}),
        # Ce qui est en ligne mais muet : un produit sans image, alors qu'on
        # lui en a peut-etre designe une depuis.
        "sans_photo_en_ligne": set(ligne.get("sans_photo") or ()),
        "existe": True,
    }


def _produits_publiables(fiche: dict) -> list[dict]:
    """Les offres COMPLETES : reference du catalogue, prix, ET photo.

    🔴 LA PHOTO EST DEVENUE OBLIGATOIRE, et ce n'est pas une exigence de
       confort. Un produit sans image n'est pas achete : sur une marketplace
       de materiaux, la photo dit la qualite du bois, la coupe de la brique,
       la propriete du sable — ce que le prix ne dit jamais.

       Elle doit en plus etre ATTRIBUEE a ce produit-la (`photos.offre_id`).
       Une photo prise dans le tas de la publication ne vaut rien : le
       01/09/2026, « Sable fin : 45 000 Ar le m3 » est parti dans le fil sous
       deux photos de gravillon et de moellon, parce qu'un post qui annonce
       cinq materiaux porte les photos des cinq.

    Consequence assumee : au 01/09/2026 le corpus ne rend AUCUN produit
    transferable, alors que 14 offres avaient reference et prix. C'est la
    mesure du travail qui reste, pas une regression.
    """
    return tri.etat_des_offres(fiche)["pretes"]


def apercu(prospect_id: str) -> dict:
    """Ce qui partirait, sans rien écrire. Sert à l'aperçu avant inscription."""
    fiche = base.prospect(prospect_id)
    if not fiche:
        raise ErreurInscription("Prospect introuvable.")
    publiables = _produits_publiables(fiche)
    try:
        etat = etat_sur_le_site(fiche)
    except akora.ErreurAkora:
        # Le site n'a pas repondu : on montre l'apercu sans le recoupement
        # plutot qu'une page en erreur, mais on ne pretend pas savoir.
        etat = {"existe": None, "a_nous": True, "produits": set(),
                "prix_en_ligne": {}, "raison": "site injoignable",
                "fournisseur_id": "", "statut": ""}
    deja = etat["produits"]
    a_ajouter = [o for o in publiables if o["materiau_slug"] not in deja]
    # Le depot a-t-il change de tarif depuis la derniere fois ? C'est la
    # question que « deja en ligne » masquait : un produit present avec un
    # prix perime vaut moins qu'un produit absent, parce qu'il fait croire
    # qu'il est a jour.
    en_ligne = etat.get("prix_en_ligne") or {}
    prix_changes = [
        {"nom": o["materiau_nom"], "slug": o["materiau_slug"],
         "en_ligne": en_ligne[o["materiau_slug"]], "releve": o["prix"]}
        for o in publiables
        if o["materiau_slug"] in en_ligne
        and int(en_ligne[o["materiau_slug"]]) != int(o["prix"])
    ]
    sans_prix = [
        o for o in fiche.get("offres", [])
        if o.get("garder") and o.get("materiau_slug") and not o.get("prix")
    ]
    ambigus = [
        o for o in fiche.get("offres", [])
        if o.get("garder") and not o.get("materiau_slug")
    ]
    return {
        "nom": fiche.get("nom"),
        "deja_inscrit": bool(fiche.get("fournisseur_id")),
        # Ce que le site porte deja, pour que le tri se fasse a l'ecran et pas
        # en cliquant : un depot deja complet ne merite pas un clic.
        "sur_le_site": etat["existe"],
        "fiche_a_nous": etat["a_nous"],
        "raison_rapprochement": etat["raison"],
        "statut_distant": etat["statut"],
        "produits_deja": sorted(deja),
        "produits_a_ajouter": [o["materiau_nom"] for o in a_ajouter],
        "prix_changes": prix_changes,
        "rien_a_faire": (bool(etat["existe"]) and not a_ajouter
                         and not prix_changes),
        "produits": [
            {"nom": o["materiau_nom"], "prix": o["prix"], "unite": o.get("unite")}
            for o in publiables
        ],
        "sans_prix": [o["materiau_nom"] for o in sans_prix],
        "ambigus": [o["libelle_brut"][:60] for o in ambigus],
        "vehicules": len([v for v in fiche.get("vehicules", []) if v.get("garder")]),
        "manque": _ce_qui_manque(fiche, publiables),
    }


def offres_en_attente_de_format(fiche: dict) -> list[dict]:
    """Les offres de CETTE fiche qui ont un prix et attendent leur format.

    C'est la cause numero un des refus, et elle etait invisible : le message
    parlait d'un « produit reference AVEC un prix » sans jamais dire lequel
    des deux manquait. Mesure le 01/09/2026 : sur les 97 offres gardees des 32
    prospects valides, 35 avaient un prix, 2 une reference, AUCUNE les deux.
    """
    return [
        offre for offre in fiche.get("offres", [])
        if offre.get("garder") and offre.get("prix")
        and not offre.get("materiau_slug")
        and not offre.get("hors_catalogue")
    ]


def _ce_qui_manque(fiche: dict, publiables: list[dict]) -> list[str]:
    """Ce qui manque au DEPOT pour exister sur Akora. Pas a ses produits.

    🔴 CE QUI A CHANGE, ET POURQUOI. L'inscription exigeait « au moins un
       produit reference AVEC un prix ». Or 440 publications sur 526 (84 %,
       mesure du 01/09/2026) ne portent AUCUN prix : le tarif ne se met pas
       dans le post, il se donne au telephone. Un depot dont on avait le nom,
       le quartier et le numero ne pouvait donc pas entrer sur le site, et on
       attendait un prix qui n'allait jamais tomber tout seul.

       Le depot entre maintenant avec ses coordonnees. Ses produits le
       rejoignent quand ils se completent — un appel qui donne le prix, une
       photo qu'on designe.
    """
    return tri.fiche_depot_complete(fiche)


def inscrire(prospect_id: str, publier_aussi: bool = False,
             actualiser_prix: bool = False) -> dict:
    """Crée le fournisseur et ses produits sur Akora. Renvoie ce qui a été écrit.

    Idempotent : si le prospect porte déjà un `fournisseur_id`, la fiche
    distante est mise à jour et les produits resynchronisés. Relancer ne crée
    jamais un deuxième dépôt du même nom.
    """
    fiche = base.prospect(prospect_id)
    if not fiche:
        raise ErreurInscription("Prospect introuvable.")
    if fiche.get("statut") == "refuse":
        raise ErreurInscription("Ce dépôt a demandé à ne pas être contacté.")

    publiables = _produits_publiables(fiche)
    manques = _ce_qui_manque(fiche, publiables)
    if manques:
        # ⚠ Le MOTIF doit coller au manque reel. La premiere version collait
        # toujours la meme phrase sur les prix, meme quand il ne manquait que
        # la ville : le 24/08/2026 un refus « il manque une ville » se
        # terminait par un discours sur les prix de remplissage, et on a
        # cherche le prix pendant plusieurs minutes.
        raisons = {
            "un nom d'enseigne":
                "une fiche sans nom n'est revendiquable par personne",
            "un contact (téléphone ou page)":
                "une fiche qu'on ne peut pas appeler ne sert ni a l'acheteur "
                "ni a nous — et c'est par l'appel qu'on obtient les prix",
            "un emplacement (ville ou quartier)":
                "sans localite, la fiche ne peut ni etre trouvee dans "
                "l'annuaire ni servir un calcul de livraison",
        }
        motifs = [raisons[m] for m in manques if m in raisons]
        raise ErreurInscription(
            "Il manque " + ", ".join(manques)
            + (". " + " ; ".join(motifs).capitalize() + "." if motifs else ".")
        )

    # ── Ce depot est-il DEJA sur Akora ? ─────────────────────────────────
    etat = etat_sur_le_site(fiche)
    if etat["existe"] and not etat["a_nous"]:
        # Sa fiche lui appartient : on n'y touche pas, et on cesse de le
        # demarcher. Le prospect devient un client, pas un echec.
        base.modifier_prospect(prospect_id, {
            "statut": "deja_client", "fournisseur_id": etat["fournisseur_id"]})
        base.evenement(prospect_id, "inscription",
                       f"Deja sur Akora, fiche tenue par le depot ({etat['raison']}).")
        base.logguer(
            f"« {fiche['nom']} » est deja sur Akora et tient sa propre fiche "
            f"({etat['raison']}) — rien n'a ete ecrit.", "info")
        return {"action": "deja_au_depot", "fournisseur_id": etat["fournisseur_id"],
                "statut": etat["statut"], "produits": 0,
                "raison": etat["raison"]}

    if etat["existe"] and not fiche.get("fournisseur_id"):
        # Meme depot, lien jamais pose : on ADOPTE au lieu de creer un double.
        base.modifier_prospect(prospect_id, {"fournisseur_id": etat["fournisseur_id"]})
        fiche["fournisseur_id"] = etat["fournisseur_id"]
        base.logguer(
            f"« {fiche['nom']} » existait deja sur Akora ({etat['raison']}) : "
            "sa fiche est reprise, aucun doublon cree.", "info")

    # Ce qui manque VRAIMENT au site. Renvoyer les produits deja presents ne
    # ferait que reecrire leur prix — et sur une fiche qu'on nous a peut-etre
    # rendue entre-temps, ce serait ecraser le tarif du depot.
    en_ligne = etat.get("prix_en_ligne") or {}
    manquants = [o for o in publiables if o["materiau_slug"] not in etat["produits"]]
    # Un produit DEJA en ligne mais sans image reprend le chemin : on vient de
    # lui designer une photo, et c'est la seule facon qu'elle lui parvienne.
    muets = etat.get("sans_photo_en_ligne") or set()
    manquants += [o for o in publiables
                  if o["materiau_slug"] in etat["produits"]
                  and o["materiau_slug"] in muets]
    # ⚠ UN PRIX EN LIGNE NE S'ECRASE PAS TOUT SEUL. Ce que le bot vient de
    #   lire n'est pas forcement plus recent que ce qui est affiche : la
    #   publication importee a la main le 01/09/2026 datait du 31 mai, et son
    #   chevron « 8 000ar a 10 000ar » aurait remplace un 9 000 Ar juste.
    #   L'ecart se SIGNALE (apercu.prix_changes) ; il ne se corrige que sur
    #   demande explicite.
    reprix = []
    if actualiser_prix:
        reprix = [o for o in publiables
                  if o["materiau_slug"] in en_ligne
                  and int(en_ligne[o["materiau_slug"]]) != int(o["prix"])]
        manquants = manquants + reprix

    proprietaire = compte_akora()
    localite = None
    try:
        trouvee = akora.localite_par_nom(fiche.get("quartier") or fiche.get("ville") or "")
        localite = trouvee["id"] if trouvee else None
        # La coordonnée vient de la table `localites`, jamais d'une estimation
        # (règle A2.8, aucune coordonnée inventée) — exactement ce que fait
        # déjà `reservation.reserver`. Sans elle, aucune livraison n'est
        # chiffrable : le fournisseur apparaît dans l'annuaire mais son prix
        # rendu chantier reste vide, et c'est TOUTE la promesse d'Akora.
        # Constaté le 01/09/2026 : les 4 fiches créées par le bot étaient
        # toutes sans position, deux d'entre elles avaient pourtant leur
        # localité.
        if trouvee and trouvee.get("lat") is not None and not fiche.get("lat"):
            fiche["lat"], fiche["lng"] = trouvee["lat"], trouvee["lng"]
            base.modifier_prospect(
                prospect_id, {"lat": trouvee["lat"], "lng": trouvee["lng"]})
    except akora.ErreurAkora:
        pass

    photos = [p for p in fiche.get("photos", []) if p.get("garder") and p.get("url_o2")]
    statut = "actif" if publier_aussi else "brouillon"

    if fiche.get("fournisseur_id"):
        distant = fiche["fournisseur_id"]
        akora.executer_systeme(
            _sql_maj_fournisseur(distant, fiche, localite, photos, statut))
    else:
        slug = _slug_libre(_slug(fiche["nom"]))
        lignes = akora.executer(
            _sql_creer_fournisseur(fiche, proprietaire, slug, localite, photos, statut)
        )
        if not lignes or not lignes[0].get("id"):
            raise ErreurInscription("Le fournisseur n'a pas été créé.")
        distant = lignes[0]["id"]
        base.modifier_prospect(prospect_id, {"fournisseur_id": distant})

    # Les photos partent AVANT les produits : un produit sans image ne va
    # jamais sur le site, et c'est ici que la regle se tient. Une photo
    # designee vit sur ce PC tant qu'on ne l'a pas televersee — c'est le
    # maillon qui manquait, constate le 01/09/2026 sur « Hazo Rn3 » :
    # 6 photos attribuees, 2 produits prets, zero `url_o2`, et un site
    # qui recevait des produits sans image.
    images: dict[int, list[str]] = {}
    if manquants:
        images = televerser_les_photos(fiche, manquants)
        sans_image = [o for o in manquants if not images.get(int(o['id']))]
        if sans_image:
            noms = ', '.join((o.get('materiau_nom') or '?') for o in sans_image[:4])
            base.logguer(
                f"{len(sans_image)} produit(s) NON transfere(s) — leur photo "
                f"n'a pas pu etre mise en ligne : {noms}", "avert")
            manquants = [o for o in manquants if images.get(int(o['id']))]
    if manquants:
        akora.executer(_sql_produits(distant, manquants, statut, images))
    if statut == "actif":
        # ⚠ LA PHOTO EST UNE CONDITION D'ACTIVATION, PAS SEULEMENT
        #   D'ECRITURE. Je l'avais posee a l'ecriture des produits et
        #   oubliee ici : le 01/09/2026, relancer une inscription pour
        #   reparer une position a REACTIVE trois produits sans image que
        #   j'avais remis en brouillon une heure plus tot. Un garde-fou
        #   pose a un seul bout d'un chemin n'en est pas un.
        # Les produits deja en base ne sont pas dans `manquants` : sans cette
        # ligne, un depot passait en actif avec un catalogue reste en
        # brouillon — donc une fiche visible et vide. C'est exactement ce qui
        # s'est produit le 01/09/2026 sur les quatre premiers depots.
        akora.executer(
            "UPDATE public.produits SET statut = 'actif'::public.statut_produit "
            f"WHERE fournisseur_id = {akora.txt(distant)}::uuid "
            "  AND statut = 'brouillon'::public.statut_produit "
            "  AND materiau_ref_id IS NOT NULL AND prix_unitaire > 0 "
            "  AND cardinality(photos) > 0;")
    akora.executer(_sql_vehicules(distant, fiche))
    lier_fiche_reservee(fiche, distant, localite)
    if statut == "actif":
        publier_au_fil(fiche, distant, publiables)

    base.modifier_prospect(prospect_id, {"statut": "inscrit"})
    base.evenement(
        prospect_id, "inscription",
        f"Inscrit sur Akora ({statut}) avec {len(manquants)} produit(s) ajoute(s).",
    )
    akora.oublier_cache()
    base.logguer(
        f"« {fiche['nom']} » inscrit sur Akora en {statut} — "
        f"{len(manquants)} produit(s) ajoute(s)"
        + (f", {len(publiables) - len(manquants)} deja present(s)."
           if len(manquants) != len(publiables) else "."),
        "succes",
    )
    return {
        "action": "adopte" if etat["existe"] else "cree",
        "fournisseur_id": distant,
        "statut": statut,
        "produits": len(manquants) - len(reprix),
        "prix_actualises": len(reprix),
        "produits_deja": len(publiables) - len(manquants),
        "lien": f"{SITE}/fournisseur/{_slug(fiche['nom'])}",
    }


def transferer_produits(prospect_id: str, actualiser_prix: bool = False) -> dict:
    """Envoie sur Akora les produits COMPLETS d'un depot deja inscrit.

    Le second geste, celui qui se repete. La fiche du depot se remplit une
    fois — nom, contact, emplacement ; ses produits, eux, arrivent au fil des
    appels et des photos designees, et ce bouton les pousse a chaque fois.

    Ne touche a rien d'autre : ni au nom du depot, ni a sa position, ni a sa
    flotte. Et jamais aux produits d'un depot qui tient sa propre fiche.
    """
    fiche = base.prospect(prospect_id)
    if not fiche:
        raise ErreurInscription("Prospect introuvable.")

    etat = etat_sur_le_site(fiche)
    if not etat["existe"]:
        raise ErreurInscription(
            "Ce depot n'a pas encore de fiche sur Akora : transferez-le "
            "d'abord, ses produits suivront.")
    if not etat["a_nous"]:
        raise ErreurInscription(
            "Ce depot tient sa propre fiche sur Akora : ses prix sont a lui, "
            "on n'y ecrit pas.")

    distant = etat["fournisseur_id"]
    if not fiche.get("fournisseur_id"):
        base.modifier_prospect(prospect_id, {"fournisseur_id": distant})

    pretes = _produits_publiables(fiche)
    if not pretes:
        etat_offres = tri.etat_des_offres(fiche)
        raise ErreurInscription(
            "Aucun produit complet. Il manque : "
            + ", ".join(filter(None, [
                f"{len(etat_offres['sans_reference'])} format(s)"
                if etat_offres["sans_reference"] else "",
                f"{len(etat_offres['sans_prix'])} prix"
                if etat_offres["sans_prix"] else "",
                f"{len(etat_offres['sans_photo'])} photo(s) a designer"
                if etat_offres["sans_photo"] else "",
            ])) + ". Un produit ne part qu'avec sa reference, son prix ET sa photo.")

    en_ligne = etat.get("prix_en_ligne") or {}
    manquants = [o for o in pretes if o["materiau_slug"] not in etat["produits"]]
    muets = etat.get("sans_photo_en_ligne") or set()
    manquants += [o for o in pretes
                  if o["materiau_slug"] in etat["produits"]
                  and o["materiau_slug"] in muets]
    reprix = []
    if actualiser_prix:
        reprix = [o for o in pretes
                  if o["materiau_slug"] in en_ligne
                  and int(en_ligne[o["materiau_slug"]]) != int(o["prix"])]
        manquants = manquants + reprix

    statut = "actif" if charger().get("inscrire_en_actif", False) else "brouillon"
    # Les photos partent AVANT les produits : un produit sans image ne va
    # jamais sur le site, et c'est ici que la regle se tient. Une photo
    # designee vit sur ce PC tant qu'on ne l'a pas televersee — c'est le
    # maillon qui manquait, constate le 01/09/2026 sur « Hazo Rn3 » :
    # 6 photos attribuees, 2 produits prets, zero `url_o2`, et un site
    # qui recevait des produits sans image.
    images: dict[int, list[str]] = {}
    if manquants:
        images = televerser_les_photos(fiche, manquants)
        sans_image = [o for o in manquants if not images.get(int(o['id']))]
        if sans_image:
            noms = ', '.join((o.get('materiau_nom') or '?') for o in sans_image[:4])
            base.logguer(
                f"{len(sans_image)} produit(s) NON transfere(s) — leur photo "
                f"n'a pas pu etre mise en ligne : {noms}", "avert")
            manquants = [o for o in manquants if images.get(int(o['id']))]
    if manquants:
        akora.executer(_sql_produits(distant, manquants, statut, images))
    if statut == "actif":
        akora.executer(
            "UPDATE public.produits SET statut = 'actif'::public.statut_produit "
            f"WHERE fournisseur_id = {akora.txt(distant)}::uuid "
            "  AND statut = 'brouillon'::public.statut_produit "
            "  AND materiau_ref_id IS NOT NULL AND prix_unitaire > 0 "
            "  AND cardinality(photos) > 0;")
        publier_au_fil(fiche, distant, pretes)

    akora.oublier_cache()
    base.evenement(
        prospect_id, "inscription",
        f"{len(manquants) - len(reprix)} produit(s) ajoute(s), "
        f"{len(reprix)} prix actualise(s).")
    base.logguer(
        f"« {fiche['nom']} » : {len(manquants) - len(reprix)} produit(s) "
        f"ajoute(s) sur Akora"
        + (f", {len(reprix)} prix actualise(s)." if reprix else "."),
        "succes" if manquants else "info")
    return {
        "fournisseur_id": distant,
        "produits": len(manquants) - len(reprix),
        "prix_actualises": len(reprix),
        "produits_deja": len(pretes) - len(manquants),
        "statut": statut,
    }


def lier_fiche_reservee(fiche: dict, distant: str, localite: str | None) -> bool:
    """Rend la fiche REVENDIQUABLE. C'est le geste qui evite un doublon.

    `revendiquer_fiche()` sait transferer la propriete du fournisseur au depot
    qui revendique — mais seulement si `prospects_fournisseurs.fournisseur_id`
    pointe vers lui. Sinon elle part dans sa branche « creer » et fabrique un
    SECOND depot du meme nom, a cote du premier.

    Constate le 01/09/2026 : 20 fiches reservees sur le site, **zero** liee a
    un fournisseur, alors que quatre depots avaient les deux. Deux d'entre eux
    (Mirary, Fournisseur en Materiaux) etaient armes pour le doublon : leur
    lien de revendication etait deja parti.

    La cause etait un ordre : l'ancien code ne posait le lien que si une fiche
    reservee existait DEJA. Quand l'inscription precede la reservation — le cas
    courant — l'UPDATE ne touchait aucune ligne, en silence. On cree donc la
    fiche reservee ici si elle manque, sans photo : elle ne sert qu'a porter le
    jeton et le lien.
    """
    jeton = (fiche.get("jeton") or "").strip()
    if not jeton:
        base.logguer(
            f"« {fiche.get('nom')} » n'a pas de jeton : sa fiche ne sera pas "
            "revendicable tant qu'elle n'est pas reservee.", "avert")
        return False

    from . import reservation
    try:
        # ⚠ NE PAS rejouer l'upsert complet sur une fiche qui existe deja : il
        # ecrit `photos = excluded.photos`, donc une fiche reservee avec ses
        # huit photos envoyees sur o2switch les perdrait toutes, et sa
        # localite avec. Fiche presente = on ne pose QUE le lien.
        existe = akora.executer(
            "SELECT id::text FROM public.prospects_fournisseurs "
            f"WHERE jeton = {akora.txt(jeton)} LIMIT 1;"
        )
        if not existe:
            if localite is None:
                trouvee = akora.localite_par_nom(
                    fiche.get("quartier") or fiche.get("ville") or "")
                localite = trouvee["id"] if trouvee else None
            akora.executer(reservation._sql_upsert_fiche(fiche, [], localite))
        akora.executer(
            "UPDATE public.prospects_fournisseurs "
            f"SET fournisseur_id = {akora.txt(distant)}::uuid, updated_at = now() "
            f"WHERE jeton = {akora.txt(jeton)};"
        )
    except akora.ErreurAkora as e:
        # Un lien manquant ne doit pas annuler une inscription reussie : on le
        # dit fort, et le rattrapage se relance seul a la prochaine inscription.
        base.logguer(
            f"Lien de revendication NON pose pour « {fiche.get('nom')} » : {e}",
            "erreur")
        return False
    return True


def _texte_fil(fiche: dict, publiables: list[dict]) -> str:
    """Ce que le depot dit dans le fil, ecrit avec ses seuls chiffres a lui."""
    lignes = [f"{fiche['nom']} — ce que nous avons en stock"]
    lieu = fiche.get("quartier") or fiche.get("ville")
    if lieu:
        lignes[0] = f"{fiche['nom']} — {lieu}"
    lignes.append("")
    for offre in publiables[:8]:
        unite = fil.UNITES.get(offre.get("unite") or "", "")
        lignes.append(
            f"{offre['materiau_nom']} : {fil.prix_lisible(offre['prix'])} {unite}".strip()
        )
    lignes.append("")
    # Dire d'où viennent ces prix n'est pas une précaution de style : ils ont
    # été relevés sur les annonces publiques du dépôt, pas saisis par lui.
    # Cette phrase est lue par des acheteurs : elle porte ses accents.
    lignes.append(
        "Prix relevés sur les annonces publiques de ce dépôt. "
        "Prix au dépôt, hors livraison."
    )
    texte = "\n".join(lignes)
    return texte[:1200]


def televerser_les_photos(fiche: dict, offres: list[dict]) -> dict[int, list[str]]:
    """Met EN LIGNE les photos designees de ces produits, puis rend leurs URL.

    🔴 LE MAILLON QUI MANQUAIT. Une photo choisie a l'ecran vit sur ce PC, et
       le bot la sert a `/photo/...` — une adresse que personne d'autre ne
       peut ouvrir. Rien ne la televersait : `envoyer_photos` n'existait que
       pour la fiche reservee. Le site recevait donc des produits sans image
       alors que l'ecran affichait « pret » et « 5/6 attribuee(s) ».

       Constate le 01/09/2026 sur « Hazo Rn3 » : 6 photos attribuees,
       2 produits prets, **zero** `url_o2`.

    L'envoi ne concerne QUE les photos des produits transferes : un prospect
    en garde souvent des dizaines, et les envoyer toutes couterait du temps et
    de l'espace pour des images que personne ne verra.
    """
    from . import reservation, tri

    par_offre = tri.photos_par_offre(fiche)
    vises = {int(o["id"]) for o in offres if o.get("id") is not None}
    a_envoyer = [photo
                 for identifiant, photos in par_offre.items() if identifiant in vises
                 for photo in photos if not photo.get("url_o2")]
    if a_envoyer:
        base.logguer(
            f"« {fiche.get('nom')} » : envoi de {len(a_envoyer)} photo(s) de "
            "produit vers o2switch…", "info")
        reservation.envoyer_ces_photos(fiche, a_envoyer)
        # On relit la fiche : `url_o2` vient d'etre ecrit photo par photo.
        fiche = base.prospect(fiche["id"]) or fiche
    return photos_par_offre(fiche)


def photos_par_offre(fiche: dict) -> dict[int, list[str]]:
    """{identifiant d'offre: [adresses des photos qui la montrent]}.

    Le lien est pose a la main dans l'ecran de tri du bot : aucune machine ne
    distingue un madrier d'un chevron sur une photo de tas de bois. Seules les
    photos DEJA envoyees (url_o2) comptent — une image encore sur ce PC n'est
    affichable par personne.
    """
    par_offre: dict[int, list[str]] = {}
    for photo in fiche.get("photos", []):
        if not (photo.get("garder") and photo.get("url_o2") and photo.get("offre_id")):
            continue
        par_offre.setdefault(int(photo["offre_id"]), []).append(photo["url_o2"])
    # La base borne les photos d'un produit : on coupe ici plutot que de
    # laisser Postgres refuser toute l'inscription pour une image de trop.
    return {oid: urls[:4] for oid, urls in par_offre.items()}


def _photos_qui_montrent(fiche: dict, publiables: list[dict]) -> list[str]:
    """Les photos dont on est SÛR qu'elles montrent le produit annoncé.

    🔴 LE DÉFAUT QU'ELLE RÉPARE, VU EN LIGNE LE 01/09/2026. La publication de
    « Fournisseur en Matériaux de construction » disait « Sable fin :
    45 000 Ar le m³ » sous **deux photos de gravillon et de moellon**. Les
    photos n'étaient pas volées à un autre dépôt ni prises au hasard : elles
    venaient bien de la publication Facebook d'où sortait le prix. Seulement
    ce post annonçait CINQ matériaux — gravillon, fasika, moellon, biriky,
    caillasse — avec les photos des cinq, et nous n'en publiions qu'un.

    Le critère « même publication d'origine » ne suffit donc pas. Celui qui
    tient : **la publication d'origine ne devait parler que de ce produit-là**.
    Un post qui annonce un seul matériau montre ce matériau ; un catalogue en
    montre plusieurs, et rien ne dit laquelle est laquelle.

    Sans photo sûre, on publie sans photo. Un texte nu vaut mieux qu'une image
    qui contredit le prix affiché juste en dessous — c'est le dépôt qu'elle
    fait passer pour un menteur.
    """
    # Une photo ATTRIBUEE a la main a un produit annonce ici ne se discute
    # pas : c'est un humain qui a dit ce qu'elle montre.
    attribuees = photos_par_offre(fiche)
    explicites = [
        url for offre in publiables
        for url in attribuees.get(int(offre["id"]), [])
        if offre.get("id") is not None
    ]
    if explicites:
        return explicites[:4]

    gardees = [o for o in fiche.get("offres", []) if o.get("garder")]
    par_publication: dict[str, int] = {}
    for offre in gardees:
        source = offre.get("publication_id")
        if source:
            par_publication[source] = par_publication.get(source, 0) + 1

    # Les publications qui ne parlaient que d'UNE chose, et qui figurent parmi
    # les produits annoncés ici.
    sures = {
        offre.get("publication_id") for offre in publiables
        if par_publication.get(offre.get("publication_id")) == 1
    }
    if not sures:
        return []
    return [
        photo["url_o2"] for photo in fiche.get("photos", [])
        if photo.get("garder") and photo.get("url_o2")
        and photo.get("publication_id") in sures
    ][:4]


def publier_au_fil(fiche: dict, distant: str, publiables: list[dict]) -> str:
    """Une publication `stock` AU NOM DU DEPOT, avec ses produits attaches.

    Le fil est le premier ecran d'Akora. Une fiche creee mais muette n'y
    apparait pas : le 01/09/2026, quatre depots existaient sur le site et le
    fil ne portait que trois publications, toutes du seed.

    Une seule publication par depot : relancer l'inscription resynchronise les
    prix, ce n'est pas une nouvelle. Le fil se remplit de depots, pas de
    repetitions.
    """
    if not publiables:
        return ""
    deja = akora.executer(
        "SELECT id::text FROM public.publications "
        f"WHERE fournisseur_id = {akora.txt(distant)}::uuid "
        "AND type = 'stock'::public.type_publication LIMIT 1;"
    )
    if deja:
        return deja[0]["id"]

    texte = _texte_fil(fiche, publiables)
    if len(texte) < 10:
        return ""
    photos = _photos_qui_montrent(fiche, publiables)
    tableau = ("ARRAY[" + ", ".join(akora.txt(u) for u in photos) + "]::text[]"
               if photos else "'{}'::text[]")
    lignes = akora.executer(
        "INSERT INTO public.publications "
        "(type, fournisseur_id, auteur_id, texte, photos, localite_id, statut) "
        # `auteur_id` référence `profiles`, pas `auth.users` : un propriétaire
        # sans ligne de profil ferait échouer l'insertion sur la clé étrangère.
        # Le sous-select rend NULL dans ce cas — la contrainte
        # `publication_coherente` l'autorise pour une publication de dépôt, et
        # une publication sans auteur vaut mieux qu'un fil vide.
        "SELECT 'stock'::public.type_publication, f.id, "
        "       (SELECT pr.id FROM public.profiles pr WHERE pr.id = f.owner_id), "
        f"{akora.txt(texte)}, {tableau}, f.localite_id, "
        "'publiee'::public.statut_publication "
        "  FROM public.fournisseurs f "
        f" WHERE f.id = {akora.txt(distant)}::uuid "
        "RETURNING id::text;"
    )
    if not lignes or not lignes[0].get("id"):
        base.logguer(
            f"Publication au fil refusee pour « {fiche.get('nom')} ».", "avert")
        return ""
    publication = lignes[0]["id"]

    # Les produits mis en avant : la base en accepte quatre au plus, et ce
    # sont les identifiants REELS qu'on relit — pas ceux qu'on croit avoir
    # ecrits.
    slugs = ", ".join(akora.txt(o["materiau_slug"]) for o in publiables[:4])
    akora.executer(
        "INSERT INTO public.publication_produits (publication_id, produit_id, ordre) "
        f"SELECT {akora.txt(publication)}::uuid, p.id, "
        "       row_number() over (order by p.prix_unitaire desc) - 1 "
        "  FROM public.produits p "
        f" WHERE p.fournisseur_id = {akora.txt(distant)}::uuid "
        f"   AND p.slug IN ({slugs}) "
        " LIMIT 4 "
        "ON CONFLICT DO NOTHING;"
    )
    base.logguer(
        f"« {fiche['nom']} » a publie son stock dans le fil Akora.", "succes")
    return publication


def _sql_creer_fournisseur(fiche: dict, proprietaire: str, slug: str,
                           localite: str | None, photos: list[dict],
                           statut: str) -> str:
    colonnes = {
        "owner_id": f"{akora.txt(proprietaire)}::uuid",
        "raison_sociale": akora.txt(fiche["nom"]),
        "slug": akora.txt(slug),
        "metier": akora.txt(fiche.get("metier")),
        # Format international impose par la base, mobile uniquement.
        "telephone": akora.txt(telephone_e164(fiche.get("telephone"))),
        "whatsapp": (akora.txt(telephone_e164(fiche.get("telephone")))
                     if fiche.get("whatsapp") else "NULL"),
        "adresse": akora.txt(fiche.get("adresse")),
        "localite_id": f"{akora.txt(localite)}::uuid" if localite else "NULL",
        "lat": akora.reel(fiche.get("lat")),
        "lng": akora.reel(fiche.get("lng")),
        "photo_depot": akora.txt(photos[0]["url_o2"]) if photos else "NULL",
        "retrait_sur_place": akora.bool_sql(fiche.get("retrait_sur_place")),
        "rayon_max_km": (akora.reel(fiche.get("rayon_km"))
                         if fiche.get("rayon_km") else "40"),
        "statut": f"{akora.txt(statut)}::public.statut_fournisseur",
        # Rien n'a été vérifié : ni NIF, ni STAT, ni existence légale.
        # Le badge se gagne, il ne se suppose pas.
        "niveau_verification": "'non_verifie'::public.niveau_verification",
    }
    noms = ", ".join(colonnes)
    valeurs = ", ".join(colonnes.values())
    return (f"INSERT INTO public.fournisseurs ({noms}) VALUES ({valeurs}) "
            "RETURNING id::text;")


def _sql_maj_fournisseur(distant: str, fiche: dict, localite: str | None,
                         photos: list[dict], statut: str) -> str:
    """Met à jour sans toucher au propriétaire : le dépôt l'a peut-être repris."""
    champs = [
        f"raison_sociale = {akora.txt(fiche['nom'])}",
        f"metier = {akora.txt(fiche.get('metier'))}",
        f"telephone = {akora.txt(telephone_e164(fiche.get('telephone')))}",
        f"adresse = {akora.txt(fiche.get('adresse'))}",
        f"lat = {akora.reel(fiche.get('lat'))}",
        f"lng = {akora.reel(fiche.get('lng'))}",
        f"retrait_sur_place = {akora.bool_sql(fiche.get('retrait_sur_place'))}",
    ]
    if localite:
        champs.append(f"localite_id = {akora.txt(localite)}::uuid")
    if photos:
        champs.append(f"photo_depot = {akora.txt(photos[0]['url_o2'])}")
    if fiche.get("rayon_km"):
        champs.append(f"rayon_max_km = {akora.reel(fiche['rayon_km'])}")
    # Le statut ne REDESCEND jamais : si le dépôt a publié sa fiche lui-même,
    # une resynchronisation du bot ne doit pas la faire disparaître.
    if statut == "actif":
        champs.append("statut = 'actif'::public.statut_fournisseur")
    return (f"UPDATE public.fournisseurs SET {', '.join(champs)}, updated_at = now() "
            f"WHERE id = {akora.txt(distant)}::uuid;")


def _sql_produits(distant: str, offres: list[dict], statut: str,
                  photos: dict[int, list[str]] | None = None) -> str:
    """Écrit les produits. `poids` et `volume` restent NULL exprès.

    Le trigger `aligner_produit_sur_reference` les remplit depuis la référence,
    et c'est lui qui doit faire autorité : le fournisseur ajustera le poids de
    SON parpaing, mais la famille et l'unité viennent du catalogue.
    """
    if not offres:
        return "SELECT 1;"

    # Un INSERT … SELECT par matériau : `materiau_ref_id`, `categorie_id` et
    # l'unité par défaut sont résolus EN BASE, depuis le slug. Rien n'est
    # deviné ici — si la référence a disparu du catalogue, le SELECT ne rend
    # aucune ligne et le produit n'est simplement pas créé.
    photos = photos or {}
    morceaux = []
    for offre in offres:
        unite = (f"{akora.txt(offre['unite'])}::public.unite"
                 if offre.get("unite") else "m.unite_defaut")
        # Les photos de CE produit, attribuees a la main dans le bot. Vide
        # quand personne n'a dit ce que montre l'image : mieux vaut un produit
        # sans photo qu'un madrier illustre par un tas de gravillon.
        siennes = photos.get(int(offre["id"])) if offre.get("id") is not None else None
        tableau = ("ARRAY[" + ", ".join(akora.txt(u) for u in siennes) + "]::text[]"
                   if siennes else "'{}'::text[]")
        valeurs = ", ".join([
            f"{akora.txt(distant)}::uuid",
            "m.id",
            "m.categorie_id",
            akora.txt(offre["materiau_nom"]),
            akora.txt(offre["materiau_slug"]),
            unite,
            akora.num(offre["prix"]),
            akora.num(offre.get("quantite_min") or 1),
            "NULL",          # poids  : rempli par le trigger depuis la référence
            "NULL",          # volume : idem
            tableau,
            f"{akora.txt(statut)}::public.statut_produit",
        ])
        morceaux.append(
            "INSERT INTO public.produits (fournisseur_id, materiau_ref_id, "
            "categorie_id, nom_affiche, slug, unite, prix_unitaire, quantite_min, "
            "poids_kg_unite, volume_m3_unite, photos, statut) "
            f"SELECT {valeurs} FROM public.materiaux_ref m "
            f"WHERE m.slug = {akora.txt(offre['materiau_slug'])} "
            "ON CONFLICT (fournisseur_id, slug) DO UPDATE SET "
            "prix_unitaire = excluded.prix_unitaire, unite = excluded.unite, "
            "quantite_min = excluded.quantite_min, prix_maj_le = now(), "
            # On ajoute des photos, on n'en retire jamais : une resynchronisation
            # sans attribution ne doit pas vider la fiche d'un produit.
            "photos = CASE WHEN cardinality(excluded.photos) > 0 "
            "              THEN excluded.photos ELSE produits.photos END, "
            # Le statut MONTE, il ne redescend jamais : une réinscription en
            # actif publie un produit resté en brouillon, mais une
            # resynchronisation en brouillon ne dépublie pas ce que le dépôt a
            # mis en ligne lui-même. Sans cette ligne, les 6 produits des 4
            # fiches créées le 23-31/08 seraient restés invisibles même une
            # fois leur fournisseur publié.
            "statut = CASE WHEN excluded.statut = 'actif'::public.statut_produit "
            "              THEN excluded.statut ELSE produits.statut END;"
        )
    return "".join(morceaux)


def _sql_vehicules(distant: str, fiche: dict) -> str:
    """La flotte, si elle a une capacité connue.

    Un véhicule sans capacité mesurée n'entre dans aucun calcul de livraison :
    il est créé mais INACTIF, pour que le transporteur le complète au lieu
    qu'on facture sur une capacité inventée.
    """
    flotte = [v for v in fiche.get("vehicules", []) if v.get("garder")]
    if not flotte:
        return "SELECT 1;"
    morceaux = [
        f"DELETE FROM public.vehicules_livraison "
        f"WHERE fournisseur_id = {akora.txt(distant)}::uuid;"
    ]
    lignes = []
    for rang, v in enumerate(flotte):
        mesure = v.get("capacite_m3") or v.get("capacite_kg")
        lignes.append("(" + ", ".join([
            f"{akora.txt(distant)}::uuid",
            akora.txt(v["nom"]),
            akora.reel(v.get("capacite_m3") or 1),
            akora.reel(v.get("capacite_kg") or 1000),
            akora.num(v.get("prix_par_km") or 0),
            akora.num(v.get("forfait_base") or 0),
            akora.reel(v.get("km_inclus") or 0),
            akora.num(v.get("prix_minimum") or 0),
            akora.bool_sql(v.get("aller_retour")),
            akora.bool_sql(bool(mesure)),
            str(rang),
        ]) + ")")
    morceaux.append(
        "INSERT INTO public.vehicules_livraison (fournisseur_id, nom, capacite_m3, "
        "capacite_kg, prix_par_km, forfait_base, km_inclus, prix_minimum, "
        "facturer_aller_retour, actif, ordre) VALUES " + ", ".join(lignes) + ";"
    )
    return "".join(morceaux)


def publier(prospect_id: str) -> dict:
    """Fait passer un fournisseur inscrit de `brouillon` à `actif`.

    C'est le seul geste qui rend une fiche VISIBLE dans l'annuaire public,
    avec le nom du dépôt et les prix relevés sur Facebook. Il se fait sur un
    clic humain, jamais en lot silencieux.
    """
    fiche = base.prospect(prospect_id)
    if not fiche or not fiche.get("fournisseur_id"):
        raise ErreurInscription("Ce prospect n'est pas encore inscrit sur Akora.")
    distant = fiche["fournisseur_id"]
    akora.executer_systeme(
        "UPDATE public.fournisseurs SET statut = 'actif'::public.statut_fournisseur, "
        f"updated_at = now() WHERE id = {akora.txt(distant)}::uuid;"
        "UPDATE public.produits SET statut = 'actif'::public.statut_produit "
        f"WHERE fournisseur_id = {akora.txt(distant)}::uuid "
        "AND materiau_ref_id IS NOT NULL AND prix_unitaire > 0 "
        "AND cardinality(photos) > 0;"
    )
    publiables = _produits_publiables(fiche)
    lier_fiche_reservee(fiche, distant, None)
    publier_au_fil(fiche, distant, publiables)
    base.evenement(prospect_id, "inscription", "Fiche publiée dans l'annuaire Akora.")
    base.logguer(f"« {fiche['nom']} » est maintenant visible sur Akora.", "succes")
    akora.oublier_cache()
    return {"fournisseur_id": distant, "statut": "actif"}


def depublier(prospect_id: str) -> dict:
    """Repasse la fiche en brouillon — elle disparaît de l'annuaire."""
    fiche = base.prospect(prospect_id)
    if not fiche or not fiche.get("fournisseur_id"):
        raise ErreurInscription("Ce prospect n'est pas inscrit sur Akora.")
    distant = fiche["fournisseur_id"]
    akora.executer_systeme(
        "UPDATE public.fournisseurs SET statut = 'brouillon'::public.statut_fournisseur, "
        f"updated_at = now() WHERE id = {akora.txt(distant)}::uuid;"
    )
    base.evenement(prospect_id, "inscription", "Fiche retirée de l'annuaire.")
    akora.oublier_cache()
    return {"fournisseur_id": distant, "statut": "brouillon"}
