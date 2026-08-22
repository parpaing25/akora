import { Toaster as Sonner } from "sonner";

/** Notifications ephemeres. Les couleurs restent celles des tokens. */
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
        },
      }}
    />
  );
}
