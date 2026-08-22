import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.dirname(fileURLToPath(import.meta.url));
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: { host: "::", port: 8080 },
  plugins: [
    react(),
    VitePWA({
      // Le service worker est enregistré à la main, après « load » (cf. src/lib/pwa.ts) :
      // le précache ne doit jamais concurrencer le premier rendu sur une 3G lente.
      injectRegister: false,
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw.js",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "Akora — matériaux de construction à Madagascar",
        short_name: "Akora",
        description: "Le prix rendu chantier, pas le prix au dépôt.",
        lang: "fr",
        theme_color: "#BB4A18",
        background_color: "#FCFAF6",
        display: "standalone",
        scope: "/",
        start_url: "/",
        orientation: "portrait-primary",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      injectManifest: {
        // ── PRÉCACHE = LA COQUILLE, RIEN DE PLUS ─────────────────────────────
        // Retour d'expérience Fonenako : un précache de 154 fichiers a fait
        // passer l'accueil de 4,3 s à 9,6 s sur mutualisé. On ne précache donc
        // QUE ce que la première page télécharge déjà de toute façon.
        globPatterns: [
          "index.html",
          "assets/index-*.css",
          "assets/index-*.js",
          "assets/react-vendor-*.js",
          "assets/supabase-vendor-*.js",
          "fonts/*.woff2",
        ],
        maximumFileSizeToCacheInBytes: 600 * 1024,
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(racine, "./src") } },
  build: {
    // Pas de sourcemap en production (règle A3) : on n'expose pas le code source.
    sourcemap: false,
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Deux vendors seulement. Surtout PAS de chunk « radix » global :
        // mesuré sur Fonenako, il facturait 48 Ko gzip de dialogues et
        // d'onglets à chaque visiteur de l'accueil. Rollup découpe le reste
        // par usage réel.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "supabase-vendor": ["@supabase/supabase-js"],
        },
        // Fusionne tout chunk sous 5 Ko dans son parent : 33 micro-fichiers,
        // c'est 33 allers-retours réseau sur une 3G à 185 ms de RTT.
        experimentalMinChunkSize: 5_000,
      },
    },
  },
});
