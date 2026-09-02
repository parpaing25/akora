"""Pousser les prix collectés vers l'observatoire public — avec TROIS gardes.

L'observatoire du site (`public.releves_prix` → RPC `observatoire_prix`) est
signé Akora : un faux prix publié là vaut pire que pas de prix. Trois classes
de défaut sont connues, chacune payée par un incident réel :

  1. PRIX ORPHELIN — le montant ne figure pas dans le libellé de son offre
     (pairage cassé : une planche à 28 000 Ar au lieu de 4 700, 01/09) ;
  2. HORS-PÉRIMÈTRE / UNITÉ — déjà écarté en amont (garder, hors_catalogue),
     et une unité contraire à la référence ne se compare pas ;
  3. MAUVAIS APPARIEMENT — le prix est vrai, le libellé est vrai, la
     RÉFÉRENCE est fausse : « Épaisseur bois 1,4 cm misy bordure eo aloha
     120.000 ar » est parti à l'observatoire comme bordure de trottoir P1 à
     120 000 Ar/ml (01/09). Ni le garde 1 ni le garde 2 ne le voient.

Le garde 3 est un contrôle de VRAISEMBLANCE : quand l'observatoire connaît
déjà la médiane d'un matériau sur au moins deux dépôts, un relevé qui s'en
écarte d'un facteur > 2,5 n'est PAS poussé — il part dans « à confirmer »,
avec sa raison, et c'est un humain qui tranche. Un vrai changement de marché
de ×2,5 existe rarement ; un mauvais appariement le simule tout le temps.

Anonyme PAR CONSTRUCTION : empreinte = sha256 du téléphone normalisé, jamais
un nom, jamais un numéro, jamais un libellé (ils contiennent parfois le
téléphone du dépôt en toutes lettres).

    python -m bot.observatoire_pousse            # mode à blanc, rien n'écrit
    python -m bot.observatoire_pousse --ecrire   # pousse
"""
from __future__ import annotations

import hashlib
import re
import sys

CHIFFRES = re.compile(r"\d+")
DEVISES_MALGACHES = ("", "ar", "ariary", "mga", "fmg")
FACTEUR_VRAISEMBLANCE = 2.5
MINIMUM_DEPOTS_POUR_MEDIANE = 2


def _suite_de_chiffres(texte: str) -> str:
    """« 45.000 ar » → « 45000 » — même règle que outils/prix_orphelins.py."""
    return "".join(CHIFFRES.findall(texte or ""))


def empreinte_depot(telephone_cle: str | None, cle: str | None) -> str:
    graine = telephone_cle or ("cle:" + (cle or ""))
    return hashlib.sha256(graine.encode()).hexdigest()


def preparer(
    offres: list[dict],
    catalogue: dict[str, tuple[str, str]],
    localites: dict[str, str],
    medianes: dict[str, tuple[int, int]],
) -> dict:
    """Trie les offres : à pousser, écartées (comptées par raison), à confirmer.

    `catalogue`  : slug → (materiau_ref_id, unite_defaut)
    `localites`  : nom minuscule → localite_id
    `medianes`   : materiau_ref_id → (prix_median, nb_depots) — l'état ACTUEL
                   de l'observatoire, la base du contrôle de vraisemblance.
    """
    valeurs: list[tuple] = []
    a_confirmer: list[dict] = []
    ecartees = {"devise": 0, "prix_orphelin": 0, "slug_inconnu": 0, "unite": 0}

    for o in offres:
        devise = (o.get("devise_source") or "").lower()
        if devise not in DEVISES_MALGACHES:
            ecartees["devise"] += 1
            continue
        prix = int(o["prix"])
        if str(prix) not in _suite_de_chiffres(o.get("libelle_brut")):
            ecartees["prix_orphelin"] += 1
            continue
        ref = catalogue.get(o.get("materiau_slug") or "")
        if not ref:
            ecartees["slug_inconnu"] += 1
            continue
        ref_id, unite_ref = ref
        unite = (o.get("unite") or "").strip() or None
        if unite is not None and unite != unite_ref:
            ecartees["unite"] += 1
            continue

        # ── Garde 3 : la vraisemblance ────────────────────────────────────
        connu = medianes.get(ref_id)
        if connu:
            mediane, nb_depots = connu
            if nb_depots >= MINIMUM_DEPOTS_POUR_MEDIANE and mediane > 0 and (
                prix > mediane * FACTEUR_VRAISEMBLANCE
                or prix < mediane / FACTEUR_VRAISEMBLANCE
            ):
                a_confirmer.append({
                    "offre_id": o.get("id"),
                    "libelle": (o.get("libelle_brut") or "")[:120],
                    "prix": prix,
                    "mediane": mediane,
                    "raison": (
                        f"prix {prix} Ar contre une médiane de {mediane} Ar "
                        f"sur {nb_depots} dépôts (facteur > {FACTEUR_VRAISEMBLANCE})"
                    ),
                })
                continue

        lieu = None
        for candidat in (o.get("quartier"), o.get("ville")):
            if candidat and candidat.strip().lower() in localites:
                lieu = localites[candidat.strip().lower()]
                break
        date = (o.get("publie_le") or o.get("vu_le") or "")[:10] or None
        valeurs.append((
            ref_id, lieu, prix, unite,
            empreinte_depot(o.get("telephone_cle"), o.get("cle")), date,
        ))

    return {"valeurs": valeurs, "ecartees": ecartees, "a_confirmer": a_confirmer}


# ── La partie branchée (base locale + site) — rien au-dessus n'y touche ────

def offres_publiables() -> list[dict]:
    """Les offres gardées, référencées, chiffrées, de prospects vivants."""
    from . import base
    with base.connexion() as cx:
        return [dict(l) for l in cx.execute("""
            select o.id, o.materiau_slug, o.prix, o.unite, o.libelle_brut,
                   o.devise_source, o.publie_le, o.vu_le,
                   p.telephone_cle, p.cle, p.quartier, p.ville
            from offres o join prospects p on p.id = o.prospect_id
            where o.garder = 1 and o.hors_catalogue = 0
              and o.materiau_slug is not null and o.materiau_slug != ''
              and o.prix is not null and o.prix > 0
              and p.statut not in ('rejete', 'doublon', 'refuse')
        """)]


def etat_du_site() -> tuple[dict, dict, dict]:
    """(catalogue, localites, medianes) lus sur le site — la source, pas un cache."""
    from . import akora
    catalogue = {
        l["slug"]: (l["id"], l["unite"]) for l in akora.executer(
            "select slug, id, unite_defaut as unite from public.materiaux_ref where actif;")
    }
    localites = {
        l["nom"].strip().lower(): l["id"] for l in akora.executer(
            "select nom, id from public.localites;")
    }
    medianes = {
        l["materiau_ref_id"]: (int(l["prix_median"]), int(l["nb_depots"]))
        for l in akora.executer(
            "select materiau_ref_id, prix_median, nb_depots "
            "from public.observatoire_prix(null, null);")
        if l.get("prix_median") is not None
    }
    return catalogue, localites, medianes


def pousser(valeurs: list[tuple]) -> int:
    """Écrit par paquets ; l'index unique du site avale les doublons."""
    from . import akora
    total = 0
    for debut in range(0, len(valeurs), 40):
        morceau = valeurs[debut:debut + 40]
        tuples = ", ".join(
            "({}, {}, {}, {}, 'collecte', {}, {})".format(
                akora.txt(ref_id),
                akora.txt(lieu) if lieu else "null",
                prix,
                akora.txt(unite) + "::public.unite" if unite else "null",
                akora.txt(emp),
                akora.txt(date) + "::date" if date else "current_date",
            )
            for ref_id, lieu, prix, unite, emp, date in morceau
        )
        akora.executer(
            "insert into public.releves_prix"
            " (materiau_ref_id, localite_id, prix, unite, source,"
            "  empreinte_depot, releve_le)"
            f" values {tuples} on conflict do nothing;"
        )
        total += len(morceau)
    return total


def lancer(ecrire: bool = False) -> dict:
    """Le passage complet. Rendu sous forme de bilan, journalisé si écrit."""
    catalogue, localites, medianes = etat_du_site()
    tri = preparer(offres_publiables(), catalogue, localites, medianes)
    if ecrire and tri["valeurs"]:
        pousser(tri["valeurs"])
        from . import base
        base.logguer(
            f"Observatoire : {len(tri['valeurs'])} relevé(s) poussé(s), "
            f"{sum(tri['ecartees'].values())} écarté(s), "
            f"{len(tri['a_confirmer'])} à confirmer (vraisemblance).",
            "succes",
        )
    return tri


def main() -> int:
    ecrire = "--ecrire" in sys.argv
    tri = lancer(ecrire)
    print(f"À pousser : {len(tri['valeurs'])} — écartées : {tri['ecartees']}")
    for ligne in tri["a_confirmer"]:
        print(f"  À CONFIRMER : {ligne['raison']} — « {ligne['libelle']} »")
    if not ecrire:
        print("MODE À BLANC — rien n'est écrit. Relancer avec --ecrire.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
