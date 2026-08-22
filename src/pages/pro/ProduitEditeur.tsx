import * as React from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LigneFournisseur } from "@/lib/donnees/fournisseurs";
import {
  creerProduit,
  lireMonProduit,
  majProduit,
  supprimerProduit,
  type SaisieProduit,
} from "@/lib/donnees/produits";
import { chercherMateriaux, type MateriauRef } from "@/lib/donnees/materiaux";
import { LIBELLE_STOCK, LIBELLE_UNITE, type StatutStock, type Unite } from "@/lib/types-metier";
import { Seo } from "@/components/Seo";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie, ZoneTexte } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { Squelette } from "@/components/ui/skeleton";
import { AvertissementMetier } from "@/components/ui/etats";
import { Liste, ListeContenu, ListeDeclencheur, ListeElement, ListeValeur } from "@/components/ui/select";
import { ChoixMateriau } from "@/components/pro/ChoixMateriau";
import { DialogueDemandeMateriau } from "@/components/pro/DialogueDemandeMateriau";
import { PhotosProduit } from "@/components/pro/PhotosProduit";
import { PaliersProduit } from "@/components/pro/PaliersProduit";

const STOCKS: StatutStock[] = ["en_stock", "sur_commande", "rupture"];

interface Formulaire {
  nom_affiche: string;
  description: string;
  prix_unitaire: string;
  prix_promo: string;
  tva_taux: string;
  quantite_min: string;
  poids_kg_unite: string;
  volume_m3_unite: string;
  stock_statut: StatutStock;
  delai_preparation_jours: string;
}

const VIDE: Formulaire = {
  nom_affiche: "",
  description: "",
  prix_unitaire: "",
  prix_promo: "",
  tva_taux: "0",
  quantite_min: "1",
  poids_kg_unite: "",
  volume_m3_unite: "",
  stock_statut: "en_stock",
  delai_preparation_jours: "0",
};

const nombre = (valeur: string) => Number.parseFloat(valeur.replace(",", "."));
const entier = (valeur: string) => Number.parseInt(valeur, 10);

/**
 * Création et modification d'un produit (AKORA-DESIGN §10).
 *
 * Le référentiel d'abord, le reste ensuite : sans matériau choisi ou demandé,
 * il n'y a pas de produit à décrire. Le nom normalisé et la famille restent en
 * lecture seule ; le poids et le volume, eux, sont préremplis puis ajustables,
 * parce que le parpaing d'un dépôt n'est pas celui d'un autre.
 */
export default function ProduitEditeur() {
  const fiche = useOutletContext<LigneFournisseur>();
  const { id } = useParams<{ id: string }>();
  const naviguer = useNavigate();
  const estNouveau = !id || id === "nouveau";

  const [materiau, setMateriau] = React.useState<MateriauRef | null>(null);
  const [demande, setDemande] = React.useState<{ id: string; nom: string; categorieId: string } | null>(null);
  const [dialogueOuvert, setDialogueOuvert] = React.useState(false);
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [form, setForm] = React.useState<Formulaire>(VIDE);
  const [enCours, setEnCours] = React.useState(false);

  const produit = useQuery({
    queryKey: ["produit", id],
    queryFn: () => lireMonProduit(id as string),
    enabled: !estNouveau,
  });

  // Recharge la référence liée pour afficher le nom normalisé en lecture seule.
  React.useEffect(() => {
    const p = produit.data;
    if (!p) return;
    setForm({
      nom_affiche: p.nom_affiche,
      description: p.description ?? "",
      prix_unitaire: String(p.prix_unitaire),
      prix_promo: p.prix_promo == null ? "" : String(p.prix_promo),
      tva_taux: String(p.tva_taux),
      quantite_min: String(p.quantite_min),
      poids_kg_unite: String(p.poids_kg_unite),
      volume_m3_unite: String(p.volume_m3_unite),
      stock_statut: p.stock_statut,
      delai_preparation_jours: String(p.delai_preparation_jours),
    });
    setPhotos(p.photos ?? []);
    if (p.materiau_ref_id) {
      void chercherMateriaux("", null, 500).then((tous) => {
        setMateriau(tous.find((m) => m.id === p.materiau_ref_id) ?? null);
      });
    }
  }, [produit.data]);

  const choisirMateriau = (m: MateriauRef) => {
    setMateriau(m);
    setDemande(null);
    setForm((f) => ({
      ...f,
      nom_affiche: f.nom_affiche || m.nom,
      poids_kg_unite: f.poids_kg_unite || String(m.poids_kg_unite_defaut),
      volume_m3_unite: f.volume_m3_unite || String(m.volume_m3_unite_defaut),
    }));
  };

  const uniteRetenue: Unite = materiau?.unite_defaut ?? produit.data?.unite ?? "piece";
  const categorieRetenue = materiau?.categorie_id ?? demande?.categorieId ?? produit.data?.categorie_id ?? null;

  const enregistrer = async () => {
    if (!materiau && !demande && !produit.data?.demande_materiau_id) {
      toast.error("Choisissez d'abord un matériau", {
        description: "Ou demandez son ajout au catalogue commun.",
      });
      return;
    }
    const prix = entier(form.prix_unitaire);
    const poids = nombre(form.poids_kg_unite);
    const volume = nombre(form.volume_m3_unite);
    if (!(prix > 0) || !(poids > 0) || !(volume > 0) || form.nom_affiche.trim().length < 2) {
      toast.error("Saisie incomplète", {
        description: "Nom, prix, poids et volume par unité sont obligatoires.",
      });
      return;
    }
    if (!categorieRetenue) {
      toast.error("Famille introuvable pour ce produit.");
      return;
    }

    const saisie: SaisieProduit = {
      fournisseur_id: fiche.id,
      materiau_ref_id: materiau?.id ?? produit.data?.materiau_ref_id ?? null,
      demande_materiau_id: demande?.id ?? produit.data?.demande_materiau_id ?? null,
      categorie_id: categorieRetenue,
      nom_affiche: form.nom_affiche.trim(),
      description: form.description.trim() || null,
      unite: uniteRetenue,
      prix_unitaire: prix,
      prix_promo: form.prix_promo.trim() ? entier(form.prix_promo) : null,
      tva_taux: nombre(form.tva_taux) || 0,
      quantite_min: Math.max(1, entier(form.quantite_min) || 1),
      poids_kg_unite: poids,
      volume_m3_unite: volume,
      stock_statut: form.stock_statut,
      delai_preparation_jours: Math.max(0, entier(form.delai_preparation_jours) || 0),
      photos,
      statut: materiau || produit.data?.materiau_ref_id ? "brouillon" : "en_attente_materiau",
    };

    setEnCours(true);
    try {
      if (estNouveau) {
        const nouvelId = await creerProduit(saisie);
        toast.success("Produit enregistré", { description: "Il reste en brouillon tant que vous ne l'avez pas publié." });
        naviguer("/pro/catalogue/" + nouvelId, { replace: true });
      } else {
        const { statut: _ignore, ...sansStatut } = saisie;
        await majProduit(id as string, sansStatut);
        toast.success("Produit mis à jour");
      }
    } catch (erreur) {
      toast.error("Enregistrement impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  if (!estNouveau && produit.isPending) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Squelette className="h-8 w-1/2" />
        <Squelette className="h-72 w-full" />
      </div>
    );
  }

  const enAttente = !materiau && (demande !== null || produit.data?.statut === "en_attente_materiau");

  return (
    <>
      <Seo
        titre={estNouveau ? "Ajouter un produit" : "Modifier un produit"}
        chemin={estNouveau ? "/pro/catalogue/nouveau" : "/pro/catalogue/" + id}
        indexable={false}
      />
      <h2 className="text-section">{estNouveau ? "Ajouter un produit" : "Modifier un produit"}</h2>

      <div className="mt-4 space-y-4">
        <Carte className="p-4">
          <h3 className="text-produit">1. Le matériau</h3>
          <p className="mt-0.5 text-legende text-muted-foreground">
            Il vient du catalogue commun d'Akora. C'est lui qui place votre offre dans le
            comparateur, face aux autres dépôts.
          </p>
          <div className="mt-3">
            {enAttente ? (
              <AvertissementMetier titre="En attente de référence">
                {demande
                  ? "« " + demande.nom + " » a été proposé au catalogue commun. "
                  : "Ce produit attend qu'un administrateur crée sa référence. "}
                Il restera visible ici, mais ne sera ni publié, ni comparable, ni ajoutable à un
                panier tant que la demande n'est pas acceptée.
              </AvertissementMetier>
            ) : (
              <ChoixMateriau
                choisi={materiau}
                onChoisir={choisirMateriau}
                onDemanderAjout={() => setDialogueOuvert(true)}
              />
            )}
            {materiau ? (
              <Bouton variante="fantome" taille="compact" className="mt-2" onClick={() => setMateriau(null)}>
                Choisir un autre matériau
              </Bouton>
            ) : null}
          </div>
        </Carte>

        <Carte className="p-4">
          <h3 className="text-produit">2. Votre offre</h3>
          <div className="mt-3 space-y-3">
            <Champ
              etiquette="Libellé commercial"
              aide="Votre nom à vous. Il s'affiche sur votre fiche, mais ne remplace jamais la référence dans le comparateur."
              obligatoire
            >
              {(a) => (
                <Saisie {...a} value={form.nom_affiche} onChange={(e) => setForm({ ...form, nom_affiche: e.target.value })} />
              )}
            </Champ>

            <Champ etiquette="Description">
              {(a) => (
                <ZoneTexte {...a} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              )}
            </Champ>

            <div className="grid gap-3 sm:grid-cols-2">
              <Champ
                etiquette={"Prix par " + LIBELLE_UNITE[uniteRetenue] + " (Ar)"}
                aide={fiche.assujetti_tva ? "Hors taxe : vous êtes assujetti à la TVA." : "Vous n'êtes pas assujetti à la TVA."}
                obligatoire
              >
                {(a) => (
                  <Saisie {...a} value={form.prix_unitaire} onChange={(e) => setForm({ ...form, prix_unitaire: e.target.value })} inputMode="numeric" className="nombres" />
                )}
              </Champ>
              <Champ etiquette="Prix promotionnel (Ar)" aide="Facultatif, doit rester sous le prix normal.">
                {(a) => (
                  <Saisie {...a} value={form.prix_promo} onChange={(e) => setForm({ ...form, prix_promo: e.target.value })} inputMode="numeric" className="nombres" />
                )}
              </Champ>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Champ etiquette="Poids par unité (kg)" aide="Prérempli d'après la référence. Ajustez-le pour VOTRE produit." obligatoire>
                {(a) => (
                  <Saisie {...a} value={form.poids_kg_unite} onChange={(e) => setForm({ ...form, poids_kg_unite: e.target.value })} inputMode="decimal" className="nombres" />
                )}
              </Champ>
              <Champ etiquette="Volume par unité (m³)" aide="Encombrement dans le camion. C'est lui qui décide du véhicule." obligatoire>
                {(a) => (
                  <Saisie {...a} value={form.volume_m3_unite} onChange={(e) => setForm({ ...form, volume_m3_unite: e.target.value })} inputMode="decimal" className="nombres" />
                )}
              </Champ>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Champ etiquette="Quantité minimale">
                {(a) => (
                  <Saisie {...a} value={form.quantite_min} onChange={(e) => setForm({ ...form, quantite_min: e.target.value })} inputMode="numeric" className="nombres" />
                )}
              </Champ>
              <Champ etiquette="Disponibilité">
                {(a) => (
                  <Liste value={form.stock_statut} onValueChange={(v) => setForm({ ...form, stock_statut: v as StatutStock })}>
                    <ListeDeclencheur id={a.id}>
                      <ListeValeur />
                    </ListeDeclencheur>
                    <ListeContenu>
                      {STOCKS.map((s) => (
                        <ListeElement key={s} value={s}>
                          {LIBELLE_STOCK[s]}
                        </ListeElement>
                      ))}
                    </ListeContenu>
                  </Liste>
                )}
              </Champ>
              <Champ etiquette="Préparation (jours)">
                {(a) => (
                  <Saisie {...a} value={form.delai_preparation_jours} onChange={(e) => setForm({ ...form, delai_preparation_jours: e.target.value })} inputMode="numeric" className="nombres" />
                )}
              </Champ>
            </div>

            <PhotosProduit photos={photos} onChange={setPhotos} />
          </div>
        </Carte>

        {!estNouveau && produit.data ? (
          <Carte className="p-4">
            <h3 className="text-produit">3. Remises par quantité</h3>
            <div className="mt-3">
              <PaliersProduit produitId={produit.data.id} prixDeBase={produit.data.prix_unitaire} />
            </div>
          </Carte>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Bouton disabled={enCours} onClick={() => void enregistrer()}>
            {enCours ? "Enregistrement" : "Enregistrer"}
          </Bouton>
          <Bouton variante="secondaire" onClick={() => naviguer("/pro/catalogue")}>
            Revenir au catalogue
          </Bouton>
          {!estNouveau ? (
            <Bouton
              variante="fantome"
              className="text-destructive-strong"
              onClick={async () => {
                await supprimerProduit(id as string);
                toast.success("Produit supprimé");
                naviguer("/pro/catalogue");
              }}
            >
              Supprimer
            </Bouton>
          ) : null}
        </div>
      </div>

      <DialogueDemandeMateriau
        ouvert={dialogueOuvert}
        onOuvertChange={setDialogueOuvert}
        fournisseurId={fiche.id}
        onDeposee={(demandeId, categorieId, _unite, poids, volume, nom) => {
          setDemande({ id: demandeId, nom, categorieId });
          setMateriau(null);
          setForm((f) => ({
            ...f,
            nom_affiche: f.nom_affiche || nom,
            poids_kg_unite: String(poids),
            volume_m3_unite: String(volume),
          }));
        }}
      />
    </>
  );
}
