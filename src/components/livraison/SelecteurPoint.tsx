import * as React from "react";
import { MapPin, Crosshair, Pencil } from "lucide-react";
import { toast } from "sonner";
import { usePointLivraison, type PointLivraison } from "@/lib/point-livraison";
import { useGeolocalisation } from "@/hooks/useGeolocalisation";
import { Bouton } from "@/components/ui/button";
import { Tiroir, TiroirContenu, TiroirTitre } from "@/components/ui/drawer";
import { ChoixLocalite } from "@/components/pro/ChoixLocalite";
import { CartePoint } from "@/components/carte/CartePoint";

/**
 * Fixe le point de livraison, des trois façons prévues (spec B6 étape 1) :
 * recherche dans `localites`, « Ma position », clic sur la carte.
 *
 * Une fois fixé, il est rappelé en tête d'écran — « Livrer à … · modifier » —
 * parce que tous les prix affichés en dépendent.
 */
export function SelecteurPoint({ compact = false }: { compact?: boolean }) {
  const { point, definir, effacer } = usePointLivraison();
  const [ouvert, setOuvert] = React.useState(false);

  if (point && compact) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex min-h-11 items-center gap-1.5 text-legende text-muted-foreground hover:text-foreground"
      >
        <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate">Livrer à {point.libelle}</span>
        <span className="lien-souligne shrink-0">modifier</span>
        <TiroirPoint ouvert={ouvert} onOuvertChange={setOuvert} onDefinir={definir} onEffacer={effacer} point={point} />
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-3">
      {point ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-[0.9375rem]">
            <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">
              Livrer à <strong>{point.libelle}</strong>
            </span>
          </p>
          <Bouton variante="tertiaire" taille="compact" onClick={() => setOuvert(true)}>
            <Pencil className="size-4" aria-hidden="true" />
            Modifier
          </Bouton>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-legende text-muted-foreground">
            Dites où livrer pour voir les prix rendus chantier.
          </p>
          <Bouton taille="compact" onClick={() => setOuvert(true)}>
            <MapPin className="size-4" aria-hidden="true" />
            Choisir le lieu
          </Bouton>
        </div>
      )}
      <TiroirPoint ouvert={ouvert} onOuvertChange={setOuvert} onDefinir={definir} onEffacer={effacer} point={point} />
    </div>
  );
}

/**
 * Le tiroir seul, piloté de l'extérieur — pour l'en-tête et les boutons de
 * l'accueil, qui affichent leur propre déclencheur. Il se branche lui-même
 * sur le magasin du point de livraison.
 */
export function TiroirPointSeul({
  ouvert,
  onOuvertChange,
}: {
  ouvert: boolean;
  onOuvertChange: (v: boolean) => void;
}) {
  const { point, definir, effacer } = usePointLivraison();
  return (
    <TiroirPoint
      ouvert={ouvert}
      onOuvertChange={onOuvertChange}
      onDefinir={definir}
      onEffacer={effacer}
      point={point}
    />
  );
}

function TiroirPoint({
  ouvert,
  onOuvertChange,
  onDefinir,
  onEffacer,
  point,
}: {
  ouvert: boolean;
  onOuvertChange: (v: boolean) => void;
  onDefinir: (p: PointLivraison) => void;
  onEffacer: () => void;
  point: PointLivraison | null;
}) {
  const { localiser, enCours, erreur } = useGeolocalisation();
  const [brouillon, setBrouillon] = React.useState<PointLivraison | null>(point);

  React.useEffect(() => {
    if (ouvert) setBrouillon(point);
  }, [ouvert, point]);

  return (
    <Tiroir open={ouvert} onOpenChange={onOuvertChange}>
      <TiroirContenu>
        <TiroirTitre>Où livrer ?</TiroirTitre>
        <p className="mt-1 text-legende text-muted-foreground">
          Sans point de livraison, Akora n'affiche aucun prix de transport — il n'en invente pas.
        </p>

        <div className="mt-4 space-y-3">
          <ChoixLocalite
            valeur={brouillon?.localiteId ?? null}
            etiquette="Chercher une commune"
            aide="La liste vient de la base Akora, pas d'un service extérieur."
            onChange={(localite) => {
              if (!localite) return;
              if (localite.lat == null || localite.lng == null) {
                toast.info("Commune sans coordonnées", {
                  description: "Pointez votre chantier sur la carte ci-dessous.",
                });
                return;
              }
              setBrouillon({
                lat: localite.lat,
                lng: localite.lng,
                libelle: localite.nom,
                localiteId: localite.id,
                origine: "localite",
              });
            }}
          />

          <Bouton
            variante="secondaire"
            pleineLargeur
            disabled={enCours}
            onClick={async () => {
              const position = await localiser();
              if (position) {
                setBrouillon({ ...position, libelle: "ma position", localiteId: null, origine: "position" });
              }
            }}
          >
            <Crosshair className="size-4" aria-hidden="true" />
            {enCours ? "Localisation en cours" : "Utiliser ma position"}
          </Bouton>
          {erreur ? (
            <p role="alert" className="text-[0.78rem] text-destructive-strong">
              {erreur}
            </p>
          ) : null}

          <div>
            <p className="text-legende font-semibold">Ou pointez sur la carte</p>
            <CartePoint
              className="mt-1.5 h-56"
              intitule="Choisir le point de livraison"
              point={brouillon ? { lat: brouillon.lat, lng: brouillon.lng } : null}
              onChange={(p) =>
                setBrouillon({ ...p, libelle: "un point sur la carte", localiteId: null, origine: "carte" })
              }
            />
          </div>

          <div className="flex gap-2">
            <Bouton
              pleineLargeur
              disabled={!brouillon}
              onClick={() => {
                if (brouillon) onDefinir(brouillon);
                onOuvertChange(false);
              }}
            >
              Valider ce lieu
            </Bouton>
            {point ? (
              <Bouton
                variante="fantome"
                onClick={() => {
                  onEffacer();
                  onOuvertChange(false);
                }}
              >
                Retirer
              </Bouton>
            ) : null}
          </div>
        </div>
      </TiroirContenu>
    </Tiroir>
  );
}
