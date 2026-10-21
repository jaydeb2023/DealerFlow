import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // deep navy -> professional blue, with a cyan accent
        df: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
          500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e3a8a', 900: '#0b1b46', 950: '#071233',
        },
        cyan: { 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2' },
      },
      fontFamily: { sans: ['var(--font-inter)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
export default config
