import { AlertTriangle } from "lucide-react";
import { useParametre } from "@/hooks/useParametre";

/**
 * Bandeau d'incident (audit C-05, 06/09/2026). Piloté par la ligne
 * `parametres.bandeau_incident` : `{"actif": true, "texte": "…"}` l'affiche
 * sur toutes les pages en cinq minutes au plus, sans déploiement.
 *
 *   update public.parametres set valeur = '{"actif": true, "texte": "Les paiements MVola sont vérifiés avec retard ce matin."}' where cle = 'bandeau_incident';
 */
export function BandeauIncident() {
  const bandeau = useParametre<{ actif: boolean; texte: string }>("bandeau_incident", { actif: false, texte: "" });
  if (!bandeau.actif || !bandeau.texte) return null;
  return (
    <div role="status" className="border-b border-attention/40 bg-attention-soft px-4 py-2 text-legende text-foreground">
      <div className="container flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-attention-strong" aria-hidden="true" />
        <p>{bandeau.texte}</p>
      </div>
    </div>
  );
}
