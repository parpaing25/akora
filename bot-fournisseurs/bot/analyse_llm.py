"""Relecture d'une publication par un modèle — couche OPTIONNELLE.

Les expressions régulières d'`extraction.py` sont fiables sur le mécanique :
un numéro malgache, un montant avec sa devise, un tarif ligne par ligne. Elles
butent sur le jugement, et trois cas reviennent sans cesse :

  - **le vendeur ou l'acheteur ?** « Mila fasika 3 camion » (je CHERCHE du
    sable) a exactement la forme d'une offre. Publier un acheteur comme
    fournisseur est la faute la plus visible du lot ;
  - **un tarif en prose** : « le 15 est à 1400 et le 20 à 1800 » — aucune ligne
    à découper, deux montants, deux formats ;
  - **le hors-périmètre** : Akora ne prend que le gros œuvre. Une publication de
    quincaillerie, de plomberie ou d'électricité doit être écartée, pas
    rattachée de force au matériau le plus proche.

⚠ Le modèle ne choisit JAMAIS de `materiau_ref`. Il propose un **libellé**
(« parpaing 15 », « fasika »), et c'est `referentiel.apparier()` qui décide du
slug. Sinon le modèle inventerait des références qui n'existent pas dans le
catalogue fermé, et l'INSERT partirait avec une clé étrangère morte.

Une panne du modèle ne casse jamais la collecte : on retombe sur la lecture par
expressions régulières, et le prospect est simplement marqué non relu.
"""
from __future__ import annotations

import json

import requests

from .config import CLE_ANTHROPIC

MODELE_ANTHROPIC = "claude-sonnet-5"
MODELE_PASSERELLE = "claude-abo"

# Prompt volontairement stable : c'est ce qui permet la mise en cache côté API
# (le tarif du cache est ~10 % du plein). Ne jamais y coller une date ni un
# compteur, ça invaliderait le cache à chaque appel.
SYSTEME = """Tu lis une publication Facebook malgache et tu dis si son auteur VEND
des matériaux de construction de GROS ŒUVRE, et lesquels.

Tu réponds UNIQUEMENT par un objet JSON, sans texte autour.

PÉRIMÈTRE. Seuls comptent : agglomérés et préfabriqués béton (parpaing, hourdis,
poutrelle, bordure, buse, regard, pavé, claustra), briques (cuite, BTC, adobe),
granulats (sable, gravillon, moellon, remblai, latérite), liants (ciment, chaux,
plâtre), bois de construction (rondin, chevron, planche, madrier, latte,
contreplaqué, bambou), couverture (tôle, tuile, faîtière, fibrociment), acier
(fer à béton, treillis, fil recuit) et béton prêt à l'emploi.
Sont HORS PÉRIMÈTRE et doivent donner est_fournisseur = false : quincaillerie,
outillage, plomberie, électricité, peinture, carrelage, menuiserie finie,
mobilier, et toute prestation de service (maçon, entreprise de construction).

Champs attendus :
- est_fournisseur : booléen. false si l'auteur CHERCHE à acheter ("mila",
  "je cherche", "recherche"), si c'est une offre d'emploi, une publicité
  d'entreprise de construction sans vente de matériau, ou du hors-périmètre.
- role : "vendeur" | "acheteur" | "autre"
- nom : la raison sociale ou le nom commercial du vendeur, ou null. Ne prends
  PAS un prénom de compte personnel : laisse null, l'appelant s'en charge.
- metier : "Dépôt" | "Briqueterie" | "Carrière" | "Scierie" |
  "Centrale à béton" | "Transporteur" | null
- ville : la ville ("Antananarivo", "Toamasina"…) ou null
- quartier : le quartier précis ("Ambohibao", "Talatamaty"…) ou null
- adresse : l'adresse ou le point de repère donné, ou null
- telephone : le numéro donné, au format "034 12 345 67", ou null
- livre : booléen, le vendeur annonce livrer
- retrait_sur_place : booléen, on peut venir chercher au dépôt
- produits : liste. Un objet par matériau distinct, avec :
    - libelle : le matériau TEL QU'ÉCRIT dans la publication, en incluant le
      format s'il est donné ("parpaing 15", "hourdis 12", "fer 8",
      "sable fin", "tôle 25/100 de 3 m"). N'invente aucune référence,
      n'utilise aucun code : recopie ce que le texte dit.
    - prix : le prix unitaire en ariary (entier) ou null. Si le texte est en
      Fmg, convertis en ariary (1 Ar = 5 Fmg). Ne confonds pas le prix
      unitaire avec un total ni avec un prix de livraison.
    - unite : "piece" | "sac" | "m3" | "tonne" | "m2" | "ml" | "botte" |
      "chargement" | "palette" | null
    - quantite_min : entier ou null
- resume : une phrase de 15 mots maximum, en français, décrivant le vendeur.
- confiance : 0 à 100, ta confiance dans cette lecture.
- doute : une phrase courte sur ce qui reste incertain, ou "".

N'INVENTE RIEN. Tout champ que le texte ne dit pas reste null. Mieux vaut un
champ vide qu'une valeur plausible mais fausse."""


class LLMIndisponible(Exception):
    """Le modèle n'a pas répondu. Jamais fatal : la lecture regex reste valable."""


def _extraire_json(contenu: str) -> dict:
    debut, fin = contenu.find("{"), contenu.rfind("}")
    if debut < 0 or fin < debut:
        raise LLMIndisponible("réponse sans JSON")
    try:
        return json.loads(contenu[debut:fin + 1])
    except json.JSONDecodeError as e:
        raise LLMIndisponible(f"JSON illisible : {e}") from e


def _via_anthropic(texte: str, cfg: dict) -> dict:
    """API Claude officielle, avec mise en cache du prompt système."""
    try:
        import anthropic
    except ImportError as e:
        raise LLMIndisponible("paquet `anthropic` absent (pip install anthropic)") from e

    cle = (
        CLE_ANTHROPIC.read_text(encoding="utf-8-sig").strip()
        if CLE_ANTHROPIC.exists() else None
    )
    client = anthropic.Anthropic(api_key=cle) if cle else anthropic.Anthropic()
    try:
        reponse = client.messages.create(
            model=cfg.get("llm_modele") or MODELE_ANTHROPIC,
            max_tokens=1500,
            system=[{
                "type": "text",
                "text": SYSTEME,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{"role": "user", "content": texte}],
        )
    except Exception as e:      # réseau, quota, clé absente…
        raise LLMIndisponible(str(e)[:200]) from e

    return _extraire_json(
        "".join(b.text for b in reponse.content if getattr(b, "type", "") == "text")
    )


def _via_passerelle(texte: str, cfg: dict) -> dict:
    """LiteLLM local d'Hermes. Il n'expose que /v1/chat/completions."""
    adresse = (cfg.get("llm_passerelle") or "http://127.0.0.1:4000").rstrip("/")
    try:
        reponse = requests.post(
            f"{adresse}/v1/chat/completions",
            json={
                "model": cfg.get("llm_modele") or MODELE_PASSERELLE,
                "max_tokens": 1500,
                "messages": [
                    {"role": "system", "content": SYSTEME},
                    {"role": "user", "content": texte},
                ],
            },
            timeout=int(cfg.get("llm_delai", 120)),
        )
    except requests.RequestException as e:
        raise LLMIndisponible(str(e)[:200]) from e
    if not reponse.ok:
        raise LLMIndisponible(f"HTTP {reponse.status_code} — {reponse.text[:160]}")
    return _extraire_json(reponse.json()["choices"][0]["message"]["content"])


def relire(texte: str, cfg: dict) -> dict:
    """Fait relire une publication. Lève LLMIndisponible en cas d'échec."""
    if not (texte or "").strip():
        raise LLMIndisponible("texte vide")

    transport = cfg.get("llm_transport", "passerelle")
    if transport == "anthropic":
        return _via_anthropic(texte, cfg)
    try:
        return _via_passerelle(texte, cfg)
    except LLMIndisponible:
        if not cfg.get("llm_repli_anthropic"):
            raise
        return _via_anthropic(texte, dict(cfg, llm_modele=None))


def fusionner(lecture: dict, modele: dict, cfg: dict) -> dict:
    """Combine les deux lectures.

    Partage des rôles :
      - le **modèle** tranche l'identité et le jugement (vendeur ou acheteur,
        périmètre, métier, nom commercial, quel prix va avec quel matériau) ;
      - les **expressions régulières** gardent la main sur le téléphone : le
        format malgache est rigide, un regex ne s'y trompe pas et surtout ne
        l'invente pas ;
      - le **référentiel** garde la main sur le slug, toujours.
    """
    from . import referentiel      # importé ici : évite un cycle au chargement

    fusion = dict(lecture)

    for champ in ("nom", "metier", "ville", "quartier", "adresse"):
        valeur = (modele.get(champ) or "").strip() if isinstance(modele.get(champ), str) \
            else modele.get(champ)
        if valeur:
            fusion[champ] = valeur
    for champ in ("livre", "retrait_sur_place"):
        if modele.get(champ) is not None:
            fusion[champ] = bool(modele[champ]) or bool(fusion.get(champ))

    # Le téléphone du modèle ne sert qu'en dernier recours, et il repasse par
    # la normalisation : un numéro « corrigé » par un modèle est un faux numéro.
    if not fusion.get("telephone_cle") and modele.get("telephone"):
        from .extraction import normaliser_telephone
        affichage, cle = normaliser_telephone(str(modele["telephone"]))
        if cle:
            fusion["telephone"], fusion["telephone_cle"] = affichage, cle
            fusion["telephones"] = [{"affichage": affichage, "cle": cle}]

    # Les produits du modèle repassent tous par l'appariement déterministe.
    produits = modele.get("produits") or []
    if produits:
        connus = {
            (o.get("materiau_slug") or o.get("type_slug") or o["libelle_brut"])
            for o in fusion.get("offres", [])
        }
        for produit in produits:
            libelle = (produit.get("libelle") or "").strip()
            if not libelle:
                continue
            appariement = referentiel.apparier(libelle)
            if appariement is None:
                # Le modèle a vu un matériau que le catalogue fermé ignore :
                # ça ne se jette pas, ça se signale à l'administrateur.
                from . import base
                base.signaler_materiau_absent(libelle, (modele.get("resume") or "")[:200])
                continue
            empreinte = appariement.get("materiau_slug") or appariement.get("type_slug")
            if empreinte in connus:
                # Déjà lu ligne par ligne : on complète seulement le prix
                # manquant, on ne remplace pas un montant lu textuellement.
                for offre in fusion["offres"]:
                    meme = (offre.get("materiau_slug") or offre.get("type_slug")) == empreinte
                    if meme and offre.get("prix") is None and produit.get("prix"):
                        offre["prix"] = int(produit["prix"])
                        offre["devise_source"] = "Ar"
                continue
            connus.add(empreinte)
            fusion.setdefault("offres", []).append({
                "libelle_brut": libelle[:180],
                "prix": int(produit["prix"]) if produit.get("prix") else None,
                "devise_source": "Ar" if produit.get("prix") else None,
                "unite": produit.get("unite") or appariement.get("unite"),
                "quantite_min": produit.get("quantite_min"),
                **{c: appariement[c] for c in (
                    "materiau_slug", "materiau_nom", "type_slug", "type_nom",
                    "famille_slug", "certitude", "ambigu", "hors_catalogue")},
            })

    fusion["est_fournisseur"] = modele.get("est_fournisseur", True)
    fusion["role"] = modele.get("role") or "vendeur"
    fusion["llm_resume"] = (modele.get("resume") or "").strip()
    fusion["llm_confiance"] = modele.get("confiance")
    fusion["llm_doute"] = (modele.get("doute") or "").strip()
    fusion["lu_par_llm"] = True
    return fusion


def tester(cfg: dict) -> dict:
    """Vérifie que le chemin choisi répond — bouton des réglages."""
    exemple = (
        "DEPOT AMBOHIBAO mivarotra : parpaing 15 = 1400 Ar, hourdis 12 = 1900 Ar, "
        "fasika 1 camion 8m3 = 320 000 Ar. Livraison misy. Antsoy 034 12 345 67"
    )
    lecture = relire(exemple, cfg)
    transport = cfg.get("llm_transport", "passerelle")
    return {
        "ok": True,
        "transport": transport,
        "modele": cfg.get("llm_modele")
        or (MODELE_ANTHROPIC if transport == "anthropic" else MODELE_PASSERELLE),
        "est_fournisseur": lecture.get("est_fournisseur"),
        "produits_lus": len(lecture.get("produits") or []),
        "confiance": lecture.get("confiance"),
    }
