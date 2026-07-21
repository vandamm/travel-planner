/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Lora', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Ink neutrals — text, from darkest to lightest.
        ink: {
          DEFAULT: '#1f1d18',
          frame: '#26231d',
          600: '#5b554a',
          500: '#8f8775',
          450: '#9a917f',
          400: '#a8a08d',
          300: '#b3aa96',
          200: '#c2bba8',
        },
        // Warm surfaces.
        surface: {
          DEFAULT: '#faf8f1',
          chip: '#f0ece2',
        },
        // Border tones.
        edge: {
          DEFAULT: '#ddd6c7',
          100: '#e6dfce',
          150: '#e6e1d5',
          200: '#ece6d8',
          250: '#d8d0c0',
          300: '#cfc9bb',
          350: '#c9c1b1',
        },
        // City hues (day-header colours).
        city: {
          vermilion: '#c0392b',
          pine: '#5f6f44',
          indigo: '#3a4a5c',
          plum: '#8a5a78',
        },
        // Category-chip triads: text / bg / border.
        transit: { DEFAULT: '#a8392b', bg: '#f7e6e2', border: '#e7c3bb' },
        outdoor: { DEFAULT: '#4f5e38', bg: '#edf1e1', border: '#d2dcbb' },
        indoor: { DEFAULT: '#34465a', bg: '#e6ecf2', border: '#cfd9e4' },
      },
      borderRadius: {
        frame: '5px',
        card: '4px',
        chip: '3px',
      },
      // Mobile sheet slide-up. Guard motion at the call site with
      // `motion-reduce:animate-none` — do not drop that guard.
      keyframes: {
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        // Anchored popover reveal (date/time pickers). Guard at the call site
        // with `motion-reduce:animate-none`.
        'popover-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'sheet-in': 'sheet-in 150ms ease-out',
        'popover-in': 'popover-in 120ms ease-out',
      },
    },
  },
  plugins: [],
}
