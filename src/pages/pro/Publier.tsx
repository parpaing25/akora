import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { useMaFiche } from "@/hooks/useMaFiche";
import { listerMesProduits } from "@/lib/donnees/produits";
import { publier, type TypePublication } from "@/lib/donnees/fil";
import { envoyerPhotos } from "@/lib/photos";
import { Seo } from "@/components/Seo";
import { Champ } from "@/components/ui/champ";
import { Bouton } from "@/components/ui/button";
import { GroupeRadio, OptionRadio } from "@/components/ui/radio-group";
import { Squelette } from "@/components/ui/skeleton";
import { EtatVide } from "@/components/ui/etats";

/**
 * Publier dans le fil.
 *
 * Le fil ne vaut que par ce qu'on y met : sans cet écran, la page d'accueil
 * resterait vide indéfiniment. Trois natures d'annonce, parce qu'un dépôt n'a
 * pas dix choses à dire — du stock arrive, un prix baisse, un camion part.
 *
 * Les photos partent sur o2switch, jamais dans Supabase Storage (règle A2.6) :
 * l'egress du plan Supabase est la ressource la plus chère du produit.
 */

const NATURES: { valeur: Exclude<TypePublication, "prix_marche" | "demande">; titre: string; detail: string }[] = [
  {
    valeur: "stock",
    titre: "Stock disponible",
    detail: "Ce qui vient d'arriver au dépôt, et en quelle quantité.",
  },
  {
    valeur: "baisse_prix",
    titre: "Baisse de prix",
    detail: "Un prix qui descend, et jusqu'à quand il tient.",
  },
  {
    valeur: "livraison",
    titre: "Tournée de livraison",
    detail: "Un camion qui part vers un secteur, et quand.",
  },
];

const MAX_PHOTOS = 4;
const MAX_PRODUITS = 4;

export default function Publier() {
  const naviguer = useNavigate();
  const fiche = useMaFiche();
  const client = useQueryClient();

  const [nature, setNature] = React.useState<(typeof NATURES)[number]["valeur"]>("stock");
  const [texte, setTexte] = React.useState("");
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [produitIds, setProduitIds] = React.useState<string[]>([]);
  const [jours, setJours] = React.useState<string>("7");
  const [envoiPhoto, setEnvoiPhoto] = React.useState(false);
  const [enCours, setEnCours] = React.useState(false);

  const fournisseurId = fiche.data?.id ?? null;

  const catalogue = useQuery({
    queryKey: ["mes-produits", fournisseurId],
    enabled: Boolean(fournisseurId),
    staleTime: 60_000,
    queryFn: () => listerMesProduits(fournisseurId as string),
  });

  const produitsActifs = React.useMemo(
    () => (catalogue.data ?? []).filter((produit) => produit.statut === "actif"),
    [catalogue.data],
  );

  const ajouterPhotos = async (fichiers: FileList | null) => {
    if (!fichiers || fichiers.length === 0) return;
    const place = MAX_PHOTOS - photos.length;
    if (place <= 0) {
      toast.error(`Quatre photos au maximum.`);
      return;
    }
    setEnvoiPhoto(true);
    try {
      const urls = await envoyerPhotos(Array.from(fichiers).slice(0, place), "produits");
      setPhotos((precedentes) => [...precedentes, ...urls]);
    } catch (erreur) {
      toast.error("Envoi impossible", { description: (erreur as Error).message });
    } finally {
      setEnvoiPhoto(false);
    }
  };

  const basculerProduit = (id: string) => {
    setProduitIds((precedents) =>
      precedents.includes(id)
        ? precedents.filter((autre) => autre !== id)
        : precedents.length >= MAX_PRODUITS
          ? precedents
          : [...precedents, id],
    );
  };

  const soumettre = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    if (!fournisseurId) return;
    if (texte.trim().length < 10) {
      toast.error("Dites-en un peu plus", { description: "Dix caractères au minimum." });
      return;
    }
    setEnCours(true);
    try {
      const duree = Number.parseInt(jours, 10);
      await publier({
        type: nature,
        texte: texte.trim(),
        photos,
        fournisseurId,
        produitIds,
        expireLe:
          Number.isFinite(duree) && duree > 0
            ? new Date(Date.now() + duree * 86_400_000).toISOString()
            : null,
      });
      await client.invalidateQueries({ queryKey: ["fil"] });
      toast.success("Publié dans le fil");
      naviguer("/", { replace: true });
    } catch (erreur) {
      toast.error("Publication impossible", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  if (fiche.isLoading) {
    /* Squelette à la forme de la page (§5) : titre, intro, puis les trois
       grands blocs du formulaire — jamais un texte de chargement nu. */
    return (
      <div className="space-y-5">
        <Squelette className="h-7 w-52" />
        <Squelette className="h-4 w-4/5" />
        <Squelette className="h-24 w-full" />
        <Squelette className="h-32 w-full" />
        <Squelette className="h-24 w-full" />
      </div>
    );
  }

  if (!fiche.data || fiche.data.statut !== "actif") {
    return (
      <>
        <Seo titre="Publier dans le fil" chemin="/pro/publier" indexable={false} />
        <EtatVide
          titre="Votre dépôt n'est pas encore actif"
          phrase="Seuls les dépôts actifs publient dans le fil : c'est ce qui l'empêche de se remplir d'annonces invérifiables. Terminez votre dossier de vérification."
        />
      </>
    );
  }

  return (
    <>
      <Seo titre="Publier dans le fil" chemin="/pro/publier" indexable={false} />
      <h1 className="text-page">Publier dans le fil</h1>
      <p className="mt-1 text-legende text-muted-foreground">
        Votre annonce apparaît sur l'accueil des acheteurs, avec le prix rendu à leur chantier.
        Dix publications par jour au maximum.
      </p>

      <form onSubmit={soumettre} className="mt-5 space-y-5">
        <fieldset className="m-0 border-0 p-0">
          <legend className="pb-2.5 text-legende font-semibold">Nature de l'annonce</legend>
          <GroupeRadio
            className="sm:grid-cols-3"
            value={nature}
            onValueChange={(v) => setNature(v as typeof nature)}
          >
            {NATURES.map((option) => (
              <OptionRadio
                key={option.valeur}
                id={`nature-${option.valeur}`}
                valeur={option.valeur}
                titre={option.titre}
                detail={option.detail}
              />
            ))}
          </GroupeRadio>
        </fieldset>

        <Champ
          etiquette="Votre annonce"
          aide="Dites ce qui change, où, et jusqu'à quand. Entre 10 et 1200 caractères."
          obligatoire
        >
          {(attributs) => (
            <textarea
              {...attributs}
              value={texte}
              onChange={(e) => setTexte(e.target.value.slice(0, 1200))}
              rows={4}
              placeholder="Baisse sur le parpaing 15 jusqu'à samedi. Stock plein, livraison le jour même sur Talatamaty, Ivato et Ambohidratrimo."
              className="w-full rounded-md border border-input bg-card p-3 text-courant outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
        </Champ>
        <p className="nombres -mt-3 text-right text-[0.72rem] text-muted-foreground">
          {texte.length} / 1200
        </p>

        <div>
          <p className="mb-2 text-legende font-semibold">Photos (quatre au maximum)</p>
          <div className="flex flex-wrap gap-2">
            {photos.map((url) => (
              <span key={url} className="relative">
                <img
                  src={url}
                  alt=""
                  width={96}
                  height={96}
                  className="size-24 rounded-md border border-border bg-muted object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotos((p) => p.filter((autre) => autre !== url))}
                  aria-label="Retirer cette photo"
                  className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full border border-border bg-card"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <label
                htmlFor="ajout-photos"
                className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input text-legende text-muted-foreground"
              >
                <ImagePlus size={20} aria-hidden="true" />
                {envoiPhoto ? "Envoi…" : "Ajouter"}
                <input
                  id="ajout-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={envoiPhoto}
                  onChange={(e) => {
                    void ajouterPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-1 text-legende font-semibold">
            Produits mis en avant (quatre au maximum)
          </p>
          <p className="mb-2 text-[0.72rem] text-muted-foreground">
            Le premier produit porte le prix rendu chantier affiché sur la carte.
          </p>
          {produitsActifs.length === 0 ? (
            <p className="rounded-md bg-muted p-3 text-legende text-muted-foreground">
              Aucun produit actif dans votre catalogue. Une annonce sans produit reste possible,
              mais elle n'affichera pas de prix rendu.
            </p>
          ) : (
            <ul className="space-y-2">
              {produitsActifs.map((produit) => {
                const choisi = produitIds.includes(produit.id);
                return (
                  <li key={produit.id}>
                    <label
                      htmlFor={`produit-${produit.id}`}
                      className={
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border p-3 " +
                        (choisi ? "border-primary bg-primary-soft" : "border-border bg-card")
                      }
                    >
                      <input
                        id={`produit-${produit.id}`}
                        type="checkbox"
                        checked={choisi}
                        onChange={() => basculerProduit(produit.id)}
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate text-courant">
                        {produit.nom_affiche}
                      </span>
                      {choisi ? (
                        <span className="nombres shrink-0 text-legende text-muted-foreground">
                          {produitIds.indexOf(produit.id) + 1}
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Champ
          etiquette="Retirer du fil après"
          aide="Une annonce périmée dessert le dépôt qui l'a publiée."
        >
          {(attributs) => (
            <select
              {...attributs}
              value={jours}
              onChange={(e) => setJours(e.target.value)}
              className="cible-44 w-full rounded-md border border-input bg-card px-3 text-courant"
            >
              <option value="2">2 jours</option>
              <option value="7">7 jours</option>
              <option value="14">14 jours</option>
              <option value="30">30 jours</option>
              <option value="0">Ne pas retirer</option>
            </select>
          )}
        </Champ>

        <Bouton type="submit" disabled={enCours || envoiPhoto} pleineLargeur>
          {enCours ? "Publication en cours" : "Publier dans le fil"}
        </Bouton>
      </form>
    </>
  );
}
