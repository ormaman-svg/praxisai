import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f5f4fa",
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
        },
        navy: {
          DEFAULT: "#0c0c14",
          900: "#09090f",
          800: "#111119",
          700: "#1c1c2e",
          600: "#252540",
        },
        line: "#ebe9f2",
      },
      fontFamily: {
        sans: ['Assistant', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Assistant', 'sans-serif'],
      },
      boxShadow: {
        card:         "0 1px 2px rgba(0,0,0,0.03), 0 4px 20px rgba(100,60,200,0.06)",
        "card-hover": "0 2px 4px rgba(0,0,0,0.04), 0 8px 32px rgba(100,60,200,0.10)",
        pop:          "0 12px 44px rgba(15,10,40,0.18)",
        glow:         "0 4px 14px rgba(124,58,237,0.32)",
        "glow-lg":    "0 8px 28px rgba(124,58,237,0.42)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};
export default config;
