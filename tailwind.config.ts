import type { Config } from "tailwindcss";

/**
 * praxisAI design tokens.
 * Direction: "calm clinical precision" — a clean neutral canvas, a deliberate
 * violet brand accent, layered realistic shadows, and a deep ink sidebar.
 * Token NAMES are kept stable (brand / navy / line / shadow-card / font-display)
 * so every existing component inherits the refresh; values are recalibrated.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Canvas + surfaces
        bg: "#f6f7f9",
        surface: "#ffffff",
        "surface-2": "#fafbfc",
        "surface-3": "#f3f4f7",

        // Brand — violet, the deliberate accent (Tailwind violet, extended)
        brand: {
          DEFAULT: "#7c3aed",
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },

        // Deep ink for the sidebar / nav — near-black with a cool indigo undertone
        navy: {
          DEFAULT: "#0d0e16",
          950: "#08080d",
          900: "#0d0e16",
          800: "#15161f",
          700: "#1e1f2b",
          600: "#2a2b3a",
          500: "#3a3b4d",
        },

        // Cool neutral ink scale for text (a refined, slightly cool slate)
        ink: {
          50:  "#f7f8fa",
          100: "#eef0f4",
          200: "#dfe2e9",
          300: "#c5cad6",
          400: "#9aa1b2",
          500: "#6c7384",
          600: "#4d5362",
          700: "#383d49",
          800: "#23262f",
          900: "#13151b",
        },

        // Hairlines
        line: "#e8e9ee",
        "line-soft": "#eef0f4",
        "line-strong": "#dcdee5",
      },
      fontFamily: {
        sans: ["Assistant", "Inter", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "Assistant", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        // Tightened, deliberate display sizes (with sensible line-heights + tracking)
        "display": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "title":   ["1.5rem",  { lineHeight: "1.2", letterSpacing: "-0.015em" }],
      },
      boxShadow: {
        // Layered, realistic, neutral shadows (ambient + contact) — the premium look
        xs:           "0 1px 2px rgba(17,19,28,0.05)",
        card:         "0 1px 2px rgba(17,19,28,0.04), 0 4px 16px rgba(17,19,28,0.05)",
        "card-hover": "0 2px 4px rgba(17,19,28,0.05), 0 12px 32px rgba(17,19,28,0.10)",
        pop:          "0 1px 2px rgba(17,19,28,0.06), 0 18px 48px rgba(17,19,28,0.18)",
        // Brand glow — reserved for interactive brand elements
        glow:         "0 6px 16px rgba(124,58,237,0.28)",
        "glow-lg":    "0 10px 28px rgba(124,58,237,0.38)",
        // Inset top-highlight for buttons / dark surfaces
        "inner-top":  "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      borderRadius: {
        "lg": "10px",
        "xl": "12px",
        "2xl": "16px",
        "3xl": "22px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease",
        "slide-up": "slide-up 0.35s cubic-bezier(0.16,1,0.3,1)",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16,1,0.3,1)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
