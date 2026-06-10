import type { Config } from 'tailwindcss'
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'Inter', 'sans-serif'],
        heading: ['Plus Jakarta Sans', 'Heebo', 'sans-serif'],
      },
      colors: {
        sidebar: '#0f1923',
        accent: '#2563eb',
        ink: { DEFAULT: '#0f172a', 2: '#475569', 3: '#94a3b8' },
        line: { DEFAULT: '#e2e8f0', soft: '#f1f5f9' },
      },
    },
  },
  plugins: [],
}
export default config
