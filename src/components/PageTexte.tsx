import * as React from "react";
import { Seo } from "@/components/Seo";

/**
 * Enveloppe des pages éditoriales.
 *
 * Une seule colonne, largeur de lecture bornée, titres hiérarchisés. Le ton
 * suit AKORA-DESIGN §13 : matière et franchise, français simple, aucun
 * superlatif — on explique le mécanisme au moment où il coûte quelque chose
 * au lecteur.
 */
export function PageTexte({
  titre,
  chemin,
  description,
  chapeau,
  majLe,
  indexable = true,
  donneesStructurees,
  children,
}: {
  titre: string;
  chemin: string;
  description?: string;
  chapeau?: string;
  majLe?: string;
  indexable?: boolean;
  donneesStructurees?: Record<string, unknown> | Record<string, unknown>[];
  children: React.ReactNode;
}) {
  return (
    <div className="container max-w-2xl py-8">
      <Seo
        titre={titre}
        chemin={chemin}
        description={description ?? chapeau}
        indexable={indexable}
        donneesStructurees={donneesStructurees}
      />
      <h1 className="text-page">{titre}</h1>
      {chapeau ? <p className="mt-2 text-[1.0625rem] text-muted-foreground">{chapeau}</p> : null}

      <div
        className={
          "prose prose-sm mt-6 max-w-none prose-headings:font-semibold prose-headings:tracking-tight " +
          "prose-h2:text-section prose-h2:mt-8 prose-h3:text-produit prose-h3:mt-6 " +
          "prose-p:text-[0.9375rem] prose-p:leading-relaxed prose-li:text-[0.9375rem] " +
          "prose-a:text-secondary-strong prose-strong:text-foreground"
        }
      >
        {children}
      </div>

      {majLe ? (
        <p className="mt-8 border-t border-border pt-3 text-[0.78rem] text-muted-foreground">
          Dernière mise à jour : {majLe}.
        </p>
      ) : null}
    </div>
  );
}
