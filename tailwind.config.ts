import type { Config } from "tailwindcss";

/**
 * praxisAI — "Clinic OS" design system.
 * Teal identity, near-black sidebar, crisp white cards, rich data ink.
 * Completely new palette — confident, modern, clinical.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Canvas
        bg:         "#F4F6FA",
        surface:    "#FFFFFF",
        "surface-2":"#F9FAFB",
        "surface-3":"#F1F4F8",

        // Brand — teal: medical, precise, trustworthy
        brand: {
          DEFAULT: "#0D9488",
          50:  "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
          800: "#115E59",
          900: "#134E4A",
          950: "#042F2E",
        },

        // Electric — blue for AI/interactive accents
        electric: {
          DEFAULT: "#3B82F6",
          50:  "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },

        // Sidebar / nav rail — near-black, slightly blue-shifted
        rail: {
          DEFAULT: "#0C111D",
          900: "#0C111D",
          800: "#111827",
          700: "#1C2536",
          600: "#293548",
          500: "#3A4A5C",
          400: "#5A6A7C",
          300: "#8B9CB0",
        },

        // Ink — cool neutral text scale
        ink: {
          50:  "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
        },

        // Hairlines
        line:         "#E8ECF2",
        "line-soft":  "#F1F4F8",
        "line-strong":"#D1D9E4",

        // Status
        success: { DEFAULT: "#16A34A", light: "#DCFCE7", text: "#15803D" },
        warning: { DEFAULT: "#D97706", light: "#FEF3C7", text: "#B45309" },
        danger:  { DEFAULT: "#DC2626", light: "#FEE2E2", text: "#B91C1C" },
      },
      fontFamily: {
        sans:    ["Inter", "Assistant", "system-ui", "sans-serif"],
        display: ["Inter", "Assistant", "sans-serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "brand-gradient":  "linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)",
        "electric-gradient":"linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)",
        "dark-gradient":   "linear-gradient(180deg, #1C2536 0%, #0C111D 100%)",
        "hero-gradient":   "linear-gradient(135deg, #0D9488 0%, #3B82F6 50%, #7C3AED 100%)",
      },
      boxShadow: {
        xs:             "0 1px 2px rgba(15,23,42,0.04)",
        sm:             "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
        card:           "0 0 0 1px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.04)",
        "card-hover":   "0 0 0 1px rgba(13,148,136,0.15), 0 4px 8px rgba(15,23,42,0.05), 0 12px 28px rgba(15,23,42,0.09)",
        pop:            "0 0 0 1px rgba(15,23,42,0.08), 0 8px 24px rgba(15,23,42,0.12), 0 32px 64px rgba(15,23,42,0.18)",
        glow:           "0 0 0 1px rgba(13,148,136,0.2), 0 4px 16px rgba(13,148,136,0.25)",
        "glow-electric":"0 0 0 1px rgba(59,130,246,0.2), 0 4px 16px rgba(59,130,246,0.25)",
        inner:          "inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      borderRadius: {
        "sm":  "6px",
        "md":  "8px",
        "lg":  "10px",
        "xl":  "12px",
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "28px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "shimmer": {
          from: { backgroundPosition: "-200% 0" },
          to:   { backgroundPosition: "200% 0" },
        },
        "pulse-ring": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.8" },
          "50%":      { transform: "scale(1.15)", opacity: "0.3" },
        },
      },
      animation: {
        "fade-in":        "fade-in 0.25s ease both",
        "slide-up":       "slide-up 0.3s cubic-bezier(0.16,1,0.3,1) both",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in":       "scale-in 0.22s cubic-bezier(0.16,1,0.3,1) both",
        "shimmer":        "shimmer 2s linear infinite",
        "pulse-ring":     "pulse-ring 2s ease-in-out infinite",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
