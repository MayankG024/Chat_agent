/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#dce5ff',
          300: '#c2d2ff',
          400: '#9cb5ff',
          500: '#6b8cff',
          600: '#4762ff',
          700: '#3449e6',
          800: '#2b3cb3',
          900: '#26348f',
          950: '#1b2154',
        }
      }
    },
  },
  plugins: [],
}
