import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { FournisseurAuth } from "@/hooks/useAuth";
import { FournisseurInfobulle } from "@/components/ui/tooltip";
import { enregistrerServiceWorker } from "@/lib/pwa";
import { mesurerVitals } from "@/lib/vitals";
import { FrontiereErreurs } from "@/components/EcranCasse";
import "./index.css";

/**
 * Aucun abonnement Realtime pour rafraichir les donnees (regle A2.7) : on
 * s'appuie sur react-query, avec un staleTime genereux et un rafraichissement
 * au retour de focus. Sur un mutualise et un quota d'egress serre, c'est la
 * difference entre un site qui tient et un site qui coute.
 */
const clientRequetes = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const racine = document.getElementById("racine");
if (!racine) throw new Error("Element racine introuvable.");

createRoot(racine).render(
  <StrictMode>
    <QueryClientProvider client={clientRequetes}>
      <BrowserRouter>
        <FournisseurAuth>
          <FournisseurInfobulle delayDuration={200}>
            <FrontiereErreurs>
              <App />
            </FrontiereErreurs>
          </FournisseurInfobulle>
        </FournisseurAuth>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

enregistrerServiceWorker();
mesurerVitals();
