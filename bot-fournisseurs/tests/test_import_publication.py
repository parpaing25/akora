"""Désigner LA publication visée par un lien collé.

🔴 CE QUI A ÉTÉ MESURÉ LE 01/09/2026, en important un vrai lien.

Ouvrir `facebook.com/share/p/1DEn6ibetm/` ne donne pas une page à une
publication. Facebook résout vers
`permalink.php?story_fbid=pfbid0wny…&id=100086004439472` et affiche la
publication **au milieu du fil de sa page** : 22 blocs `role="article"` sur
l'écran. Prendre « le bloc le plus fourni » a rendu, d'un appel à l'autre,
le tarif de madriers cherché, puis un article sur l'élevage de tilapia.

Deux repères, dans cet ordre : l'identifiant de la publication présent dans
les liens du bloc, puis le titre de la page — qui reprend le début du texte
visé : « (20+) #ARRIVAGE #ARRIVAGE… - Fivarotan-kazo Mirary | Facebook ».

    python -m pytest tests/test_import_publication.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot.collecteur import _bloc_vise, empreinte  # noqa: E402

TITRE = "(20+) #ARRIVAGE #ARRIVAGE‼️ #HAUTE #QUALITE... - Fivarotan-kazo Mirary | Facebook"
ADRESSE = ("https://www.facebook.com/permalink.php?story_fbid=pfbid0wnyD6B13z8"
           "wb4G4xiARBKyuxWWCn92ozTaQPedwxCXSMegjejTbk6WHHkYc34mWUl&id=100086004439472")

VISE = {
    "texte": "#ARRIVAGE #ARRIVAGE\n#HAUTE #QUALITE #LIVRAISON gratuite eto TANA\n"
             "#MADRIER 4m : (KINININA MENA BE)\n15cmx7cmx4m= 35 000ar",
    "permalien": "", "auteur_url": "",
}
LEURRE = {
    # Plus long que la publication visée : c'est exactement le piège.
    "texte": "FIOMPIANA TRONDRO TILAPIA : AFAKA MITONDRA VOLA HO ANAO VE IZY ? " * 8,
    "permalien": "https://www.facebook.com/1234/posts/9999", "auteur_url": "",
}


def test_le_titre_de_la_page_designe_le_bon_bloc():
    assert _bloc_vise([LEURRE, VISE], ADRESSE, TITRE) is VISE


def test_l_identifiant_de_la_publication_prime_sur_le_titre():
    """Quand le lien du bloc porte le story_fbid, il n'y a plus à deviner."""
    exact = {**VISE, "texte": "court",
             "permalien": "https://www.facebook.com/permalink.php?story_fbid="
                          "pfbid0wnyD6B13z8wb4G4xiARBKyuxWWCn92ozTaQPedwxCXSMegjejTbk6WHHkYc34mWUl"}
    assert _bloc_vise([LEURRE, exact], ADRESSE, "titre sans rapport") is exact


def test_un_seul_bloc_ne_se_discute_pas():
    assert _bloc_vise([LEURRE], ADRESSE, TITRE) is LEURRE


def test_sans_repere_on_retombe_sur_le_plus_fourni():
    """On devine alors — mais seulement là, et en dernier recours."""
    assert _bloc_vise([VISE, LEURRE], "https://facebook.com/", "") is LEURRE


def test_deux_publications_de_groupe_ne_partagent_pas_leur_empreinte():
    """Le défaut qui faisait répondre « déjà dans la base » à tout coup.

    `empreinte()` hache le permalien seul. En coupant la query, toutes les
    adresses `permalink.php?story_fbid=...` se ramenaient à
    « permalink.php » : une seule empreinte pour toutes les publications de
    groupe. Le deuxième import annonçait alors la fiche d'un autre dépôt.
    """
    a = "https://www.facebook.com/permalink.php?story_fbid=pfbidAAA&id=1"
    b = "https://www.facebook.com/permalink.php?story_fbid=pfbidBBB&id=1"
    assert empreinte("texte", a) != empreinte("texte", b)
    assert empreinte("texte", a.split("?")[0]) == empreinte("autre", b.split("?")[0])
