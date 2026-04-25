import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#FFD700',
          dark:    '#B8860B',
          glow:    '#FFA500',
        },
        brand: {
          bg:      '#0a0a0f',
          surface: '#12121a',
          card:    '#1a1a2e',
          border:  '#2a2a3e',
        },
      },
      boxShadow: {
        gold: '0 0 20px rgba(255, 215, 0, 0.4), 0 0 40px rgba(255, 165, 0, 0.2)',
        'gold-sm': '0 0 8px rgba(255, 215, 0, 0.3)',
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(255,215,0,0.4)' },
          '50%':       { boxShadow: '0 0 35px rgba(255,165,0,0.7)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
