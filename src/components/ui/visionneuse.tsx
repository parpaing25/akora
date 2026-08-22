import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";

/**
 * Visionneuse de photos, avec zoom.
 *
 * Une photo de chantier se regarde de pres : on veut voir la texture du
 * parpaing, lire une etiquette, compter les rangees d'une palette. Une
 * vignette de 400 px ne le permet pas, et ouvrir l'image dans un onglet fait
 * sortir du fil.
 *
 * Le zoom marche a la molette, au double-clic et au PINCE a deux doigts —
 * c'est ce dernier qui compte, puisque l'essentiel du trafic est sur
 * telephone. Tout est en `transform` : le navigateur compose sans recalculer
 * la mise en page, donc cela reste fluide sur un appareil d'entree de gamme.
 *
 * Aucune bibliotheque. Un carrousel avec zoom pese 30 a 50 Ko ; ces cent
 * lignes en pesent deux.
 */
const ECHELLE_MIN = 1;
const ECHELLE_MAX = 5;
const ECHELLE_DOUBLE_CLIC = 2.5;

interface Point {
  x: number;
  y: number;
}

export function Visionneuse({
  photos,
  index,
  ouvert,
  onFermer,
  onIndex,
  legende,
}: {
  photos: readonly string[];
  index: number;
  ouvert: boolean;
  onFermer: () => void;
  onIndex: (index: number) => void;
  legende?: string;
}) {
  const [echelle, setEchelle] = React.useState(1);
  const [decalage, setDecalage] = React.useState<Point>({ x: 0, y: 0 });
  const pointeurs = React.useRef(new Map<number, Point>());
  const depart = React.useRef<{ distance: number; echelle: number; centre: Point } | null>(null);
  const glisse = React.useRef<{ origine: Point; decalage: Point } | null>(null);

  const reinitialiser = React.useCallback(() => {
    setEchelle(1);
    setDecalage({ x: 0, y: 0 });
  }, []);

  // Changer de photo remet le zoom a plat : garder l'agrandissement de la
  // precedente ferait arriver sur un detail sans savoir lequel.
  React.useEffect(() => {
    reinitialiser();
  }, [index, ouvert, reinitialiser]);

  const aller = React.useCallback(
    (pas: number) => {
      if (photos.length < 2) return;
      onIndex((index + pas + photos.length) % photos.length);
    },
    [index, onIndex, photos.length],
  );

  React.useEffect(() => {
    if (!ouvert) return;
    const clavier = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") aller(1);
      else if (e.key === "ArrowLeft") aller(-1);
      else if (e.key === "0") reinitialiser();
    };
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  }, [ouvert, aller, reinitialiser]);

  /** Zoom autour d'un point, pour que ce qu'on vise reste sous le doigt. */
  const zoomerVers = (facteur: number, centre?: Point) => {
    setEchelle((precedente) => {
      const suivante = Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN, precedente * facteur));
      if (suivante === 1) setDecalage({ x: 0, y: 0 });
      else if (centre) {
        const rapport = suivante / precedente;
        setDecalage((d) => ({
          x: centre.x - (centre.x - d.x) * rapport,
          y: centre.y - (centre.y - d.y) * rapport,
        }));
      }
      return suivante;
    });
  };

  const distanceEntre = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const milieu = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const surPointeurBas = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const liste = [...pointeurs.current.values()];
    if (liste.length === 2) {
      depart.current = {
        distance: distanceEntre(liste[0]!, liste[1]!),
        echelle,
        centre: milieu(liste[0]!, liste[1]!),
      };
      glisse.current = null;
    } else if (liste.length === 1 && echelle > 1) {
      glisse.current = { origine: { x: e.clientX, y: e.clientY }, decalage };
    }
  };

  const surPointeurBouge = (e: React.PointerEvent) => {
    if (!pointeurs.current.has(e.pointerId)) return;
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const liste = [...pointeurs.current.values()];

    // Deux doigts : pince. C'est le geste qu'on attend sur un telephone.
    if (liste.length === 2 && depart.current) {
      const distance = distanceEntre(liste[0]!, liste[1]!);
      const suivante = Math.min(
        ECHELLE_MAX,
        Math.max(ECHELLE_MIN, (depart.current.echelle * distance) / depart.current.distance),
      );
      setEchelle(suivante);
      if (suivante === 1) setDecalage({ x: 0, y: 0 });
      return;
    }

    // Un doigt, image agrandie : on deplace.
    if (liste.length === 1 && glisse.current) {
      setDecalage({
        x: glisse.current.decalage.x + (e.clientX - glisse.current.origine.x),
        y: glisse.current.decalage.y + (e.clientY - glisse.current.origine.y),
      });
    }
  };

  const surPointeurHaut = (e: React.PointerEvent) => {
    pointeurs.current.delete(e.pointerId);
    if (pointeurs.current.size < 2) depart.current = null;
    if (pointeurs.current.size === 0) glisse.current = null;
  };

  if (photos.length === 0) return null;
  const photo = photos[Math.min(index, photos.length - 1)];

  return (
    <DialogPrimitive.Root open={ouvert} onOpenChange={(o) => (o ? undefined : onFermer())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/90 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">
            {legende ?? "Photo en grand"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Molette, double-clic ou pincement à deux doigts pour zoomer. Flèches pour changer de
            photo, Échap pour fermer.
          </DialogPrimitive.Description>

          <div className="flex shrink-0 items-center justify-between gap-2 p-2 text-background">
            <p className="nombres px-2 text-legende text-background/80">
              {photos.length > 1 ? `${index + 1} / ${photos.length}` : legende ? "" : ""}
              {legende ? <span className="ml-2 text-background/60">{legende}</span> : null}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => zoomerVers(1 / 1.4)}
                disabled={echelle <= ECHELLE_MIN}
                aria-label="Réduire"
                className="cible-44 flex items-center justify-center rounded-md text-background/80 hover:bg-background/10 disabled:opacity-40"
              >
                <Minus size={18} aria-hidden="true" />
              </button>
              <span className="nombres w-12 text-center text-legende text-background/80">
                {Math.round(echelle * 100)} %
              </span>
              <button
                type="button"
                onClick={() => zoomerVers(1.4)}
                disabled={echelle >= ECHELLE_MAX}
                aria-label="Agrandir"
                className="cible-44 flex items-center justify-center rounded-md text-background/80 hover:bg-background/10 disabled:opacity-40"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
              <DialogPrimitive.Close
                aria-label="Fermer"
                className="cible-44 flex items-center justify-center rounded-md text-background/80 hover:bg-background/10"
              >
                <X size={20} aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div
            className="relative flex-1 select-none overflow-hidden"
            onPointerDown={surPointeurBas}
            onPointerMove={surPointeurBouge}
            onPointerUp={surPointeurHaut}
            onPointerCancel={surPointeurHaut}
            onWheel={(e) => {
              if (!e.ctrlKey && Math.abs(e.deltaY) < 1) return;
              zoomerVers(e.deltaY < 0 ? 1.15 : 1 / 1.15, { x: e.clientX, y: e.clientY });
            }}
            onDoubleClick={(e) =>
              echelle > 1
                ? reinitialiser()
                : zoomerVers(ECHELLE_DOUBLE_CLIC, { x: e.clientX, y: e.clientY })
            }
          >
            <img
              src={photo}
              alt={legende ?? ""}
              draggable={false}
              className="absolute inset-0 size-full object-contain"
              style={{
                transform: `translate(${decalage.x}px, ${decalage.y}px) scale(${echelle})`,
                transformOrigin: "center",
                transition: pointeurs.current.size > 0 ? "none" : "transform 160ms var(--courbe)",
                cursor: echelle > 1 ? "grab" : "zoom-in",
                touchAction: "none",
              }}
            />

            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => aller(-1)}
                  aria-label="Photo précédente"
                  className="cible-44 absolute left-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-foreground/50 text-background hover:bg-foreground/70"
                >
                  <ChevronLeft size={22} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => aller(1)}
                  aria-label="Photo suivante"
                  className="cible-44 absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-foreground/50 text-background hover:bg-foreground/70"
                >
                  <ChevronRight size={22} aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>

          {photos.length > 1 ? (
            <div className="flex shrink-0 justify-center gap-2 p-3">
              {photos.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => onIndex(i)}
                  aria-label={`Voir la photo ${i + 1}`}
                  aria-current={i === index}
                  className={
                    "size-14 overflow-hidden rounded-md border-2 " +
                    (i === index ? "border-primary" : "border-transparent opacity-60")
                  }
                >
                  <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Etat pret a l'emploi : `const v = useVisionneuse(photos)`. */
export function useVisionneuse(photos: readonly string[]) {
  const [index, setIndex] = React.useState(0);
  const [ouvert, setOuvert] = React.useState(false);
  return {
    index,
    ouvert,
    ouvrir: (i = 0) => {
      setIndex(i);
      setOuvert(true);
    },
    fermer: () => setOuvert(false),
    changer: setIndex,
    photos,
  };
}
