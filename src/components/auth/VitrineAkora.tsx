import { ShieldCheck } from "lucide-react";
import { IllustrationCamion } from "@/components/motion/IllustrationCamion";
import { AnneauProgression } from "@/components/motion/AnneauProgression";
import { cn } from "@/lib/utils";

/**
 * La vitrine de l'inscription (03/09/2026) — ce qu'un compte apporte, en
 * trois cartes qu'on fait glisser du pouce, chacune avec un geste animé.
 *
 * ⚠ AUCUN PRIX, AUCUNE DISTANCE, AUCUN NOM DE DÉPÔT (règle A2.8) : une vitrine
 *   qui montrerait « 1 250 000 Ar rendu chantier » inventerait un chiffre, et
 *   ce site ne ment jamais sur un prix. Le camion roule, le badge se pose,
 *   l'anneau se remplit — les gestes du produit, pas des données.
 *
 * Trois cartes = les trois promesses déjà écrites dans PanneauMarque. Elles
 * ne sont pas recopiées : ce composant les reçoit, pour qu'une reformulation
 * ne se fasse qu'à un endroit.
 */
export function VitrineAkora({
  etapes,
  className,
}: {
  etapes: readonly (readonly [string, string])[];
  className?: string;
}) {
  const visuels = [
    <IllustrationCamion key="camion" categorie="camion" anime className="h-14 w-auto" />,
    <span
      key="badge"
      className="inline-flex items-center gap-1.5 rounded-full border border-secondary/40 bg-secondary-soft px-3 py-1.5 text-legende font-semibold text-secondary-strong"
    >
      <ShieldCheck className="size-4" aria-hidden="true" />
      Fournisseur vérifié
    </span>,
    <AnneauProgression key="anneau" fait={2} total={3} taille={56} />,
  ];

  return (
    <section aria-label="Ce qu'un compte Akora apporte" className={cn("-mx-5", className)}>
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {etapes.map(([titre, aide], index) => (
          <li
            key={titre}
            className="entree w-[82%] shrink-0 snap-center sm:w-[60%]"
            style={{ animationDelay: `${90 * index}ms` }}
          >
            <div className="carte flex h-full flex-col gap-3 p-4">
              <div className="flex h-14 items-center">{visuels[index] ?? null}</div>
              <p className="text-produit leading-snug">{titre}</p>
              <p className="text-legende leading-relaxed text-muted-foreground">{aide}</p>
            </div>
          </li>
        ))}
      </ul>
      {/* Trois points, pour dire qu'il y a trois cartes — sans les compter à
          haute voix : la liste est déjà lisible par un lecteur d'écran. */}
      <div className="mt-2 flex justify-center gap-1.5" aria-hidden="true">
        {etapes.map(([titre], index) => (
          <span
            key={titre}
            className={cn("h-1.5 rounded-full bg-primary/30", index === 0 ? "w-4 bg-primary" : "w-1.5")}
          />
        ))}
      </div>
    </section>
  );
}
