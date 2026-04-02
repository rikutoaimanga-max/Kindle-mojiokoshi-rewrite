/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        neon: {
          cyan:   '#00f5ff',
          purple: '#bf5fff',
          pink:   '#ff2d9b',
          green:  '#00ff88',
          yellow: '#ffe600',
        },
        dark: {
          950: '#05050f',
          900: '#0a0a1a',
          800: '#0f0f24',
          700: '#16162e',
          600: '#1e1e3a',
          500: '#272748',
        },
      },
      boxShadow: {
        'neon-cyan':   '0 0 8px #00f5ff, 0 0 20px rgba(0,245,255,0.3)',
        'neon-purple': '0 0 8px #bf5fff, 0 0 20px rgba(191,95,255,0.3)',
        'neon-pink':   '0 0 8px #ff2d9b, 0 0 20px rgba(255,45,155,0.3)',
        'neon-green':  '0 0 8px #00ff88, 0 0 20px rgba(0,255,136,0.3)',
        'neon-btn':    '0 0 12px rgba(0,245,255,0.4), inset 0 0 12px rgba(0,245,255,0.05)',
        'glass':       '0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        'neon-gradient':    'linear-gradient(135deg, #00f5ff, #bf5fff)',
        'purple-gradient':  'linear-gradient(135deg, #7c3aed, #bf5fff)',
        'green-gradient':   'linear-gradient(135deg, #00ff88, #00b4d8)',
        'grid-dark':        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='rgba(0,245,255,0.05)' stroke-width='1'/%3E%3C/svg%3E\")",
      },
      animation: {
        'pulse-neon': 'pulseNeon 2.5s ease-in-out infinite',
        'float':      'float 4s ease-in-out infinite',
        'scan':       'scan 3s linear infinite',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
}
