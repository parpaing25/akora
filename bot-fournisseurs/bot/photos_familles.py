"""Pré-trier les photos par FAMILLE de matériau — et rien de plus fin.

Le constat du 01/09/2026 : 1 329 photos collectées, 6 rattachées à une offre.
Rattacher se fait à la main, photo par photo, dans le panneau du prospect —
et personne ne trie 1 329 vignettes.

Ce que ce module fait : demander à un modèle de vision UNE chose par photo —
la famille (bois, briques, granulats, tôles…), ou « camion », ou « autre ».
Avec ça, le panneau peut montrer d'abord les photos de la famille du produit
qu'on est en train de compléter : le clic reste humain, il devient court.

🔒 CE QU'IL NE FERA JAMAIS — et pourquoi c'est une limite assumée :
   distinguer un madrier 7×15 d'un 7×17 sur une photo de tas de bois est
   impossible, y compris à l'œil humain. Promettre le rattachement
   automatique photo→produit serait l'illusion exacte qui a déjà coûté une
   soirée sur l'appariement des formats. La famille pré-trie ; l'humain
   désigne.

Les familles viennent du CATALOGUE (data/referentiel.json), jamais d'une
liste écrite ici : ajoutez une famille côté site, elle est connue au
prochain passage. Un libellé hors liste rendu par le modèle devient
« autre » — le modèle propose, la liste fermée dispose (même règle que
l'appariement : un modèle ne choisit jamais un identifiant).

    python -m bot.photos_familles              # à blanc sur 40 photos
    python -m bot.photos_familles --ecrire     # écrit photos.famille
    python -m bot.photos_familles --nombre 120
"""
from __future__ import annotations

import base64 as b64
import io
import json
import sys
from pathlib import Path

ETIQUETTES_FIXES = ("camion", "personne", "autre")
TAILLE_MAX_PX = 512          # une image se paie en PIXELS (outils/image.py)
PHOTOS_PAR_APPEL = 8
MODELE = "claude-sonnet-5"


class VisionIndisponible(Exception):
    pass


def familles_du_catalogue() -> list[str]:
    """Les slugs de familles depuis le cache du catalogue — la source."""
    from .config import DOSSIER_DONNEES
    chemin = Path(DOSSIER_DONNEES) / "referentiel.json"
    try:
        contenu = json.loads(chemin.read_text(encoding="utf-8"))
        slugs = [f.get("slug", "") for f in contenu.get("familles", []) if f.get("slug")]
    except (OSError, ValueError):
        slugs = []
    # Repli mesuré le 01/09 — utilisé seulement si le cache manque.
    return slugs or [
        "agglomeres", "briques", "granulats", "liants",
        "bois", "couverture", "acier", "beton-pret",
    ]


def normaliser_famille(brute: str, familles: list[str]) -> str:
    """La liste fermée dispose : hors liste → « autre », jamais une invention."""
    reduit = (brute or "").strip().lower()
    if reduit in familles or reduit in ETIQUETTES_FIXES:
        return reduit
    return "autre"


def consigne(familles: list[str]) -> str:
    """Prompt stable (cache API) : une étiquette par image, liste fermée."""
    liste = ", ".join(list(familles) + list(ETIQUETTES_FIXES))
    return (
        "Tu regardes des photos prises sur des annonces Facebook de matériaux "
        "de construction à Madagascar. Pour CHAQUE image, donne UNE étiquette "
        f"parmi cette liste fermée, et rien d'autre : {liste}.\n"
        "« camion » si l'image montre surtout un véhicule de transport ; "
        "« personne » si elle montre surtout des gens ; « autre » au moindre "
        "doute — ne devine jamais.\n"
        'Réponds UNIQUEMENT en JSON : {"1": "etiquette", "2": "etiquette", …} '
        "dans l'ordre des images."
    )


def _reduire(chemin: Path) -> tuple[str, str]:
    """(base64, type mime) — l'image ramenée à 512 px : les pixels se paient."""
    from PIL import Image
    with Image.open(chemin) as image:
        image = image.convert("RGB")
        image.thumbnail((TAILLE_MAX_PX, TAILLE_MAX_PX))
        tampon = io.BytesIO()
        image.save(tampon, format="JPEG", quality=80)
    return b64.b64encode(tampon.getvalue()).decode(), "image/jpeg"


def _appeler_vision(chemins: list[Path], familles: list[str]) -> dict:
    """Un appel API pour un lot d'images. Isolé pour être remplaçable en test."""
    try:
        import anthropic
    except ImportError as e:
        raise VisionIndisponible("paquet `anthropic` absent (pip install anthropic)") from e
    from .config import CLE_ANTHROPIC
    cle = (
        CLE_ANTHROPIC.read_text(encoding="utf-8-sig").strip()
        if CLE_ANTHROPIC.exists() else None
    )
    if not cle:
        raise VisionIndisponible(
            "clé absente (~/.akora-secrets/anthropic_key.txt) — le pré-tri "
            "des photos est une option, pas une panne."
        )
    contenu = []
    for chemin in chemins:
        donnees, mime = _reduire(chemin)
        contenu.append({
            "type": "image",
            "source": {"type": "base64", "media_type": mime, "data": donnees},
        })
    contenu.append({"type": "text", "text": "Étiquette de chaque image, dans l'ordre."})
    client = anthropic.Anthropic(api_key=cle)
    try:
        reponse = client.messages.create(
            model=MODELE,
            max_tokens=400,
            system=[{
                "type": "text",
                "text": consigne(familles),
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{"role": "user", "content": contenu}],
        )
    except Exception as e:                                   # noqa: BLE001
        raise VisionIndisponible(str(e)[:200]) from e
    texte = "".join(b.text for b in reponse.content if getattr(b, "type", "") == "text")
    debut, fin = texte.find("{"), texte.rfind("}")
    if debut < 0 or fin < debut:
        raise VisionIndisponible("réponse sans JSON")
    return json.loads(texte[debut:fin + 1])


def classer(chemins: list[Path], familles: list[str], appel=None) -> dict[Path, str]:
    """{chemin: famille} pour un lot — chaque étiquette repasse par la liste fermée."""
    appel = appel or _appeler_vision
    resultat: dict[Path, str] = {}
    for debut in range(0, len(chemins), PHOTOS_PAR_APPEL):
        lot = chemins[debut:debut + PHOTOS_PAR_APPEL]
        brut = appel(lot, familles)
        for indice, chemin in enumerate(lot, start=1):
            resultat[chemin] = normaliser_famille(str(brut.get(str(indice), "")), familles)
    return resultat


# ── La partie branchée sur la base locale ──────────────────────────────────

def _garantir_colonne() -> None:
    """`photos.famille`, ajoutée ici même : le module se suffit."""
    from . import base
    with base.connexion() as cx:
        colonnes = {l[1] for l in cx.execute("pragma table_info(photos)")}
        if "famille" not in colonnes:
            cx.execute("ALTER TABLE photos ADD COLUMN famille TEXT")


def photos_a_classer(nombre: int) -> list[dict]:
    """Les photos gardées, jamais classées — rattachées ou non à un produit.

    ⚠ Le filtre `offre_id IS NULL` a été retiré le 03/09/2026 : le lien vit
      maintenant dans `photos_offres`, et la colonne gelée ne s'écrit plus —
      le filtre aurait laissé passer tout le monde. Et une photo déjà
      attribuée à un produit peut en illustrer d'autres : sa famille sert
      encore à trier la bande de vignettes des autres lignes.
    """
    from . import base
    _garantir_colonne()
    with base.connexion() as cx:
        return [dict(l) for l in cx.execute(
            "SELECT ph.id, ph.prospect_id, ph.fichier, pub.dossier "
            "  FROM photos ph LEFT JOIN publications pub ON pub.id = ph.publication_id "
            " WHERE ph.garder = 1 AND ph.famille IS NULL "
            " ORDER BY ph.id LIMIT ?", (nombre,),
        )]


def lancer(nombre: int = 40, ecrire: bool = False, appel=None) -> dict:
    from . import base
    from .config import DOSSIER_PROSPECTS
    familles = familles_du_catalogue()
    lignes = photos_a_classer(nombre)
    chemins, presentes = [], []
    for ligne in lignes:
        # 🔴 LES PHOTOS VIVENT DANS LE DOSSIER DE LA PUBLICATION, pas dans
        #   `data/prospects/<prospect_id>/` — c'est le chemin qu'utilisent
        #   `reservation.envoyer_ces_photos` et la route `/photo` du serveur.
        #   Mesuré le 03/09/2026 : 403 photos, colonne `famille` créée, NULLE
        #   403 fois. Ce pré-tri n'avait JAMAIS trouvé un seul fichier, et ne
        #   loguait rien : il tournait chaque jour pour classer zéro photo.
        if not ligne.get("dossier"):
            continue
        chemin = Path(DOSSIER_PROSPECTS).parent / ligne["dossier"] / ligne["fichier"]
        if chemin.exists():
            chemins.append(chemin)
            presentes.append(ligne)
    verdicts = classer(chemins, familles, appel=appel)
    comptes: dict[str, int] = {}
    for ligne, chemin in zip(presentes, chemins):
        famille = verdicts.get(chemin, "autre")
        comptes[famille] = comptes.get(famille, 0) + 1
        if ecrire:
            with base.connexion() as cx:
                cx.execute("UPDATE photos SET famille = ? WHERE id = ?",
                           (famille, ligne["id"]))
    if ecrire and presentes:
        base.logguer(
            f"Pré-tri photos : {len(presentes)} classée(s) par famille "
            f"({', '.join(f'{f} ×{n}' for f, n in sorted(comptes.items()))}).",
            "succes",
        )
    return {"classees": len(presentes), "comptes": comptes,
            "absentes": len(lignes) - len(presentes)}


def main() -> int:
    ecrire = "--ecrire" in sys.argv
    nombre = 40
    if "--nombre" in sys.argv:
        nombre = int(sys.argv[sys.argv.index("--nombre") + 1])
    try:
        bilan = lancer(nombre=nombre, ecrire=ecrire)
    except VisionIndisponible as e:
        print(f"Vision indisponible : {e}")
        return 1
    print(f"{bilan['classees']} photo(s) classée(s) : {bilan['comptes']}"
          + (f" — {bilan['absentes']} fichier(s) introuvable(s)" if bilan["absentes"] else ""))
    if not ecrire:
        print("MODE À BLANC — rien n'est écrit. Relancer avec --ecrire.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
