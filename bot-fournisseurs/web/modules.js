/* ═══════════════════════════════════════════════════════════════════════════
   Bot fournisseurs Akora — automatisations, demandes, camions, bulletin
   ═══════════════════════════════════════════════════════════════════════════
   Chargé après app.js, dont il réutilise les utilitaires ($, api, toast,
   echapper, prixAr, jour, etat…). Séparé pour une raison simple : app.js
   portait déjà les six vues d'origine, et un fichier de 1 500 lignes qu'on
   ouvre pour changer un libellé est un fichier qu'on n'ouvre plus.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── AUTOMATISATIONS ──────────────────────────────────────────────────────
   Chaque carte dit ce que l'interrupteur FAIT, et ce qu'il ne fera JAMAIS.
   La seconde phrase n'est pas de la décoration : c'est elle qui permet
   d'allumer sans crainte, et c'est elle qui manque à tous les bots qu'on
   finit par éteindre « au cas où ».

   Le classement suit ce que l'automatisation TOUCHE — le PC, la base Akora
   en privé, puis le site public. C'est le seul ordre qui aide à décider. */

const AUTOMATISATIONS = [
  {
    groupe: "locales",
    cle: "collecte_auto",
    titre: "Collecte automatique",
    fait: "Parcourt les sources actives aux heures réglées, et va plus loin dans les mêmes fils si l'objectif du jour n'est pas atteint.",
    jamais: "Ne devient jamais plus rapide : ce sont les défilements qui augmentent, pas le rythme. Un jour creux ne rend pas le bot agressif.",
  },
  {
    groupe: "locales",
    cle: "auto_relances",
    titre: "Signaler les relances dues",
    fait: "Compte chaque matin les dépôts contactés restés sans réponse au-delà du délai, et le dit dans le journal.",
    jamais: "N'envoie aucun message. Facebook coupe les comptes qui écrivent en série, et un dépôt démarché par un robot ne rappelle pas.",
  },
  {
    groupe: "locales",
    cle: "lire_commentaires",
    titre: "Chercher le prix en commentaire",
    fait: "Ouvre la publication quand elle vend sans annoncer de prix, et lit les commentaires du vendeur — « vidiny ao amin'ny commentaire » est la norme ici.",
    jamais: "N'ouvre jamais une publication qui a déjà un prix, ni plus de quelques-unes par source : chaque ouverture est une page chargée de plus chez Facebook. Ne retient que les commentaires DU vendeur — le prix qu'un passant croit se rappeler ne vaut rien.",
  },
  {
    groupe: "locales",
    cle: "auto_recherches",
    titre: "Combler les trous de couverture",
    fait: "Repère les familles sans aucun fournisseur ni prospect dans une ville, et ajoute la recherche Facebook correspondante aux sources.",
    jamais: "N'ajoute jamais plus que le nombre réglé par passage — la liste des sources doit rester lisible.",
  },
  {
    groupe: "locales",
    cle: "llm_actif",
    titre: "Relecture par un modèle",
    fait: "Fait relire chaque publication : vendeur ou acheteur, hors-périmètre, et quel montant va avec quel matériau quand le tarif est écrit en prose.",
    jamais: "Ne choisit jamais une référence du catalogue. Il propose un libellé, l'appariement décide — sinon il inventerait des références qui n'existent pas.",
  },
  {
    groupe: "privees",
    cle: "auto_synchro",
    titre: "Relire le site chaque jour",
    fait: "Regarde qui a ouvert sa fiche, qui l'a revendiquée, qui a refusé — et met les statuts à jour.",
    jamais: "N'écrit rien chez le fournisseur : c'est une lecture. Sans elle, on relancerait un dépôt qui vient de créer son compte.",
  },
  {
    groupe: "privees",
    cle: "auto_reservation",
    titre: "Réserver les fiches validées",
    fait: "Écrit sur akora.fonenako.mg la fiche de chaque prospect validé : nom, quartier, produits, prix, camions, photos.",
    jamais: "Ne rend rien public. Une fiche réservée n'est ni indexée ni dans l'annuaire : elle ne s'ouvre qu'avec son jeton, celui qu'on envoie au dépôt.",
  },
  {
    groupe: "publiques",
    cle: "auto_bulletin",
    titre: "Préparer le bulletin de prix",
    fait: "Compose chaque semaine le brouillon du bulletin — les médianes par matériau — et le signale dans le journal.",
    jamais: "Ne publie rien tout seul. Préparer n'engage rien ; publier signe une page publique au nom d'Akora.",
  },
  {
    groupe: "publiques",
    cle: "auto_bulletin_publier",
    titre: "Publier le bulletin sans relecture",
    danger: true,
    fait: "Envoie le bulletin dans le fil d'accueil d'Akora, visible de tous, sans que personne ne l'ait relu.",
    jamais: "N'y met que des lignes appuyées sur au moins trois dépôts, et pas plus d'un bulletin tous les six jours. Le seuil de fiabilité n'est jamais contournable.",
  },
];

function carteAutomatisation(a) {
  const actif = !!(etat.config || {})[a.cle];
  return `
  <div class="carte-auto ${actif ? "actif" : ""} ${a.danger ? "publique" : ""}"
       data-carte-auto="${a.cle}">
    <div class="carte-auto-tete">
      <h3>${echapper(a.titre)}</h3>
      <label class="interrupteur">
        <input type="checkbox" data-auto="${a.cle}" ${actif ? "checked" : ""}>
        <span class="piste"></span>
      </label>
    </div>
    <p class="fait">${echapper(a.fait)}</p>
    <p class="jamais"><b>Ne fera jamais :</b> ${echapper(a.jamais)}</p>
  </div>`;
}

/** Version compacte, pour le tableau de bord : tout est allumable de là.
 *
 * Le détail long reste dans l'onglet dédié — mais devoir changer d'onglet
 * pour éteindre une automatisation qui s'emballe est exactement ce qu'on ne
 * veut pas. */
function rendreAutoRapide() {
  const zone = $("#auto-rapide");
  if (!zone) return;
  const config = etat.config || {};
  // On ne redessine que si l'état a bougé : sans ça, la boucle de deux
  // secondes remplacerait l'interrupteur sous le doigt de l'utilisateur.
  const signature = AUTOMATISATIONS.map((a) => (config[a.cle] ? "1" : "0")).join("");
  if (zone.dataset.signature === signature) return;
  zone.dataset.signature = signature;

  zone.innerHTML = AUTOMATISATIONS.map((a) => `
    <div class="carte-auto compacte ${config[a.cle] ? "actif" : ""} ${a.danger ? "publique" : ""}"
         data-carte-auto-rapide="${a.cle}">
      <div class="carte-auto-tete">
        <h3>${echapper(a.titre)}</h3>
        <label class="interrupteur">
          <input type="checkbox" data-auto="${a.cle}" ${config[a.cle] ? "checked" : ""}>
          <span class="piste"></span>
        </label>
      </div>
      <p class="fait">${echapper(a.fait.split(".")[0])}.</p>
    </div>`).join("");
  brancherInterrupteurs(zone);
}

/** Le même comportement pour les deux rendus : un seul endroit à corriger. */
function brancherInterrupteurs(racine) {
  $$("[data-auto]", racine).forEach((bascule) => {
    bascule.addEventListener("change", async () => {
      const cle = bascule.dataset.auto;
      const definition = AUTOMATISATIONS.find((a) => a.cle === cle);
      // La seule confirmation de tout le produit, et elle est ici : c'est le
      // seul interrupteur qui écrit une page publique sans relecture.
      if (bascule.checked && definition && definition.danger) {
        const accord = confirm(
          "Publier le bulletin SANS RELECTURE ?\n\n"
          + "Il partira dans le fil d'accueil d'akora.fonenako.mg, visible de "
          + "tous et signé Akora, sans que personne ne l'ait lu.\n\n"
          + "Les garde-fous restent : seules les médianes appuyées sur au moins "
          + "trois dépôts y entrent, et pas plus d'un bulletin tous les six jours."
        );
        if (!accord) { bascule.checked = false; return; }
      }
      try {
        etat.config = await api("/api/config", {
          method: "POST", corps: { config: { [cle]: bascule.checked } },
        });
        $$(`[data-carte-auto="${cle}"], [data-carte-auto-rapide="${cle}"]`)
          .forEach((carte) => carte.classList.toggle("actif", bascule.checked));
        // Les deux rendus montrent les mêmes interrupteurs : l'autre doit
        // suivre, sinon le tableau de bord ment sur ce qui tourne.
        $$(`[data-auto="${cle}"]`).forEach((autre) => { autre.checked = bascule.checked; });
        const zone = $("#auto-rapide");
        if (zone) delete zone.dataset.signature;
        toast(`${definition ? definition.titre : cle} : ${bascule.checked ? "activé" : "éteint"}.`,
              bascule.checked ? "succes" : "");
      } catch (e) {
        bascule.checked = !bascule.checked;
        toast(e.message, "erreur");
      }
    });
  });
}

async function chargerAutomatisations() {
  etat.config = await api("/api/config");
  for (const groupe of ["locales", "privees", "publiques"]) {
    $("#auto-" + groupe).innerHTML = AUTOMATISATIONS
      .filter((a) => a.groupe === groupe).map(carteAutomatisation).join("");
  }
  $("#heures-collecte").value = (etat.config.heures_collecte || []).join(", ");
  $("#objectif-jour").value = etat.config.objectif_par_jour ?? 0;
  $$("[data-auto-num]").forEach((e) => { e.value = etat.config[e.dataset.autoNum] ?? ""; });
  $$("[data-auto-txt]").forEach((e) => { e.value = etat.config[e.dataset.autoTxt] ?? ""; });

  brancherInterrupteurs($("#vue-automatisations"));
}

$("#btn-auto-horaires").onclick = async () => {
  const modifs = {
    heures_collecte: $("#heures-collecte").value.split(",")
      .map((h) => h.trim()).filter(Boolean),
    objectif_par_jour: Number($("#objectif-jour").value) || 0,
  };
  $$("[data-auto-num]").forEach((e) => { modifs[e.dataset.autoNum] = Number(e.value) || 0; });
  $$("[data-auto-txt]").forEach((e) => { modifs[e.dataset.autoTxt] = e.value.trim(); });
  try {
    etat.config = await api("/api/config", { method: "POST", corps: { config: modifs } });
    toast("Réglages enregistrés.", "succes");
  } catch (e) { toast(e.message, "erreur"); }
};

/* ── DEMANDES D'ACHETEURS ─────────────────────────────────────────────────── */

const filtresDemandes = { statut: "", famille: "" };

async function chargerDemandes() {
  try {
    const pression = await api("/api/demandes/pression");
    $("#table-pression tbody").innerHTML = pression.length ? pression.map((p) => {
      const premiereVille = p.villes.length ? p.villes[0].ville : "";
      const requete = premiereVille
        ? `${p.libelle.split(" ")[0]} ${premiereVille}` : "";
      return `
      <tr>
        <td><strong>${echapper(p.libelle)}</strong></td>
        <td class="nombre">${p.demandes}</td>
        <td class="nombre">${p.urgentes || "—"}</td>
        <td class="nombre">${p.avec_contact}</td>
        <td><small>${p.villes.map((v) => `${echapper(v.ville)} (${v.n})`).join(", ") || "—"}</small></td>
        <td>${requete ? `<button class="bouton fin" data-chercher="${echapper(requete)}">Chercher des dépôts</button>` : ""}</td>
      </tr>`;
    }).join("")
      : '<tr><td colspan="6" class="vide">Aucune demande sur les 7 derniers jours.</td></tr>';

    $$("#table-pression [data-chercher]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        try {
          await api("/api/sources", { method: "POST", corps: { url: bouton.dataset.chercher } });
          toast(`Recherche « ${bouton.dataset.chercher} » ajoutée aux sources.`, "succes");
        } catch (e) { toast(e.message, "erreur"); }
      });
    });
  } catch (e) { toast(e.message, "erreur"); }

  let liste = [];
  try {
    liste = await api("/api/demandes?" + new URLSearchParams(filtresDemandes));
  } catch (e) { return toast(e.message, "erreur"); }

  $("#vide-demandes").hidden = liste.length > 0;
  $("#grille-demandes").innerHTML = liste.map((d) => `
    <button class="fiche-demande ${d.urgence ? "urgente" : ""}" data-demande="${d.id}">
      <span class="quoi">
        ${echapper(d.materiau_nom || d.type_nom || "Matériau non reconnu")}
        ${d.urgence ? '<span class="badge rouge">urgent</span>' : ""}
      </span>
      ${d.quantite ? `<span class="combien">${d.quantite} ${echapper(d.unite || "")}</span>` : ""}
      <span class="ou">
        ${echapper(d.quartier || d.ville || "lieu inconnu")}
        ${d.telephone ? " · " + echapper(d.telephone) : " · pas de téléphone"}
        ${d.budget ? " · budget " + prixAr(d.budget) : ""}
      </span>
      <span class="extrait">${echapper((d.texte || "").slice(0, 150))}</span>
      <span class="fiche-bas">
        <span class="badge ${d.statut === "nouvelle" ? "bleu" : "gris"}">${echapper(d.statut)}</span>
        <span class="badge pointille">${echapper(d.source_nom || "")}</span>
      </span>
    </button>`).join("");

  $$("#grille-demandes [data-demande]").forEach((carte) => {
    carte.addEventListener("click", () => ouvrirDemande(carte.dataset.demande));
  });

  $("#demandes-famille").innerHTML = '<option value="">Toutes les familles</option>'
    + etat.arbre.map((f) =>
      `<option value="${f.slug}" ${f.slug === filtresDemandes.famille ? "selected" : ""}>${echapper(f.nom)}</option>`
    ).join("");
}

$$("#filtres-demandes .puce").forEach((puce) => {
  puce.addEventListener("click", () => {
    $$("#filtres-demandes .puce").forEach((p) => p.classList.remove("actif"));
    puce.classList.add("actif");
    filtresDemandes.statut = puce.dataset.statut;
    chargerDemandes();
  });
});
$("#demandes-famille").onchange = (e) => {
  filtresDemandes.famille = e.target.value;
  chargerDemandes();
};

async function ouvrirDemande(did) {
  let demande, capables = [];
  try {
    demande = await api("/api/demandes/" + did);
    capables = await api(`/api/demandes/${did}/fournisseurs`);
  } catch (e) { return toast(e.message, "erreur"); }

  etat.ouvert = null;        // ce panneau n'est pas celui d'un prospect
  $("#p-titre").textContent = demande.materiau_nom || demande.type_nom || "Demande";
  $("#p-sous-titre").innerHTML =
    `<span class="badge bleu">demande d'acheteur</span>
     ${demande.urgence ? '<span class="badge rouge">urgent</span>' : ""}
     &nbsp;${echapper(demande.quartier || demande.ville || "lieu inconnu")}
     · vue le ${jour(demande.collecte_le)}`;

  const aucunDepot = "Aucun prospect ne vend ce matériau pour l'instant. "
    + "C'est un trou à combler.";

  $("#panneau-contenu").innerHTML = `
    <div class="bloc">
      <h3>Le besoin</h3>
      <div class="champs">
        <div><label>Quantité</label><div>${demande.quantite ? demande.quantite + " " + echapper(demande.unite || "") : "non chiffrée"}</div></div>
        <div><label>Budget annoncé</label><div>${demande.budget ? prixAr(demande.budget) : "—"}</div></div>
        <div><label>Contact</label><div>${echapper(demande.telephone || "aucun numéro")}</div></div>
        <div><label>Source</label><div>${echapper(demande.source_nom || "—")}</div></div>
      </div>
      ${demande.permalien ? `<p class="bloc-aide" style="margin-top:10px"><a href="${echapper(demande.permalien)}" target="_blank" rel="noopener">Ouvrir la publication sur Facebook</a></p>` : ""}
    </div>

    <div class="bloc">
      <h3>Publication d'origine</h3>
      <div class="apercu-message">${echapper(demande.texte || "")}</div>
    </div>

    <div class="bloc">
      <h3>Qui peut la servir <span class="badge gris">${capables.length}</span></h3>
      <p class="bloc-aide">
        Même matériau d'abord, même ville ensuite, puis le score. Un dépôt à
        Toamasina ne sert pas un chantier à Tana — le proposer ferait perdre un
        appel des deux côtés.
      </p>
      ${capables.length ? capables.map((c) => `
        <button class="pile-ligne" data-voir-prospect="${c.id}">
          <span class="n">${c.score}</span>
          <span class="c">
            <strong>${echapper(c.nom || "Sans nom")}</strong>
            <small>
              ${echapper(c.quartier || c.ville || "lieu inconnu")}
              ${c.exact ? " · a exactement ce matériau" : " · même type de matériau"}
              ${c.meme_ville ? " · même ville" : ""}
              ${c.prix ? " · " + prixAr(c.prix) : ""}
            </small>
          </span>
        </button>`).join("")
        : `<p class="bloc-aide">${aucunDepot}</p>`}
    </div>

    <div class="bloc">
      <h3>Traiter</h3>
      <div class="canaux">
        <button class="bouton fin" data-statut-demande="traitee">Marquer traitée</button>
        <button class="bouton fin" data-statut-demande="ignoree">Ignorer</button>
        <button class="bouton fin" data-statut-demande="nouvelle">Remettre en nouvelle</button>
      </div>
    </div>`;

  $$("[data-voir-prospect]").forEach((ligne) => {
    ligne.addEventListener("click", () => ouvrirPanneau(ligne.dataset.voirProspect));
  });
  $$("[data-statut-demande]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      try {
        await api(`/api/demandes/${did}/statut`, {
          method: "POST", corps: { statut: bouton.dataset.statutDemande },
        });
        toast("Demande mise à jour.", "succes");
        fermerPanneau();
        chargerDemandes();
      } catch (e) { toast(e.message, "erreur"); }
    });
  });

  // Le pied du panneau n'a de sens que pour un prospect (valider, réserver…).
  $("#panneau .panneau-pied").hidden = true;
  $("#panneau").hidden = false;
}

/* ── CAMIONS ──────────────────────────────────────────────────────────────── */

function blocVehicules(p) {
  const flotte = p.vehicules || [];
  const transporteur = (p.nature || "depot") !== "depot";
  if (!flotte.length && !transporteur) return "";

  return `
  <div class="bloc">
    <h3>Camions <span class="badge gris">${flotte.length}</span></h3>
    <p class="bloc-aide">
      C'est la pièce qui rend le <strong>prix rendu chantier</strong> calculable.
      Une capacité vide n'est pas un oubli : « 10 roues » ne se convertit pas en
      mètres cubes sans inventer un chiffre — c'est à vous de le saisir.
    </p>
    ${flotte.length ? flotte.map((v) => `
      <div class="vehicule" data-vehicule="${v.id}">
        <span class="nom">${echapper(v.nom)}</span>
        <input type="text" data-vehicule-champ="capacite_m3" value="${v.capacite_m3 ?? ""}"
               placeholder="m³" inputmode="decimal" title="Capacité en mètres cubes">
        <input type="text" data-vehicule-champ="forfait_base" value="${v.forfait_base ?? ""}"
               placeholder="Ar / voyage" inputmode="numeric">
        <input type="text" data-vehicule-champ="prix_par_km" value="${v.prix_par_km ?? ""}"
               placeholder="Ar / km" inputmode="numeric">
        <button class="jeter" data-jeter-vehicule="${v.id}" title="Retirer ce camion">×</button>
        <div class="brut">
          ${!v.capacite_m3 && !v.capacite_kg ? '<span class="badge jaune">capacité à saisir</span> ' : ""}
          ${!v.forfait_base && !v.prix_par_km ? '<span class="badge jaune">tarif à saisir</span> ' : ""}
          lu : « ${echapper(v.libelle_brut)} »
        </div>
      </div>`).join("")
      : '<p class="bloc-aide">Aucun camion relevé sur ses publications.</p>'}
  </div>`;
}

/** Branché depuis app.js, après chaque rendu du panneau. */
function brancherVehicules(pid) {
  $$("[data-vehicule-champ]").forEach((entree) => {
    entree.addEventListener("change", async () => {
      const vid = entree.closest("[data-vehicule]").dataset.vehicule;
      const brut = entree.value.trim().replace(/\s/g, "").replace(",", ".");
      const valeur = brut === "" ? null : Number(brut);
      if (valeur !== null && Number.isNaN(valeur)) {
        return toast("Ce champ attend un nombre.", "erreur");
      }
      try {
        await api("/api/vehicules/" + vid, {
          method: "PATCH", corps: { champs: { [entree.dataset.vehiculeChamp]: valeur } },
        });
        await ouvrirPanneau(pid);
        chargerProspects();
      } catch (e) { toast(e.message, "erreur"); }
    });
  });
  $$("[data-jeter-vehicule]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await api("/api/vehicules/" + bouton.dataset.jeterVehicule, { method: "DELETE" });
      await ouvrirPanneau(pid);
    });
  });
}

/* ── BULLETIN DE PRIX ─────────────────────────────────────────────────────── */

async function apercuBulletin() {
  const zone = $("#bulletin-zone");
  zone.innerHTML = '<p class="aide">Préparation…</p>';
  const ville = $("#bulletin-ville").value;
  let apercu;
  try {
    apercu = await api("/api/fil/apercu?ville=" + encodeURIComponent(ville));
  } catch (e) {
    zone.innerHTML = `<p class="aide">${echapper(e.message)}</p>`;
    return;
  }

  const attente = apercu.publiable ? "" :
    `<span class="aide" style="margin:0">Un bulletin a été publié récemment — attendez ${apercu.jours_a_attendre} jour(s).</span>`;

  zone.innerHTML = `
    <div class="bulletin-meta">
      <span><strong>${apercu.lignes}</strong> matériaux retenus</span>
      <span>·</span>
      <span>${apercu.ecartees} écarté(s) faute de trois dépôts</span>
      <span>·</span>
      <span>${apercu.caracteres} / 1200 caractères</span>
      ${apercu.dernier ? `<span>·</span><span>dernier bulletin le ${jour(apercu.dernier.publie_le)}</span>` : ""}
    </div>
    <div class="bulletin">${echapper(apercu.texte)}</div>
    <div class="canaux">
      <button class="bouton fin" id="btn-bulletin-copier">Copier</button>
      <button class="bouton principal fin" id="btn-bulletin-publier"
              ${apercu.publiable ? "" : "disabled"}>Publier dans le fil Akora</button>
      ${attente}
    </div>`;

  $("#btn-bulletin-copier").onclick = async () => {
    await navigator.clipboard.writeText(apercu.texte);
    toast("Bulletin copié.", "succes");
  };
  const publier = $("#btn-bulletin-publier");
  if (publier) publier.onclick = async () => {
    const accord = confirm(
      "Publier ce bulletin dans le fil d'accueil d'Akora ?\n\n"
      + "Il sera visible de tous les visiteurs de akora.fonenako.mg, signé Akora."
    );
    if (!accord) return;
    try {
      const r = await api("/api/fil/publier", { method: "POST", corps: { ville } });
      toast("Bulletin publié dans le fil.", "succes");
      zone.innerHTML += `<p class="aide fine">Publication ${r.id.slice(0, 8)} en ligne.</p>`;
    } catch (e) { toast(e.message, "erreur"); }
  };
}
$("#btn-bulletin-apercu").onclick = apercuBulletin;

/* ── Ajouter le fil d'actualité en un clic ────────────────────────────────── */
$("#btn-ajouter-fil").onclick = async () => {
  try {
    await api("/api/sources", {
      method: "POST",
      corps: { nom: "Mon fil d'actualité", url: "https://www.facebook.com/" },
    });
    chargerSources();
    toast("Fil d'actualité ajouté aux sources.", "succes");
  } catch (e) { toast(e.message, "erreur"); }
};
