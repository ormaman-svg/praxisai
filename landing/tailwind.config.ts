import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f8fafc",
        navy: { DEFAULT: "#0f1923", 800: "#16222e", 700: "#1d2c3a" },
        brand: { DEFAULT: "#2563eb", 600: "#2563eb", 700: "#1d4ed8", 50: "#eff6ff", 100: "#dbeafe" },
        line: "#e2e8f0",
      },
      fontFamily: {
        sans: ['Assistant', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Assistant', 'sans-serif'],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)",
        pop: "0 10px 30px rgba(15,23,42,.12)",
      },
    },
  },
  plugins: [],
};
export default config;
