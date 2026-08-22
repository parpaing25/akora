import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.dirname(fileURLToPath(import.meta.url));

/**
 * Configuration dédiée à la passe axe-core.
 *
 * Elle est SÉPARÉE de vitest.config.ts à dessein : la suite principale ne
 * teste que la logique métier pure (règle A7). Celle-ci ne teste rien — elle
 * audite le rendu statique des écrans les plus riches en formulaires, et
 * échoue s'il reste une violation critique ou sérieuse.
 */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(racine, "./src") } },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://audit.invalid"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("cle-de-test-hors-ligne"),
    "import.meta.env.VITE_SITE_URL": JSON.stringify("https://akora.fonenako.mg"),
  },
  test: {
    environment: "jsdom",
    include: ["src/qualite/**/*.a11y.ts"],
  },
});
