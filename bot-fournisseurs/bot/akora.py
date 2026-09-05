"""Pont vers la base Akora : lire le référentiel, vérifier l'annuaire, écrire.

Le bot passe par l'**API Management** de Supabase, avec le jeton `sbp_...` déjà
utilisé par `scripts/db-push.mjs`. Pas par la clé anon : les tables `produits`
et `fournisseurs` lui sont fermées (c'est justement ce qui empêche de moissonner
l'annuaire depuis le navigateur). Et surtout pas par une clé `service_role` —
la règle du dépôt est qu'il n'en existe aucune sur cette machine.
"""
from __future__ import annotations

import json

import requests

from .config import api_supabase

DELAI = 60


class ErreurAkora(Exception):
    pass


def executer(requete: str) -> list[dict]:
    """Joue une requête SQL et renvoie les lignes. Lève ErreurAkora sur échec."""
    url, jeton = api_supabase()
    try:
        reponse = requests.post(
            url,
            headers={"Authorization": f"Bearer {jeton}", "Content-Type": "application/json"},
            json={"query": requete},
            timeout=DELAI,
        )
    except requests.RequestException as e:
        raise ErreurAkora(f"Base Akora injoignable : {e}") from e
    if not reponse.ok:
        raise ErreurAkora(
            f"Supabase a refusé : HTTP {reponse.status_code} — {reponse.text[:300]}"
        )
    try:
        lignes = reponse.json()
    except ValueError:
        return []
    return lignes if isinstance(lignes, list) else []


def executer_systeme(requete: str) -> None:
    """Joue une requete en se DECLARANT appel systeme. Ne rend aucune ligne.

    🔴 POURQUOI ELLE EXISTE. `public.proteger_colonnes_fournisseur()` est un
    trigger BEFORE UPDATE qui remet `statut`, `owner_id` et
    `niveau_verification` a leur ancienne valeur pour tout appelant qui n'est
    ni administrateur ni « systeme ». Il ne leve AUCUNE erreur : la requete
    repond « succes » et rien n'a bouge.

    C'est ce qui a fait dormir quatre fiches en brouillon du 23/08 au
    01/09/2026 alors que le bot annoncait « inscrit sur Akora en actif » a
    chaque passage — et que `publier()` ne pouvait pas davantage marcher. Le
    genre de panne qu'on ne trouve qu'en relisant la base apres coup, jamais
    dans les journaux.

    `est_appel_systeme()` exige DEUX choses : le drapeau `akora.systeme` pose,
    et un role interne. Le bot passe par l'API Management, donc
    `current_user` vaut `postgres` : la seconde est acquise, la premiere se
    pose ici, et seulement le temps de la transaction (`set_config(..., true)`).

    Le bloc DO ne rend rien : reserver cette voie aux mises a jour dont on
    n'attend pas de lignes, et laisser `executer()` pour tout le reste — un
    appel systeme est une exception, pas le chemin normal.
    """
    executer(
        "do $akora$ begin "
        "perform set_config('akora.systeme', 'on', true); "
        + requete.strip() +
        " end $akora$;"
    )


def txt(valeur) -> str:
    """Littéral SQL texte. Tout ce qui vient de Facebook passe par ici."""
    if valeur is None or valeur == "":
        return "NULL"
    return "'" + str(valeur).replace("'", "''") + "'"


def num(valeur) -> str:
    if valeur in (None, ""):
        return "NULL"
    return str(int(valeur))


def reel(valeur) -> str:
    if valeur in (None, ""):
        return "NULL"
    return repr(float(valeur))


def bool_sql(valeur) -> str:
    return "true" if valeur else "false"


def jsonb(valeur) -> str:
    return txt(json.dumps(valeur, ensure_ascii=False)) + "::jsonb"


# ── Référentiel ────────────────────────────────────────────────────────────
REQUETE_REFERENTIEL = """
select json_build_object(
  'familles', (
    select coalesce(json_agg(json_build_object(
      'slug', c.slug, 'nom', c.nom, 'nom_mg', c.nom_mg) order by c.ordre), '[]'::json)
      from public.categories c where c.active
  ),
  'types', (
    select coalesce(json_agg(json_build_object(
      'slug', t.slug, 'nom', t.nom, 'nom_mg', t.nom_mg,
      'synonymes', t.synonymes, 'famille', c.slug) order by c.ordre, t.ordre), '[]'::json)
      from public.types_materiaux t
      join public.categories c on c.id = t.categorie_id
     where t.actif
  ),
  'materiaux', (
    select coalesce(json_agg(json_build_object(
      'slug', m.slug, 'nom', m.nom, 'libelle_court', m.libelle_court,
      'dimensions', m.dimensions, 'unite', m.unite_defaut::text,
      'poids', m.poids_kg_unite_defaut, 'volume', m.volume_m3_unite_defaut,
      'attributs', m.attributs, 'type_slug', t.slug, 'famille', c.slug)
      order by c.ordre, m.ordre_format), '[]'::json)
      from public.materiaux_ref m
      left join public.types_materiaux t on t.id = m.type_id
      join public.categories c on c.id = m.categorie_id
     where m.actif
  )
) as referentiel;
"""


def lire_referentiel() -> dict:
    lignes = executer(REQUETE_REFERENTIEL)
    if not lignes:
        raise ErreurAkora("Le référentiel est revenu vide.")
    contenu = lignes[0].get("referentiel")
    if isinstance(contenu, str):
        contenu = json.loads(contenu)
    if not contenu or not contenu.get("materiaux"):
        raise ErreurAkora(
            "Aucun matériau de référence dans la base — le seed n'a pas été chargé "
            "(npm run db:seed côté site)."
        )
    return contenu


# ── Annuaire : ce fournisseur est-il DÉJÀ chez nous ? ──────────────────────
_cache_annuaire: list[dict] | None = None


def annuaire() -> list[dict]:
    """Les fournisseurs déjà inscrits, avec leurs numéros. Mis en cache.

    Sans cette liste, on démarcherait un dépôt qui a déjà son compte — la
    manière la plus rapide de perdre sa crédibilité auprès d'un client.
    """
    global _cache_annuaire
    if _cache_annuaire is None:
        lignes = executer(
            "select f.id::text, f.raison_sociale, f.slug, f.statut::text, "
            "       f.owner_id::text as owner_id, "
            "       regexp_replace(coalesce(f.telephone, ''), '[^0-9]', '', 'g') as tel, "
            "       regexp_replace(coalesce(f.whatsapp, ''), '[^0-9]', '', 'g') as tel2, "
            # Les produits que ce depot a DEJA. Sans eux, chaque inscription
            # renvoyait tout son catalogue au site pour n'y rien changer, et
            # surtout on ne pouvait pas dire a l'ecran ce qu'il restait a
            # ajouter — donc on ne savait pas si un clic servait a quelque
            # chose. Une seule requete pour tout le monde : une par depot se
            # verrait a l'oeil nu sur l'ecran de tri.
            "       coalesce((select array_agg(p.slug) from public.produits p "
            "                  where p.fournisseur_id = f.id), '{}') as produits, "
            # Le PRIX de chaque produit deja en ligne. C'est lui qui distingue
            # « on l'a deja » de « on l'a, mais le depot a change son tarif » —
            # la deuxieme est la seule raison de reecrire quoi que ce soit.
            "       coalesce((select jsonb_object_agg(p.slug, p.prix_unitaire) "
            "                   from public.produits p "
            "                  where p.fournisseur_id = f.id), '{}'::jsonb) as prix, "
            # Les produits EN LIGNE qui n'ont aucune image. Sans cette
            # liste, un produit deja transfere ne recevait jamais la photo
            # qu'on lui designait ensuite : le transfert n'ecrit que ce qui
            # MANQUE, et lui ne manquait pas — il etait seulement muet.
            "       coalesce((select array_agg(p.slug) from public.produits p "
            "                  where p.fournisseur_id = f.id "
            "                    and cardinality(p.photos) = 0), '{}') as sans_photo "
            "  from public.fournisseurs f;"
        )
        for ligne in lignes:
            produits = ligne.get("produits")
            if isinstance(produits, str):          # tableau Postgres en texte
                produits = [m for m in produits.strip("{}").split(",") if m]
            ligne["produits"] = list(produits or [])
            prix = ligne.get("prix")
            if isinstance(prix, str):
                prix = json.loads(prix)
            ligne["prix"] = {k: int(v) for k, v in (prix or {}).items()
                             if v is not None}
            muets = ligne.get("sans_photo")
            if isinstance(muets, str):
                muets = [m for m in muets.strip("{}").split(",") if m]
            ligne["sans_photo"] = list(muets or [])
        _cache_annuaire = lignes
    return _cache_annuaire


def oublier_cache() -> None:
    global _cache_annuaire
    _cache_annuaire = None


def _fin_de_numero(brut: str) -> str:
    """Les 9 derniers chiffres : 0341234567, +261341234567 et 341234567 sont un
    seul et même abonné. Comparer les chaînes entières les séparerait."""
    chiffres = "".join(c for c in (brut or "") if c.isdigit())
    return chiffres[-9:] if len(chiffres) >= 9 else chiffres


def deja_fournisseur(telephone: str, nom: str = "") -> tuple[str, str]:
    """(id, raison) si ce prospect est déjà un fournisseur Akora, sinon ('', '')."""
    fin = _fin_de_numero(telephone)
    nom_reduit = "".join(c for c in (nom or "").lower() if c.isalnum())
    for ligne in annuaire():
        if fin and fin in (_fin_de_numero(ligne.get("tel")), _fin_de_numero(ligne.get("tel2"))):
            return ligne["id"], f"même numéro que « {ligne['raison_sociale']} »"
        autre = "".join(c for c in (ligne.get("raison_sociale") or "").lower() if c.isalnum())
        if nom_reduit and len(nom_reduit) >= 6 and nom_reduit == autre:
            return ligne["id"], f"même raison sociale que « {ligne['raison_sociale']} »"
    return "", ""


# ── Localités : pour poser un prospect sur la carte ────────────────────────
_cache_localites: list[dict] | None = None


def localites() -> list[dict]:
    global _cache_localites
    if _cache_localites is None:
        _cache_localites = executer(
            "select id::text, nom, type::text, slug, lat, lng from public.localites;"
        )
    return _cache_localites


def localite_par_nom(nom: str) -> dict | None:
    if not nom:
        return None
    reduit = "".join(c for c in nom.lower() if c.isalnum())
    for ligne in localites():
        if "".join(c for c in (ligne["nom"] or "").lower() if c.isalnum()) == reduit:
            return ligne
    return None


def tester() -> dict:
    """Bouton « Tester la connexion » des réglages."""
    referentiel = lire_referentiel()
    return {
        "ok": True,
        "familles": len(referentiel["familles"]),
        "types": len(referentiel["types"]),
        "materiaux": len(referentiel["materiaux"]),
        "fournisseurs_inscrits": len(annuaire()),
    }
