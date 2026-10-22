/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        arcade: {
          bg: '#0a0b10',
          card: '#12141f',
          border: '#1f2438',
          cyan: '#00f3ff',
          neonPink: '#ff007f',
          neonAmber: '#ffaa00',
          neonGreen: '#00ff66',
          purple: '#8b5cf6',
          accent: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Orbitron', 'Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 20px -3px rgba(0, 243, 255, 0.4)',
        'neon-pink': '0 0 20px -3px rgba(255, 0, 127, 0.4)',
        'neon-green': '0 0 20px -3px rgba(0, 255, 102, 0.4)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.85', transform: 'scale(1.02)' },
        },
      },
    },
  },
  plugins: [],
}
