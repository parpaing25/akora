"""Les messages de prospection, en français et en malgache.

Le bot **n'envoie rien tout seul**, et c'est une décision, pas une lacune :
Facebook coupe les comptes qui envoient des messages en série, et un dépôt
démarché par un robot ne rappelle pas. L'interface prépare le texte, ouvre
WhatsApp ou Messenger sur la bonne conversation, et c'est un humain qui appuie.

L'argument de vente tient en une phrase : **sa fiche existe déjà**. Elle porte
son nom, son quartier, ses produits et ses prix, relevés dans ses propres
publications. Il n'a rien à saisir — il a à confirmer. C'est ce qui fait la
différence avec un « inscrivez-vous sur notre site », et c'est pour ça que la
fiche est réservée AVANT le premier contact.
"""
from __future__ import annotations

from urllib.parse import quote

from . import marche
from .config import SITE

ESPACE_FINE = " "


def prix_ar(montant) -> str:
    """« 1 400 Ar » — espace fine insécable, jamais de décimale (AKORA-DESIGN §3)."""
    if montant in (None, ""):
        return ""
    return f"{int(montant):,}".replace(",", ESPACE_FINE) + f"{ESPACE_FINE}Ar"


UNITES_COURTES = {
    "piece": "la pièce", "sac": "le sac", "m3": "le m³", "tonne": "la tonne",
    "m2": "le m²", "ml": "le mètre", "botte": "la botte",
    "chargement": "le chargement", "palette": "la palette",
}
UNITES_MG = {
    "piece": "isaky ny iray", "sac": "isaky ny gony", "m3": "isaky ny m³",
    "tonne": "isaky ny taonina", "m2": "isaky ny m²", "ml": "isaky ny metatra",
    "botte": "isaky ny fehezana", "chargement": "isaky ny fiara",
    "palette": "isaky ny paleta",
}


def lien_fiche(fiche: dict) -> str:
    """L'adresse de la fiche réservée. Elle ne s'ouvre qu'avec son jeton."""
    jeton = fiche.get("jeton") or ""
    return f"{SITE}/depot-reserve/{jeton}" if jeton else ""


def _lignes_produits(offres: list[dict], langue: str, maxi: int = 5) -> list[str]:
    unites = UNITES_MG if langue == "mg" else UNITES_COURTES
    gardees = [o for o in offres if o.get("garder", 1) and o.get("materiau_nom")]
    gardees.sort(key=lambda o: (o.get("prix") is None, o.get("materiau_nom") or ""))
    lignes = []
    for offre in gardees[:maxi]:
        nom = offre["materiau_nom"]
        if offre.get("prix"):
            unite = unites.get(offre.get("unite") or "", "")
            lignes.append(f"• {nom} — {prix_ar(offre['prix'])} {unite}".strip())
        else:
            lignes.append(f"• {nom}")
    reste = len(gardees) - maxi
    if reste > 0:
        lignes.append(
            f"• … sy {reste} hafa" if langue == "mg" else f"• … et {reste} autre(s)"
        )
    return lignes


def _lignes_vehicules(vehicules: list[dict], langue: str, maxi: int = 4) -> list[str]:
    """La flotte, telle qu'un transporteur la reconnaîtra."""
    gardes = [v for v in vehicules if v.get("garder", 1)]
    lignes = []
    for vehicule in gardes[:maxi]:
        morceaux = [vehicule["nom"]]
        if vehicule.get("forfait_base"):
            morceaux.append(
                f"{prix_ar(vehicule['forfait_base'])} "
                + ("isaky ny dia" if langue == "mg" else "le voyage")
            )
        if vehicule.get("prix_par_km"):
            morceaux.append(f"{prix_ar(vehicule['prix_par_km'])} / km")
        lignes.append("• " + " — ".join(morceaux))
    reste = len(gardes) - maxi
    if reste > 0:
        lignes.append(f"• … sy {reste} hafa" if langue == "mg"
                      else f"• … et {reste} autre(s)")
    return lignes


def argument_demandes(prospect_id: str) -> str:
    """« Voici ce que les acheteurs ont cherché chez vous cette semaine. »

    Le seul argument qui déplace un dépôt : pas la promesse de visibilité, la
    preuve d'une demande qu'il ne voit pas passer. Silencieux s'il n'y en a
    aucune — une phrase creuse vaut moins que rien.
    """
    from . import demandes as mod_demandes

    bilan = mod_demandes.argumentaire(prospect_id)
    if not bilan["demandes"]:
        return ""
    exemples = []
    for demande in bilan["demandes"][:3]:
        morceau = demande["materiau"]
        if demande["quantite"]:
            morceau += f" ({demande['quantite']})"
        if demande["lieu"]:
            morceau += f" à {demande['lieu']}"
        exemples.append(morceau)
    return (
        f"Ces {bilan['jours']} derniers jours, {bilan['total']} acheteur(s) ont "
        "cherché ce que vous vendez, près de chez vous : "
        + " ; ".join(exemples) + "."
    )


def argument_prix(offres: list[dict]) -> str:
    """« Votre parpaing 15 est 12 % sous la médiane du marché » — s'il y a de quoi.

    Ne sort une phrase que si la médiane repose sur au moins trois dépôts :
    sinon le chiffre serait une opinion déguisée en donnée.
    """
    reperes = {r["materiau_slug"]: r for r in marche.observatoire() if r["fiable"]}
    for offre in offres:
        repere = reperes.get(offre.get("materiau_slug") or "")
        if not repere or not offre.get("prix"):
            continue
        ecart = round((offre["prix"] - repere["median"]) / repere["median"] * 100)
        if ecart <= -5:
            return (
                f"Votre {repere['materiau_nom'].lower()} à {prix_ar(offre['prix'])} "
                f"est {abs(ecart)}{ESPACE_FINE}% sous la médiane relevée à Antananarivo "
                f"({prix_ar(repere['median'])}) : c'est un argument que les acheteurs "
                "verront tout de suite."
            )
    return ""


# ── Modèles ────────────────────────────────────────────────────────────────
def premier_contact(fiche: dict, offres: list[dict]) -> str:
    langue = fiche.get("langue") or "fr"
    nom = (fiche.get("nom") or "").strip()
    lieu = fiche.get("quartier") or fiche.get("ville") or ""
    lien = lien_fiche(fiche)

    # Un transporteur n'a pas de tarif matériau : lui envoyer une liste de
    # produits vide le convaincrait surtout qu'on s'est trompé de numéro.
    if (fiche.get("nature") or "depot") == "transporteur":
        return contact_transporteur(fiche, langue, nom, lieu, lien)

    produits = "\n".join(_lignes_produits(offres, langue))

    if langue == "mg":
        salutation = f"Manao ahoana {nom}," if nom else "Manao ahoana,"
        return "\n".join(filter(None, [
            salutation,
            "",
            "Akora izahay — tranonkala fampitahana vidin'ny fitaovana fanorenana "
            "eto Madagasikara.",
            "",
            f"Efa VONONA ny pejinao ao aminay{f' ({lieu})' if lieu else ''}. "
            "Nalainay avy amin'ny lahatsoratrao eto Facebook ny vokatra sy ny vidiny :",
            produits,
            "",
            "Tsy misy tsy maintsy soratanao : mila manamarina fotsiny ianao. "
            "Raha manaiky ianao dia lasa anao ny pejy, ary azonao ovaina "
            "ny vidiny sy ny stock rehetra.",
            "",
            f"Jereo eto : {lien}" if lien else "",
            "",
            "Raha tsy tianao dia lazao fotsiny, dia esorinay ny pejy. Misaotra.",
        ]))

    salutation = f"Bonjour {nom}," if nom else "Bonjour,"
    return "\n".join(filter(None, [
        salutation,
        "",
        "Ici Akora, le site qui compare les fournisseurs de matériaux de "
        "construction à Madagascar, prix rendu chantier.",
        "",
        f"Votre fiche est déjà prête chez nous{f' ({lieu})' if lieu else ''}. "
        "Nous l'avons remplie à partir de vos propres publications Facebook :",
        produits,
        "",
        "Vous n'avez rien à saisir — seulement à confirmer. La fiche devient "
        "la vôtre : vous corrigez les prix, le stock et votre zone de "
        "livraison, et les acheteurs vous contactent directement.",
        "",
        f"Elle est ici : {lien}" if lien else "",
        # Deux arguments, et l'ordre compte : la demande d'abord (ce qu'il
        # rate), le prix ensuite (ce qu'il fait bien). Chacun se tait s'il n'a
        # rien de vrai à dire.
        argument_demandes(fiche.get("id") or ""),
        argument_prix(offres),
        "",
        "Si cela ne vous intéresse pas, dites-le simplement : nous la "
        "supprimons et nous ne vous recontactons plus.",
    ]))


def contact_transporteur(fiche: dict, langue: str, nom: str, lieu: str,
                         lien: str) -> str:
    """Le même argument, mais pour quelqu'un qui vend des kilomètres.

    Ce qu'on lui promet n'est pas de la visibilité : ce sont des chantiers qui
    cherchent un camion, et un prix de livraison calculé automatiquement à
    partir de SON barème.
    """
    flotte = "\n".join(_lignes_vehicules(fiche.get("vehicules") or [], langue))

    if langue == "mg":
        return "\n".join(filter(None, [
            f"Manao ahoana {nom}," if nom else "Manao ahoana,",
            "",
            "Akora izahay — tranonkala fampitahana vidin'ny fitaovana fanorenana. "
            "Mila fiara fitaterana ny mpanjifa rehetra manafatra fitaovana aminay.",
            "",
            f"Efa vonona ny pejinao{f' ({lieu})' if lieu else ''}, "
            "nalaina avy amin'ny lahatsoratrao :",
            flotte,
            "",
            "Ny vidin'ny fitaterana dia kajiana avy amin'ny tarifanao, "
            "arakaraka ny halaviran'ny toerana. Tsy misy tsy maintsy soratanao : "
            "mila manamarina fotsiny.",
            "",
            f"Jereo eto : {lien}" if lien else "",
            "",
            "Raha tsy tianao dia lazao fotsiny, dia esorinay. Misaotra.",
        ]))

    return "\n".join(filter(None, [
        f"Bonjour {nom}," if nom else "Bonjour,",
        "",
        "Ici Akora, le site qui compare les fournisseurs de matériaux de "
        "construction à Madagascar. Tout ce qui s'y vend doit être livré — "
        "et c'est là que nous manquons de camions.",
        "",
        f"Votre fiche transporteur est déjà prête{f' ({lieu})' if lieu else ''}, "
        "remplie à partir de vos propres publications :",
        flotte,
        "",
        "Le prix de livraison est calculé automatiquement à partir de VOTRE "
        "barème et de la distance jusqu'au chantier. Vous n'avez rien à saisir "
        "— seulement à confirmer, et à corriger vos tarifs.",
        "",
        f"Elle est ici : {lien}" if lien else "",
        "",
        "Si cela ne vous intéresse pas, dites-le simplement : nous la "
        "supprimons et nous ne vous recontactons plus.",
    ]))


def relance(fiche: dict, offres: list[dict], rang: int = 1) -> str:
    langue = fiche.get("langue") or "fr"
    nom = (fiche.get("nom") or "").strip()
    lien = lien_fiche(fiche)
    derniere = rang >= 2

    if langue == "mg":
        return "\n".join(filter(None, [
            f"Manao ahoana {nom}," if nom else "Manao ahoana,",
            "",
            "Mbola miandry anao ny pejinao ao amin'ny Akora.",
            f"{lien}" if lien else "",
            "",
            "Ity no fanamarihana farany raha tsy mamaly ianao — tsy hanelingelina "
            "anao intsony izahay." if derniere
            else "Raha misy fanontaniana dia valio fotsiny ity hafatra ity.",
        ]))

    return "\n".join(filter(None, [
        f"Bonjour {nom}," if nom else "Bonjour,",
        "",
        "Votre fiche Akora vous attend toujours — elle est déjà remplie, "
        "il n'y a qu'à la confirmer.",
        f"{lien}" if lien else "",
        "",
        "C'est notre dernier message si vous ne répondez pas : nous ne "
        "reviendrons pas vers vous." if derniere
        else "Une question ? Répondez simplement à ce message.",
    ]))


MODELES = {
    "premier": premier_contact,
    "relance1": lambda f, o: relance(f, o, 1),
    "relance2": lambda f, o: relance(f, o, 2),
}


def composer(fiche: dict, offres: list[dict], modele: str = "premier") -> str:
    fabrique = MODELES.get(modele, premier_contact)
    return fabrique(fiche, offres).strip()


# ── Canaux ─────────────────────────────────────────────────────────────────
def _msisdn(telephone: str) -> str:
    """Format international sans « + » : ce qu'attend wa.me."""
    chiffres = "".join(c for c in (telephone or "") if c.isdigit())
    if chiffres.startswith("0"):
        chiffres = "261" + chiffres[1:]
    elif not chiffres.startswith("261"):
        chiffres = "261" + chiffres
    return chiffres


def canaux(fiche: dict, texte: str) -> list[dict]:
    """Les façons d'envoyer ce message, de la plus directe à la moins.

    WhatsApp accepte le texte pré-rempli dans l'adresse ; Messenger non — il
    ouvre seulement la conversation. Le bouton « Copier » n'est donc pas un
    confort, c'est le seul chemin praticable côté Messenger.
    """
    liste = []
    if fiche.get("telephone"):
        liste.append({
            "canal": "whatsapp",
            "libelle": "WhatsApp",
            "url": f"https://wa.me/{_msisdn(fiche['telephone'])}?text={quote(texte)}",
            "pre_rempli": True,
        })
        liste.append({
            "canal": "sms",
            "libelle": "SMS",
            "url": f"sms:{fiche['telephone'].replace(' ', '')}?body={quote(texte)}",
            "pre_rempli": True,
        })
        liste.append({
            "canal": "appel",
            "libelle": "Appeler",
            "url": f"tel:{fiche['telephone'].replace(' ', '')}",
            "pre_rempli": False,
        })
    if fiche.get("page_url"):
        liste.append({
            "canal": "messenger",
            "libelle": "Messenger",
            "url": f"https://{fiche['page_url']}",
            "pre_rempli": False,
        })
    return liste
