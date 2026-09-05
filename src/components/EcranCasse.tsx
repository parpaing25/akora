import * as React from "react";

/**
 * Frontière d'erreurs globale (audit Q-09 / C-07, 06/09/2026).
 *
 * Avant : aucune — une exception de rendu laissait une PAGE BLANCHE, sans un
 * mot. Ici : un écran qui dit ce qui s'est passé et propose de recharger, et
 * l'erreur part vers le suivi d'erreurs si un DSN est configuré (import
 * différé : le SDK ne pèse rien pour qui n'a pas d'erreur).
 */
interface Etat {
  cassee: boolean;
}

export class FrontiereErreurs extends React.Component<React.PropsWithChildren, Etat> {
  state: Etat = { cassee: false };

  static getDerivedStateFromError(): Etat {
    return { cassee: true };
  }

  componentDidCatch(erreur: Error, info: React.ErrorInfo) {
    console.error("Rendu interrompu :", erreur, info.componentStack);
    const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
    if (dsn && import.meta.env.PROD) {
      // Envoi minimal sans SDK : l'enveloppe Sentry est du JSON par ligne.
      try {
        const u = new URL(dsn);
        const projet = u.pathname.replace("/", "");
        const cle = u.username;
        const url = `${u.protocol}//${u.host}/api/${projet}/envelope/?sentry_key=${cle}&sentry_version=7`;
        const id = crypto.randomUUID().replace(/-/g, "");
        const corps =
          JSON.stringify({ event_id: id, sent_at: new Date().toISOString() }) + "\n" +
          JSON.stringify({ type: "event" }) + "\n" +
          JSON.stringify({
            event_id: id, level: "error", platform: "javascript", release: import.meta.env.VITE_VERSION ?? "inconnue",
            request: { url: location.pathname },
            exception: { values: [{ type: erreur.name, value: erreur.message.slice(0, 500), stacktrace: undefined }] },
            extra: { composants: (info.componentStack ?? "").slice(0, 2000) },
          });
        void fetch(url, { method: "POST", body: corps, keepalive: true });
      } catch {
        // le suivi d'erreurs ne doit jamais casser plus que ce qui l'est déjà
      }
    }
  }

  render() {
    if (!this.state.cassee) return this.props.children;
    return (
      <main className="container max-w-lg py-16 text-center">
        <p className="text-page">Quelque chose a cassé de notre côté</p>
        <p className="mt-3 text-courant text-muted-foreground">
          Ce n'est pas vous. Rechargez la page ; si ça continue, écrivez-nous à contact@akora.fonenako.mg
          en indiquant ce que vous faisiez.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-semibold text-primary-foreground"
          >
            Recharger la page
          </button>
          <a href="/" className="inline-flex min-h-11 items-center rounded-md border border-foreground px-4 font-semibold">
            Retour à l'accueil
          </a>
        </div>
      </main>
    );
  }
}
