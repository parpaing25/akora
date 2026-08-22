import * as React from "react";
import { toast } from "sonner";
import { Trash2, ImagePlus } from "lucide-react";
import { envoyerPhotos, PHOTOS_MAX_PAR_PRODUIT } from "@/lib/photos";
import { ImageProduit } from "@/components/produit/ImageProduit";
import { Bouton } from "@/components/ui/button";

/**
 * Photos du produit : compression navigateur, envoi séquentiel espacé d'une
 * seconde vers o2switch (spec D5). Huit au maximum, la première sert de
 * vignette dans les listes.
 */
export function PhotosProduit({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
}) {
  const champ = React.useRef<HTMLInputElement>(null);
  const [progression, setProgression] = React.useState<string | null>(null);

  const ajouter = async (fichiers: FileList) => {
    const restant = PHOTOS_MAX_PAR_PRODUIT - photos.length;
    if (restant <= 0) {
      toast.error("Huit photos au maximum par produit.");
      return;
    }
    const aEnvoyer = Array.from(fichiers).slice(0, restant);
    setProgression("Préparation…");
    try {
      const urls = await envoyerPhotos(aEnvoyer, "produits", (fait, total) =>
        setProgression(`Envoi ${fait} sur ${total}…`),
      );
      onChange([...photos, ...urls]);
      toast.success(urls.length > 1 ? `${urls.length} photos ajoutées` : "Photo ajoutée");
    } catch (erreur) {
      toast.error("Envoi impossible", { description: (erreur as Error).message });
    } finally {
      setProgression(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-legende font-semibold">Photos</p>
      <p className="text-[0.78rem] text-muted-foreground">
        Huit au maximum. La première sert de vignette. Elles sont réduites à 1280 px avant envoi,
        pour ne pas faire ramer les acheteurs en 3G.
      </p>

      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((url, index) => (
            <li key={url} className="relative">
              <ImageProduit
                src={url}
                alt={`Photo ${index + 1}`}
                variante="vignette"
                className="aspect-[4/3] w-full rounded-xs border border-border object-cover"
              />
              <button
                type="button"
                aria-label={`Retirer la photo ${index + 1}`}
                onClick={() => onChange(photos.filter((p) => p !== url))}
                className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-xs bg-card/90 text-destructive-strong shadow"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label htmlFor="photos-produit" className="sr-only">
        Ajouter des photos du produit
      </label>
      <input
        id="photos-produit"
        ref={champ}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) void ajouter(e.target.files);
          e.target.value = "";
        }}
      />
      <Bouton
        variante="secondaire"
        taille="compact"
        disabled={progression !== null || photos.length >= PHOTOS_MAX_PAR_PRODUIT}
        onClick={() => champ.current?.click()}
      >
        <ImagePlus className="size-4" aria-hidden="true" />
        {progression ?? "Ajouter des photos"}
      </Bouton>
      {progression ? (
        <p className="text-[0.78rem] text-muted-foreground" aria-live="polite">
          {progression}
        </p>
      ) : null}
    </div>
  );
}
