import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { formaterDateHeure } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Bulle, BulleContenu, BulleDeclencheur } from "@/components/ui/popover";
import { Bouton } from "@/components/ui/button";

/** Cloche de notifications. Alimentée par le seul canal Realtime du produit. */
export function Notifications() {
  const { data, nonLues, marquerLue, marquerToutesLues } = useNotifications();

  return (
    <Bulle>
      <BulleDeclencheur asChild>
        <button
          type="button"
          className="relative inline-flex cible-44 items-center justify-center rounded-md text-foreground hover:bg-muted"
          aria-label={nonLues > 0 ? nonLues + " notification(s) non lue(s)" : "Notifications"}
        >
          <Bell className="size-5" aria-hidden="true" />
          {nonLues > 0 ? (
            <span
              aria-hidden="true"
              className="nombres absolute right-1 top-1 min-w-[1.1rem] rounded-full bg-primary px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-primary-foreground"
            >
              {nonLues > 9 ? "9+" : nonLues}
            </span>
          ) : null}
        </button>
      </BulleDeclencheur>

      <BulleContenu align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-legende font-semibold">Notifications</p>
          {nonLues > 0 ? (
            <Bouton variante="fantome" taille="compact" onClick={() => void marquerToutesLues()}>
              Tout marquer lu
            </Bouton>
          ) : null}
        </div>

        {(data ?? []).length === 0 ? (
          <p className="px-3 py-6 text-center text-legende text-muted-foreground">
            Rien pour l'instant.
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {(data ?? []).map((n) => {
              const contenu = (
                <>
                  <span className={cn("block text-[0.9375rem]", !n.lue && "font-semibold")}>{n.titre}</span>
                  {n.corps ? (
                    <span className="mt-0.5 block text-[0.78rem] text-muted-foreground">{n.corps}</span>
                  ) : null}
                  <span className="nombres mt-0.5 block text-[0.75rem] text-muted-foreground">
                    {formaterDateHeure(n.created_at)}
                  </span>
                </>
              );
              return (
                <li key={n.id} className={cn(!n.lue && "bg-primary-soft/60")}>
                  {n.lien ? (
                    <Link
                      to={n.lien}
                      onClick={() => void marquerLue(n.id)}
                      className="block px-3 py-2.5 hover:bg-muted"
                    >
                      {contenu}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void marquerLue(n.id)}
                      className="block w-full px-3 py-2.5 text-left hover:bg-muted"
                    >
                      {contenu}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </BulleContenu>
    </Bulle>
  );
}
