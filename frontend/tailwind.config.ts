import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        base:      'var(--bg-base)',
        surface:   'var(--bg-surface)',
        elevated:  'var(--bg-elevated)',
        border:    'var(--border)',
        primary:   'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        blue:      'var(--accent-blue)',
        green:     'var(--accent-green)',
        amber:     'var(--accent-amber)',
        red:       'var(--accent-red)',
        purple:    'var(--accent-purple)',
      },
      fontFamily: {
        mono: ['"DM Mono"', 'monospace'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        code: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
