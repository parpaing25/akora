"""Le bulletin des prix de marché, pour le fil d'accueil d'Akora.

Le fil du site prévoit déjà un type de publication `prix_marche`, sans
fournisseur : une publication écrite par Akora elle-même. Rien ne l'alimentait.
Or c'est exactement ce que l'observatoire du bot calcule.

L'intérêt n'est pas cosmétique. Une marketplace qui démarre a un fil vide, et
un fil vide dit « il ne se passe rien ici ». Le remplir avec des **prix réels
relevés sur le terrain** donne au visiteur la seule chose qu'il cherche
vraiment — combien ça coûte — avant même qu'un fournisseur se soit inscrit.

🔒 **Rien ne part tout seul.** Le bot compose un brouillon, l'interface le
montre en entier, et c'est un clic humain qui publie. Trois raisons :
une publication est publique et signée Akora ; une médiane fausse lue par un
professionnel décrédibilise le site pour de bon ; et le fil est le premier
écran du produit.

Deux garde-fous en plus du clic :
  - seules les lignes **fiables** entrent (au moins trois dépôts relevés) ;
  - un bulletin n'est pas republié s'il en existe déjà un de moins de N jours.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from . import akora, base, marche

ESPACE_FINE = " "
TEXTE_MAX = 1200        # contrainte `publications.texte`
TEXTE_MIN = 10
JOURS_ENTRE_BULLETINS = 6
LIGNES_MAX = 8


class ErreurFil(Exception):
    pass


def _prix(montant) -> str:
    return f"{int(montant):,}".replace(",", ESPACE_FINE) + f"{ESPACE_FINE}Ar"


UNITES = {
    "piece": "la pièce", "sac": "le sac", "m3": "le m³", "tonne": "la tonne",
    "m2": "le m²", "ml": "le mètre", "botte": "la botte",
    "chargement": "le chargement", "palette": "la palette",
}


def composer(ville: str = "", jours: int = 30) -> dict:
    """Fabrique le brouillon du bulletin. Ne publie rien.

    Renvoie {texte, lignes, ville, fiables, ecartees} — `ecartees` dit combien
    de matériaux ont été laissés de côté faute de relevés suffisants, pour que
    personne ne croie le bulletin exhaustif.
    """
    releves = marche.observatoire(ville=ville)
    fiables = [r for r in releves if r["fiable"]]
    ecartees = len(releves) - len(fiables)

    if not fiables:
        raise ErreurFil(
            "Aucun prix assez sûr pour un bulletin : il faut au moins trois "
            f"dépôts relevés par matériau ({len(releves)} matériau(x) suivis, "
            "aucun n'y arrive encore). Continuez la collecte."
        )

    fiables.sort(key=lambda r: -r["nb_fournisseurs"])
    retenues = fiables[:LIGNES_MAX]

    ou = f" à {ville}" if ville else " à Madagascar"
    entete = f"Prix relevés cette semaine{ou}"
    lignes = [entete, ""]
    for repere in retenues:
        unite = UNITES.get(repere["unite"] or "", "")
        lignes.append(
            f"{repere['materiau_nom']} : {_prix(repere['median'])} {unite}".strip()
            + f" — de {_prix(repere['min'])} à {_prix(repere['max'])}"
            + f" ({repere['nb_fournisseurs']} dépôts)"
        )
    lignes.append("")
    lignes.append(
        "Médianes relevées sur les annonces publiques des dépôts. "
        "Prix au dépôt, hors livraison."
    )

    texte = "\n".join(lignes)
    # La contrainte de la base coupe à 1200 caractères : mieux vaut retirer des
    # lignes entières que livrer un bulletin tronqué au milieu d'un prix.
    while len(texte) > TEXTE_MAX and len(retenues) > 1:
        retenues.pop()
        lignes = lignes[:2 + len(retenues)] + lignes[-2:]
        texte = "\n".join(lignes)

    if len(texte) < TEXTE_MIN:
        raise ErreurFil("Bulletin trop court pour être publié.")

    return {
        "texte": texte,
        "lignes": len(retenues),
        "ville": ville,
        "fiables": len(fiables),
        "ecartees": ecartees,
        "caracteres": len(texte),
    }


def dernier_bulletin() -> dict | None:
    """Le dernier `prix_marche` du fil, pour ne pas en empiler deux."""
    lignes = akora.executer(
        "SELECT id::text, publie_le::text, left(texte, 60) AS debut "
        "  FROM public.publications "
        " WHERE type = 'prix_marche' AND statut = 'publiee' "
        " ORDER BY publie_le DESC LIMIT 1;"
    )
    return lignes[0] if lignes else None


def _trop_recent(dernier: dict | None) -> int:
    """Nombre de jours restants avant de pouvoir republier. 0 si c'est bon."""
    if not dernier or not dernier.get("publie_le"):
        return 0
    try:
        quand = datetime.fromisoformat(dernier["publie_le"].replace(" ", "T"))
    except ValueError:
        return 0
    if quand.tzinfo is None:
        quand = quand.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - quand).days
    return max(0, JOURS_ENTRE_BULLETINS - age)


def apercu(ville: str = "") -> dict:
    """Ce que l'interface affiche avant de proposer le bouton « Publier »."""
    brouillon = composer(ville)
    try:
        dernier = dernier_bulletin()
    except akora.ErreurAkora:
        dernier = None
    attente = _trop_recent(dernier)
    return {
        **brouillon,
        "dernier": dernier,
        "jours_a_attendre": attente,
        "publiable": attente == 0,
    }


def publier(ville: str = "", forcer: bool = False) -> dict:
    """Écrit le bulletin dans le fil. À n'appeler que sur un clic humain.

    `forcer` passe outre le délai entre deux bulletins — jamais le contrôle de
    fiabilité, qui n'est pas négociable : un chiffre faux publié sous le nom
    d'Akora coûte plus que le fil vide qu'il remplace.
    """
    brouillon = composer(ville)
    try:
        dernier = dernier_bulletin()
    except akora.ErreurAkora as e:
        raise ErreurFil(f"Fil illisible, publication annulée : {e}") from e

    attente = _trop_recent(dernier)
    if attente and not forcer:
        raise ErreurFil(
            f"Un bulletin a déjà été publié il y a moins de {JOURS_ENTRE_BULLETINS} "
            f"jours. Attendez {attente} jour(s), ou forcez si c'est voulu."
        )

    localite = "NULL"
    if ville:
        try:
            trouvee = akora.localite_par_nom(ville)
            if trouvee:
                localite = f"{akora.txt(trouvee['id'])}::uuid"
        except akora.ErreurAkora:
            pass

    expire = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(
        timespec="seconds"
    )
    lignes = akora.executer(
        "INSERT INTO public.publications "
        "(type, fournisseur_id, auteur_id, texte, localite_id, statut, expire_le) "
        f"VALUES ('prix_marche'::public.type_publication, NULL, NULL, "
        f"{akora.txt(brouillon['texte'])}, {localite}, "
        f"'publiee'::public.statut_publication, {akora.txt(expire)}::timestamptz) "
        "RETURNING id::text;"
    )
    if not lignes or not lignes[0].get("id"):
        raise ErreurFil("La publication n'a pas été écrite.")

    identifiant = lignes[0]["id"]
    base.logguer(
        f"Bulletin de prix publié dans le fil Akora ({brouillon['lignes']} "
        f"matériaux, {brouillon['caracteres']} caractères).",
        "succes",
    )
    return {"id": identifiant, **brouillon}


def retirer(publication_id: str) -> None:
    """Masque un bulletin publié par erreur. Le fil ne supprime pas, il masque."""
    akora.executer(
        "UPDATE public.publications SET statut = 'masquee'::public.statut_publication "
        f"WHERE id = {akora.txt(publication_id)}::uuid AND type = 'prix_marche';"
    )
    base.logguer(f"Bulletin {publication_id[:8]} masqué dans le fil.", "avert")
