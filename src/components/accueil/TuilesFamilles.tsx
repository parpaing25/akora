import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listerFamilles } from "@/lib/donnees/categories";
import { Squelette } from "@/components/ui/skeleton";

/**
 * Les familles du catalogue en tuiles — une icône, un mot. C'est la porte
 * d'entrée « je sais ce que je cherche » de la V2 : deux tapes de l'accueil
 * au comparateur, sans lire une phrase. Les familles viennent de la base,
 * jamais d'une liste écrite ici ; l'icône est choisie par slug, et un slug
 * inconnu reçoit l'icône générique.
 */
const ICONES: Record<string, JSX.Element> = {
  agglomeres: (
    <>
      <rect x="3" y="5" width="8" height="6" rx="1" /><rect x="13" y="5" width="8" height="6" rx="1" />
      <rect x="8" y="13" width="8" height="6" rx="1" /><rect x="3" y="13" width="3" height="6" rx="1" /><rect x="18" y="13" width="3" height="6" rx="1" />
    </>
  ),
  briques: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" /><path d="M3 12h18" /><path d="M12 4v8" /><path d="M7.5 12v8" /><path d="M16.5 12v8" />
    </>
  ),
  granulats: (
    <>
      <path d="M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </>
  ),
  liants: (
    <>
      <path d="M6 3h12l1 5H5l1-5Z" /><path d="M5 8h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8Z" /><path d="M9 13h6" />
    </>
  ),
  bois: (
    <>
      <path d="M12 22V10" /><path d="M12 3 5 12h4l-3 5h12l-3-5h4L12 3Z" />
    </>
  ),
  couverture: (
    <>
      <path d="M3 11 12 4l9 7" /><path d="M5 10v9h14v-9" /><path d="M9 19v-5h6v5" />
    </>
  ),
  acier: (
    <>
      <path d="M4 20 20 4" /><path d="M4 14 14 4" /><path d="M10 20 20 10" /><circle cx="4" cy="20" r="1.5" /><circle cx="20" cy="4" r="1.5" />
    </>
  ),
  "beton-pret": (
    <>
      <path d="M3 17h13l3-6h2" /><circle cx="7" cy="19" r="2" /><circle cx="17" cy="19" r="2" /><path d="M6 11a5 5 0 1 1 10 0v6H6v-6Z" />
    </>
  ),
};

/**
 * ⚠ UN MOT PAR TUILE, CALCULÉ. À 390 px, quatre tuiles font 81 px de large :
 *   à 12 px semi-gras, onze caractères tiennent sur une ligne. « Agglomérés
 *   et préfabriqués béton » s'affichait « Agglomérés et… » à 11,5 px. Le nom
 *   complet reste le nom accessible du lien ; l'œil, lui, lit un mot.
 */
const NOMS_COURTS: Record<string, string> = {
  agglomeres: "Agglomérés",
  briques: "Briques",
  granulats: "Granulats",
  liants: "Liants",
  bois: "Bois",
  couverture: "Couverture",
  acier: "Acier",
  "beton-pret": "Béton prêt",
};

const ICONE_DEFAUT = (
  <>
    <path d="m12 2 9 4.5-9 4.5-9-4.5Z" /><path d="m3 12 9 4.5 9-4.5" /><path d="m3 17 9 4.5 9-4.5" />
  </>
);

export function TuilesFamilles({ className }: { className?: string }) {
  const familles = useQuery({ queryKey: ["familles"], queryFn: listerFamilles, staleTime: 30 * 60_000 });

  if (familles.isPending) {
    return (
      <div className={"grid grid-cols-4 gap-2 " + (className ?? "")} aria-busy="true">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Squelette key={i} className="h-[5.25rem] rounded-lg" />
        ))}
      </div>
    );
  }
  if (!familles.data?.length) return null;

  return (
    <nav aria-label="Familles de matériaux" className={className}>
      <ul className="grid grid-cols-4 gap-2">
        {familles.data.map((famille, index) => (
          <li key={famille.id} className="entree" style={{ animationDelay: `${60 * index}ms` }}>
            <Link
              to={`/materiaux/${famille.slug}`}
              aria-label={famille.nom}
              title={famille.nom}
              className="carte carte-cliquable flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 px-1 text-center text-[0.75rem] font-semibold leading-tight"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-7 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONES[famille.slug] ?? ICONE_DEFAUT}
              </svg>
              <span className="line-clamp-2">{NOMS_COURTS[famille.slug] ?? famille.nom}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
