import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

/**
 * Toute la charte vit dans src/index.css sous forme de tokens HSL.
 * Ici on se contente de les exposer à Tailwind : aucune couleur, aucun rayon
 * et aucune ombre en dur (interdit de design n° 6 et n° 5).
 */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", lg: "2rem" },
      // Desktop : largeur maximale 1400 px (AKORA-DESIGN §9).
      screens: { "2xl": "1400px" },
    },
    extend: {
      // Sans cette clé, `font-sans` retombe sur la pile Tailwind par défaut,
      // qui ne contient PAS Inter — bug vécu sur Fonenako.
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
          strong: "hsl(var(--primary-strong))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          soft: "hsl(var(--secondary-soft))",
          strong: "hsl(var(--secondary-strong))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          soft: "hsl(var(--accent-soft))",
          strong: "hsl(var(--accent-strong))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
          strong: "hsl(var(--success-strong))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
          strong: "hsl(var(--destructive-strong))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        // 12 px : cartes. 10 px (`md`) : boutons et champs. 6 px (`xs`) : petits éléments.
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        // UNE SEULE ombre dans tout le produit (AKORA-DESIGN §4). Toutes les
        // classes `shadow-*` pointent volontairement sur la même valeur pour
        // qu'aucun composant shadcn n'en introduise une seconde.
        DEFAULT: "var(--ombre)",
        sm: "var(--ombre)",
        md: "var(--ombre)",
        lg: "var(--ombre)",
        xl: "var(--ombre)",
        "2xl": "var(--ombre)",
        inner: "var(--ombre)",
        none: "none",
      },
      fontSize: {
        // Échelle imposée (AKORA-DESIGN §2).
        page: ["2.125rem", { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "700" }],
        section: ["1.375rem", { lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "600" }],
        produit: ["1.0625rem", { lineHeight: "1.3", fontWeight: "600" }],
        courant: ["0.9375rem", { lineHeight: "1.55" }],
        legende: ["0.8125rem", { lineHeight: "1.45" }],
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        // Pulsation d'opacité 0,55 → 1 sur 1,4 s (AKORA-DESIGN §5, états).
        squelette: { "0%, 100%": { opacity: "0.55" }, "50%": { opacity: "1" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        squelette: "squelette 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [animate, typography],
} satisfies Config;
