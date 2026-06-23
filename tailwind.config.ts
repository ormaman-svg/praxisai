import type { Config } from "tailwindcss";

/**
 * praxisAI design system — "Aurora Clinical".
 * A confident, premium clinical product: a cool paper canvas with a faint
 * aurora at the top, a violet→indigo brand paired with a cyan "AI" accent,
 * layered realistic shadows, generous radii, and a deep ink navigation rail.
 * Token names are stable (brand / navy / ink / line / accent) so every
 * component inherits the language; values define the look.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Canvas + surfaces
        bg: "#f4f5f9",
        surface: "#ffffff",
        "surface-2": "#fafbfd",
        "surface-3": "#f1f2f7",

        // Brand — violet→indigo, the primary identity
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

        // Accent — cyan/sky, the "AI / intelligence" highlight (data, focus, live)
        accent: {
          DEFAULT: "#06b6d4",
          50:  "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
        },

        // Deep ink for the sidebar / nav — near-black with a cool indigo undertone
        navy: {
          DEFAULT: "#0b0c14",
          950: "#07070c",
          900: "#0b0c14",
          800: "#12131c",
          700: "#1b1c28",
          600: "#272838",
          500: "#383a4d",
        },

        // Cool neutral ink scale for text
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
        line: "#e7e8ef",
        "line-soft": "#eef0f4",
        "line-strong": "#d8dae3",
      },
      fontFamily: {
        sans: ["Assistant", "Inter", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "Assistant", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "display": ["2.5rem",  { lineHeight: "1.06", letterSpacing: "-0.025em" }],
        "title":   ["1.6rem",  { lineHeight: "1.15", letterSpacing: "-0.02em" }],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
        "brand-accent": "linear-gradient(120deg, #7c3aed 0%, #6366f1 50%, #06b6d4 100%)",
      },
      boxShadow: {
        xs:           "0 1px 2px rgba(17,19,28,0.05)",
        card:         "0 1px 2px rgba(17,19,28,0.04), 0 4px 16px rgba(17,19,28,0.05)",
        "card-hover": "0 2px 4px rgba(17,19,28,0.05), 0 14px 36px rgba(17,19,28,0.11)",
        pop:          "0 1px 2px rgba(17,19,28,0.06), 0 20px 52px rgba(17,19,28,0.20)",
        glow:         "0 6px 18px rgba(124,58,237,0.30)",
        "glow-lg":    "0 12px 32px rgba(124,58,237,0.40)",
        "glow-accent":"0 6px 18px rgba(6,182,212,0.30)",
        "inner-top":  "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      borderRadius: {
        "lg": "10px",
        "xl": "12px",
        "2xl": "16px",
        "3xl": "22px",
        "4xl": "28px",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "aurora-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(0,-2%,0) scale(1.05)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease",
        "slide-up": "slide-up 0.4s cubic-bezier(0.16,1,0.3,1)",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16,1,0.3,1)",
        "aurora": "aurora-drift 14s ease-in-out infinite",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
