import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', './index.html', './dashboard.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#1e3a5f',
        positive: '#22c55e',
        alert: '#ef4444',
        bg: '#f8fafc',
        text: '#1e293b',
        darkBg: '#0f172a',
        darkText: '#f1f5f9',
      },
    },
  },
  plugins: [],
} satisfies Config;
