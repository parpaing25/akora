import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.dirname(fileURLToPath(import.meta.url));

// Les tests portent sur la LOGIQUE MÉTIER PURE (livraison, paliers, commission,
// ledger, machine à états, métrés). Aucun test de rendu (règle A7).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(racine, "./src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: ["default"],
  },
});
