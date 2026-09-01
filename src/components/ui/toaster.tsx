import { Toaster as Sonner } from "sonner";

/**
 * Notifications éphémères. Les couleurs restent celles des tokens : pas la
 * palette de sonner (richColors), mais un filet latéral par ton — le même
 * vocabulaire que `.filet-primaire` et `AvertissementMetier` — pour qu'une
 * erreur ne ressemble jamais à un succès.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      richColors={false}
      closeButton
      toastOptions={{
        classNames: {
          toast: "carte text-[0.9375rem]",
          title: "font-semibold",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-foreground",
          success: "border-l-4 border-l-success [&_[data-icon]]:text-success",
          error: "border-l-4 border-l-destructive [&_[data-icon]]:text-destructive",
          warning: "border-l-4 border-l-accent [&_[data-icon]]:text-accent-strong",
          info: "border-l-4 border-l-primary [&_[data-icon]]:text-primary",
        },
      }}
    />
  );
}
