import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cn, TAILLES_MAISON } from "@/lib/utils";

describe("cn — tailles maison et couleurs ne se battent pas", () => {
  it("garde la couleur quand une taille maison suit (bouton compact, 05/09/2026)", () => {
    const r = cn("bg-primary text-primary-foreground", "min-h-11 px-3 text-legende");
    expect(r).toContain("text-primary-foreground");
    expect(r).toContain("text-legende");
  });

  it("deux tailles : la dernière gagne, comme pour text-sm/text-lg", () => {
    expect(cn("text-legende", "text-courant")).toBe("text-courant");
    expect(cn("text-sm", "text-page")).toBe("text-page");
  });

  it("deux couleurs : la dernière gagne toujours", () => {
    expect(cn("text-foreground", "text-primary-foreground")).toBe("text-primary-foreground");
  });

  it("chaque taille de tailwind.config.ts est déclarée à tailwind-merge", () => {
    const config = readFileSync(new URL("../../tailwind.config.ts", import.meta.url), "utf8");
    const bloc = config.match(/fontSize:\s*\{([\s\S]*?)\n\s*\},/)?.[1] ?? "";
    const declarees = [...bloc.matchAll(/^\s*([a-z]+):\s*\[/gm)].map((m) => m[1]);
    expect(declarees.length).toBeGreaterThan(0);
    for (const taille of declarees) expect(TAILLES_MAISON).toContain(taille);
  });
});
