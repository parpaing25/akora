import {
  adresse,
  clientAdmin,
  enTetesCors,
  MOTIF_TELEPHONE,
  quotaOk,
  reponse,
  utilisateurAppelant,
} from "../_commun.ts";
import { calculerLivraison, type LigneACharger, type Vehicule, type Zone } from "../_partage/livraison.ts";
import { prixUnitaireApplicable, type Palier } from "../_partage/paliers.ts";

/**
 * Création des commandes à partir d'un panier.
 *
 * RIEN de ce que le client envoie sur l'argent n'est cru : il transmet des
 * identifiants de produits et des quantités, point. Les prix, les paliers, la
 * distance, le véhicule, les rotations et les totaux sont RECALCULÉS ici, avec
 * exactement le même module que celui qui a affiché l'estimation (recette F7).
 *
 * Un panier multi-fournisseurs produit une commande PAR fournisseur.
 */

interface CorpsRequete {
  lignes: { produit_id: string; quantite: number }[];
  nom_contact: string;
  telephone_contact: string;
  email_contact?: string | null;
  localite_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  adresse_libre?: string | null;
  mode_paiement?: "en_ligne_integral" | "en_ligne_acompte" | "a_la_livraison";
  message?: string | null;
}

const COLONNES_PRODUIT =
  "id, nom_affiche, unite, prix_unitaire, prix_promo, quantite_min, poids_kg_unite, volume_m3_unite, stock_statut, fournisseur_id, fournisseur_nom, fournisseur_niveau, fournisseur_lat, fournisseur_lng, fournisseur_rayon_max_km, fournisseur_coef_sinuosite, fournisseur_modes_paiement";

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") return new Response("ok", { headers: enTetesCors });
  if (requete.method !== "POST") return reponse(405, { erreur: "Méthode non autorisée." });

  const client = clientAdmin();
  const ip = adresse(requete);
  const acheteurId = await utilisateurAppelant(requete);

  if (!(await quotaOk(client, "creer_commande", acheteurId ?? ip, 20))) {
    return reponse(429, { erreur: "Trop de commandes cette heure-ci. Réessayez plus tard." });
  }

  let corps: CorpsRequete;
  try {
    corps = (await requete.json()) as CorpsRequete;
  } catch {
    return reponse(400, { erreur: "Corps de requête illisible." });
  }

  const lignes = (corps.lignes ?? []).filter((l) => l?.produit_id && Number(l.quantite) > 0);
  if (lignes.length === 0) return reponse(400, { erreur: "Panier vide." });
  if (lignes.length > 100) return reponse(400, { erreur: "Panier trop volumineux." });
  if (!corps.nom_contact?.trim()) return reponse(400, { erreur: "Nom de contact obligatoire." });
  if (!MOTIF_TELEPHONE.test(corps.telephone_contact ?? "")) {
    return reponse(400, { erreur: "Numéro de téléphone invalide." });
  }

  const ids = [...new Set(lignes.map((l) => l.produit_id))];
  const { data: produits, error: erreurProduits } = await client
    .from("produits_publics")
    .select(COLONNES_PRODUIT)
    .in("id", ids);
  if (erreurProduits) return reponse(500, { erreur: erreurProduits.message });
  if (!produits || produits.length !== ids.length) {
    return reponse(400, { erreur: "Un produit du panier n'est plus disponible. Rechargez votre panier." });
  }

  const { data: paliersBruts } = await client
    .from("produits_paliers")
    .select("produit_id, quantite_min, prix_unitaire")
    .in("produit_id", ids);
  const paliersParProduit = new Map<string, Palier[]>();
  for (const p of paliersBruts ?? []) {
    const liste = paliersParProduit.get(p.produit_id) ?? [];
    liste.push({ quantite_min: Number(p.quantite_min), prix_unitaire: Number(p.prix_unitaire) });
    paliersParProduit.set(p.produit_id, liste);
  }

  type Groupe = { fournisseurId: string; produits: { produit: Record<string, unknown>; quantite: number }[] };
  const groupes = new Map<string, Groupe>();
  for (const ligne of lignes) {
    const produit = produits.find((p) => p.id === ligne.produit_id) as unknown as Record<string, unknown>;
    const fournisseurId = String(produit.fournisseur_id);
    const groupe = groupes.get(fournisseurId) ?? { fournisseurId, produits: [] };
    groupe.produits.push({ produit, quantite: Math.trunc(Number(ligne.quantite)) });
    groupes.set(fournisseurId, groupe);
  }

  const creees: { id: string; numero: string; fournisseur: string; montant_total: number }[] = [];

  for (const groupe of groupes.values()) {
    const premier = groupe.produits[0]!.produit;

    const { data: vehicules } = await client
      .from("vehicules_livraison")
      .select(
        "id, nom, capacite_m3, capacite_kg, prix_par_km, forfait_base, km_inclus, prix_minimum, facturer_aller_retour",
      )
      .eq("fournisseur_id", groupe.fournisseurId)
      .eq("actif", true);
    const { data: zones } = await client
      .from("zones_livraison")
      .select("id, nom, rayon_km, seuil_franco, rayon_franco_km, majoration_pct")
      .eq("fournisseur_id", groupe.fournisseurId)
      .eq("actif", true);

    let montantProduits = 0;
    const lignesACharger: LigneACharger[] = [];
    const lignesCommande: Record<string, unknown>[] = [];

    for (const { produit, quantite } of groupe.produits) {
      const q = Math.max(Number(produit.quantite_min ?? 1), quantite);
      const base = Number(produit.prix_promo ?? produit.prix_unitaire);
      const prix = prixUnitaireApplicable(base, paliersParProduit.get(String(produit.id)) ?? [], q);
      const total = Math.round(prix * q);
      montantProduits += total;
      lignesACharger.push({
        quantite: q,
        poids_kg_unite: Number(produit.poids_kg_unite),
        volume_m3_unite: Number(produit.volume_m3_unite),
      });
      lignesCommande.push({
        produit_id: produit.id,
        designation_snapshot: produit.nom_affiche,
        unite_snapshot: produit.unite,
        prix_unitaire_snapshot: prix,
        quantite: q,
        total_ligne: total,
      });
    }

    const livraison = calculerLivraison({
      depart:
        premier.fournisseur_lat == null || premier.fournisseur_lng == null
          ? null
          : { lat: Number(premier.fournisseur_lat), lng: Number(premier.fournisseur_lng) },
      arrivee:
        corps.lat == null || corps.lng == null ? null : { lat: Number(corps.lat), lng: Number(corps.lng) },
      rayonMaxKm: Number(premier.fournisseur_rayon_max_km ?? 40),
      coefSinuosite:
        premier.fournisseur_coef_sinuosite == null ? null : Number(premier.fournisseur_coef_sinuosite),
      vehicules: (vehicules ?? []) as unknown as Vehicule[],
      zones: (zones ?? []) as unknown as Zone[],
      lignes: lignesACharger,
      montantProduits,
    });

    const estimable = livraison.statut === "estimee" || livraison.statut === "offerte";
    const montantLivraison = livraison.statut === "estimee" ? livraison.cout : 0;

    // Le paiement en ligne exige une livraison chiffrable ET un fournisseur
    // verifie. On retrograde vers « a la livraison » plutot que de refuser.
    const modesAcceptes = (premier.fournisseur_modes_paiement ?? []) as string[];
    const verifie = ["verifie", "partenaire"].includes(String(premier.fournisseur_niveau));
    const modeDemande = corps.mode_paiement ?? "a_la_livraison";
    const mode =
      modeDemande !== "a_la_livraison" && estimable && verifie && modesAcceptes.includes(modeDemande)
        ? modeDemande
        : "a_la_livraison";

    const { data: numero, error: erreurNumero } = await client.rpc("prochain_numero_commande");
    if (erreurNumero || !numero) return reponse(500, { erreur: "Numérotation indisponible." });

    const { data: commande, error: erreurCommande } = await client
      .from("commandes")
      .insert({
        numero,
        acheteur_id: acheteurId,
        nom_contact: corps.nom_contact.trim(),
        telephone_contact: corps.telephone_contact,
        email_contact: corps.email_contact ?? null,
        fournisseur_id: groupe.fournisseurId,
        localite_id: corps.localite_id ?? null,
        lat: corps.lat ?? null,
        lng: corps.lng ?? null,
        adresse_libre: corps.adresse_libre ?? null,
        distance_km: estimable ? Number(livraison.detail.distanceRouteKm.toFixed(2)) : null,
        vehicule_id: estimable ? livraison.detail.vehicule.id : null,
        nb_rotations: estimable ? livraison.detail.rotations : 1,
        montant_produits: montantProduits,
        montant_livraison: montantLivraison,
        montant_total: montantProduits + montantLivraison,
        montant_commission: 0,
        livraison_estimable: estimable,
        mode_paiement: mode,
        statut: "envoyee",
        message: corps.message ?? null,
      })
      .select("id, numero")
      .single();
    if (erreurCommande || !commande) {
      return reponse(500, { erreur: erreurCommande?.message ?? "Insertion refusée." });
    }

    const { error: erreurLignes } = await client
      .from("lignes_commande")
      .insert(lignesCommande.map((l) => ({ ...l, commande_id: commande.id })))
      .select("id");
    if (erreurLignes) return reponse(500, { erreur: erreurLignes.message });

    await client.rpc("journaliser", {
      _action: "creer_commande",
      _entite: "commandes",
      _entite_id: commande.id,
      _avant: null,
      _apres: { ip, montant_total: montantProduits + montantLivraison },
    });

    const { data: fournisseur } = await client
      .from("fournisseurs")
      .select("owner_id")
      .eq("id", groupe.fournisseurId)
      .maybeSingle();
    if (fournisseur?.owner_id) {
      await client.rpc("notifier", {
        _user_id: fournisseur.owner_id,
        _titre: "Nouvelle commande " + commande.numero,
        _corps: corps.nom_contact.trim() + " vous a passé commande.",
        _lien: "/pro/commandes",
        _categorie: "commande",
      });
    }

    creees.push({
      id: commande.id,
      numero: commande.numero,
      fournisseur: String(premier.fournisseur_nom),
      montant_total: montantProduits + montantLivraison,
    });
  }

  return reponse(200, { commandes: creees });
});
