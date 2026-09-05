# 05 — Plan IA : ce qui a du sens pour Akora, et ce qui n'en a pas

**État** : aucune IA sur le site (grep `groq|gemini|openai|mistral|anthropic|llm` → 0 dans `src/` et `supabase/functions/`). En amont, le bot de collecte (`bot-fournisseurs`, dépôt à part) lit des publications Facebook avec un LLM et en sort matériaux, cotes et prix : il est la seule IA de la chaîne et il a produit l'essentiel du catalogue. Le site, lui, cherche par mots exacts et ne parle que français à un public bilingue qui vit sur WhatsApp et Messenger.

**Contraintes qui décident de tout** : budget récurrent proche de zéro (H4) ; audience en 3G sur téléphone d'entrée de gamme (rien de lourd côté client) ; règle d'Akora « ne jamais inventer un prix » (`APropos.tsx:38`) ; les quotas gratuits des LLM sont **de production** et se brûlent en une session de tests (incident Fonenako du 04/09 : 1 076 réponses 429 Groq après des rejeux) ; le malgache généré doit être relu par un locuteur (règle du 04/09 : jamais une correction de langue au raisonnement seul).

## Les cinq candidates, notées

| # | Intégration | Valeur pour Akora | Coût mensuel | Effort | Risque | Verdict |
|---|---|---|---|---|---|---|
| A | **Recherche en langage naturel → comparateur** : « 200 parpaings de 15 livrés à Itaosy » ouvre le comparateur du bon format, quantité et point de livraison remplis | Forte : c'est la promesse du site en une phrase ; supprime 3 écrans pour un acheteur pressé | 0 € (Gemini Flash gratuit ≈ 1 500 req/j, ou Groq) puis ~0,05 €/1 000 requêtes | 1 semaine | Mauvaise interprétation → toujours proposer, jamais commander ; repli sur la recherche actuelle | **Faire en premier** (Q4 2026) |
| B | **Assistant WhatsApp / Messenger de commande, malgache et français** : le client écrit « mila biriky 500 » ; l'assistant montre 3 offres rendu chantier, prend nom/adresse, crée la commande via `commande-creer`, envoie le lien de suivi | Très forte : l'audience est là, pas sur un site ; 84 % des publications de dépôts n'ont pas de prix parce que tout se règle en discussion | 0 € jusqu'à 1 000 conversations/mois (WhatsApp Cloud API), LLM gratuit puis ~10 €/mois à 5 000 conversations | 3 semaines (réutilise l'architecture `messenger-webhook`/`agent-fonenako` de Fonenako : en-tête `x-region`, gestion des échos, répondeur unique) | Boucles d'écho, deux répondeurs, qualité du malgache, quotas LLM brûlés par les tests — tous déjà rencontrés et documentés sur Fonenako | **Faire en second** (T1 2027) |
| C | **Photo → fiche produit** : le fournisseur (ou le bot) envoie une photo de tas de bois ou d'ardoise de prix ; le modèle propose type, format, cotes, prix lus | Forte pour l'alimentation du catalogue (goulot actuel : photos triées à la main) | 0 € (Gemini Flash vision gratuit) puis ~0,3 €/1 000 photos | 2 semaines | L'incident du 01/09 (« sable fin » illustré par du gravillon) : **la machine propose, l'humain valide, toujours** | Faire après A (les fournisseurs publient eux-mêmes) |
| D | **Observatoire des prix : anomalies et alertes** : médiane ± écart absolu par format et ville (sans LLM), alerte « baisse de prix sur un matériau suivi » (table `abonnements` existante), note de marché hebdomadaire rédigée par LLM à partir des chiffres | Moyenne à court terme (peu de données), forte pour le SEO/GEO (contenu daté, factuel, cité par les moteurs IA) | 0 € (statistiques en SQL ; rédaction ≈ 2 000 jetons/semaine) | 1 semaine | Un prix aberrant publié comme « tendance » ; d'où le filtre statistique **avant** la rédaction et la mention de la source sur chaque chiffre | Faire quand ≥ 30 relevés par format |
| E | **Traduction et enrichissement du catalogue** : `nom_mg` des 112 formats, descriptions courtes, `alt` des photos | Moyenne ; accessibilité et malgache | 0 € (une passe unique, ~50 000 jetons) | 2 jours + relecture | Malgache approximatif publié → relecture obligatoire par Andry, lot par lot | Faire, en tâche de fond |

Écartées : chatbot RAG généraliste sur le site (l'audience n'est pas sur le site, elle est sur WhatsApp : voir B) ; recommandations personnalisées (0 commande, aucun signal) ; enregistrement de session analysé par IA (poids, vie privée, 3G) ; « agent interne de reporting » — c'est l'agent hebdomadaire de `06`, déjà prévu.

## Garde-fous obligatoires (pour A, B, C — non négociables)

| Exigence du barème | Mise en œuvre Akora |
|---|---|
| Limites de sujet | Prompt système : matériaux de gros œuvre, livraison, commande, paiement Akora ; tout le reste → « je ne peux pas vous aider là-dessus, voici le contact » ; **jamais** de conseil structurel (« ce mur tiendra ») : renvoi aux calculateurs avec l'avertissement existant |
| « Vous parlez à une IA » | Premier message et pied de chaque réponse ; `source: "ia"` dans la réponse JSON (convention Fonenako) |
| Données personnelles | Le LLM ne voit **jamais** téléphone, nom, adresse : l'interprétation reçoit le texte de la demande ; la commande est créée par du code, pas par le modèle (`commande-creer` inchangée) |
| Repli si l'API tombe | A : recherche actuelle ; B : « un humain vous répond, voici le numéro » + notification admin ; C : saisie manuelle |
| Plafond de coûts | Compteur `consommer_quota("ia", jour, N)` par jour et par IP/utilisateur ; coupure à 80 % du quota gratuit ; alerte Telegram |
| Journalisation | Table `ia_journal (id, canal, entree, sortie_json, modele, jetons, duree_ms, utilisateur_id null, created_at)` ; purge 90 jours ; jamais le numéro de téléphone |
| Évaluation qualité | `tests/ia/recherche.jsonl` : 40 phrases réelles (mg, fr, mélange, fautes) → slug + quantité attendus ; seuil 90 % avant déploiement ; rejoué **hors production** (clé de test, `sansIA` pour les tests de routage) |
| Signalement | Bouton « Mauvaise réponse » → `ia_journal.signale = true` ; revue hebdomadaire par l'agent de `06` |

## A — Recherche en langage naturel : architecture et code de départ

```
[Recherche.tsx] ──texte──▶ Edge Function interpreter-recherche ──▶ LLM (JSON strict)
       ▲                          │  valide contre formats_vitrine (slug existe ?)
       └──── {format_slug, quantite, unite, localite} ◀───────────┘
       puis navigation : /materiaux/{famille}/{type}/{format}?q={quantite}&lieu={localite}
```

`supabase/functions/interpreter-recherche/index.ts` (départ) :
```ts
import { corsEntetes, reponse, clientAdmin, quotaOk, adresse } from "../_commun.ts";

const SCHEMA = `{"format_slug": string|null, "type_slug": string|null, "quantite": number|null, "unite": "piece"|"m3"|"sac"|"tonne"|"ml"|null, "localite": string|null, "confiance": 0..1}`;

Deno.serve(async (requete) => {
  if (requete.method === "OPTIONS") return new Response(null, { headers: corsEntetes });
  const client = clientAdmin();
  const ip = adresse(requete);
  if (!(await quotaOk(client, "ia_recherche", ip, 60, true))) return reponse(429, { erreur: "Trop de recherches, réessayez dans une heure." });

  const { texte } = await requete.json();
  if (typeof texte !== "string" || texte.length < 3 || texte.length > 200) return reponse(400, { erreur: "Texte invalide." });

  // Le catalogue est la seule vérité : le modèle choisit dans une liste fermée.
  const { data: formats } = await client.from("formats_vitrine").select("slug, nom, type_slug, type_nom, unite").limit(500);
  const liste = (formats ?? []).map((f) => `${f.slug} | ${f.nom} | ${f.type_nom} | ${f.unite}`).join("\n");

  const prompt = `Tu extrais une demande de matériaux de construction à Madagascar (français, malgache ou mélange).
Réponds UNIQUEMENT en JSON : ${SCHEMA}. Choisis format_slug dans la liste (sinon null) ; type_slug si le format est ambigu.
Ne devine jamais un prix. Localité = quartier ou ville cité, sinon null.
LISTE:\n${liste}\n\nDEMANDE: ${texte.replace(/\s+/g, " ")}`;

  const cle = Deno.env.get("GEMINI_API_KEY");
  if (!cle) return reponse(503, { erreur: "Interprétation indisponible." });   // le client retombe sur la recherche classique
  const debut = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cle}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!r?.ok) return reponse(503, { erreur: "Interprétation indisponible." });
  const corps = await r.json();
  let resultat: Record<string, unknown> = {};
  try { resultat = JSON.parse(corps.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"); } catch { /* repli */ }

  // Validation : un slug qui n'existe pas est null, point.
  const slugs = new Set((formats ?? []).map((f) => f.slug));
  if (resultat.format_slug && !slugs.has(String(resultat.format_slug))) resultat.format_slug = null;

  await client.from("ia_journal").insert({ canal: "recherche", entree: texte, sortie_json: resultat, modele: "gemini-2.0-flash", duree_ms: Date.now() - debut });
  return reponse(200, resultat);
});
```
Côté `Recherche.tsx` : si le texte contient un nombre ou plus de trois mots, appeler la fonction ; si `format_slug` et `confiance ≥ 0,6`, afficher une carte « Vous cherchez peut-être : Parpaing creux 15 × 200 pièces, livré à Itaosy — Comparer » **au-dessus** des résultats classiques, jamais à leur place. Le clic ouvre le comparateur pré-rempli. Mention « suggestion générée par une IA » sous la carte.

Migration : `ia_journal` + `create index on ia_journal (created_at)` + purge cron 90 jours. Secret : `GEMINI_API_KEY` (clé gratuite, projet Google dédié à Akora, alerte de quota activée).

## B — Assistant WhatsApp : ce qu'il faut réutiliser, pas réinventer

Fonenako a déjà payé les leçons (fiches des 04-05/09) : un seul répondeur par canal ; l'écho de sa propre réponse arrive en 300 ms et sur un autre isolat → persister **avant** l'envoi ; en-tête `x-region: ap-southeast-1` entre fonctions ; `reasoning_effort` bas et marge de jetons ; ne jamais rejouer un corpus contre la fonction déployée en journée. Le cerveau d'Akora : intentions fermées (chercher, comparer, commander, suivre, parler à un humain), outils = les mêmes RPC/vues que le site (`formats_vitrine`, `produits_publics`, `commande-creer`, `lire_commande_invitee` du correctif F-01). Le malgache : gabarits validés par Andry pour les phrases fixes, LLM seulement pour comprendre, pas pour rédiger, tant que le corpus de réponses validées n'existe pas.

## Calendrier et coûts

| Trimestre | Livraison | Coût récurrent |
|---|---|---|
| Q4 2026 | A (recherche naturelle) + E (nom_mg) | 0 € |
| T1 2027 | B (WhatsApp) | 0 → 10 €/mois selon volume |
| T2 2027 | C (photo → fiche) intégré à l'espace pro et au bot | 0 → 5 €/mois |
| T2 2027 | D (observatoire) quand les relevés le permettent | 0 € |

Budget total 2027 estimé : **≤ 15 €/mois** en croisière, 0 € au lancement. Chaque brique passe par le jeu de tests, la journalisation et le plafond de coûts avant d'être exposée.
