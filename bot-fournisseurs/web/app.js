/* ═══════════════════════════════════════════════════════════════════════════
   Bot fournisseurs Akora — interface
   ═══════════════════════════════════════════════════════════════════════════
   Une seule page, six vues, aucun cadre applicatif : le serveur est local,
   les données tiennent en quelques centaines de lignes, et une dépendance de
   plus serait une dépendance à charger hors ligne.

   L'état vient de /api/etat, interrogé toutes les 2 secondes. Tout le reste
   est demandé à la demande, quand une vue s'ouvre.
   ═══════════════════════════════════════════════════════════════════════════ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const etat = {
  vue: "bord",
  filtres: { statut: "", source_id: 0, recherche: "", famille: "", tri: "score" },
  prospects: [],
  ouvert: null,          // fiche complète du prospect affiché dans le panneau
  arbre: [],             // familles › types › formats
  config: {},
  sources: [],
  dernierEtat: null,
  // Les fiches cochees. Un Set, pas un tableau : on coche, on filtre, on
  // recoche — l'appartenance doit se tester en temps constant, et la
  // selection survit au rechargement de la grille.
  selection: new Set(),
};

// ── Utilitaires ────────────────────────────────────────────────────────────
const ESPACE_FINE = " ";

/** « 1 400 Ar » — espace fine insécable, jamais de décimale (AKORA-DESIGN §3). */
function prixAr(montant) {
  if (montant === null || montant === undefined || montant === "") return "—";
  return String(Math.round(montant)).replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_FINE)
    + ESPACE_FINE + "Ar";
}

const UNITES = {
  piece: "/ pièce", sac: "/ sac", m3: "/ m³", tonne: "/ tonne", m2: "/ m²",
  ml: "/ mètre", botte: "/ botte", chargement: "/ chargement", palette: "/ palette",
};

const LIBELLES_STATUT = {
  a_trier: "À trier", incomplet: "Incomplet", valide: "Validé", reserve: "Réservé",
  a_contacter: "À contacter", contacte: "Contacté", relance: "Relancé",
  revendique: "Revendiqué", refuse: "Refus", rejete: "Écarté",
  doublon: "Doublon", deja_client: "Déjà client",
};
const COULEURS_STATUT = {
  a_trier: "gris", incomplet: "jaune", valide: "bleu", reserve: "bleu",
  a_contacter: "bleu", contacte: "jaune", relance: "jaune", revendique: "vert",
  refuse: "rouge", rejete: "gris", doublon: "gris", deja_client: "vert",
};

function heure(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function jour(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
function echapper(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Branche un gestionnaire, sans mourir si l'élément n'existe pas.
 *
 * Ce garde-fou n'est pas de la prudence de principe : `$("#absent").onclick = f`
 * lève une TypeError AU CHARGEMENT, ce qui avorte le reste du script — y
 * compris la boucle d'état. Le tableau de bord restait alors à zéro, la
 * pastille Facebook grise, et rien n'indiquait la cause. Un bouton déplacé
 * d'un onglet à l'autre ne doit plus pouvoir éteindre toute l'interface. */
function surClic(selecteur, fonction) {
  const element = $(selecteur);
  if (element) element.onclick = fonction;
  return element;
}

let minuterieToast;
function toast(message, genre = "") {
  const boite = $("#toast");
  boite.textContent = message;
  boite.className = "toast " + genre;
  boite.hidden = false;
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => { boite.hidden = true; }, 5200);
}

/** Appel JSON. Une erreur du serveur remonte telle quelle : elle est écrite
 *  pour être lue par un humain, pas pour être traduite ici. */
async function api(chemin, options = {}) {
  const reponse = await fetch(chemin, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.corps ? JSON.stringify(options.corps) : undefined,
  });
  const brut = await reponse.text();
  let donnees = null;
  try { donnees = brut ? JSON.parse(brut) : null; } catch { donnees = null; }
  if (!reponse.ok) {
    throw new Error((donnees && (donnees.detail || donnees.message)) || brut || "Erreur");
  }
  return donnees;
}

// ── Navigation ─────────────────────────────────────────────────────────────
const TITRES_VUE = {
  bord: "Tableau de bord", fournisseurs: "Fournisseurs", demandes: "Demandes d'acheteurs",
  prospection: "Prospection", appels: "À appeler", formats: "Atelier des formats",
  annuaire: "Annuaire", marche: "Prix et couverture", automatisations: "Automatisations",
  sources: "Sources", candidats: "Nouvelles sources", reglages: "Réglages",
};

$$(".onglet").forEach((bouton) => {
  bouton.addEventListener("click", () => ouvrirVue(bouton.dataset.vue));
});

/* Le menu latéral se replie sous 960 px : un bouton l'ouvre, un voile ou
   Échap le referme. Sur grand écran il est toujours là, rien à faire. */
function basculerNav(ouvrir) {
  const ouvert = ouvrir ?? !document.body.classList.contains("nav-ouverte");
  document.body.classList.toggle("nav-ouverte", ouvert);
  const voile = $("#nav-voile");
  if (voile) voile.hidden = !ouvert;
  const bouton = $("#btn-nav");
  if (bouton) bouton.setAttribute("aria-expanded", String(ouvert));
}
surClic("#btn-nav", () => basculerNav());
surClic("#nav-voile", () => basculerNav(false));

function ouvrirVue(nom) {
  if (!TITRES_VUE[nom]) nom = "bord";
  etat.vue = nom;
  $$(".onglet").forEach((b) => b.classList.toggle("actif", b.dataset.vue === nom));
  $$(".vue").forEach((v) => v.classList.toggle("active", v.id === "vue-" + nom));
  const titre = $("#titre-vue");
  if (titre) titre.textContent = TITRES_VUE[nom];
  document.title = `${TITRES_VUE[nom]} — Bot fournisseurs Akora`;
  basculerNav(false);
  window.scrollTo({ top: 0 });
  // La vue survit à un rechargement (le bot redémarre, F5) — pas à une
  // nouvelle fenêtre : le matin, on arrive sur le tableau de bord.
  try { sessionStorage.setItem("akora-vue", nom); } catch { /* navigation privée */ }
  if (nom === "fournisseurs") chargerProspects();
  if (nom === "demandes") chargerDemandes();
  if (nom === "prospection") chargerFile();
  if (nom === "appels") chargerAppels();
  if (nom === "formats") chargerFormats();
  if (nom === "annuaire") chargerAnnuaire();
  if (nom === "marche") chargerMarche();
  if (nom === "automatisations") chargerAutomatisations();
  if (nom === "sources") chargerSources();
  if (nom === "candidats") chargerCandidats();
  if (nom === "reglages") chargerReglages();
}

// ── Boucle d'état ──────────────────────────────────────────────────────────
async function rafraichirEtat() {
  let donnees;
  try {
    donnees = await api("/api/etat");
  } catch {
    return;      // le serveur redémarre : on retentera dans 2 s
  }
  etat.dernierEtat = donnees;
  const c = donnees.compteurs;

  ["a_trier", "valide", "reserve", "contacte", "revendique", "incomplet"]
    .forEach((cle) => { const n = $("#n-" + cle); if (n) n.textContent = c[cle] ?? 0; });
  $("#n-offres").textContent = c.offres_appariees ?? 0;

  // Les offres chiffrees qui n'attendent qu'un format : c'est le compteur qui
  // dit combien de produits sont a un clic d'etre publiables.
  const aAppeler = c.depots_a_appeler ?? 0;
  const pastilleAppels = $("#pastille-appels");
  if (pastilleAppels) {
    pastilleAppels.textContent = aAppeler;
    pastilleAppels.classList.toggle("zero", aAppeler === 0);
  }

  const aTrancher = c.formats_a_trancher ?? 0;
  const pastilleFormats = $("#pastille-formats");
  if (pastilleFormats) {
    pastilleFormats.textContent = aTrancher;
    pastilleFormats.classList.toggle("zero", aTrancher === 0);
  }

  const aTrier = (c.a_trier ?? 0) + (c.incomplet ?? 0);
  const pastille = $("#pastille-trier");
  pastille.textContent = aTrier;
  pastille.classList.toggle("zero", aTrier === 0);

  // Session Facebook
  const okFb = donnees.session_fb;
  $("#etat-fb").className = "etat " + (okFb ? "ok" : "ko");
  $("#etat-fb-texte").textContent = okFb ? "Facebook : connecté" : "Facebook : à connecter";
  $("#banniere-fb").hidden = okFb;
  $("#btn-collecte").disabled = !okFb || donnees.tache.actif;

  // Catalogue
  const okRef = donnees.referentiel;
  $("#etat-ref").className = "etat " + (okRef ? "ok" : "ko");
  $("#banniere-ref").hidden = okRef;

  // Compte utilisé
  $("#ligne-compte").innerHTML = okFb
    ? `<span>Le bot lit Facebook avec la session enregistrée sur ce PC.</span>
       <button class="lien-discret" id="btn-oublier">Changer de compte</button>`
    : `<span>Aucun compte connecté.</span>
       <button class="lien-discret" id="btn-connexion">Connecter mon compte Facebook</button>`;
  const oublier = $("#btn-oublier");
  if (oublier) oublier.onclick = async () => {
    await api("/api/facebook/oublier", { method: "POST" });
    toast("Session oubliée.");
  };
  const connecter = $("#btn-connexion");
  if (connecter) connecter.onclick = lancerConnexion;

  // Progression
  const occupe = donnees.tache.actif;
  const collecte = donnees.collecte;
  $("#progression").hidden = !occupe;
  $("#btn-arreter").disabled = !collecte.actif;
  $("#btn-reserver-lot").disabled = occupe;
  $("#btn-synchro").disabled = occupe;
  // APRÈS la ligne ci-dessus, et pas avant : elle remettrait le bouton en
  // service. Relu à chaque tour parce que l'interrupteur vit dans un AUTRE
  // onglet — allumé là-bas, le bandeau doit disparaître ici tout seul.
  rendreBannierePoussee();
  if (occupe) {
    const libelles = {
      collecte: collecte.source
        ? `Collecte — ${collecte.source} · ${collecte.nouveaux} nouveau(x), ` +
          `${collecte.revus} revu(s) sur ${collecte.parcourues} publication(s)`
        : "Collecte en cours…",
      reservation: "Réservation de la fiche… " + (donnees.tache.detail || ""),
      reservation_lot: "Réservation en lot… " + (donnees.tache.detail || ""),
      connexion: "Fenêtre Facebook ouverte — connectez-vous.",
      synchro: "Relecture du site…",
    };
    $("#texte-progression").textContent =
      libelles[donnees.tache.type] || "Travail en cours…";
  }

  // Demandes d'acheteurs
  const d = donnees.demandes || { sept_jours: 0, nouvelle: 0 };
  $("#n-demandes").textContent = d.sept_jours ?? 0;
  const pd = $("#pastille-demandes");
  pd.textContent = d.nouvelle ?? 0;
  pd.classList.toggle("zero", !d.nouvelle);

  // Planning
  const p = donnees.planning;
  $("#etat-planning").innerHTML = p.actif
    ? `<span><strong>${p.trouves}</strong> / ${p.objectif} fournisseur(s) aujourd'hui
        ${p.atteint ? "— objectif atteint ✓" : ""}</span>
       <span>·</span><span>Prochain passage : <strong>${p.prochain || "—"}</strong></span>`
    : `<span>Collectes automatiques désactivées — le bot ne démarrera rien tout seul.</span>`;

  // Les réglages de collecte, sur le tableau de bord comme chez Fonenako.
  // Ils ne sont écrasés que si l'utilisateur n'est pas en train de les taper.
  const champHeures = $("#heures-collecte-bord");
  if (champHeures && document.activeElement !== champHeures) {
    champHeures.value = (etat.config.heures_collecte || []).join(", ");
  }
  const champObjectif = $("#objectif-jour-bord");
  if (champObjectif && document.activeElement !== champObjectif) {
    champObjectif.value = etat.config.objectif_par_jour ?? 0;
  }
  const caseAuto = $("#collecte-auto-bord");
  if (caseAuto) caseAuto.checked = !!etat.config.collecte_auto;

  // Les interrupteurs d'automatisation, allumables depuis le tableau de bord.
  if (typeof rendreAutoRapide === "function") rendreAutoRapide();

  // Entonnoir
  const b = donnees.bilan;
  $("#entonnoir").innerHTML = [
    ["Collectés", b.collectes, "sur Facebook"],
    ["Réservés", b.reserves, "fiche écrite sur le site"],
    ["Contactés", b.contactes, "message envoyé"],
    ["Revendiqués", b.revendiques, `${b.taux_revendication}% des contactés`],
  ].map(([libelle, valeur, note]) => `
    <div class="etape-e">
      <div class="n">${valeur}</div>
      <div class="l">${libelle}</div>
      <div class="t">${note}</div>
    </div>`).join("");

  // Marché
  const m = donnees.marche;
  $("#etat-reservation").textContent = m.releves
    ? `${m.releves} prix relevés sur ${m.materiaux_suivis} matériaux, ${m.villes} ville(s).`
    : "Aucun prix relevé pour l'instant.";

  // Journal
  $("#journal").innerHTML = donnees.journal.map((l) =>
    `<li><span class="h">${heure(l.ts)}</span><span class="${l.niveau}">${echapper(l.message)}</span></li>`
  ).join("");

  // La file de prospection se recompte à chaque tour : c'est le seul chiffre
  // qu'Andry regarde en arrivant le matin.
  const file = (c.valide ?? 0) + (c.reserve ?? 0);
  const pf = $("#pastille-file");
  pf.textContent = file;
  pf.classList.toggle("zero", file === 0);

  rendreBarreEtat(donnees);
}

/** La ligne d'état de l'en-tête : ce que le bot fait MAINTENANT, en un
 *  regard, quel que soit l'onglet ouvert. */
function rendreBarreEtat(donnees) {
  const zone = $("#barre-etat");
  if (!zone) return;
  const collecte = donnees.collecte || {};
  const tache = donnees.tache || {};
  const p = donnees.planning || {};
  let classe = "calme", texte;
  if (collecte.actif) {
    classe = "actif";
    texte = collecte.source
      ? `Collecte en cours — ${collecte.source}`
      : "Collecte en cours…";
  } else if (tache.actif) {
    classe = "actif";
    texte = { reservation: "Réservation en cours", reservation_lot: "Réservation en lot",
              connexion: "Fenêtre Facebook ouverte", synchro: "Relecture du site",
              import: "Import d'une publication",
              prospection_sources: "Recherche de sources" }[tache.type] || "Travail en cours";
  } else if (p.actif) {
    texte = `${p.trouves ?? 0} / ${p.objectif ?? 0} fournisseur(s) aujourd'hui · prochain passage ${p.prochain || "—"}`;
  } else {
    classe = "eteint";
    texte = "Collectes automatiques éteintes";
  }
  zone.className = "barre-etat " + classe;
  zone.innerHTML = `<i></i><span>${echapper(texte)}</span>`;
}

// ── Actions du tableau de bord ─────────────────────────────────────────────
async function lancerConnexion() {
  try {
    await api("/api/facebook/connexion", { method: "POST" });
    toast("Une fenêtre Facebook s'ouvre — connectez-vous, elle se fermera seule.");
  } catch (e) { toast(e.message, "erreur"); }
}
$("#btn-connexion-banniere").onclick = lancerConnexion;

$("#btn-collecte").onclick = async () => {
  try {
    await api("/api/collecte", { method: "POST" });
    toast("Collecte lancée.");
  } catch (e) { toast(e.message, "erreur"); }
};
$("#btn-arreter").onclick = async () => {
  await api("/api/collecte/arret", { method: "POST" });
  toast("Arrêt demandé — la source en cours se termine.");
};
$("#btn-reserver-lot").onclick = async () => {
  if (!confirm("Réserver la fiche de tous les fournisseurs validés ?\n\n" +
               "Chaque fiche est écrite sur akora.fonenako.mg, sans être publique : " +
               "elle ne s'ouvre qu'avec le lien qu'on enverra au dépôt.")) return;
  try {
    await api("/api/reserver-lot", { method: "POST" });
    toast("Réservation en lot lancée.");
  } catch (e) { toast(e.message, "erreur"); }
};
$("#btn-synchro").onclick = async () => {
  try {
    await api("/api/synchroniser-statuts", { method: "POST" });
    toast("Relecture du site lancée.");
  } catch (e) { toast(e.message, "erreur"); }
};

/** Inscrit d'un coup tous les prospects VALIDÉS comme vrais fournisseurs.
 *
 * C'est le geste qui remplit l'annuaire d'Akora. Il crée les fiches en
 * brouillon : « Publier » reste un acte séparé, fiche par fiche. */
surClic("#btn-inscrire-lot", async () => {
  let valides = [];
  try {
    valides = await api("/api/prospects?statut=valide&tri=score");
  } catch (e) { return toast(e.message, "erreur"); }
  if (!valides.length) {
    return toast("Aucun fournisseur validé à inscrire.", "erreur");
  }
  const accord = confirm([
    `Inscrire ${valides.length} fournisseur(s) validé(s) sur akora.fonenako.mg ?`,
    "",
    "Chaque fiche crée un VRAI fournisseur, avec ses produits et ses prix.",
    "Elle est créée EN BROUILLON : elle existe, elle n'apparaît nulle part",
    "tant que vous n'avez pas cliqué « Publier » sur sa fiche.",
    "",
    "Les produits sans prix ne sont pas inscrits — Akora compare des prix.",
  ].join("\n"));
  if (!accord) return;
  try {
    await api("/api/prospects/lot/inscrire", {
      method: "POST", corps: { ids: valides.map((p) => p.id) },
    });
    toast(`Inscription de ${valides.length} fournisseur(s) lancée.`, "succes");
  } catch (e) { toast(e.message, "erreur"); }
});
$("#btn-sync-ref-banniere").onclick = () => synchroniserReferentiel();

surClic("#btn-planning", async () => {
  const heures = $("#heures-collecte-bord").value.split(",")
    .map((h) => h.trim()).filter(Boolean);
  try {
    etat.config = await api("/api/config", {
      method: "POST",
      corps: {
        config: {
          collecte_auto: $("#collecte-auto-bord").checked,
          heures_collecte: heures,
          objectif_par_jour: Number($("#objectif-jour-bord").value) || 0,
        },
      },
    });
    toast("Réglages enregistrés.", "succes");
    if (typeof chargerAutomatisations === "function"
        && etat.vue === "automatisations") chargerAutomatisations();
  } catch (e) { toast(e.message, "erreur"); }
});

$$(".lien-statut").forEach((bouton) => {
  bouton.addEventListener("click", () => {
    etat.filtres.statut = bouton.dataset.statut;
    $$("#filtres-statut .puce").forEach((p) =>
      p.classList.toggle("actif", p.dataset.statut === bouton.dataset.statut));
    ouvrirVue("fournisseurs");
  });
});

/** Prévient AVANT le clic que « Réserver » va refuser.
 *
 *  Découvrir un garde-fou au moment où on appuie sur le bouton, c'est croire
 *  que le bot est cassé. Le dire d'avance, c'est une consigne. */
function rendreBannierePoussee() {
  const bandeau = $("#banniere-poussee");
  if (!bandeau) return;
  const autorise = pousseeAutorisee();
  bandeau.hidden = autorise;
  const occupe = !!(etat.dernierEtat && etat.dernierEtat.tache
                    && etat.dernierEtat.tache.actif);
  // Les boutons qui partiraient pour rien sont désactivés plutôt que masqués :
  // un bouton absent laisse croire que la fonction n'existe pas.
  ["#btn-reserver-lot", "#sel-reserver", "#p-reserver"].forEach((selecteur) => {
    const bouton = $(selecteur);
    if (!bouton) return;
    if (!autorise) bouton.disabled = true;
    else if (selecteur !== "#p-reserver") bouton.disabled = occupe;
    bouton.title = autorise ? "" : "Envoi des fiches éteint — onglet Automatisations.";
  });
}

/** L'écriture vers akora.fonenako.mg est-elle ouverte ? */
function pousseeAutorisee() {
  return !!(etat.config || {}).pousser_les_fiches;
}

surClic("#btn-poussee-auto", () => ouvrirVue("automatisations"));

// ── Vue Fournisseurs ───────────────────────────────────────────────────────
async function chargerProspects() {
  const parametres = new URLSearchParams(etat.filtres);
  try {
    etat.prospects = await api("/api/prospects?" + parametres);
  } catch (e) {
    toast(e.message, "erreur");
    return;
  }
  const grille = $("#grille");
  $("#vide").hidden = etat.prospects.length > 0;
  grille.innerHTML = etat.prospects.map(carteProspect).join("");
  $$(".fiche", grille).forEach((carte) => {
    carte.addEventListener("click", () => ouvrirPanneau(carte.dataset.id));
  });
  $$("[data-cocher]", grille).forEach((case_) => {
    case_.addEventListener("change", () =>
      basculerSelection(case_.dataset.cocher, case_.checked));
  });
  // Une fiche disparue du filtre reste selectionnee : c'est voulu, on peut
  // constituer une selection en plusieurs passes. Mais la barre doit dire
  // combien, pas combien sont visibles.
  rendreBarreSelection();
  chargerDoublons();
}

/* ── Doublons probables ────────────────────────────────────────────────────
   Le bot SIGNALE, il ne fusionne pas. Mesuré le 24/08/2026 : le
   dédoublonnage par téléphone et par empreinte tient (180 publications, 180
   empreintes, aucun doublon d'offre) ; ce qui restait, ce sont des fiches
   HOMONYMES — dont plusieurs venaient en fait du même compte Facebook vu
   depuis deux groupes.

   Deux niveaux, et l'interface ne les mélange pas :
     · « même compte Facebook » — l'identifiant numérique est identique ;
     · « même nom » — à REGARDER, jamais à fusionner les yeux fermés :
       « Fournisseur en Matériaux de construction » est une enseigne générique
       que des pages réellement différentes portent. */
async function chargerDoublons() {
  const bloc = $("#bloc-doublons");
  if (!bloc) return;
  let groupes = [];
  try {
    groupes = await api("/api/doublons");
  } catch {
    bloc.hidden = true;      // le serveur redémarre : on ne dit rien de faux
    return;
  }
  bloc.hidden = groupes.length === 0;
  if (!groupes.length) return;
  const surs = groupes.filter((g) => g.certitude === "compte").length;
  $("#doublons-titre").textContent =
    `${groupes.length} doublon(s) probable(s)` +
    (surs ? ` — dont ${surs} sur le même compte Facebook` : "");
  $("#doublons-liste").innerHTML = groupes.map(groupeDoublon).join("");
  $$("[data-fusionner]", $("#doublons-liste")).forEach((bouton) => {
    bouton.addEventListener("click", () => fusionnerDoublon(bouton.dataset.fusionner));
  });
}

function groupeDoublon(g) {
  const sur = g.certitude === "compte";
  const lignes = g.fiches.map((f) => `
    <label class="doublon-fiche">
      <input type="radio" name="garder-${echapper(g.cle)}" value="${f.id}"
             ${f.id === g.garder ? "checked" : ""}>
      <span class="doublon-nom">${echapper(f.nom || "sans nom")}</span>
      <span class="doublon-detail">${echapper(f.telephone || "pas de numéro")}</span>
      <span class="doublon-detail">${f.nb_offres} offre(s) · ${f.nb_publications} publication(s)</span>
      <span class="doublon-detail">${echapper(LIBELLES_STATUT[f.statut] || f.statut)}</span>
      <a class="doublon-detail lien-discret" href="https://${echapper(f.page_url)}"
         target="_blank" rel="noopener">${echapper(f.page_url || "")}</a>
    </label>`).join("");
  return `
  <div class="doublon ${sur ? "sur" : "doute"}" data-cle="${echapper(g.cle)}">
    <p class="doublon-entete">
      <span class="doublon-marque">${sur ? "Même compte Facebook" : "Même nom seulement"}</span>
      <strong>${echapper(g.nom || "sans nom")}</strong>
      <small>${echapper(g.raison)}</small>
    </p>
    ${lignes}
    <p class="doublon-actions">
      <button class="bouton fin" data-fusionner="${echapper(g.cle)}">
        Fusionner dans la fiche cochée
      </button>
      ${sur ? "" : `<small class="doublon-garde-fou">Deux dépôts peuvent
        porter le même nom : vérifiez le numéro et la page avant de
        fusionner.</small>`}
    </p>
  </div>`;
}

async function fusionnerDoublon(cle) {
  const bloc = $(`.doublon[data-cle="${CSS.escape(cle)}"]`);
  if (!bloc) return;
  const choisi = $(`input[type="radio"]:checked`, bloc);
  if (!choisi) { toast("Cochez la fiche à garder.", "erreur"); return; }
  const tous = $$("input[type=\"radio\"]", bloc).map((i) => i.value);
  const absorbes = tous.filter((id) => id !== choisi.value);
  if (!absorbes.length) return;
  if (!confirm(
    `Fusionner ${absorbes.length} fiche(s) dans celle qui est cochée ?\n\n` +
    "Leurs publications, offres, photos et véhicules seront déplacés, puis " +
    "les fiches vidées seront supprimées. C'est irréversible.")) return;
  try {
    const r = await api("/api/doublons/fusionner", {
      method: "POST", corps: { garder: choisi.value, absorbes },
    });
    toast(`${r.absorbees} fiche(s) fusionnée(s).`, "succes");
    chargerProspects();
  } catch (e) {
    toast(e.message, "erreur");
  }
}

function carteProspect(p) {
  const photo = p.photo_couverture && p.photo_publication
    ? `<img src="/photo/${p.photo_publication}/${encodeURIComponent(p.photo_couverture)}" alt="" loading="lazy" decoding="async">`
    : `<span class="sans-photo">pas de photo</span>`;
  const types = (p.types_vendus || "").split(",").filter(Boolean).slice(0, 3);
  const manques = (p.manques || []).slice(0, 2);
  const cochee = etat.selection.has(p.id);
  return `
  <div class="enveloppe-fiche ${cochee ? "cochee" : ""}" data-enveloppe="${p.id}">
  <label class="coche" title="Sélectionner pour agir en lot">
    <input type="checkbox" data-cocher="${p.id}" ${cochee ? "checked" : ""}>
    <span></span>
  </label>
  <button class="fiche" data-id="${p.id}">
    <div class="fiche-image">
      ${photo}
      <span class="note ${p.niveau || "froid"}">${p.score}</span>
    </div>
    <div class="fiche-corps">
      <div class="fiche-nom">${echapper(p.nom || "Sans nom")}</div>
      <div class="fiche-meta">
        ${echapper(p.metier || "—")} · ${echapper(p.quartier || p.ville || "lieu inconnu")}
      </div>
      <div class="fiche-prix">
        <b>${p.nb_offres}</b> produit(s)${types.length ? " — " + echapper(types.join(", ")) : ""}
      </div>
      <div class="fiche-meta">${echapper(p.telephone || "pas de téléphone")}</div>
      <div class="fiche-bas">
        <span class="badge ${COULEURS_STATUT[p.statut] || "gris"}">${LIBELLES_STATUT[p.statut] || p.statut}</span>
        ${p.fournisseur_id ? '<span class="badge vert" title="Ce dépôt a déjà sa fiche sur akora.fonenako.mg">sur Akora</span>' : ""}
        ${manques.map((m) => `<span class="badge pointille">${echapper(m)}</span>`).join("")}
      </div>
    </div>
  </button>
  </div>`;
}

/* ── Sélection multiple ────────────────────────────────────────────────────
   Valider trente dépôts un par un, c'est trente allers-retours dans le
   panneau. La sélection survit au rechargement de la grille : on coche, on
   filtre, on coche encore, puis on agit. */

function basculerSelection(pid, coche) {
  if (coche) etat.selection.add(pid); else etat.selection.delete(pid);
  const enveloppe = $(`[data-enveloppe="${pid}"]`);
  if (enveloppe) enveloppe.classList.toggle("cochee", coche);
  rendreBarreSelection();
}

function rendreBarreSelection() {
  const barre = $("#barre-selection");
  if (!barre) return;
  const nombre = etat.selection.size;
  barre.hidden = nombre === 0;
  if (!nombre) return;
  $("#selection-compte").textContent =
    `${nombre} fiche${nombre > 1 ? "s" : ""} sélectionnée${nombre > 1 ? "s" : ""}`;
}

async function agirSurLaSelection(action) {
  const ids = [...etat.selection];
  if (!ids.length) return;
  try {
    if (action === "inscrire") {
      const accord = confirm([
        `Inscrire ${ids.length} fournisseur(s) sur akora.fonenako.mg ?`,
        "",
        "Chaque fiche crée un VRAI fournisseur, avec ses produits et ses prix.",
        "Elle est créée EN BROUILLON : elle existe, elle n'apparaît nulle part",
        "tant que vous n'avez pas cliqué « Publier » sur sa fiche.",
        "",
        "Les produits sans prix ne sont pas inscrits — Akora compare des prix.",
      ].join("\n"));
      if (!accord) return;
      await api("/api/prospects/lot/inscrire", { method: "POST", corps: { ids } });
      toast(`Inscription de ${ids.length} fournisseur(s) lancée.`, "succes");
    } else if (action === "reserver") {
      await api("/api/prospects/lot/reserver", { method: "POST", corps: { ids } });
      toast(`Réservation de ${ids.length} fiche(s) lancée.`, "succes");
    } else {
      const r = await api("/api/prospects/lot/" + action, {
        method: "POST", corps: { ids },
      });
      toast(`${r.faits} fiche(s) mise(s) à jour.`, "succes");
    }
    etat.selection.clear();
    rendreBarreSelection();
    chargerProspects();
  } catch (e) { toast(e.message, "erreur"); }
}

surClic("#sel-valider", () => agirSurLaSelection("valide"));
surClic("#sel-rejeter", () => agirSurLaSelection("rejete"));
surClic("#sel-reserver", () => agirSurLaSelection("reserver"));
surClic("#sel-inscrire", () => agirSurLaSelection("inscrire"));
surClic("#sel-rien", () => {
  etat.selection.clear();
  $$("[data-cocher]").forEach((c) => { c.checked = false; });
  $$("[data-enveloppe]").forEach((e) => e.classList.remove("cochee"));
  rendreBarreSelection();
});
surClic("#sel-tout", () => {
  // « Tout » veut dire ce qui est AFFICHE, pas toute la base : cocher
  // silencieusement des fiches qu'on ne voit pas est la meilleure facon de
  // valider ce qu'on n'a pas regarde.
  etat.prospects.forEach((p) => etat.selection.add(p.id));
  $$("[data-cocher]").forEach((c) => { c.checked = true; });
  $$("[data-enveloppe]").forEach((e) => e.classList.add("cochee"));
  rendreBarreSelection();
});

$$("#filtres-statut .puce").forEach((puce) => {
  puce.addEventListener("click", () => {
    $$("#filtres-statut .puce").forEach((p) => p.classList.remove("actif"));
    puce.classList.add("actif");
    etat.filtres.statut = puce.dataset.statut;
    chargerProspects();
  });
});
$("#filtre-famille").onchange = (e) => { etat.filtres.famille = e.target.value; chargerProspects(); };
$("#filtre-source").onchange  = (e) => { etat.filtres.source_id = Number(e.target.value); chargerProspects(); };
$("#tri").onchange            = (e) => { etat.filtres.tri = e.target.value; chargerProspects(); };
let minuterieRecherche;
$("#recherche").oninput = (e) => {
  clearTimeout(minuterieRecherche);
  minuterieRecherche = setTimeout(() => {
    etat.filtres.recherche = e.target.value.trim();
    chargerProspects();
  }, 260);
};

// ── Panneau de détail ──────────────────────────────────────────────────────
async function ouvrirPanneau(pid) {
  try {
    etat.ouvert = await api("/api/prospects/" + pid);
  } catch (e) { return toast(e.message, "erreur"); }
  rendrePanneau();
  $("#panneau").hidden = false;
}

function fermerPanneau() {
  $("#panneau").hidden = true;
  etat.ouvert = null;
}
$("#p-fermer").onclick = fermerPanneau;
$("#panneau").addEventListener("click", (e) => {
  if (e.target.id === "panneau") fermerPanneau();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#panneau").hidden) fermerPanneau();
});

function rendrePanneau() {
  const p = etat.ouvert;
  if (!p) return;
  // Le panneau sert aussi aux demandes d'acheteurs, qui masquent son pied :
  // sans ce retour, « Valider » et « Réserver » disparaissaient dès qu'on
  // avait ouvert une demande une fois.
  $("#panneau .panneau-pied").hidden = false;
  $("#p-titre").textContent = p.nom || "Fournisseur sans nom";
  $("#p-sous-titre").innerHTML =
    `<span class="badge ${COULEURS_STATUT[p.statut] || "gris"}">${LIBELLES_STATUT[p.statut] || p.statut}</span>
     &nbsp;score ${p.score}/100 · ${p.nb_publications} publication(s) ·
     vu le ${jour(p.derniere_vue)}`;

  const gardees = p.offres.filter((o) => o.garder);
  $("#panneau-contenu").innerHTML = [
    p.fiche_url ? `
      <div class="lien-fiche">
        <strong>Fiche réservée :</strong>
        <a href="${p.fiche_url}" target="_blank" rel="noopener">${p.fiche_url}</a>
      </div>` : "",
    p.fournisseur_id ? `
      <div class="lien-fiche">
        <strong>Inscrit sur Akora</strong>
        <span class="badge bleu">${p.statut === "inscrit" ? "en brouillon ou publié" : echapper(p.statut)}</span>
        <span style="flex-basis:100%;font-size:12px;color:var(--beton-doux)">
          Un fournisseur en brouillon existe mais n'apparaît pas dans
          l'annuaire. « Publier » le rend visible, avec son nom et ses prix.
        </span>
        <button class="bouton fin" id="p-publier">Publier dans l'annuaire</button>
        <button class="bouton fin" id="p-depublier">Repasser en brouillon</button>
      </div>` : "",
    blocScore(p),
    blocIdentite(p),
    blocOffres(p),
    typeof blocVehicules === "function" ? blocVehicules(p) : "",
    blocPhotos(p),
    blocMessage(p),
    blocPublications(p),
    blocHistorique(p),
  ].join("");

  brancherPanneau();
  $("#p-reserver").disabled = gardees.filter((o) => o.materiau_slug).length === 0
    || !pousseeAutorisee();
}

function blocScore(p) {
  const details = p.detail_score || [];
  return `
  <div class="bloc">
    <h3>Pourquoi ce score</h3>
    <p class="bloc-aide">
      Le score répond à une seule question : <em>ce dépôt-là vaut-il un appel
      aujourd'hui&nbsp;?</em> Il n'a rien à voir avec la qualité du dépôt.
    </p>
    <div class="score-detail">
      ${details.map((d) => `
        <div class="score-ligne ${d.poste === "malus" ? "malus" : ""}">
          <span class="poste">${echapper(d.poste)}</span>
          <span class="jauge"><i style="width:${d.sur ? Math.max(0, d.points) / d.sur * 100 : 100}%"></i></span>
          <span class="raison">${d.points > 0 ? "+" : ""}${d.points} — ${echapper(d.raison)}</span>
        </div>`).join("")}
    </div>
  </div>`;
}

function blocIdentite(p) {
  return `
  <div class="bloc">
    <h3>Identité</h3>
    <p class="bloc-aide">
      Tout est corrigeable. Une valeur saisie ici fait autorité : la collecte
      suivante ne la remplacera pas.
    </p>
    <div class="champs">
      ${champ("nom", "Enseigne", p.nom)}
      ${champ("nature", "Ce qu'il est", p.nature || "depot", ["depot", "transporteur", "mixte"])}
      ${champ("metier", "Métier", p.metier, ["", "Dépôt", "Briqueterie", "Carrière", "Scierie", "Centrale à béton", "Transporteur"])}
      ${champ("telephone", "Téléphone", p.telephone)}
      ${champ("ville", "Ville", p.ville)}
      ${champ("quartier", "Quartier", p.quartier)}
      ${champ("adresse", "Adresse / repère", p.adresse)}
      ${champ("langue", "Langue du message", p.langue, ["fr", "mg"])}
      ${champ("rayon_km", "Rayon de livraison (km)", p.rayon_km)}
      ${champ("seuil_franco", "Franco à partir de", p.seuil_franco)}
    </div>
    <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap">
      <label class="case"><input type="checkbox" data-bool="whatsapp" ${p.whatsapp ? "checked" : ""}> WhatsApp</label>
      <label class="case"><input type="checkbox" data-bool="livre" ${p.livre ? "checked" : ""}> Livre</label>
      <label class="case"><input type="checkbox" data-bool="retrait_sur_place" ${p.retrait_sur_place ? "checked" : ""}> Retrait sur place</label>
    </div>
    ${p.note ? `<p class="bloc-aide" style="margin-top:10px">${echapper(p.note)}</p>` : ""}
  </div>`;
}

function champ(cle, libelle, valeur, options) {
  if (options) {
    return `<div><label>${libelle}</label>
      <select data-champ="${cle}">
        ${options.map((o) => `<option value="${echapper(o)}" ${o === (valeur || "") ? "selected" : ""}>${echapper(o || "—")}</option>`).join("")}
      </select></div>`;
  }
  return `<div><label>${libelle}</label>
    <input type="text" data-champ="${cle}" value="${echapper(valeur || "")}"></div>`;
}

/** Ce qui manque a une offre pour partir sur le site.
 *
 * Meme regle que `bot/tri.py` cote serveur, et il ne faut pas qu'elles
 * divergent : une reference du catalogue, un PRIX, une PHOTO designee. Les
 * trois, sinon le produit ne part pas. C'est ce qui evite de croire une fiche
 * prete parce qu'elle a des prix partout et pas une image. */
function manquesDeLOffre(offre, prospect) {
  if (offre.hors_catalogue) {
    return [{ texte: "hors catalogue", couleur: "gris" }];
  }
  const manques = [];
  if (!offre.materiau_slug) manques.push({ texte: "format à préciser", couleur: "jaune" });
  if (!offre.prix) manques.push({ texte: "prix à demander", couleur: "rouge" });
  const aUnePhoto = (prospect.photos || []).some(
    (f) => f.garder && String(f.offre_id) === String(offre.id));
  if (!aUnePhoto) manques.push({ texte: "photo à désigner", couleur: "bleu" });
  if (!manques.length) manques.push({ texte: "prêt", couleur: "vert" });
  return manques;
}

/** Les photos a choisir, SOUS le produit. On clique celle qui le montre.
 *
 * L'ordre n'est pas neutre : les photos de la MEME publication d'abord.
 * C'est la que se trouve la bonne — un depot photographie ce qu'il annonce
 * dans le meme post. Les autres suivent, derriere un depli, pour ne pas
 * poser 1 700 vignettes dans la page (48 produits x 35 photos chez un seul
 * depot).
 *
 * Une photo deja prise par un AUTRE produit reste cliquable mais se voit :
 * elle porte le nom de celui qui la tient. Rien n'interdit de la reprendre —
 * c'est parfois la meme image qui montre deux formats du meme bois — mais on
 * ne le fait plus sans le savoir. */
function bandePhotos(offre, prospect) {
  const toutes = (prospect.photos || []).filter((f) => f.garder);
  if (!toutes.length) return "";

  const memePost = toutes.filter((f) => f.publication_id === offre.publication_id);
  const autres = toutes.filter((f) => f.publication_id !== offre.publication_id);

  // Deuxieme cle de tri : la FAMILLE vue par le pre-tri (photos_familles.py).
  // Celles de la famille du produit d'abord, les non-classees au milieu, les
  // autres familles en queue. Le pre-tri propose, le clic humain dispose —
  // et tant que rien n'est classe (f.famille absent), l'ordre ne bouge pas.
  const rangFamille = (f) =>
    !f.famille || !offre.famille_slug ? 1 : (f.famille === offre.famille_slug ? 0 : 2);
  memePost.sort((a, b) => rangFamille(a) - rangFamille(b));
  autres.sort((a, b) => rangFamille(a) - rangFamille(b));
  const nomDe = (photoId) => {
    const autre = prospect.offres.find(
      (x) => String(x.id) !== String(offre.id)
        && toutes.some((f) => String(f.id) === String(photoId)
                             && String(f.offre_id) === String(x.id)));
    return autre ? (autre.materiau_nom || "un autre produit") : "";
  };

  const vignette = (f) => {
    const mienne = String(f.offre_id) === String(offre.id);
    const prise = !mienne && f.offre_id ? nomDe(f.id) : "";
    return `
    <button class="vignette ${mienne ? "choisie" : ""} ${prise ? "prise" : ""}"
            data-photo-pour="${offre.id}" data-photo-id="${f.id}"
            title="${mienne ? "Retirer cette photo du produit"
                            : prise ? "Déjà sur « " + echapper(prise) + " »"
                                    : "Cette photo montre ce produit"}">
      <img src="/photo/${f.publication_id}/${encodeURIComponent(f.fichier)}"
           alt="" loading="lazy">
    </button>`;
  };

  return `
  <div class="photos-offre">
    <span class="discret">Photo :</span>
    ${memePost.map(vignette).join("")}
    ${autres.length ? `
      <details class="autres-photos">
        <summary title="Les photos des autres publications de ce dépôt">
          + ${autres.length}</summary>
        <div class="bande">${autres.map(vignette).join("")}</div>
      </details>` : ""}
  </div>`;
}

function blocOffres(p) {
  const lignes = p.offres.map((o) => {
    /* 🔴 LE LIBELLE MONTRE LE NOM QUI PARTIRA SUR LE SITE.
     *
     * Il affichait « <type> — <libellé court> », soit « Brique pleine —
     * 6×11×22 », alors que la référence s'appelle « Brique repressée
     * 6x11x22 » et que c'est CE nom-là que le bot écrit dans `nom_affiche`.
     * On lisait donc « Brique pleine » ici et « Brique repressée » sur Akora,
     * et on pouvait croire que le site avait renommé l'article. Il n'y touche
     * pas : le bot est maître. C'était l'étiquette qui mentait, pas la
     * donnée. */
    const options = etat.arbre.flatMap((f) =>
      f.types.flatMap((t) => t.formats.map((m) => ({
        slug: m.slug,
        libelle: m.nom || `${t.nom} — ${m.libelle_court}`,
        groupe: t.nom,
        famille: f.nom,
      }))));
    return `
    <div class="offre" data-offre="${o.id}">
      <select data-offre-champ="materiau_slug">
        <option value="">— à préciser —</option>
        ${[...new Set(options.map((m) => m.groupe))].map((groupe) => `
          <optgroup label="${echapper(groupe)}">
            ${options.filter((m) => m.groupe === groupe).map((m) =>
              `<option value="${m.slug}" ${m.slug === o.materiau_slug ? "selected" : ""}>${echapper(m.libelle)}</option>`).join("")}
          </optgroup>`).join("")}
      </select>
      <input type="text" data-offre-champ="prix" value="${o.prix ?? ""}" placeholder="prix (Ar)" inputmode="numeric">
      <select data-offre-champ="unite">
        ${["", "piece", "sac", "m3", "tonne", "m2", "ml", "botte", "chargement", "palette"]
          .map((u) => `<option value="${u}" ${u === (o.unite || "") ? "selected" : ""}>${u || "—"}</option>`).join("")}
      </select>
      <button class="jeter" data-jeter="${o.id}" title="Retirer cette offre">×</button>
      <div class="brut">
        ${manquesDeLOffre(o, p).map((m) => `<span class="badge ${m.couleur}">${m.texte}</span> `).join("")}
        lu : « ${echapper(o.libelle_brut)} »
      </div>
      ${bandePhotos(o, p)}
    </div>`;
  }).join("");

  return `
  <div class="bloc">
    <h3>Produits relevés <span class="badge gris">${p.offres.length}</span></h3>
    <p class="bloc-aide">
      Le catalogue Akora est une <strong>liste fermée</strong> : un produit sans
      référence ne peut jamais être publié. Préciser un format ici, c'est ce qui
      fait passer une fiche de non publiable à publiable.
    </p>
    ${lignes || '<p class="bloc-aide">Aucun produit relevé.</p>'}
  </div>`;
}

/** Les photos, et CE QU'ELLES MONTRENT.
 *
 * 🔴 Une photo appartenait a une publication, jamais a un produit. Un post qui
 *    annonce cinq materiaux porte les photos des cinq — le 01/09/2026, la
 *    publication « Sable fin : 45 000 Ar le m3 » est partie dans le fil sous
 *    deux photos de gravillon et de moellon. Aucune machine ne distingue un
 *    madrier d'un chevron sur un tas de bois : c'est un tri humain, et il n'y
 *    avait nulle part ou le faire.
 *
 * Le nom et le prix s'affichent SOUS chaque image : c'est ce qui permet de
 * verifier d'un coup d'oeil, avant de transferer, que la photo dit la meme
 * chose que l'etiquette. */
function blocPhotos(p) {
  if (!p.photos.length) return "";
  const choix = (p.offres || []).filter((o) => o.garder);

  const attribuees = p.photos.filter((f) => f.garder && f.offre_id).length;
  const gardees = p.photos.filter((f) => f.garder).length;

  return `
  <div class="bloc">
    <h3>Photos <span class="badge gris">${p.photos.length}</span>
      <span class="badge ${attribuees === gardees && gardees ? "vert" : "jaune"}">
        ${attribuees}/${gardees} attribuée(s)</span></h3>
    <p class="bloc-aide">
      Cliquez une photo pour en faire la couverture ; le ✓ l'écarte. <strong>Le
      choix « quelle photo montre quel produit » se fait plus haut</strong>, sous
      chaque produit relevé — c'est là qu'on voit l'article et son image côte à
      côte. Une photo sans produit reste sur la fiche du dépôt, pas sur un article.
    </p>
    <div class="miniatures larges">
      ${p.photos.map((f) => {
        const o = choix.find((x) => String(x.id) === String(f.offre_id));
        const etiquette = o
          ? `<strong>${echapper(o.materiau_nom || "produit")}</strong>`
            + (o.prix ? ` · ${prixAr(o.prix)} ${UNITES[o.unite] || ""}` : " · sans prix")
          : '<span class="discret">aucun produit</span>';
        return `
        <div class="mini ${f.couverture ? "couverture" : ""} ${f.garder ? "" : "ecartee"}" data-photo="${f.id}">
          <img src="/photo/${f.publication_id}/${encodeURIComponent(f.fichier)}" alt="" loading="lazy">
          <button data-basculer="${f.id}" title="Garder ou écarter">${f.garder ? "✓" : "○"}</button>
          <div class="mini-etiquette">${etiquette}</div>
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

function blocMessage(p) {
  return `
  <div class="bloc" id="bloc-message">
    <h3>Message de prospection</h3>
    <p class="bloc-aide">
      Rédigé en ${p.langue === "mg" ? "malgache" : "français"} d'après ce qui a été
      relevé. Le bot n'envoie rien : il ouvre la conversation, vous appuyez.
    </p>
    <div class="filtres fin">
      <select id="modele-message">
        <option value="">Choisi automatiquement</option>
        <option value="premier">Premier contact</option>
        <option value="relance1">Relance</option>
        <option value="relance2">Dernière relance</option>
      </select>
      <button class="bouton fin" id="btn-recharger-message">Regénérer</button>
    </div>
    <div class="apercu-message" id="apercu-message">Chargement…</div>
    <div class="canaux" id="canaux-message"></div>
  </div>`;
}

function blocPublications(p) {
  if (!p.publications.length) return "";
  return `
  <div class="bloc">
    <h3>Publications d'origine <span class="badge gris">${p.publications.length}</span></h3>
    <p class="bloc-aide">
      La preuve. Un même dépôt poste souvent dans plusieurs groupes — c'est ce
      qui a permis de les regrouper en une seule fiche.
    </p>
    <ul class="frise">
      ${p.publications.map((v) => `
        <li>
          <span class="quand">${echapper(v.source_nom || "")} · ${echapper(v.publie_le || "")} · ${v.nb_offres} offre(s)</span>
          ${v.permalien ? `<a href="${echapper(v.permalien)}" target="_blank" rel="noopener">ouvrir sur Facebook</a> — ` : ""}
          ${echapper((v.texte || "").slice(0, 180))}${(v.texte || "").length > 180 ? "…" : ""}
        </li>`).join("")}
    </ul>
  </div>`;
}

function blocHistorique(p) {
  if (!p.evenements.length) return "";
  return `
  <div class="bloc">
    <h3>Suivi</h3>
    <ul class="frise">
      ${p.evenements.map((e) => `
        <li><span class="quand">${jour(e.ts)} ${heure(e.ts)} · ${echapper(e.genre)}</span>
        ${echapper(e.message)}</li>`).join("")}
    </ul>
  </div>`;
}

// ── Branchements du panneau ────────────────────────────────────────────────
function brancherPanneau() {
  const p = etat.ouvert;

  $$("[data-champ]").forEach((entree) => {
    entree.addEventListener("change", async () => {
      try {
        const maj = await api("/api/prospects/" + p.id, {
          method: "PATCH",
          corps: { champs: { [entree.dataset.champ]: entree.value.trim() } },
        });
        etat.ouvert = { ...etat.ouvert, ...maj };
        $("#p-titre").textContent = etat.ouvert.nom || "Fournisseur sans nom";
        chargerProspects();
      } catch (e) { toast(e.message, "erreur"); }
    });
  });

  $$("[data-bool]").forEach((case_) => {
    case_.addEventListener("change", async () => {
      await api("/api/prospects/" + p.id, {
        method: "PATCH",
        corps: { champs: { [case_.dataset.bool]: case_.checked ? 1 : 0 } },
      });
    });
  });

  $$("[data-offre-champ]").forEach((entree) => {
    entree.addEventListener("change", async () => {
      const oid = entree.closest("[data-offre]").dataset.offre;
      const champ = entree.dataset.offreChamp;
      let valeur = entree.value.trim();
      if (champ === "prix") valeur = valeur ? Number(valeur.replace(/\s/g, "")) : null;
      try {
        await api("/api/offres/" + oid, { method: "PATCH", corps: { champs: { [champ]: valeur } } });
        await ouvrirPanneau(p.id);
        chargerProspects();
      } catch (e) { toast(e.message, "erreur"); }
    });
  });

  $$("[data-jeter]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await api("/api/offres/" + bouton.dataset.jeter, { method: "DELETE" });
      await ouvrirPanneau(p.id);
    });
  });

  $$("[data-photo]").forEach((vignette) => {
    vignette.addEventListener("click", async (e) => {
      if (e.target.dataset.basculer) return;
      await api(`/api/prospects/${p.id}/couverture/${vignette.dataset.photo}`, { method: "POST" });
      await ouvrirPanneau(p.id);
      chargerProspects();
    });
  });
  $$("[data-basculer]").forEach((bouton) => {
    bouton.addEventListener("click", async (e) => {
      e.stopPropagation();
      const photo = p.photos.find((f) => String(f.id) === bouton.dataset.basculer);
      await api("/api/photos/" + bouton.dataset.basculer, {
        method: "PATCH", corps: { champs: { garder: photo.garder ? 0 : 1 } },
      });
      await ouvrirPanneau(p.id);
    });
  });

  // Choisir la photo d'un produit, depuis la ligne du produit. Recliquer la
  // meme la retire : c'est le geste inverse, au meme endroit.
  $$("[data-photo-pour]").forEach((bouton) => {
    bouton.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const photoId = bouton.dataset.photoId;
      const photo = (p.photos || []).find((f) => String(f.id) === String(photoId));
      const dejaSienne = photo
        && String(photo.offre_id) === String(bouton.dataset.photoPour);
      try {
        await api("/api/photos/" + photoId, {
          method: "PATCH",
          corps: { champs: { offre_id: dejaSienne ? null : Number(bouton.dataset.photoPour) } },
        });
        await ouvrirPanneau(p.id);
      } catch (err) {
        toast(err.message, "erreur");
      }
    });
  });

  // Les camions vivent dans modules.js — ils sont arrivés après les six vues
  // d'origine, et rien ne gagnait à les entasser ici.
  if (typeof brancherVehicules === "function") brancherVehicules(p.id);

  /* Le SECOND geste. La fiche du depot se remplit une fois — nom, contact,
     emplacement ; ses produits arrivent au fil des appels et des photos
     designees, et ce bouton les pousse a chaque fois. */
  surClic("#p-produits", async () => {
    let apercu;
    try {
      apercu = await api(`/api/prospects/${p.id}/inscription`);
    } catch (e) { return toast(e.message, "erreur"); }

    if (!apercu.produits.length) {
      return toast(
        "Aucun produit complet. Un produit ne part qu'avec sa référence, "
        + "son prix ET une photo désignée.", "erreur");
    }
    const lignes = [
      `Envoyer les produits de « ${apercu.nom} » sur akora.fonenako.mg ?`,
      "",
      `${apercu.produits.length} produit(s) complet(s) :`,
      ...apercu.produits.slice(0, 10).map(
        (x) => `• ${x.nom} — ${prixAr(x.prix)} ${UNITES[x.unite] || ""}`),
    ];
    if (apercu.produits_deja.length) {
      lignes.push("", `${apercu.produits_deja.length} déjà en ligne — non réécrit(s).`);
    }
    if ((apercu.prix_changes || []).length) {
      lignes.push("", "Prix DIFFÉRENTS de ceux en ligne :");
      apercu.prix_changes.forEach((x) => lignes.push(
        `• ${x.nom} : en ligne ${prixAr(x.en_ligne)} → relevé ${prixAr(x.releve)}`));
    }
    if (!confirm(lignes.join("\n"))) return;

    let actualiser = false;
    if ((apercu.prix_changes || []).length) {
      actualiser = confirm(
        "Remplacer les prix en ligne par ceux qui viennent d'être relevés ?"
        + "\n\nAnnuler garde les prix actuels du site.");
    }
    try {
      const r = await api(
        `/api/prospects/${p.id}/produits?actualiser_prix=${actualiser}`,
        { method: "POST" });
      toast(`${r.produits} produit(s) envoyé(s)`
        + (r.prix_actualises ? `, ${r.prix_actualises} prix mis à jour` : "")
        + ".", "succes");
      await ouvrirPanneau(p.id);
    } catch (e) {
      toast(e.message, "erreur");
    }
  });

  // Publier, c'est rendre visible le nom d'un dépôt et des prix relevés sur
  // Facebook. Une confirmation, et elle dit exactement ça.
  surClic("#p-publier", async () => {
    const accord = confirm([
      `Publier « ${p.nom} » dans l'annuaire public d'Akora ?`,
      "",
      "Son nom, son quartier et ses prix deviennent visibles de tous les",
      "visiteurs de akora.fonenako.mg — alors qu'il ne l'a pas demandé.",
      "",
      "Vous pouvez le repasser en brouillon à tout moment.",
    ].join("\n"));
    if (!accord) return;
    try {
      await api(`/api/prospects/${p.id}/publier`, { method: "POST" });
      toast("Fiche publiée dans l'annuaire.", "succes");
      await ouvrirPanneau(p.id);
    } catch (e) { toast(e.message, "erreur"); }
  });
  surClic("#p-depublier", async () => {
    try {
      await api(`/api/prospects/${p.id}/depublier`, { method: "POST" });
      toast("Fiche retirée de l'annuaire.");
      await ouvrirPanneau(p.id);
    } catch (e) { toast(e.message, "erreur"); }
  });

  $("#btn-recharger-message").onclick = () => chargerMessage(p.id, $("#modele-message").value);
  $("#modele-message").onchange = () => chargerMessage(p.id, $("#modele-message").value);
  chargerMessage(p.id, "");
}

async function chargerMessage(pid, modele) {
  const zone = $("#apercu-message");
  if (!zone) return;
  try {
    const m = await api(`/api/prospects/${pid}/message?modele=${encodeURIComponent(modele || "")}`);
    zone.textContent = m.texte;
    $("#canaux-message").innerHTML = [
      `<button class="bouton fin" id="btn-copier">Copier le texte</button>`,
      ...m.canaux.map((c) =>
        `<a class="bouton fin ${c.canal === "whatsapp" ? "principal" : ""}"
            href="${c.url}" target="_blank" rel="noopener" data-canal="${c.canal}">
           ${c.libelle}${c.pre_rempli ? "" : " (texte à coller)"}
         </a>`),
      `<button class="bouton fin" id="btn-marquer-contacte">Marquer « contacté »</button>`,
    ].join("");

    $("#btn-copier").onclick = async () => {
      await navigator.clipboard.writeText(m.texte);
      toast("Message copié.", "succes");
    };
    $("#btn-marquer-contacte").onclick = async () => {
      await api(`/api/prospects/${pid}/contacte`, {
        method: "POST", corps: { canal: "manuel" },
      });
      toast("Contact enregistré.", "succes");
      await ouvrirPanneau(pid);
      chargerProspects();
    };
    // Ouvrir WhatsApp, c'est envoyer : on enregistre le contact au clic, sinon
    // le suivi ment dès le troisième appel de la matinée.
    $$("[data-canal]").forEach((lien) => {
      lien.addEventListener("click", async () => {
        if (lien.dataset.canal === "appel") return;
        await api(`/api/prospects/${pid}/contacte`, {
          method: "POST", corps: { canal: lien.dataset.canal },
        });
        setTimeout(() => { ouvrirPanneau(pid); chargerProspects(); }, 600);
      });
    });
  } catch (e) {
    zone.textContent = "Message indisponible : " + e.message;
  }
}

// ── Boutons du pied du panneau ─────────────────────────────────────────────
async function changerStatut(statut, note = "") {
  const p = etat.ouvert;
  if (!p) return;
  try {
    await api(`/api/prospects/${p.id}/statut`, { method: "POST", corps: { statut, note } });
    toast(`Passé en « ${LIBELLES_STATUT[statut] || statut} ».`, "succes");
    fermerPanneau();
    chargerProspects();
  } catch (e) { toast(e.message, "erreur"); }
}
$("#p-valider").onclick = () => changerStatut("valide");
$("#p-rejeter").onclick = () => changerStatut("rejete");
$("#p-refus").onclick = () => {
  const motif = prompt(
    "Ce dépôt ne veut pas être contacté.\n\n" +
    "Le refus est DÉFINITIF : son numéro entre en liste rouge, sa fiche est " +
    "retirée du site, et une collecte future ne le fera pas réapparaître.\n\n" +
    "Motif (facultatif) :"
  );
  if (motif === null) return;
  changerStatut("refuse", motif);
};
$("#p-reserver").onclick = async () => {
  const p = etat.ouvert;
  try {
    await api(`/api/prospects/${p.id}/reserver`, { method: "POST" });
    toast("Réservation lancée — les photos partent d'abord.");
  } catch (e) { toast(e.message, "erreur"); }
};

/** Inscrit ce fournisseur sur le site, après lui avoir montré ce qui partira.
 *
 * L'aperçu n'est pas une politesse : il dit combien de produits ont un prix,
 * lesquels n'en ont pas, et lesquels attendent encore un format. C'est
 * exactement ce qui décide si la fiche vaut quelque chose une fois en ligne. */
surClic("#p-inscrire", async () => {
  const p = etat.ouvert;
  if (!p) return;
  let apercu;
  try {
    apercu = await api(`/api/prospects/${p.id}/inscription`);
  } catch (e) { return toast(e.message, "erreur"); }

  if (apercu.manque.length) {
    return toast("Il manque " + apercu.manque.join(", ") + ".", "erreur");
  }

  // Ce que le site porte DEJA. Deux cas s'arretent ici, et c'est le but :
  // un depot qui tient sa propre fiche ne se touche pas, et un depot deja
  // complet ne merite pas un clic.
  if (apercu.sur_le_site && !apercu.fiche_a_nous) {
    return toast(
      `« ${apercu.nom} » est deja sur Akora et tient SA fiche `
      + `(${apercu.raison_rapprochement}). Rien ne sera ecrit.`, "erreur");
  }
  if (apercu.rien_a_faire) {
    return toast(
      `« ${apercu.nom} » est deja sur Akora avec ses `
      + `${apercu.produits_deja.length} produit(s), aux memes prix : rien a faire.`);
  }

  const lignes = [
    apercu.deja_inscrit
      ? `Mettre à jour « ${apercu.nom} » sur akora.fonenako.mg ?`
      : `Inscrire « ${apercu.nom} » sur akora.fonenako.mg ?`,
    "",
    apercu.sur_le_site
      ? `Fiche deja sur le site (${apercu.raison_rapprochement}), `
        + `${apercu.produits_deja.length} produit(s) en place — on ne recree rien.`
      : "Nouvelle fiche.",
    "",
    apercu.sur_le_site
      ? `${apercu.produits_a_ajouter.length} produit(s) seront AJOUTES :`
      : `${apercu.produits.length} produit(s) partiront :`,
    ...apercu.produits.slice(0, 8).map(
      (x) => `• ${x.nom} — ${prixAr(x.prix)} ${UNITES[x.unite] || ""}`),
  ];
  if (apercu.produits.length > 8) {
    lignes.push(`• … et ${apercu.produits.length - 8} autre(s)`);
  }
  if (apercu.sans_prix.length) {
    lignes.push("", `Écartés faute de prix : ${apercu.sans_prix.join(", ")}`);
  }
  if (apercu.ambigus.length) {
    lignes.push(`Format encore à préciser : ${apercu.ambigus.length} offre(s)`);
  }
  if (apercu.vehicules) lignes.push(`${apercu.vehicules} véhicule(s) de livraison`);

  // Un prix qui a bouge depuis la derniere fois. Ce n'est PAS automatique :
  // ce que le bot vient de lire n'est pas forcement plus recent que ce qui
  // est en ligne — la publication importee le 01/09/2026 datait du 31 mai.
  if ((apercu.prix_changes || []).length) {
    lignes.push("", "Prix DIFFERENTS de ceux en ligne :");
    apercu.prix_changes.forEach((x) => lignes.push(
      `• ${x.nom} : en ligne ${prixAr(x.en_ligne)} → relevé ${prixAr(x.releve)}`));
    lignes.push("(vous choisirez juste après s'il faut les remplacer)");
  }
  lignes.push("", etat.config.inscrire_en_actif
    ? "La fiche sera VISIBLE tout de suite dans l'annuaire, et son stock"
      + " sera publie dans le fil au nom du depot."
    : "La fiche est créée EN BROUILLON : elle n'apparaîtra dans"
      + " l'annuaire qu'après un clic sur « Publier ».");

  if (!confirm(lignes.join("\n"))) return;
  try {
    let actualiser = false;
    if ((apercu.prix_changes || []).length) {
      actualiser = confirm(
        `Remplacer ${apercu.prix_changes.length} prix en ligne par ceux qui `
        + "viennent d'être relevés ?\n\n"
        + "Annuler garde les prix actuels du site : une publication ancienne "
        + "peut très bien être moins à jour que ce qui est affiché.");
    }
    const r = await api(
      `/api/prospects/${p.id}/inscrire?actualiser_prix=${actualiser}`,
      { method: "POST" });
    toast(r.action === "deja_au_depot"
      ? `« ${apercu.nom} » tient sa propre fiche : rien n'a ete ecrit.`
      : `${r.action === "adopte" ? "Fiche reprise" : "Fiche creee"} en ${r.statut}`
        + ` — ${r.produits} produit(s) ajoute(s)`
        + (r.prix_actualises ? `, ${r.prix_actualises} prix mis a jour` : "")
        + (r.produits_deja ? `, ${r.produits_deja} deja present(s).` : "."),
      "succes");
    await ouvrirPanneau(p.id);
    chargerProspects();
  } catch (e) { toast(e.message, "erreur"); }
});

// ── Vue Prospection ────────────────────────────────────────────────────────
async function chargerFile() {
  let file;
  try { file = await api("/api/file"); }
  catch (e) { return toast(e.message, "erreur"); }

  const piles = [
    ["À réserver", file.a_reserver,
     "Fiches validées : il ne leur manque que d'être écrites sur le site."],
    ["À contacter", file.a_contacter,
     "Fiche réservée, jamais contacté. Le meilleur score d'abord."],
    ["À relancer", file.a_relancer,
     "Contactés, sans réponse depuis le délai réglé."],
  ];
  $("#piles").innerHTML = piles.map(([titre, liste, aide]) => `
    <div class="pile">
      <h3>${titre} <span class="badge gris">${liste.length}</span></h3>
      <p class="aide">${aide}</p>
      <div class="pile-liste">
        ${liste.length ? liste.map((p) => `
          <button class="pile-ligne" data-id="${p.id}">
            <span class="n">${p.score}</span>
            <span class="c">
              <strong>${echapper(p.nom || "Sans nom")}</strong>
              <small>${echapper(p.quartier || p.ville || "lieu inconnu")} ·
                     ${p.nb_offres ?? "?"} produit(s) ·
                     ${echapper(p.telephone || "pas de téléphone")}</small>
            </span>
          </button>`).join("")
          : '<p class="aide">Rien pour l\'instant.</p>'}
      </div>
    </div>`).join("");

  $$("#piles .pile-ligne").forEach((ligne) => {
    ligne.addEventListener("click", () => ouvrirPanneau(ligne.dataset.id));
  });
}

// ── Vue Marché ─────────────────────────────────────────────────────────────
async function chargerMarche() {
  const famille = $("#marche-famille").value;
  const ville = $("#marche-ville").value;
  try {
    const lignes = await api(
      `/api/marche?famille=${encodeURIComponent(famille)}&ville=${encodeURIComponent(ville)}`);
    $("#table-marche tbody").innerHTML = lignes.length ? lignes.map((l) => `
      <tr>
        <td>
          ${echapper(l.materiau_nom)}
          ${l.fiable ? "" : '<span class="badge pointille">peu sûr</span>'}
          <br><small style="color:var(--beton-doux)">${echapper(l.type_nom || "")} · ${l.nb_releves} relevé(s)</small>
        </td>
        <td class="nombre">${l.nb_fournisseurs}</td>
        <td class="nombre">${prixAr(l.min)}</td>
        <td class="nombre"><strong>${prixAr(l.median)}</strong><br>
            <small style="color:var(--beton-doux)">${UNITES[l.unite] || ""}</small></td>
        <td class="nombre">${prixAr(l.max)}</td>
        <td class="nombre">${l.ecart_pct}${ESPACE_FINE}%</td>
        <td><small>${echapper(l.villes.join(", ") || "—")}</small></td>
      </tr>`).join("")
      : '<tr><td colspan="7" class="vide">Aucun prix relevé pour l\'instant.</td></tr>';

    // Les villes du sélecteur viennent des relevés eux-mêmes : proposer une
    // ville sans aucun relevé ne mènerait qu'à un tableau vide.
    if (!ville && !famille) {
      const villes = [...new Set(lignes.flatMap((l) => l.villes))].sort();
      const options = villes
        .map((v) => `<option value="${echapper(v)}">${echapper(v)}</option>`).join("");
      $("#marche-ville").innerHTML =
        '<option value="">Toutes les villes</option>' + options;
      // Le bulletin se limite souvent à une ville : les prix d'Antananarivo et
      // ceux de Toamasina dans la même publication ne comparent rien.
      $("#bulletin-ville").innerHTML =
        '<option value="">Tout Madagascar</option>' + options;
    }
  } catch (e) { toast(e.message, "erreur"); }

  try {
    const couv = await api("/api/couverture");
    const entete = `<tr><th>Ville</th>${couv.familles.map((f) =>
      `<th style="text-align:center;font-size:11px">${echapper(f.nom)}</th>`).join("")}</tr>`;
    const corps = couv.villes.map((ville) => {
      const cases = couv.familles.map((f) => {
        const c = couv.cases.find((x) => x.ville === ville && x.famille_slug === f.slug)
          || { prospects: 0, en_ligne: false, trou: true };
        const classe = c.en_ligne ? "en-ligne" : c.prospects ? "prospects" : "trou";
        const titre = c.en_ligne ? "Déjà un fournisseur en ligne"
          : c.prospects ? `${c.prospects} prospect(s) à appeler`
          : "Aucun fournisseur, aucun prospect — cliquez pour chercher";
        return `<td><button class="case-couv ${classe}" title="${titre}"
                  data-recherche="${echapper(f.nom.split(" ")[0] + " " + ville)}">
                  ${c.en_ligne ? "✓" : c.prospects || "—"}</button></td>`;
      }).join("");
      return `<tr><td>${echapper(ville)}</td>${cases}</tr>`;
    }).join("");
    $("#table-couverture tbody").innerHTML = entete + (corps ||
      '<tr><td class="vide">Rien à croiser tant qu\'aucun prospect n\'est collecté.</td></tr>');

    $$("#table-couverture .case-couv.trou").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        try {
          await api("/api/sources", { method: "POST", corps: { url: bouton.dataset.recherche } });
          toast(`Recherche « ${bouton.dataset.recherche} » ajoutée aux sources.`, "succes");
        } catch (e) { toast(e.message, "erreur"); }
      });
    });
  } catch (e) { /* le croisement avec l'annuaire exige le réseau : pas bloquant */ }

  try {
    const absents = await api("/api/materiaux-absents");
    $("#table-absents tbody").innerHTML = absents.length ? absents.map((a) => `
      <tr><td>${echapper(a.libelle)}</td><td class="nombre">${a.occurrences}</td>
          <td><small>${echapper((a.exemple || "").slice(0, 90))}</small></td></tr>`).join("")
      : '<tr><td colspan="3" class="vide">Rien pour l\'instant.</td></tr>';
  } catch { /* table locale : jamais bloquant */ }
}
$("#marche-famille").onchange = chargerMarche;
$("#marche-ville").onchange = chargerMarche;

// ── Vue Sources ────────────────────────────────────────────────────────────
const LIBELLES_GENRE = {
  groupe: "Groupe", page: "Page", recherche: "Recherche", fil: "Fil",
};

async function chargerSources() {
  // Le RENDEMENT, pas la liste brute : une source se juge sur ce qu'elle a
  // donné, pas sur le fait qu'elle existe. Tout est recalculé côté serveur à
  // chaque affichage, jamais lu dans un compteur qui dérive.
  etat.sources = await api("/api/sources/rendement");
  $("#table-sources tbody").innerHTML = etat.sources.map((s) => `
    <tr data-source="${s.id}">
      <td class="nombre">
        <span class="note-source ${s.niveau}">${s.note === null ? "—" : s.note}</span>
      </td>
      <td>
        <input type="text" data-source-champ="nom" value="${echapper(s.nom)}">
        <a href="${echapper(s.url)}" target="_blank" rel="noopener"
           title="${echapper(s.url)}"><small>ouvrir</small></a>
      </td>
      <td><span class="badge ${s.genre === "recherche" ? "jaune" : s.genre === "fil" ? "bleu" : "gris"}">${LIBELLES_GENRE[s.genre] || s.genre}</span></td>
      <td><small>${echapper(s.verdict || "")}</small></td>
      <td class="nombre">${s.fournisseurs ?? 0}</td>
      <td class="nombre">${s.offres_avec_prix ?? 0}</td>
      <td><small>${jour(s.derniere_collecte)}</small></td>
      <td><input type="checkbox" data-source-actif ${s.actif ? "checked" : ""}></td>
      <td><button class="lien-discret" data-supprimer-source>Supprimer</button></td>
    </tr>`).join("") || '<tr><td colspan="9" class="vide">Aucune source.</td></tr>';

  $$("#table-sources [data-source-champ]").forEach((entree) => {
    entree.addEventListener("change", () => {
      const sid = entree.closest("[data-source]").dataset.source;
      api(`/api/sources/${sid}`, {
        method: "PATCH", corps: { champs: { nom: entree.value.trim() } },
      });
    });
  });
  $$("#table-sources [data-source-actif]").forEach((case_) => {
    case_.addEventListener("change", () => {
      const sid = case_.closest("[data-source]").dataset.source;
      api(`/api/sources/${sid}`, {
        method: "PATCH", corps: { champs: { actif: case_.checked ? 1 : 0 } },
      });
    });
  });
  $$("#table-sources [data-supprimer-source]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const sid = bouton.closest("[data-source]").dataset.source;
      if (!confirm("Supprimer cette source ? Les fournisseurs déjà trouvés restent.")) return;
      await api(`/api/sources/${sid}`, { method: "DELETE" });
      chargerSources();
    });
  });

  // Le sélecteur de la vue Fournisseurs suit la même liste.
  $("#filtre-source").innerHTML = '<option value="0">Toutes les sources</option>'
    + etat.sources.map((s) => `<option value="${s.id}">${echapper(s.nom)}</option>`).join("");

  rendreSuggestions();
}

$("#form-source").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/sources", {
      method: "POST",
      corps: { nom: $("#source-nom").value.trim(), url: $("#source-url").value.trim() },
    });
    $("#source-nom").value = "";
    $("#source-url").value = "";
    chargerSources();
    toast("Source ajoutée.", "succes");
  } catch (e) { toast(e.message, "erreur"); }
});

surClic("#btn-couper-muettes", async () => {
  const muettes = etat.sources.filter((s) => s.actif && s.note !== null && s.note < 20);
  if (!muettes.length) return toast("Aucune source muette a couper.");
  const lignes = muettes.slice(0, 8).map((s) => `• ${s.nom} — ${s.verdict}`);
  if (muettes.length > 8) lignes.push(`… et ${muettes.length - 8} autre(s)`);
  const accord = confirm(
    [
      `Désactiver ${muettes.length} source(s) qui n'ont rien donné ?`,
      "",
      ...lignes,
      "",
      "Elles sont DÉSACTIVÉES, pas supprimées : un groupe peut se réveiller,",
      "et une source supprimée emporte l'historique qui explique pourquoi on",
      "l'avait ajoutée.",
    ].join("\n")
  );
  if (!accord) return;
  try {
    const r = await api("/api/sources/couper-les-muettes", {
      method: "POST", corps: { seuil: 20 },
    });
    toast(`${r.coupees} source(s) desactivee(s).`, "succes");
    chargerSources();
  } catch (e) { toast(e.message, "erreur"); }
});

const VILLES_SUGGEREES = ["Antananarivo", "Toamasina", "Antsirabe", "Mahajanga", "Fianarantsoa"];

function rendreSuggestions() {
  // Les suggestions sortent du CATALOGUE, pas d'une liste écrite en dur :
  // le jour où une famille est ajoutée côté site, elle apparaît ici toute seule.
  const types = etat.arbre.flatMap((f) => f.types.map((t) => t.nom)).slice(0, 8);
  const deja = new Set(etat.sources.map((s) => (s.requete || "").toLowerCase()));
  const paires = [];
  for (const ville of VILLES_SUGGEREES.slice(0, 2)) {
    for (const type of types) {
      const requete = `${type} ${ville}`;
      if (!deja.has(requete.toLowerCase())) paires.push(requete);
    }
  }
  $("#suggestions").innerHTML = paires.slice(0, 16)
    .map((r) => `<button class="puce" data-suggestion="${echapper(r)}">+ ${echapper(r)}</button>`)
    .join("") || '<p class="aide">Toutes les recherches suggérées sont déjà dans la liste.</p>';

  $$("[data-suggestion]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      try {
        await api("/api/sources", { method: "POST", corps: { url: bouton.dataset.suggestion } });
        chargerSources();
        toast("Recherche ajoutée.", "succes");
      } catch (e) { toast(e.message, "erreur"); }
    });
  });
}

// ── Vue Réglages ───────────────────────────────────────────────────────────
const REGLAGES_VISIBLES = [
  ["posts_max_par_source", "Publications max par source", "number"],
  ["scrolls_max_par_source", "Défilements max par source", "number"],
  ["jours_max", "Ignorer les publications de plus de (jours)", "number"],
  ["annee_minimum", "Ne rien collecter d’avant l’année", "number"],
  ["travailleurs", "Fils de traitement (hors navigateur)", "number"],
  ["photos_max_par_publication", "Photos max par publication", "number"],
  ["delai_relance_jours", "Relancer après (jours)", "number"],
  ["relances_max", "Relances maximum", "number"],
  ["navigateur_visible", "Navigateur visible", "bool"],
  ["prix_obligatoire", "Exiger un prix affiché", "bool"],
  ["garder_les_incomplets", "Garder les fiches incomplètes", "bool"],
];

async function chargerReglages() {
  etat.config = await api("/api/config");
  const c = etat.config;

  $("#heures-collecte").value = (c.heures_collecte || []).join(", ");
  $("#objectif-jour").value = c.objectif_par_jour ?? 0;
  $$("[data-cfg]").forEach((entree) => {
    if (entree.type === "checkbox") entree.checked = !!c[entree.dataset.cfg];
    else entree.value = c[entree.dataset.cfg] ?? "";
  });

  $("#grille-reglages").innerHTML = REGLAGES_VISIBLES.map(([cle, libelle, genre]) =>
    genre === "bool"
      ? `<div class="reglage"><label>${libelle}</label>
           <label class="case"><input type="checkbox" data-reglage="${cle}" ${c[cle] ? "checked" : ""}> activé</label></div>`
      : `<div class="reglage"><label for="r-${cle}">${libelle}</label>
           <input type="number" id="r-${cle}" data-reglage="${cle}" value="${c[cle] ?? ""}"></div>`
  ).join("");

  const catalogue = etat.arbre;
  const formats = catalogue.reduce((n, f) =>
    n + f.types.reduce((m, t) => m + t.formats.length, 0), 0);
  $("#etat-catalogue").innerHTML = catalogue.length
    ? `<span><strong>${catalogue.length}</strong> familles ·
       <strong>${catalogue.reduce((n, f) => n + f.types.length, 0)}</strong> types ·
       <strong>${formats}</strong> formats</span>`
    : "<span>Catalogue non chargé.</span>";

  try {
    const rouge = await api("/api/liste-rouge");
    $("#table-rouge tbody").innerHTML = rouge.length ? rouge.map((r) => `
      <tr><td>${echapper(r.nom || "—")}</td><td><code>${echapper(r.cle)}</code></td>
          <td>${echapper(r.motif || "—")}</td><td><small>${jour(r.ts)}</small></td></tr>`).join("")
      : '<tr><td colspan="4" class="vide">Personne — tant mieux.</td></tr>';
  } catch { /* table locale */ }
}

$("#btn-reglages").onclick = async () => {
  const modifs = {};
  $$("[data-reglage]").forEach((entree) => {
    modifs[entree.dataset.reglage] = entree.type === "checkbox"
      ? entree.checked : Number(entree.value);
  });
  $$("[data-cfg]").forEach((entree) => {
    if (entree.dataset.cfg === "collecte_auto") return;   // géré par le tableau de bord
    modifs[entree.dataset.cfg] = entree.type === "checkbox" ? entree.checked : entree.value;
  });
  try {
    etat.config = await api("/api/config", { method: "POST", corps: { config: modifs } });
    toast("Réglages enregistrés.", "succes");
  } catch (e) { toast(e.message, "erreur"); }
};

async function synchroniserReferentiel() {
  toast("Synchronisation du catalogue…");
  try {
    const r = await api("/api/referentiel/synchroniser", { method: "POST" });
    await chargerArbre();
    toast(`Catalogue à jour : ${r.familles} familles, ${r.types} types, ${r.materiaux} formats.`, "succes");
  } catch (e) { toast(e.message, "erreur"); }
}
$("#btn-sync-ref").onclick = synchroniserReferentiel;

$("#btn-test-akora").onclick = async () => {
  toast("Test de la connexion Akora…");
  try {
    const r = await api("/api/akora/test", { method: "POST" });
    toast(`Akora répond : ${r.materiaux} formats au catalogue, `
        + `${r.fournisseurs_inscrits} fournisseur(s) déjà inscrit(s).`, "succes");
  } catch (e) { toast(e.message, "erreur"); }
};

$("#btn-test-llm").onclick = async () => {
  toast("Test de la relecture…");
  try {
    const r = await api("/api/llm/test", { method: "POST" });
    toast(`${r.modele} répond : ${r.produits_lus} produit(s) lus, `
        + `confiance ${r.confiance ?? "?"}.`, "succes");
  } catch (e) { toast(e.message, "erreur"); }
};

// ── Démarrage ──────────────────────────────────────────────────────────────
async function chargerArbre() {
  try {
    etat.arbre = await api("/api/referentiel");
  } catch {
    etat.arbre = [];      // catalogue absent : l'interface le dit déjà en bannière
  }
  const options = '<option value="">Toutes les familles</option>'
    + etat.arbre.map((f) => `<option value="${f.slug}">${echapper(f.nom)}</option>`).join("");
  $("#filtre-famille").innerHTML = options;
  $("#marche-famille").innerHTML = options;
}

(async function demarrer() {
  await chargerArbre();
  await chargerSources();
  // La config est lue AVANT le premier /api/etat : les pastilles du tableau
  // de bord s'en servent, et elles s'afficheraient toutes éteintes sinon.
  etat.config = await api("/api/config");
  // Les réglages sont chargés dès le départ, pas seulement à l'ouverture de
  // leur onglet : la carte « Collectes automatiques » du tableau de bord lit
  // les mêmes champs, et elle restait vide — heures en placeholder, objectif
  // blanc, case décochée — alors que la configuration disait le contraire.
  await chargerReglages();
  await rafraichirEtat();
  setInterval(rafraichirEtat, 2000);
  let derniereVue = "";
  try { derniereVue = sessionStorage.getItem("akora-vue") || ""; } catch { /* ignoré */ }
  if (derniereVue && derniereVue !== "bord") ouvrirVue(derniereVue);
})();

/* ------------------------------------------------------------------------ *
 *  Nouvelles sources : le bot cherche, vous tranchez.
 * ------------------------------------------------------------------------ */
const cochesCandidats = new Set();
let origineCandidats = "";

async function chargerCandidats() {
  let d;
  try {
    d = await api(`/api/candidats?origine=${origineCandidats}`);
  } catch (e) {
    toast(e.message, "erreur");
    return;
  }
  const liste = $("#liste-candidats");
  const vide = $("#candidats-vide");
  $("#nb-requetes").textContent = (d.requetes || []).length;
  if (!$("#requetes-prospection").value) {
    $("#requetes-prospection").value = (d.requetes || []).join("\n");
  }

  const sous = d.sous_le_seuil
    ? ` · ${d.sous_le_seuil} écarté(s) sous ${d.seuil}/100`
    : "";
  $("#etat-candidats").textContent =
    `${d.candidats.length} en attente${sous} · ${d.compteurs.adopte || 0} adoptée(s)`;

  vide.hidden = d.candidats.length > 0;
  liste.innerHTML = d.candidats
    .map((c) => {
      const eff = c.effectif
        ? `${c.effectif.toLocaleString("fr-FR")} ${c.genre === "page" ? "abonnés" : "membres"}`
        : c.origine === "fil"
        ? ""
        : "effectif inconnu";
      const ryt = c.rythme ? `${c.rythme} pub./jour` : "";
      // Une source repérée sur le fil se juge sur ce qu'elle a DONNÉ.
      const vu = c.vues
        ? `<strong>${c.retenues}/${c.vues}</strong> utiles` +
          (c.publiees ? ` · <strong>${c.publiees}</strong> publiée(s)` : "")
        : "";
      const alertes = (c.alertes || [])
        .map((a) => `<li>${echapper(a)}</li>`)
        .join("");
      const barres = (c.details || [])
        .map(
          (x) => `<span class="mini-brique" title="${echapper(x.motif)}">
              ${echapper(x.cle)} <i style="width:${(x.points / x.sur) * 100}%"></i>
            </span>`
        )
        .join("");
      return `<article class="candidat ${c.niveau}">
        <label class="candidat-choix">
          <input type="checkbox" data-cand="${c.cle}" ${
            cochesCandidats.has(c.cle) ? "checked" : ""
          }>
          <span class="note-mini ${c.note >= 78 ? "bon" : ""}">${c.note}</span>
        </label>
        <div class="candidat-corps">
          <h3>${echapper(c.nom)}
            <span class="badge ${c.genre}">${c.genre}</span>
            ${c.origine === "fil" ? '<span class="badge fil">vu sur le fil</span>' : ""}
            ${c.prive ? '<span class="badge manque">privé</span>' : ""}
          </h3>
          <p class="candidat-chiffres">
            ${vu ? vu + (eff || ryt ? " · " : "") : ""}
            ${eff ? `<strong>${eff}</strong>` : ""}${ryt ? " · " + ryt : ""}
            ${c.categorie ? " · " + echapper(c.categorie) : ""}
            ${c.lieu ? " · " + echapper(c.lieu) : ""}
          </p>
          <div class="candidat-barres">${barres}</div>
          ${alertes ? `<ul class="candidat-alertes">${alertes}</ul>` : ""}
          <p class="discret">${
            c.origine === "fil"
              ? "Repéré sur votre fil d'actualité"
              : `Trouvé par « ${echapper(c.requete || "")} »`
          } —
            <a href="${c.url}" target="_blank" rel="noopener">${
              c.genre === "site" ? "voir le site" : "voir sur Facebook"
            }</a></p>
        </div>
        <div class="candidat-actions">
          <button class="bouton" data-decider="ecarte" data-cle="${c.cle}">Écarter</button>
          <button class="bouton principal" data-decider="adopte" data-cle="${c.cle}">Adopter</button>
        </div>
      </article>`;
    })
    .join("");

  liste.querySelectorAll("[data-cand]").forEach((c) =>
    c.addEventListener("change", () => {
      c.checked ? cochesCandidats.add(c.dataset.cand) : cochesCandidats.delete(c.dataset.cand);
      majChoixCandidats();
    })
  );
  liste.querySelectorAll("[data-decider]").forEach((b) =>
    b.addEventListener("click", () => trancher(b.dataset.cle, b.dataset.decider))
  );
  majChoixCandidats();
}

function majChoixCandidats() {
  $("#cand-compte").textContent = `${cochesCandidats.size} sélectionné(s)`;
}

async function trancher(cle, decision) {
  try {
    await api(`/api/candidats/${encodeURIComponent(cle)}/${decision}`, { method: "POST" });
    cochesCandidats.delete(cle);
    toast(decision === "adopte" ? "Source ajoutée." : "Candidat écarté.");
  } catch (e) {
    toast(e.message, "erreur");
  }
  chargerCandidats();
  rafraichirEtat();
}

async function trancherLot(decision) {
  if (!cochesCandidats.size) return toast("Rien de coché.", "erreur");
  const n = cochesCandidats.size;
  if (
    decision === "adopte" &&
    !confirm(`Ajouter ${n} source(s) ? Chaque source ajoute du temps à chaque collecte.`)
  )
    return;
  try {
    await api(`/api/candidats/lot/${decision}`, {
      method: "POST",
      body: JSON.stringify({ ids: [...cochesCandidats] }),
    });
    cochesCandidats.clear();
    toast(`${n} source(s) ${decision === "adopte" ? "adoptée(s)" : "écartée(s)"}.`);
  } catch (e) {
    toast(e.message, "erreur");
  }
  chargerCandidats();
}

$$(".filtres-candidats .puce").forEach((b) =>
  b.addEventListener("click", () => {
    origineCandidats = b.dataset.origine;
    $$(".filtres-candidats .puce").forEach((p) =>
      p.classList.toggle("actif", p === b)
    );
    chargerCandidats();
  })
);

$("#btn-cand-adopter").addEventListener("click", () => trancherLot("adopte"));
$("#btn-cand-ecarter").addEventListener("click", () => trancherLot("ecarte"));
$("#cand-tout").addEventListener("click", (e) => {
  e.preventDefault();
  $$("#liste-candidats [data-cand]").forEach((c) => {
    c.checked = true;
    cochesCandidats.add(c.dataset.cand);
  });
  majChoixCandidats();
});
$("#cand-rien").addEventListener("click", (e) => {
  e.preventDefault();
  $$("#liste-candidats [data-cand]").forEach((c) => (c.checked = false));
  cochesCandidats.clear();
  majChoixCandidats();
});

$("#btn-prospecter-sources").addEventListener("click", async () => {
  try {
    await api("/api/candidats/prospecter", { method: "POST" });
    toast("Recherche lancée — elle prend quelques minutes, suivez le journal.");
  } catch (e) {
    toast(e.message, "erreur");
  }
  rafraichirEtat();
});

$("#btn-requetes").addEventListener("click", async () => {
  const requetes = $("#requetes-prospection")
    .value.split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  try {
    await api("/api/config", {
      method: "POST",
      body: JSON.stringify({ prospection_requetes: requetes }),
    });
    $("#nb-requetes").textContent = requetes.length;
    toast(`${requetes.length} recherche(s) enregistrée(s).`);
  } catch (e) {
    toast(e.message, "erreur");
  }
});


/* ═══════════════════════════════════════════════════════════════════════════
   Atelier des formats
   ═══════════════════════════════════════════════════════════════════════════
   Le goulot mesure le 01/09/2026 : 210 offres CHIFFREES sans format, chez 34
   depots — et pas une seule offre publiable chez les 32 prospects valides. Le
   <select> qui repare cela existait deja, mais un par offre, au fond du
   panneau d'un prospect : 34 panneaux a ouvrir.

   Ici on ne trie plus par depot, on trie PAR TYPE : les 92 toles se tranchent
   ensemble, et les libelles identiques d'un meme type se tranchent d'un coup.
   Le bot ne propose aucun format, n'en classe aucun : il rassemble, il compte,
   il applique.
   ═══════════════════════════════════════════════════════════════════════════ */
let atelier = { groupes: [], offres: 0, depots: 0 };

async function chargerFormats() {
  try {
    atelier = await api("/api/formats/atelier");
  } catch (e) {
    toast(e.message, "erreur");
    return;
  }
  $("#etat-formats").textContent =
    `${atelier.offres} offre(s) chiffrée(s) sans format · ${atelier.depots} dépôt(s) · ${atelier.types} type(s)`;
  $("#formats-vide").hidden = atelier.offres > 0;
  $("#liste-formats").innerHTML = atelier.groupes.map(carteType).join("");
  brancherAtelier();
}

function carteType(g, gi) {
  const alerte = g.unites_incompatibles
    ? `<p class="aide alerte-unite">
         ⚠ Ces dépôts affichent en <strong>${g.unites_lues.join(", ")}</strong>,
         la référence Akora se vend <strong>${g.unites_reference.join(", ")}</strong>.
         Choisir un format ne suffit pas : le prix change de sens.
       </p>`
    : "";
  const sansRef = g.sans_reference
    ? `<p class="aide alerte-unite">
         ⚠ Le catalogue Akora ne connaît aucun format pour ce type. Rien à
         choisir : signalez ces offres comme hors catalogue, elles remonteront
         dans les références à ajouter au site.
       </p>`
    : "";
  return `
  <details class="carte groupe-format" data-groupe="${gi}">
    <summary>
      <strong>${echapper(g.type_nom)}</strong>
      <span class="badge gris">${g.nb_offres} offre(s)</span>
      <span class="badge gris">${g.nb_depots} dépôt(s)</span>
      <span class="discret">${g.formats.length} format(s) au catalogue</span>
      ${g.paquets.filter((x) => x.propose).length
        ? `<span class="badge bleu">${g.paquets.filter((x) => x.propose).length} proposé(s)</span>`
        : ""}
    </summary>
    ${alerte}${sansRef}
    <div class="paquets">
      ${g.paquets.map((p, pi) => lignePaquet(g, p, gi, pi)).join("")}
    </div>
    <div class="ligne-form">
      <button class="bouton principal" data-appliquer="${gi}">
        Appliquer ce type
      </button>
      <span class="discret" data-resultat="${gi}"></span>
    </div>
  </details>`;
}

function lignePaquet(g, p, gi, pi) {
  const uniteLue = [...new Set(p.offres.map((o) => o.unite).filter(Boolean))];
  const fourchette = p.prix_min === p.prix_max
    ? prixAr(p.prix_min)
    : `${prixAr(p.prix_min)} – ${prixAr(p.prix_max)}`;
  const depots = [...new Set(p.offres.map((o) => o.prospect_nom))]
    .slice(0, 3).join(", ");
  return `
  <div class="paquet" data-groupe="${gi}" data-paquet="${pi}">
    <div class="paquet-lu">
      <div class="brut ${p.propose ? "avec-proposition" : ""}">« ${echapper(p.exemple)} »</div>
      <div class="discret">
        ${p.nb} offre(s) · ${p.nb_depots} dépôt(s) · ${fourchette}
        ${uniteLue.length ? ` · lu : ${uniteLue.join(", ")}` : " · unité non lue"}
        ${depots ? ` · ${echapper(depots)}` : ""}
      </div>
    </div>
    <div class="paquet-choix">
      <select data-format>
        <option value="">— laisser en attente —</option>
        ${g.formats.map((f) => `<option value="${echapper(f.slug)}" data-unite="${echapper(f.unite || "")}" ${p.propose && p.propose.slug === f.slug ? "selected" : ""}>${echapper(f.libelle)}${f.unite ? ` (${f.unite})` : ""}</option>`).join("")}
      </select>
      ${p.propose ? `<div class="propose">
        ↳ proposé d'après les cotes écrites dans la ligne — <strong>à confirmer</strong>
      </div>` : ""}
      <label class="confirme-unite" hidden>
        <input type="checkbox" data-confirme>
        <span></span>
      </label>
      <button class="bouton discret-bouton" data-creer="${gi}" data-paquet-creer="${pi}"
              title="Créer cette référence au catalogue Akora">+ référence</button>
      <button class="bouton discret-bouton" data-absent>Hors catalogue</button>
    </div>
  </div>`;
}

function brancherAtelier() {
  // Le choix d'un format revele l'unite de la reference : si elle ne
  // correspond pas a celle que le depot affiche, le prix ne veut plus dire la
  // meme chose, et rien ne part sans une confirmation explicite.
  $$("#liste-formats [data-format]").forEach((select) => {
    select.addEventListener("change", () => {
      const bloc = select.closest(".paquet");
      const lues = infosPaquet(bloc).unites;
      const uniteRef = select.selectedOptions[0]?.dataset.unite || "";
      const label = bloc.querySelector(".confirme-unite");
      const conflit = uniteRef && lues.length && !lues.includes(uniteRef);
      label.hidden = !conflit;
      if (conflit) {
        label.querySelector("span").textContent =
          `le prix est bien ${UNITES[uniteRef] || uniteRef} (relevé ${lues.map((u) => UNITES[u] || u).join(", ")})`;
      } else {
        label.querySelector("input").checked = false;
      }
      bloc.classList.toggle("en-conflit", Boolean(conflit));
    });
  });

  $$("#liste-formats [data-absent]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const bloc = bouton.closest(".paquet");
      const { ids, exemple } = infosPaquet(bloc);
      try {
        await api("/api/formats/hors-catalogue", {
          method: "POST",
          corps: { ids, libelle: exemple },
        });
        toast(`${ids.length} offre(s) signalée(s) — la référence manque au catalogue.`);
        chargerFormats();
      } catch (e) {
        toast(e.message, "erreur");
      }
    });
  });

  /* Creer au catalogue la reference qu'une ligne reclame.
     Le site ignorait cette section ; la collecte l'a trouvee ; on la lui
     apprend. Le bot reste maitre : la cote vient du tarif du depot, le nom
     suit la convention du catalogue, et la reference cree porte le meme
     identifiant quel que soit le depot qui l'a ecrite en premier. */
  $$("#liste-formats [data-creer]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const g = atelier.groupes[Number(bouton.dataset.creer)];
      const p = g.paquets[Number(bouton.dataset.paquetCreer)];
      const ligne = (p.exemple.split("›").pop() || p.exemple).trim();
      let projet;
      try {
        projet = await api("/api/formats/reference-possible?type_slug="
          + encodeURIComponent(g.type_slug) + "&ligne=" + encodeURIComponent(ligne));
      } catch (e) { return toast(e.message, "erreur"); }

      if (!projet.possible) {
        return toast("Impossible : " + projet.motif, "erreur");
      }
      const accord = confirm([
        "Créer cette référence dans le catalogue Akora ?",
        "",
        `  ${projet.nom}`,
        `  ${projet.volume} m³ · ${projet.poids} kg (${projet.densite} kg/m³)`,
        `  identifiant : ${projet.slug}`,
        "",
        "Les cotes viennent du tarif du dépôt, le volume est calculé, et le",
        "poids suit la masse volumique déjà en place pour ce type.",
        "",
        `Elle sera appliquée aux ${p.nb} offre(s) de cette ligne.`,
      ].join("\n"));
      if (!accord) return;
      try {
        const r = await api("/api/formats/creer-reference", {
          method: "POST",
          corps: { type_slug: g.type_slug, ligne, ids: infosPaquet(
            bouton.closest(".paquet")).ids },
        });
        toast(`« ${r.nom} » créée — ${r.appliquees || 0} offre(s) rattachée(s).`,
          "succes");
        chargerFormats();
      } catch (e) {
        toast(e.message, "erreur");
      }
    });
  });

  $$("#liste-formats [data-appliquer]").forEach((bouton) => {
    bouton.addEventListener("click", () => appliquerType(Number(bouton.dataset.appliquer)));
  });
}

function infosPaquet(bloc) {
  const g = atelier.groupes[Number(bloc.dataset.groupe)];
  const p = g.paquets[Number(bloc.dataset.paquet)];
  return {
    ids: p.offres.map((o) => o.id),
    exemple: p.exemple,
    unites: [...new Set(p.offres.map((o) => o.unite).filter(Boolean))],
  };
}

async function appliquerType(gi) {
  const carte = $(`.groupe-format[data-groupe="${gi}"]`);
  const decisions = [];
  let enAttente = 0;

  $$(".paquet", carte).forEach((bloc) => {
    const select = bloc.querySelector("[data-format]");
    if (!select.value) return;
    const confirme = bloc.querySelector("[data-confirme]");
    const label = bloc.querySelector(".confirme-unite");
    if (!label.hidden && !confirme.checked) {
      enAttente += 1;
      bloc.classList.add("en-conflit");
      return;
    }
    decisions.push({
      ids: infosPaquet(bloc).ids,
      materiau_slug: select.value,
      confirme_unite: !label.hidden && confirme.checked,
    });
  });

  const resultat = $(`[data-resultat="${gi}"]`);
  if (!decisions.length) {
    resultat.textContent = enAttente
      ? `${enAttente} ligne(s) attendent que vous confirmiez l'unité.`
      : "Aucun format choisi dans ce type.";
    return;
  }
  try {
    const r = await api("/api/formats/appliquer", { method: "POST", corps: { decisions } });
    const reste = (r.unites_en_conflit || []).length;
    toast(`${r.appliquees} offre(s) ont reçu leur format.`
      + (reste ? ` ${reste} écartée(s) sur l'unité.` : ""));
    chargerFormats();
  } catch (e) {
    toast(e.message, "erreur");
  }
}

$("#btn-formats-recharger").addEventListener("click", chargerFormats);

/* Import d'une publication precise — voir Collecteur.importer(). Le travail
   ouvre un navigateur : il part en tache de fond, et c'est le journal qui
   rend compte, comme pour une collecte. */
surClic("#btn-importer", async () => {
  const champ = $("#url-import");
  const url = (champ.value || "").trim();
  if (!url.startsWith("http")) {
    return toast("Collez le lien complet de la publication.", "erreur");
  }
  try {
    await api("/api/importer", { method: "POST", corps: { url } });
    champ.value = "";
    toast("Lecture de la publication lancée — suivez le journal.");
  } catch (e) {
    toast(e.message, "erreur");
  }
});


/* ═══════════════════════════════════════════════════════════════════════════
   A appeler — la ou 84 % du corpus se debloque
   ═══════════════════════════════════════════════════════════════════════════
   Mesure du 01/09/2026 : 440 publications sur 526 ne portent AUCUN prix. Le
   tarif ne se met pas dans le post, il se donne au telephone. Le bot
   attendait donc un prix qui n'allait jamais tomber tout seul, et un depot
   dont on avait le nom, le quartier et le numero ne pouvait pas entrer sur le
   site.

   Cette vue renverse la chose : elle dit QUI appeler, et QUOI lui demander,
   article par article. Le prix se saisit ensuite dans sa fiche. */
let appels = { depots: [] };

async function chargerAppels() {
  try {
    appels = await api("/api/tri/appels");
  } catch (e) {
    return toast(e.message, "erreur");
  }
  const total = appels.depots.reduce((n, d) => n + d.nb_sans_prix, 0);
  $("#etat-appels").textContent =
    `${appels.depots.length} dépôt(s) à appeler · ${total} prix à demander`;
  $("#appels-vide").hidden = appels.depots.length > 0;
  $("#liste-appels").innerHTML = appels.depots.map(carteAppel).join("");
  brancherAppels();
}

function carteAppel(d, i) {
  const tel = d.telephone
    ? `<a href="tel:${echapper(d.telephone.replace(/\s/g, ""))}">${echapper(d.telephone)}</a>`
    : '<span class="discret">pas de numéro</span>';
  const lieu = [d.quartier, d.ville].filter(Boolean).join(" · ") || "lieu inconnu";
  const demandes = d.a_demander.map((o) =>
    `<li>${echapper(o.nom)}${o.type ? ` <span class="discret">(${echapper(o.type)})</span>` : ""}</li>`
  ).join("");
  const reste = d.nb_sans_prix - d.a_demander.length;

  return `
  <div class="carte carte-appel" data-appel="${i}">
    <div class="entete-carte">
      <h3>${echapper(d.nom)}
        ${d.sur_le_site ? '<span class="badge vert">sur le site</span>'
                        : '<span class="badge pointille">pas encore</span>'}</h3>
      <div class="actions-carte">
        <span class="discret">${echapper(lieu)}</span>
        ${tel}
        ${d.page_url ? `<a href="${echapper(d.page_url)}" target="_blank" rel="noopener">page</a>` : ""}
        <button class="bouton fin" data-ouvrir-appel="${echapper(d.id)}">Ouvrir la fiche</button>
      </div>
    </div>
    <p class="bloc-aide">
      <strong>${d.nb_sans_prix} prix à demander.</strong>
      ${d.nb_sans_photo ? `${d.nb_sans_photo} photo(s) à désigner. ` : ""}
      ${d.nb_sans_reference ? `${d.nb_sans_reference} format(s) à préciser. ` : ""}
      ${d.nb_pretes ? `${d.nb_pretes} produit(s) déjà complet(s).` : ""}
    </p>
    <ul class="liste-demandes">${demandes}</ul>
    ${reste > 0 ? `<p class="aide">… et ${reste} autre(s).</p>` : ""}
  </div>`;
}

function brancherAppels() {
  $$("[data-ouvrir-appel]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      ouvrirVue("fournisseurs");
      await ouvrirPanneau(bouton.dataset.ouvrirAppel);
    });
  });
}

$("#btn-appels-recharger").addEventListener("click", chargerAppels);


/* ═══════════════════════════════════════════════════════════════════════════
   Le miroir : collecte face au site
   ═══════════════════════════════════════════════════════════════════════════
   Trois egalites demandees, et elles ne sont pas decoratives : c'est le seul
   endroit qui dise si le travail de collecte ARRIVE quelque part. Un ecart
   qu'on ne voit pas est un ecart qui grandit. */
async function chargerMiroir() {
  let m;
  try {
    m = await api("/api/tri/miroir");
  } catch (e) {
    return;   // le tableau de bord ne doit jamais tomber pour ca
  }
  const ligne = (titre, gauche, droite, reste, aide) => `
    <tr class="${reste ? "ecart" : "aligne"}">
      <th>${titre}</th>
      <td class="nombre">${gauche}</td>
      <td class="fleche">→</td>
      <td class="nombre">${droite}</td>
      <td class="reste">${reste ? echapper(reste) : "à jour"}</td>
    </tr>`;

  const t = m.types, f = m.fournisseurs, x = m.prix;
  const jamais = (t.jamais_rencontres || []).length;
  $("#table-miroir").innerHTML = `
    <thead><tr><th></th><th class="nombre">collecte</th><th></th>
      <th class="nombre">site</th><th>ce qui reste</th></tr></thead>
    <tbody>
      ${ligne("Types de matériaux", t.collecte, t.site,
              (t.hors_catalogue || []).length
                ? `${t.hors_catalogue.length} type(s) hors catalogue`
                : (jamais ? `${jamais} type(s) jamais rencontré(s) sur le terrain` : ""))}
      ${ligne("Références (formats)", m.references.collecte, m.references.site, "")}
      ${ligne("Fournisseurs", f.collecte, f.site,
              f.a_transferer ? `${f.a_transferer} dépôt(s) à transférer` : "")}
      ${ligne("Prix relevés", x.collecte, x.site,
              x.bloques ? `${x.bloques} prix bloqué(s) : il leur manque un format ou une photo` : "")}
    </tbody>`;
  $("#miroir-quand").textContent = m.erreur
    ? "site injoignable — " + m.erreur
    : `sur ${x.offres_gardees} offre(s) retenue(s)`;
}

$("#btn-miroir").addEventListener("click", chargerMiroir);
chargerMiroir();
