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

from . import akora, base
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


def _produits_publiables(fiche: dict) -> list[dict]:
    """Les offres qui peuvent devenir des produits : référencées ET chiffrées."""
    return [
        offre for offre in fiche.get("offres", [])
        if offre.get("garder") and offre.get("materiau_slug") and offre.get("prix")
    ]


def apercu(prospect_id: str) -> dict:
    """Ce qui partirait, sans rien écrire. Sert à l'aperçu avant inscription."""
    fiche = base.prospect(prospect_id)
    if not fiche:
        raise ErreurInscription("Prospect introuvable.")
    publiables = _produits_publiables(fiche)
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
        "produits": [
            {"nom": o["materiau_nom"], "prix": o["prix"], "unite": o.get("unite")}
            for o in publiables
        ],
        "sans_prix": [o["materiau_nom"] for o in sans_prix],
        "ambigus": [o["libelle_brut"][:60] for o in ambigus],
        "vehicules": len([v for v in fiche.get("vehicules", []) if v.get("garder")]),
        "manque": _ce_qui_manque(fiche, publiables),
    }


def _ce_qui_manque(fiche: dict, publiables: list[dict]) -> list[str]:
    manques = []
    if not (fiche.get("nom") or "").strip():
        manques.append("un nom d'enseigne")
    if not publiables:
        manques.append("au moins un produit référencé AVEC un prix")
    if not (fiche.get("ville") or fiche.get("quartier")):
        manques.append("une ville ou un quartier")
    return manques


def inscrire(prospect_id: str, publier_aussi: bool = False) -> dict:
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
        raise ErreurInscription(
            "Il manque " + ", ".join(manques)
            + ". Un produit sans prix n'a rien à faire sur un site qui compare "
              "des prix, et un prix de remplissage se retrouve en ligne six "
              "mois plus tard."
        )

    proprietaire = compte_akora()
    localite = None
    try:
        trouvee = akora.localite_par_nom(fiche.get("quartier") or fiche.get("ville") or "")
        localite = trouvee["id"] if trouvee else None
    except akora.ErreurAkora:
        pass

    photos = [p for p in fiche.get("photos", []) if p.get("garder") and p.get("url_o2")]
    statut = "actif" if publier_aussi else "brouillon"

    if fiche.get("fournisseur_id"):
        distant = fiche["fournisseur_id"]
        akora.executer(_sql_maj_fournisseur(distant, fiche, localite, photos, statut))
    else:
        slug = _slug_libre(_slug(fiche["nom"]))
        lignes = akora.executer(
            _sql_creer_fournisseur(fiche, proprietaire, slug, localite, photos, statut)
        )
        if not lignes or not lignes[0].get("id"):
            raise ErreurInscription("Le fournisseur n'a pas été créé.")
        distant = lignes[0]["id"]
        base.modifier_prospect(prospect_id, {"fournisseur_id": distant})

    akora.executer(_sql_produits(distant, publiables, statut))
    akora.executer(_sql_vehicules(distant, fiche))
    # La fiche réservée, si elle existe, pointe désormais vers le vrai
    # fournisseur : sans ça, une revendication en créerait un second à côté.
    if fiche.get("jeton"):
        akora.executer(
            "UPDATE public.prospects_fournisseurs "
            f"SET fournisseur_id = {akora.txt(distant)}::uuid "
            f"WHERE jeton = {akora.txt(fiche['jeton'])};"
        )

    base.modifier_prospect(prospect_id, {"statut": "inscrit"})
    base.evenement(
        prospect_id, "inscription",
        f"Inscrit sur Akora ({statut}) avec {len(publiables)} produit(s).",
    )
    akora.oublier_cache()
    base.logguer(
        f"« {fiche['nom']} » inscrit sur Akora en {statut} — "
        f"{len(publiables)} produit(s).",
        "succes",
    )
    return {
        "fournisseur_id": distant,
        "statut": statut,
        "produits": len(publiables),
        "lien": f"{SITE}/fournisseur/{_slug(fiche['nom'])}",
    }


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


def _sql_produits(distant: str, offres: list[dict], statut: str) -> str:
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
    morceaux = []
    for offre in offres:
        unite = (f"{akora.txt(offre['unite'])}::public.unite"
                 if offre.get("unite") else "m.unite_defaut")
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
            f"{akora.txt(statut)}::public.statut_produit",
        ])
        morceaux.append(
            "INSERT INTO public.produits (fournisseur_id, materiau_ref_id, "
            "categorie_id, nom_affiche, slug, unite, prix_unitaire, quantite_min, "
            "poids_kg_unite, volume_m3_unite, statut) "
            f"SELECT {valeurs} FROM public.materiaux_ref m "
            f"WHERE m.slug = {akora.txt(offre['materiau_slug'])} "
            "ON CONFLICT (fournisseur_id, slug) DO UPDATE SET "
            "prix_unitaire = excluded.prix_unitaire, unite = excluded.unite, "
            "quantite_min = excluded.quantite_min, prix_maj_le = now();"
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
    akora.executer(
        "UPDATE public.fournisseurs SET statut = 'actif'::public.statut_fournisseur, "
        f"updated_at = now() WHERE id = {akora.txt(distant)}::uuid;"
        "UPDATE public.produits SET statut = 'actif'::public.statut_produit "
        f"WHERE fournisseur_id = {akora.txt(distant)}::uuid "
        "AND materiau_ref_id IS NOT NULL AND prix_unitaire > 0;"
    )
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
    akora.executer(
        "UPDATE public.fournisseurs SET statut = 'brouillon'::public.statut_fournisseur, "
        f"updated_at = now() WHERE id = {akora.txt(distant)}::uuid;"
    )
    base.evenement(prospect_id, "inscription", "Fiche retirée de l'annuaire.")
    akora.oublier_cache()
    return {"fournisseur_id": distant, "statut": "brouillon"}
