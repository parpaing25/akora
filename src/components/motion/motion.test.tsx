import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RouteLivraison } from "./RouteLivraison";
import { IllustrationCamion } from "./IllustrationCamion";
import { AnneauProgression } from "./AnneauProgression";

/**
 * Les briques d'animation de la V2 (02/09/2026). Elles ne s'affichent en
 * prod qu'à partir d'un dépôt avec camion déclaré — donc ce test est, pour
 * l'instant, le seul endroit où elles sont rendues. Il vérifie le rendu et
 * ce que dit le texte, jamais le mouvement lui-même.
 */
describe("RouteLivraison", () => {
  it("raconte le trajet et le prix, en ligne", () => {
    const html = renderToString(
      <RouteLivraison
        variante="ligne"
        depart="Sabotsy Namehana"
        arrivee="Ankadindramamy"
        distanceKm={9.8}
        montant={402000}
        legende="100 pièces, livrées"
      />,
    );
    expect(html).toContain("402");
    expect(html).toContain("Ankadindramamy");
    expect(html).toContain("9,8");
    expect(html).toContain("camion-ligne");
    expect(html).toContain("prix-pop");
  });

  it("dessine la courbe avec les deux lieux et le sous-titre", () => {
    const html = renderToString(
      <RouteLivraison
        variante="courbe"
        depart="Hourdis MG"
        arrivee="mon chantier"
        distanceKm={12.4}
        montant={150000}
        sousTitre="Camion benne · 1 voyage"
      />,
    );
    expect(html).toContain("camion-trajet");
    expect(html).toContain("Hourdis MG");
    expect(html).toContain("mon chantier");
    expect(html).toContain("12,4 km · Camion benne · 1 voyage");
  });

  it("ne dit rien d'une distance inconnue", () => {
    const html = renderToString(
      <RouteLivraison variante="ligne" depart="dépôt" arrivee="chantier" distanceKm={null} montant={1000} />,
    );
    expect(html).not.toContain("km");
  });
});

describe("IllustrationCamion", () => {
  it("dessine autant de roues que la catégorie en porte, et retombe sur le camion générique", () => {
    const benne = renderToString(<IllustrationCamion categorie="benne" />);
    expect(benne.match(/roue-tourne/g)?.length).toBe(3);
    const inconnu = renderToString(<IllustrationCamion categorie="ovni" />);
    expect(inconnu.match(/roue-tourne/g)?.length).toBe(2);
    const fige = renderToString(<IllustrationCamion categorie="semi" anime={false} />);
    expect(fige).not.toContain("roue-tourne");
  });
});

describe("AnneauProgression", () => {
  it("affiche la fraction et borne le remplissage", () => {
    expect(renderToString(<AnneauProgression fait={2} total={3} />)).toContain("2/3");
    const trop = renderToString(<AnneauProgression fait={9} total={3} />);
    expect(trop).toContain("9/3");
    // Rempli à 100 % au plus : le décalage résiduel est 0.
    expect(trop).toContain("--reste:0");
  });
});
