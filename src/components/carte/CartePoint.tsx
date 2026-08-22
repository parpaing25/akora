import * as React from "react";
import { cn } from "@/lib/utils";
import type { Point } from "@/lib/livraison";

/**
 * Carte Leaflet + tuiles OpenStreetMap (règle A2.3 : aucune API à clé).
 *
 * Leaflet et sa feuille de style sont chargés à la demande, dans ce composant
 * et nulle part ailleurs : ils ne pèsent donc jamais sur le premier rendu de
 * l'accueil ni sur celui d'une liste.
 *
 * Le repère est un `circleMarker` — un cercle SVG — plutôt qu'une icône
 * d'image : pas d'asset à résoudre par le bundler, et la couleur vient du
 * token latérite lu sur le document, donc aucune couleur en dur.
 */

const CENTRE_MADAGASCAR: Point = { lat: -18.8792, lng: 47.5079 };

function couleurToken(nom: string, repli: string): string {
  if (typeof window === "undefined") return repli;
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  return valeur ? `hsl(${valeur})` : repli;
}

export interface ProprietesCartePoint {
  point: Point | null;
  /** Absent = carte en lecture seule. */
  onChange?: (point: Point) => void;
  zoom?: number;
  className?: string;
  /** Étiquette lue par les lecteurs d'écran. */
  intitule: string;
}

export function CartePoint({ point, onChange, zoom = 13, className, intitule }: ProprietesCartePoint) {
  const conteneur = React.useRef<HTMLDivElement>(null);
  const carte = React.useRef<import("leaflet").Map | null>(null);
  const repere = React.useRef<import("leaflet").CircleMarker | null>(null);
  const rappel = React.useRef(onChange);
  rappel.current = onChange;

  React.useEffect(() => {
    let annule = false;
    let instance: import("leaflet").Map | null = null;

    void (async () => {
      const [L] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
      if (annule || !conteneur.current || carte.current) return;

      instance = L.map(conteneur.current, {
        center: point ?? CENTRE_MADAGASCAR,
        zoom: point ? zoom : 6,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(instance);

      if (rappel.current) {
        instance.on("click", (evenement) => {
          rappel.current?.({ lat: evenement.latlng.lat, lng: evenement.latlng.lng });
        });
      }
      carte.current = instance;
      // La carte est souvent montée dans un conteneur qui vient d'apparaître :
      // sans ce recalcul, Leaflet dessine sur une taille de zéro.
      setTimeout(() => instance?.invalidateSize(), 0);
    })();

    return () => {
      annule = true;
      instance?.remove();
      carte.current = null;
      repere.current = null;
    };
    // Volontairement monté une seule fois : les changements de `point` sont
    // traités par l'effet suivant, sans reconstruire la carte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const instance = carte.current;
    if (!instance) return;
    void (async () => {
      const L = await import("leaflet");
      if (!point) {
        repere.current?.remove();
        repere.current = null;
        return;
      }
      if (repere.current) {
        repere.current.setLatLng(point);
      } else {
        repere.current = L.circleMarker(point, {
          radius: 9,
          weight: 3,
          color: couleurToken("--primary", "#bb4a18"),
          fillColor: couleurToken("--primary", "#bb4a18"),
          fillOpacity: 0.35,
        }).addTo(instance);
      }
      instance.setView(point, Math.max(instance.getZoom(), zoom));
    })();
  }, [point, zoom]);

  return (
    <div
      ref={conteneur}
      role="application"
      aria-label={intitule}
      className={cn("w-full overflow-hidden rounded-md border border-border bg-muted", className)}
    />
  );
}
